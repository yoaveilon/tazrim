import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';
import { isExpenseDueInMonth } from '../utils/expense-frequency.js';
import dayjs from 'dayjs';

const router = Router();

// GET /api/dashboard/summary?month=YYYY-MM
router.get('/summary', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const month = (req.query.month as string) || dayjs().format('YYYY-MM');

  // Total expenses by category
  const expensesByCategory = db.prepare(`
    SELECT
      c.name, c.color, c.icon,
      SUM(ABS(t.charged_amount)) as amount
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    WHERE strftime('%Y-%m', COALESCE(t.processed_date, t.date)) = ?
      AND t.charged_amount > 0
      AND c.is_expense = 1
      AND t.user_id = ?
    GROUP BY c.id
    ORDER BY amount DESC
  `).all(month, userId) as any[];

  const totalExpenses = expensesByCategory.reduce((sum: number, c: any) => sum + c.amount, 0);

  // Income from income_records (via income_sources owned by user)
  const incomeRow = db.prepare(`
    SELECT COALESCE(SUM(COALESCE(ir.actual_amount, ir.expected_amount)), 0) as total
    FROM income_records ir
    JOIN income_sources is2 ON ir.income_source_id = is2.id
    WHERE ir.month = ? AND is2.user_id = ?
  `).get(month, userId) as any;

  // Variable income: credit card refunds (negative charged_amount)
  const variableIncomeRow = db.prepare(`
    SELECT COALESCE(SUM(ABS(charged_amount)), 0) as total
    FROM transactions
    WHERE strftime('%Y-%m', COALESCE(processed_date, date)) = ?
      AND charged_amount < 0
      AND user_id = ?
  `).get(month, userId) as any;

  const totalIncome = incomeRow.total + variableIncomeRow.total;

  // Add percentages
  const breakdown = expensesByCategory.map((c: any) => ({
    name: c.name,
    amount: c.amount,
    color: c.color,
    icon: c.icon,
    percentage: totalExpenses > 0 ? Math.round((c.amount / totalExpenses) * 100) : 0,
  }));

  res.json({
    totalIncome,
    totalExpenses,
    balance: totalIncome - totalExpenses,
    expensesByCategory: breakdown,
  });
});

// GET /api/dashboard/cashflow?month=YYYY-MM
// The core cash flow engine:
// 1. Forecasts income from income_sources
// 2. Forecasts expenses per category from historical averages (last 3 months) + fixed expenses
// 3. Compares actual vs forecast per category
// 4. Calculates "remaining to spend" = expected income - total forecast expenses already spent
router.get('/cashflow', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const month = (req.query.month as string) || dayjs().format('YYYY-MM');
  const HISTORY_MONTHS = 3;

  // ---- 1. INCOME ----
  // Auto-generate income records for the month
  const activeSources = db.prepare(
    'SELECT * FROM income_sources WHERE is_active = 1 AND user_id = ?'
  ).all(userId) as any[];

  const insertIncomeStmt = db.prepare(`
    INSERT OR IGNORE INTO income_records (income_source_id, month, expected_amount, status)
    VALUES (?, ?, ?, 'expected')
  `);
  for (const source of activeSources) {
    insertIncomeStmt.run(source.id, month, source.amount);
  }

  const incomeRecords = db.prepare(`
    SELECT ir.*, is2.name
    FROM income_records ir
    JOIN income_sources is2 ON ir.income_source_id = is2.id
    WHERE ir.month = ? AND is2.user_id = ?
  `).all(month, userId) as any[];

  const fixedIncome = incomeRecords.reduce((s: number, r: any) => s + r.expected_amount, 0);
  const actualFixedIncome = incomeRecords.reduce((s: number, r: any) => s + (r.actual_amount || 0), 0);

  // Variable income: credit card refunds (negative charged_amount)
  const variableIncomeRow = db.prepare(`
    SELECT COALESCE(SUM(ABS(charged_amount)), 0) as total
    FROM transactions
    WHERE strftime('%Y-%m', COALESCE(processed_date, date)) = ?
      AND charged_amount < 0
      AND user_id = ?
  `).get(month, userId) as any;
  const variableIncome = variableIncomeRow.total;

  const expectedIncome = fixedIncome + variableIncome;
  const actualIncome = actualFixedIncome + variableIncome;

  // ---- 2. HISTORICAL AVERAGES PER CATEGORY ----
  // Use ALL available months as history (up to the current month, excluding it)
  // so even with limited data we get the best possible forecast
  const historicalByCategory = db.prepare(`
    SELECT
      c.id as category_id, c.name, c.icon, c.color,
      SUM(t.charged_amount) as total,
      COUNT(DISTINCT strftime('%Y-%m', COALESCE(t.processed_date, t.date))) as months_count
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ?
      AND t.charged_amount > 0
      AND c.is_expense = 1
      AND strftime('%Y-%m', COALESCE(t.processed_date, t.date)) < ?
    GROUP BY c.id
  `).all(userId, month) as any[];

  // ---- 3. FIXED EXPENSES PER CATEGORY ----
  // Fetch all active fixed expenses and filter by frequency (bimonthly check)
  const allFixedExpenses = db.prepare(`
    SELECT category_id, amount, frequency, start_month
    FROM fixed_expenses
    WHERE is_active = 1 AND user_id = ? AND category_id IS NOT NULL
  `).all(userId) as any[];

  const fixedByCategory = new Map<number, number>();
  for (const fe of allFixedExpenses) {
    if (!isExpenseDueInMonth(fe.frequency, fe.start_month, month)) continue;
    fixedByCategory.set(fe.category_id, (fixedByCategory.get(fe.category_id) || 0) + fe.amount);
  }

  // ---- 3b. MANUAL FORECAST OVERRIDES ----
  const forecastOverrides = db.prepare(`
    SELECT category_id, monthly_budget
    FROM category_forecast_overrides
    WHERE user_id = ?
  `).all(userId) as any[];

  const overrideMap = new Map<number, number>();
  for (const o of forecastOverrides) {
    overrideMap.set(o.category_id, o.monthly_budget);
  }

  // Fixed expenses without category (filter by frequency)
  const fixedNoCatRows = db.prepare(`
    SELECT amount, frequency, start_month
    FROM fixed_expenses
    WHERE is_active = 1 AND user_id = ? AND category_id IS NULL
  `).all(userId) as any[];
  let fixedNoCategory = 0;
  for (const fe of fixedNoCatRows) {
    if (isExpenseDueInMonth(fe.frequency, fe.start_month, month)) {
      fixedNoCategory += fe.amount;
    }
  }

  // ---- 4. ACTUAL EXPENSES THIS MONTH PER CATEGORY ----
  const actualByCategory = db.prepare(`
    SELECT
      c.id as category_id, c.name, c.icon, c.color,
      SUM(t.charged_amount) as actual
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ?
      AND t.charged_amount > 0
      AND c.is_expense = 1
      AND strftime('%Y-%m', COALESCE(t.processed_date, t.date)) = ?
    GROUP BY c.id
  `).all(userId, month) as any[];

  const actualMap = new Map<number, number>();
  for (const a of actualByCategory) {
    actualMap.set(a.category_id, a.actual);
  }

  // ---- 4b. MANUAL FIXED EXPENSE PAYMENTS THIS MONTH ----
  // Add payments marked manually (not through credit card) to actual expenses
  const manualPayments = db.prepare(`
    SELECT fe.category_id, SUM(fep.amount_paid) as total
    FROM fixed_expense_payments fep
    JOIN fixed_expenses fe ON fep.fixed_expense_id = fe.id
    WHERE fep.month = ? AND fep.user_id = ?
    GROUP BY fe.category_id
  `).all(month, userId) as any[];

  for (const mp of manualPayments) {
    if (mp.category_id) {
      const existing = actualMap.get(mp.category_id) || 0;
      actualMap.set(mp.category_id, existing + mp.total);
    }
  }

  // Also get total of uncategorized manual payments
  const manualNoCatRow = db.prepare(`
    SELECT COALESCE(SUM(fep.amount_paid), 0) as total
    FROM fixed_expense_payments fep
    JOIN fixed_expenses fe ON fep.fixed_expense_id = fe.id
    WHERE fep.month = ? AND fep.user_id = ? AND fe.category_id IS NULL
  `).get(month, userId) as any;
  const manualNoCategory = manualNoCatRow.total;

  // ---- 4c. BUILD WEEK RANGES FOR THE MONTH ----
  const monthStart = dayjs(month + '-01');
  const daysInMonth = monthStart.daysInMonth();
  const weekRanges: { label: string; startDay: number; endDay: number; startDate: string; endDate: string }[] = [];
  let weekCurrentDay = 1;
  let weekNumCounter = 1;
  while (weekCurrentDay <= daysInMonth) {
    const sd = monthStart.date(weekCurrentDay);
    let ed = weekCurrentDay;
    while (ed < daysInMonth && sd.date(ed).day() !== 6) { ed++; }
    ed = Math.min(ed, daysInMonth);
    weekRanges.push({
      label: `שבוע ${weekNumCounter}`,
      startDay: weekCurrentDay,
      endDay: ed,
      startDate: monthStart.date(weekCurrentDay).format('YYYY-MM-DD'),
      endDate: monthStart.date(ed).format('YYYY-MM-DD'),
    });
    weekCurrentDay = ed + 1;
    weekNumCounter++;
  }

  // Prepared statements for weekly data per category
  // NOTE: For weekly breakdown WITHIN a month, we use `date` (actual transaction date)
  // not `processed_date` (which is always the 1st of the month for billing purposes).
  // The month filter still uses COALESCE(processed_date, date) to pick the right month.
  const weeklyActualStmt = db.prepare(`
    SELECT COALESCE(SUM(charged_amount), 0) as total
    FROM transactions
    WHERE user_id = ? AND charged_amount > 0
      AND category_id = ?
      AND strftime('%Y-%m', COALESCE(processed_date, date)) = ?
      AND CAST(strftime('%d', date) AS INTEGER) >= ?
      AND CAST(strftime('%d', date) AS INTEGER) <= ?
  `);

  const weeklyTransactionsStmt = db.prepare(`
    SELECT id, date, description, charged_amount
    FROM transactions
    WHERE user_id = ? AND charged_amount > 0
      AND category_id = ?
      AND strftime('%Y-%m', COALESCE(processed_date, date)) = ?
      AND CAST(strftime('%d', date) AS INTEGER) >= ?
      AND CAST(strftime('%d', date) AS INTEGER) <= ?
    ORDER BY date DESC
  `);

  // Prepared statement: fixed expense payments per category (for weekly breakdown)
  const fixedPaymentsStmt = db.prepare(`
    SELECT fep.id, fe.name as description, fep.amount_paid as charged_amount, fe.billing_day
    FROM fixed_expense_payments fep
    JOIN fixed_expenses fe ON fep.fixed_expense_id = fe.id
    WHERE fep.month = ? AND fep.user_id = ? AND fe.category_id = ?
  `);

  // ---- 5. BUILD CATEGORY FORECASTS ----
  // Collect all expense categories that have either history or actuals
  const allCategories = db.prepare(
    'SELECT id, name, icon, color FROM categories WHERE is_expense = 1 ORDER BY sort_order'
  ).all() as any[];

  const histMap = new Map<number, { total: number; months: number }>();
  for (const h of historicalByCategory) {
    histMap.set(h.category_id, { total: h.total, months: h.months_count });
  }

  const categoryForecasts: any[] = [];
  let totalForecast = 0;
  let totalActual = 0;

  for (const cat of allCategories) {
    const hist = histMap.get(cat.id);
    const fixed = fixedByCategory.get(cat.id) || 0;
    const actual = actualMap.get(cat.id) || 0;

    // Forecast logic:
    // 0. If user set a manual override — use that (highest priority)
    // 1. If we have history: use monthly average (or fixed if higher)
    // 2. If we only have fixed expenses: use those
    // 3. If no history and no fixed: use actual spending this month as forecast
    let forecast = 0;
    let monthsOfData = 0;
    const override = overrideMap.get(cat.id);
    const hasOverride = override !== undefined;

    if (hasOverride) {
      forecast = override;
      monthsOfData = -1; // Special marker: manual override
    } else if (hist && hist.months > 0) {
      const histAvg = Math.round(hist.total / hist.months);
      forecast = Math.max(histAvg, fixed);
      monthsOfData = hist.months;
    } else if (fixed > 0) {
      forecast = fixed;
    } else if (actual > 0) {
      // No historical data — use actual as the "forecast" so no deviation is shown
      forecast = actual;
      monthsOfData = 0;
    }

    // Skip categories with no forecast and no actual spend
    if (forecast === 0 && actual === 0) continue;

    // Weekly breakdown for this category
    // Fetch paid fixed expenses for this category to inject into weekly breakdown
    const fixedPayments = fixedPaymentsStmt.all(month, userId, cat.id) as any[];

    // Step 1: get actuals per week (credit card transactions only)
    const weekActuals = weekRanges.map((week) => {
      const row = weeklyActualStmt.get(userId, cat.id, month, week.startDay, week.endDay) as any;
      let total = row.total as number;
      // Add fixed expense payments that fall in this week (by billing_day)
      for (const fp of fixedPayments) {
        if (fp.billing_day >= week.startDay && fp.billing_day <= week.endDay) {
          total += fp.charged_amount;
        }
      }
      return total;
    });

    // Step 2: base budget per week (split among weeks with spending)
    const weeksWithSpending = weekActuals.filter(a => a > 0).length;
    const effectiveWeeks = weeksWithSpending > 0 ? weeksWithSpending : weekRanges.length;
    const baseBudgetPerWeek = forecast > 0 ? Math.round(forecast / effectiveWeeks) : 0;

    // Step 3: carry over leftover from past weeks to future weeks
    // Past weeks = weeks whose endDay < today's day of month
    const todayDay = dayjs().date();
    let carryOver = 0;
    const pastWeekLeftovers: number[] = [];

    for (let i = 0; i < weekRanges.length; i++) {
      const isPastWeek = weekRanges[i].endDay < todayDay;
      if (isPastWeek && weekActuals[i] > 0) {
        const leftover = Math.max(0, baseBudgetPerWeek - weekActuals[i]);
        carryOver += leftover;
        pastWeekLeftovers.push(leftover);
      } else {
        pastWeekLeftovers.push(0);
      }
    }

    // Count future weeks (with spending or not yet passed) to distribute carry-over
    const futureWeeksWithSpending = weekRanges.filter(
      (w, i) => w.endDay >= todayDay && weekActuals[i] > 0
    ).length;
    const futureWeeksCount = weekRanges.filter(w => w.endDay >= todayDay).length;
    const distributeToWeeks = futureWeeksWithSpending > 0 ? futureWeeksWithSpending : futureWeeksCount;
    const carryOverPerWeek = distributeToWeeks > 0 ? Math.round(carryOver / distributeToWeeks) : 0;

    // Step 4: build breakdown with carry-over applied to future weeks
    const weeklyBreakdown = weekRanges.map((week, i) => {
      const weekActual = weekActuals[i];
      const isPastWeek = week.endDay < todayDay;
      const transactions = weeklyTransactionsStmt.all(userId, cat.id, month, week.startDay, week.endDay) as any[];

      let remaining: number;
      if (weekActual === 0 || isPastWeek) {
        // No spending or past week — show 0 (leftover already carried forward)
        remaining = 0;
      } else {
        // Current/future week — gets base budget + share of carry-over
        remaining = Math.max(0, (baseBudgetPerWeek + carryOverPerWeek) - weekActual);
      }

      // Merge fixed expense payments into this week's transactions
      const txnList = transactions.map((t: any) => ({
        id: t.id,
        date: t.date,
        description: t.description,
        charged_amount: t.charged_amount,
      }));

      for (const fp of fixedPayments) {
        if (fp.billing_day >= week.startDay && fp.billing_day <= week.endDay) {
          txnList.push({
            id: -fp.id, // Negative ID to distinguish from regular transactions
            date: `${month}-${String(fp.billing_day).padStart(2, '0')}`,
            description: `קבועה: ${fp.description}`,
            charged_amount: fp.charged_amount,
          });
        }
      }

      // Sort by date descending
      txnList.sort((a: any, b: any) => b.date.localeCompare(a.date));

      return {
        label: week.label,
        startDay: week.startDay,
        endDay: week.endDay,
        actual: weekActual,
        remaining,
        transactions: txnList,
      };
    });

    categoryForecasts.push({
      category_id: cat.id,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      forecast,
      actual,
      difference: forecast - actual,
      monthsOfData,
      weeklyBreakdown,
    });

    totalForecast += forecast;
    totalActual += actual;
  }

  // Add uncategorized fixed expenses to forecast
  totalForecast += fixedNoCategory;

  // Add uncategorized manual payments to actual total
  totalActual += manualNoCategory;

  // Sort: over-budget first (negative difference), then by actual desc
  categoryForecasts.sort((a: any, b: any) => a.difference - b.difference);

  // ---- 6. REMAINING TO SPEND ----
  // remaining = expected income - total forecasted expenses
  // This shows how much free money is left after all forecasted/budgeted categories
  const remainingToSpend = expectedIncome - totalForecast;

  res.json({
    expectedIncome,
    actualIncome,
    variableIncome,
    totalForecastExpenses: totalForecast,
    totalActualExpenses: totalActual,
    categoryForecasts,
    remainingToSpend,
  });
});

// GET /api/dashboard/weekly?month=YYYY-MM
// Breaks the month into weeks, showing forecast vs actual per week
router.get('/weekly', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const month = (req.query.month as string) || dayjs().format('YYYY-MM');

  const monthStart = dayjs(month + '-01');
  const daysInMonth = monthStart.daysInMonth();

  // Build week ranges (Sun-Sat based, partial first/last weeks)
  const weeks: { label: string; startDay: number; endDay: number; startDate: string; endDate: string }[] = [];
  let currentDay = 1;
  let weekNum = 1;

  while (currentDay <= daysInMonth) {
    const startDate = monthStart.date(currentDay);
    // End the week on Saturday or end of month
    let endDay = currentDay;
    while (endDay < daysInMonth && startDate.date(endDay).day() !== 6) {
      endDay++;
    }
    // Make sure the end day is valid
    endDay = Math.min(endDay, daysInMonth);

    weeks.push({
      label: `שבוע ${weekNum}`,
      startDay: currentDay,
      endDay,
      startDate: monthStart.date(currentDay).format('YYYY-MM-DD'),
      endDate: monthStart.date(endDay).format('YYYY-MM-DD'),
    });

    currentDay = endDay + 1;
    weekNum++;
  }

  // --- Historical weekly averages ---
  // Get ALL historical months and their daily expenses, then compute average per-week-position
  const historicalMonths = db.prepare(`
    SELECT DISTINCT strftime('%Y-%m', COALESCE(processed_date, date)) as month
    FROM transactions
    WHERE user_id = ? AND charged_amount > 0 AND strftime('%Y-%m', COALESCE(processed_date, date)) < ?
    ORDER BY month
  `).all(userId, month) as any[];

  const numHistMonths = historicalMonths.length;

  // For each week, get actual + historical forecast
  const weeklyData = weeks.map((week) => {
    // Actual spend this month for this week range
    const actualRow = db.prepare(`
      SELECT COALESCE(SUM(charged_amount), 0) as total
      FROM transactions
      WHERE user_id = ? AND charged_amount > 0
        AND COALESCE(processed_date, date) >= ? AND COALESCE(processed_date, date) <= ?
    `).get(userId, week.startDate, week.endDate) as any;

    // Historical average for same day-range across past months
    let forecast = 0;
    if (numHistMonths > 0) {
      const histRow = db.prepare(`
        SELECT COALESCE(SUM(charged_amount), 0) as total
        FROM transactions
        WHERE user_id = ? AND charged_amount > 0
          AND strftime('%Y-%m', COALESCE(processed_date, date)) < ?
          AND CAST(strftime('%d', COALESCE(processed_date, date)) AS INTEGER) >= ?
          AND CAST(strftime('%d', COALESCE(processed_date, date)) AS INTEGER) <= ?
      `).get(userId, month, week.startDay, week.endDay) as any;
      forecast = Math.round(histRow.total / numHistMonths);
    }

    return {
      label: week.label,
      days: `${week.startDay}-${week.endDay}`,
      forecast,
      actual: actualRow.total,
    };
  });

  res.json({ weeks: weeklyData });
});

// GET /api/dashboard/forecast?month=YYYY-MM
router.get('/forecast', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const month = (req.query.month as string) || dayjs().format('YYYY-MM');
  const today = dayjs();

  // Expected income
  const incomeRecords = db.prepare(`
    SELECT ir.*, is2.name, is2.expected_day
    FROM income_records ir
    JOIN income_sources is2 ON ir.income_source_id = is2.id
    WHERE ir.month = ? AND is2.user_id = ?
  `).all(month, userId) as any[];

  // Variable income (credit card refunds)
  const forecastVarIncomeRow = db.prepare(`
    SELECT COALESCE(SUM(ABS(charged_amount)), 0) as total
    FROM transactions
    WHERE strftime('%Y-%m', COALESCE(processed_date, date)) = ?
      AND charged_amount < 0
      AND user_id = ?
  `).get(month, userId) as any;
  const forecastVariableIncome = forecastVarIncomeRow.total;

  const expectedIncome = incomeRecords.reduce((sum: number, r: any) => sum + r.expected_amount, 0) + forecastVariableIncome;
  const actualIncome = incomeRecords.reduce((sum: number, r: any) => sum + (r.actual_amount || 0), 0) + forecastVariableIncome;

  // Fixed expenses (filter by frequency)
  const allForecastFixed = db.prepare(
    'SELECT * FROM fixed_expenses WHERE is_active = 1 AND user_id = ? ORDER BY billing_day'
  ).all(userId) as any[];

  const fixedExpensesDue = allForecastFixed.filter((e: any) =>
    isExpenseDueInMonth(e.frequency, e.start_month, month)
  );

  const expectedExpenses = fixedExpensesDue.reduce((sum: number, e: any) => sum + e.amount, 0);

  // Actual expenses from transactions
  const actualExpRow = db.prepare(`
    SELECT COALESCE(SUM(charged_amount), 0) as total
    FROM transactions
    WHERE strftime('%Y-%m', COALESCE(processed_date, date)) = ?
      AND charged_amount > 0
      AND user_id = ?
  `).get(month, userId) as any;

  const actualExpenses = actualExpRow.total;

  // Upcoming fixed expenses (days until billing) — only those due this month
  const monthDate = dayjs(month + '-01');
  const upcomingFixedExpenses = fixedExpensesDue.map((e: any) => {
    const billingDate = monthDate.date(Math.min(e.billing_day, monthDate.daysInMonth()));
    const daysUntil = billingDate.diff(today, 'day');
    return {
      name: e.name,
      amount: e.amount,
      billing_day: e.billing_day,
      days_until: daysUntil,
    };
  }).filter((e: any) => e.days_until >= 0)
    .sort((a: any, b: any) => a.days_until - b.days_until);

  res.json({
    expectedIncome,
    actualIncome,
    expectedExpenses,
    actualExpenses,
    upcomingFixedExpenses,
  });
});

// GET /api/dashboard/trends?months=12
router.get('/trends', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const numMonths = parseInt(req.query.months as string) || 12;

  const startMonth = dayjs().subtract(numMonths - 1, 'month').format('YYYY-MM');

  // Get expenses per month
  const expenses = db.prepare(`
    SELECT strftime('%Y-%m', COALESCE(processed_date, date)) as month, SUM(charged_amount) as total
    FROM transactions
    WHERE strftime('%Y-%m', COALESCE(processed_date, date)) >= ?
      AND charged_amount > 0
      AND user_id = ?
    GROUP BY strftime('%Y-%m', COALESCE(processed_date, date))
    ORDER BY month
  `).all(startMonth, userId) as any[];

  // Get income per month (fixed income from income_records)
  const income = db.prepare(`
    SELECT ir.month, SUM(COALESCE(ir.actual_amount, ir.expected_amount)) as total
    FROM income_records ir
    JOIN income_sources is2 ON ir.income_source_id = is2.id
    WHERE ir.month >= ? AND is2.user_id = ?
    GROUP BY ir.month
    ORDER BY ir.month
  `).all(startMonth, userId) as any[];

  // Variable income per month (credit card refunds)
  const variableIncomeByMonth = db.prepare(`
    SELECT strftime('%Y-%m', COALESCE(processed_date, date)) as month, SUM(ABS(charged_amount)) as total
    FROM transactions
    WHERE strftime('%Y-%m', COALESCE(processed_date, date)) >= ?
      AND charged_amount < 0
      AND user_id = ?
    GROUP BY strftime('%Y-%m', COALESCE(processed_date, date))
  `).all(startMonth, userId) as any[];

  const expenseMap = new Map(expenses.map((e: any) => [e.month, e.total]));
  const incomeMap = new Map(income.map((i: any) => [i.month, i.total]));
  const variableIncomeMap = new Map(variableIncomeByMonth.map((v: any) => [v.month, v.total]));

  // Build month-by-month data
  const months: any[] = [];
  let current = dayjs(startMonth + '-01');
  const end = dayjs();

  while (current.isBefore(end) || current.format('YYYY-MM') === end.format('YYYY-MM')) {
    const m = current.format('YYYY-MM');
    const inc = (incomeMap.get(m) || 0) + (variableIncomeMap.get(m) || 0);
    const exp = expenseMap.get(m) || 0;
    months.push({
      month: m,
      income: inc,
      expenses: exp,
      balance: inc - exp,
    });
    current = current.add(1, 'month');
  }

  res.json({ months });
});

// GET /api/dashboard/forecast-overrides
// Get all manual forecast overrides for this user
router.get('/forecast-overrides', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const overrides = db.prepare(`
    SELECT cfo.*, c.name as category_name, c.icon, c.color
    FROM category_forecast_overrides cfo
    JOIN categories c ON cfo.category_id = c.id
    WHERE cfo.user_id = ?
  `).all(userId);
  res.json(overrides);
});

// PUT /api/dashboard/forecast-overrides/:categoryId
// Set or update a manual forecast override for a category
router.put('/forecast-overrides/:categoryId', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const categoryId = parseInt(req.params.categoryId as string);
  const { monthly_budget } = req.body;

  if (monthly_budget === undefined || monthly_budget === null) {
    // Delete override — go back to auto-calculated
    db.prepare(
      'DELETE FROM category_forecast_overrides WHERE category_id = ? AND user_id = ?'
    ).run(categoryId, userId);
    res.json({ deleted: true });
    return;
  }

  db.prepare(`
    INSERT INTO category_forecast_overrides (category_id, user_id, monthly_budget)
    VALUES (?, ?, ?)
    ON CONFLICT(category_id, user_id) DO UPDATE SET monthly_budget = ?
  `).run(categoryId, userId, monthly_budget, monthly_budget);

  res.json({ category_id: categoryId, monthly_budget });
});

export default router;
