import { Router, Request, Response, NextFunction } from 'express';
import { getDb } from '../db/connection.js';
import { isExpenseDueInMonth } from '../utils/expense-frequency.js';
import { type Client } from '@libsql/client';
import dayjs from 'dayjs';

const router = Router();

// --- Monthly Rollover Helpers ---
async function calculateMonthSavings(db: Client, userId: number, month: string): Promise<{
  totalSavings: number;
  details: { category: string; forecast: number; actual: number; savings: number }[];
}> {
  const historicalByCategory = (await db.execute({
    sql: `SELECT c.id as category_id, c.name, SUM(t.charged_amount) as total,
               COUNT(DISTINCT strftime('%Y-%m', COALESCE(t.processed_date, t.date))) as months_count
          FROM transactions t JOIN categories c ON t.category_id = c.id
          WHERE t.user_id = ? AND t.charged_amount > 0 AND c.is_expense = 1
            AND strftime('%Y-%m', COALESCE(t.processed_date, t.date)) < ?
          GROUP BY c.id`,
    args: [userId, month],
  })).rows as any[];

  const histMap = new Map<number, { total: number; months: number }>();
  for (const h of historicalByCategory) {
    histMap.set(Number(h.category_id), { total: Number(h.total), months: Number(h.months_count) });
  }

  const allFixedExpenses = (await db.execute({
    sql: `SELECT category_id, amount, frequency, start_month FROM fixed_expenses WHERE is_active = 1 AND user_id = ? AND category_id IS NOT NULL`,
    args: [userId],
  })).rows as any[];

  const fixedByCategory = new Map<number, number>();
  for (const fe of allFixedExpenses) {
    if (!isExpenseDueInMonth(fe.frequency as string, fe.start_month as string, month)) continue;
    const catId = Number(fe.category_id);
    fixedByCategory.set(catId, (fixedByCategory.get(catId) || 0) + Number(fe.amount));
  }

  const forecastOverrides = (await db.execute({
    sql: `SELECT category_id, monthly_budget FROM category_forecast_overrides WHERE user_id = ?`,
    args: [userId],
  })).rows as any[];

  const overrideMap = new Map<number, number>();
  for (const o of forecastOverrides) {
    overrideMap.set(Number(o.category_id), Number(o.monthly_budget));
  }

  const actualByCategory = (await db.execute({
    sql: `SELECT c.id as category_id, c.name, SUM(t.charged_amount) as actual
          FROM transactions t JOIN categories c ON t.category_id = c.id
          WHERE t.user_id = ? AND t.charged_amount > 0 AND c.is_expense = 1
            AND strftime('%Y-%m', COALESCE(t.processed_date, t.date)) = ?
          GROUP BY c.id`,
    args: [userId, month],
  })).rows as any[];

  const actualMap = new Map<number, number>();
  for (const a of actualByCategory) {
    actualMap.set(Number(a.category_id), Number(a.actual));
  }

  const manualPayments = (await db.execute({
    sql: `SELECT fe.category_id, SUM(fep.amount_paid) as total
          FROM fixed_expense_payments fep JOIN fixed_expenses fe ON fep.fixed_expense_id = fe.id
          WHERE fep.month = ? AND fep.user_id = ? AND fep.matched_transaction_id IS NULL
          GROUP BY fe.category_id`,
    args: [month, userId],
  })).rows as any[];

  for (const mp of manualPayments) {
    if (mp.category_id) {
      const catId = Number(mp.category_id);
      actualMap.set(catId, (actualMap.get(catId) || 0) + Number(mp.total));
    }
  }

  const allCategories = (await db.execute(
    'SELECT id, name FROM categories WHERE is_expense = 1'
  )).rows as any[];

  const details: { category: string; forecast: number; actual: number; savings: number }[] = [];
  let totalSavings = 0;

  for (const cat of allCategories) {
    const catId = Number(cat.id);
    const hist = histMap.get(catId);
    const fixed = fixedByCategory.get(catId) || 0;
    const actual = actualMap.get(catId) || 0;
    let forecast = 0;
    const override = overrideMap.get(catId);

    if (override !== undefined) {
      forecast = override;
    } else if (hist && hist.months > 0) {
      forecast = Math.max(Math.round(hist.total / hist.months), fixed);
    } else if (fixed > 0) {
      forecast = fixed;
    } else if (actual > 0) {
      forecast = actual;
    }

    if (forecast === 0 && actual === 0) continue;
    const savings = Math.max(0, forecast - actual);
    if (savings > 0) {
      details.push({ category: cat.name as string, forecast, actual, savings });
      totalSavings += savings;
    }
  }

  return { totalSavings, details };
}

async function getOrCalculateRollover(db: Client, userId: number, month: string): Promise<number> {
  const existing = (await db.execute({
    sql: 'SELECT rollover_amount FROM monthly_rollover WHERE user_id = ? AND month = ?',
    args: [userId, month],
  })).rows[0] as any;

  if (existing) return Number(existing.rollover_amount);

  const prevMonth = dayjs(month + '-01').subtract(1, 'month').format('YYYY-MM');
  const currentMonth = dayjs().format('YYYY-MM');
  if (prevMonth >= currentMonth) return 0;

  const { totalSavings, details } = await calculateMonthSavings(db, userId, prevMonth);

  if (totalSavings > 0) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO monthly_rollover (user_id, month, source_month, rollover_amount, details) VALUES (?, ?, ?, ?, ?)`,
      args: [userId, month, prevMonth, totalSavings, JSON.stringify(details)],
    });
  }

  return totalSavings;
}

// GET /api/dashboard/summary?month=YYYY-MM
router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const month = (req.query.month as string) || dayjs().format('YYYY-MM');

    const expensesByCategory = (await db.execute({
      sql: `SELECT c.name, c.color, c.icon, SUM(ABS(t.charged_amount)) as amount
            FROM transactions t JOIN categories c ON t.category_id = c.id
            WHERE strftime('%Y-%m', COALESCE(t.processed_date, t.date)) = ?
              AND t.charged_amount > 0 AND c.is_expense = 1 AND t.user_id = ?
            GROUP BY c.id ORDER BY amount DESC`,
      args: [month, userId],
    })).rows as any[];

    const totalExpenses = expensesByCategory.reduce((sum: number, c: any) => sum + Number(c.amount), 0);

    const incomeRow = (await db.execute({
      sql: `SELECT COALESCE(SUM(COALESCE(ir.actual_amount, ir.expected_amount)), 0) as total
            FROM income_records ir JOIN income_sources is2 ON ir.income_source_id = is2.id
            WHERE ir.month = ? AND is2.user_id = ?`,
      args: [month, userId],
    })).rows[0] as any;

    const variableIncomeRow = (await db.execute({
      sql: `SELECT COALESCE(SUM(ABS(charged_amount)), 0) as total FROM transactions
            WHERE strftime('%Y-%m', COALESCE(processed_date, date)) = ? AND charged_amount < 0 AND user_id = ?`,
      args: [month, userId],
    })).rows[0] as any;

    const totalIncome = Number(incomeRow.total) + Number(variableIncomeRow.total);

    const breakdown = expensesByCategory.map((c: any) => ({
      name: c.name,
      amount: Number(c.amount),
      color: c.color,
      icon: c.icon,
      percentage: totalExpenses > 0 ? Math.round((Number(c.amount) / totalExpenses) * 100) : 0,
    }));

    res.json({ totalIncome, totalExpenses, balance: totalIncome - totalExpenses, expensesByCategory: breakdown });
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/cashflow?month=YYYY-MM
router.get('/cashflow', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const month = (req.query.month as string) || dayjs().format('YYYY-MM');

    // ---- 1. INCOME ----
    const activeSources = (await db.execute({
      sql: 'SELECT * FROM income_sources WHERE is_active = 1 AND user_id = ?',
      args: [userId],
    })).rows as any[];

    const incomeInserts = activeSources.map((s: any) => ({
      sql: `INSERT OR IGNORE INTO income_records (income_source_id, month, expected_amount, status) VALUES (?, ?, ?, 'expected')`,
      args: [s.id, month, s.amount],
    }));
    if (incomeInserts.length > 0) await db.batch(incomeInserts, 'write');

    const incomeRecords = (await db.execute({
      sql: `SELECT ir.*, is2.name FROM income_records ir
            JOIN income_sources is2 ON ir.income_source_id = is2.id
            WHERE ir.month = ? AND is2.user_id = ?`,
      args: [month, userId],
    })).rows as any[];

    const fixedIncome = incomeRecords.reduce((s: number, r: any) => s + Number(r.expected_amount), 0);
    const actualFixedIncome = incomeRecords.reduce((s: number, r: any) => s + Number(r.actual_amount || 0), 0);

    const variableIncomeRow = (await db.execute({
      sql: `SELECT COALESCE(SUM(ABS(charged_amount)), 0) as total FROM transactions
            WHERE strftime('%Y-%m', COALESCE(processed_date, date)) = ? AND charged_amount < 0 AND user_id = ?`,
      args: [month, userId],
    })).rows[0] as any;
    const variableIncome = Number(variableIncomeRow.total);

    const expectedIncome = fixedIncome + variableIncome;
    const actualIncome = actualFixedIncome + variableIncome;

    // ---- 2. HISTORICAL AVERAGES PER CATEGORY ----
    const historicalByCategory = (await db.execute({
      sql: `SELECT c.id as category_id, c.name, c.icon, c.color,
                   SUM(t.charged_amount) as total,
                   COUNT(DISTINCT strftime('%Y-%m', COALESCE(t.processed_date, t.date))) as months_count
            FROM transactions t JOIN categories c ON t.category_id = c.id
            WHERE t.user_id = ? AND t.charged_amount > 0 AND c.is_expense = 1
              AND strftime('%Y-%m', COALESCE(t.processed_date, t.date)) < ?
            GROUP BY c.id`,
      args: [userId, month],
    })).rows as any[];

    // ---- 3. FIXED EXPENSES PER CATEGORY ----
    const allFixedExpenses = (await db.execute({
      sql: `SELECT category_id, amount, frequency, start_month FROM fixed_expenses WHERE is_active = 1 AND user_id = ? AND category_id IS NOT NULL`,
      args: [userId],
    })).rows as any[];

    const fixedByCategory = new Map<number, number>();
    for (const fe of allFixedExpenses) {
      if (!isExpenseDueInMonth(fe.frequency as string, fe.start_month as string, month)) continue;
      const catId = Number(fe.category_id);
      fixedByCategory.set(catId, (fixedByCategory.get(catId) || 0) + Number(fe.amount));
    }

    // ---- 3b. FORECAST OVERRIDES ----
    const forecastOverrides = (await db.execute({
      sql: `SELECT category_id, monthly_budget FROM category_forecast_overrides WHERE user_id = ?`,
      args: [userId],
    })).rows as any[];

    const overrideMap = new Map<number, number>();
    for (const o of forecastOverrides) {
      overrideMap.set(Number(o.category_id), Number(o.monthly_budget));
    }

    // Fixed expenses without category
    const fixedNoCatRows = (await db.execute({
      sql: `SELECT amount, frequency, start_month FROM fixed_expenses WHERE is_active = 1 AND user_id = ? AND category_id IS NULL`,
      args: [userId],
    })).rows as any[];

    let fixedNoCategory = 0;
    for (const fe of fixedNoCatRows) {
      if (isExpenseDueInMonth(fe.frequency as string, fe.start_month as string, month)) {
        fixedNoCategory += Number(fe.amount);
      }
    }

    // ---- 4. ACTUAL EXPENSES THIS MONTH PER CATEGORY ----
    const actualByCategory = (await db.execute({
      sql: `SELECT c.id as category_id, c.name, c.icon, c.color, SUM(t.charged_amount) as actual
            FROM transactions t JOIN categories c ON t.category_id = c.id
            WHERE t.user_id = ? AND t.charged_amount > 0 AND c.is_expense = 1
              AND strftime('%Y-%m', COALESCE(t.processed_date, t.date)) = ?
            GROUP BY c.id`,
      args: [userId, month],
    })).rows as any[];

    const actualMap = new Map<number, number>();
    for (const a of actualByCategory) {
      actualMap.set(Number(a.category_id), Number(a.actual));
    }

    const manualPayments = (await db.execute({
      sql: `SELECT fe.category_id, SUM(fep.amount_paid) as total
            FROM fixed_expense_payments fep JOIN fixed_expenses fe ON fep.fixed_expense_id = fe.id
            WHERE fep.month = ? AND fep.user_id = ? AND fep.matched_transaction_id IS NULL
            GROUP BY fe.category_id`,
      args: [month, userId],
    })).rows as any[];

    for (const mp of manualPayments) {
      if (mp.category_id) {
        const catId = Number(mp.category_id);
        actualMap.set(catId, (actualMap.get(catId) || 0) + Number(mp.total));
      }
    }

    const manualNoCatRow = (await db.execute({
      sql: `SELECT COALESCE(SUM(fep.amount_paid), 0) as total
            FROM fixed_expense_payments fep JOIN fixed_expenses fe ON fep.fixed_expense_id = fe.id
            WHERE fep.month = ? AND fep.user_id = ? AND fe.category_id IS NULL AND fep.matched_transaction_id IS NULL`,
      args: [month, userId],
    })).rows[0] as any;
    const manualNoCategory = Number(manualNoCatRow.total);

    // ---- 4c. WEEK RANGES ----
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

    // ---- 5. BUILD CATEGORY FORECASTS ----
    const allCategories = (await db.execute(
      'SELECT id, name, icon, color FROM categories WHERE is_expense = 1 ORDER BY sort_order'
    )).rows as any[];

    const histMap = new Map<number, { total: number; months: number }>();
    for (const h of historicalByCategory) {
      histMap.set(Number(h.category_id), { total: Number(h.total), months: Number(h.months_count) });
    }

    const categoryForecasts: any[] = [];
    let totalForecast = 0;
    let totalActual = 0;
    const todayDay = dayjs().date();

    for (const cat of allCategories) {
      const catId = Number(cat.id);
      const hist = histMap.get(catId);
      const fixed = fixedByCategory.get(catId) || 0;
      const actual = actualMap.get(catId) || 0;
      let forecast = 0;
      let monthsOfData = 0;
      const override = overrideMap.get(catId);
      const hasOverride = override !== undefined;

      if (hasOverride) {
        forecast = override!;
        monthsOfData = -1;
      } else if (hist && hist.months > 0) {
        const histAvg = Math.round(hist.total / hist.months);
        forecast = Math.max(histAvg, fixed);
        monthsOfData = hist.months;
      } else if (fixed > 0) {
        forecast = fixed;
      } else if (actual > 0) {
        forecast = actual;
        monthsOfData = 0;
      }

      if (forecast === 0 && actual === 0) continue;

      // Fixed payments for this category (already paid, not matched to credit card)
      const fixedPayments = (await db.execute({
        sql: `SELECT fep.id, fe.name as description, fep.amount_paid as charged_amount, fe.billing_day
              FROM fixed_expense_payments fep JOIN fixed_expenses fe ON fep.fixed_expense_id = fe.id
              WHERE fep.month = ? AND fep.user_id = ? AND fe.category_id = ? AND fep.matched_transaction_id IS NULL`,
        args: [month, userId, catId],
      })).rows as any[];

      // Unpaid fixed expenses for this category (pending/expected)
      const unpaidFixedExpenses = (await db.execute({
        sql: `SELECT fe.id, fe.name as description, fe.amount as charged_amount, fe.billing_day, fe.frequency, fe.start_month
              FROM fixed_expenses fe
              WHERE fe.is_active = 1 AND fe.user_id = ? AND fe.category_id = ?
                AND fe.id NOT IN (
                  SELECT fep.fixed_expense_id FROM fixed_expense_payments fep
                  WHERE fep.month = ? AND fep.user_id = ?
                )`,
        args: [userId, catId, month, userId],
      })).rows as any[];

      // Filter by frequency
      const pendingFixed = unpaidFixedExpenses.filter((fe: any) =>
        isExpenseDueInMonth(fe.frequency as string || 'monthly', fe.start_month as string || null, month)
      );

      // Weekly breakdown — run all week queries in parallel
      const weekActuals = await Promise.all(weekRanges.map(async (week) => {
        const row = (await db.execute({
          sql: `SELECT COALESCE(SUM(charged_amount), 0) as total FROM transactions
                WHERE user_id = ? AND charged_amount > 0 AND category_id = ?
                  AND strftime('%Y-%m', COALESCE(processed_date, date)) = ?
                  AND CAST(strftime('%d', date) AS INTEGER) >= ?
                  AND CAST(strftime('%d', date) AS INTEGER) <= ?`,
          args: [userId, catId, month, week.startDay, week.endDay],
        })).rows[0] as any;

        let total = Number(row.total);
        for (const fp of fixedPayments) {
          if (Number(fp.billing_day) >= week.startDay && Number(fp.billing_day) <= week.endDay) {
            total += Number(fp.charged_amount);
          }
        }
        return total;
      }));

      const weeksWithSpending = weekActuals.filter(a => a > 0).length;
      const effectiveWeeks = weeksWithSpending > 0 ? weeksWithSpending : weekRanges.length;
      const baseBudgetPerWeek = forecast > 0 ? Math.round(forecast / effectiveWeeks) : 0;

      let carryOver = 0;
      for (let i = 0; i < weekRanges.length; i++) {
        const isPastWeek = weekRanges[i].endDay < todayDay;
        if (isPastWeek && weekActuals[i] > 0) {
          carryOver += baseBudgetPerWeek - weekActuals[i];
        }
      }

      const futureWeeksWithSpending = weekRanges.filter((w, i) => w.endDay >= todayDay && weekActuals[i] > 0).length;
      const futureWeeksCount = weekRanges.filter(w => w.endDay >= todayDay).length;
      const distributeToWeeks = futureWeeksWithSpending > 0 ? futureWeeksWithSpending : futureWeeksCount;
      const carryOverPerWeek = distributeToWeeks > 0 ? Math.round(carryOver / distributeToWeeks) : 0;

      const weeklyBreakdown = await Promise.all(weekRanges.map(async (week, i) => {
        const weekActual = weekActuals[i];
        const isPastWeek = week.endDay < todayDay;

        const transactions = (await db.execute({
          sql: `SELECT id, date, description, charged_amount FROM transactions
                WHERE user_id = ? AND charged_amount > 0 AND category_id = ?
                  AND strftime('%Y-%m', COALESCE(processed_date, date)) = ?
                  AND CAST(strftime('%d', date) AS INTEGER) >= ?
                  AND CAST(strftime('%d', date) AS INTEGER) <= ?
                ORDER BY date DESC`,
          args: [userId, catId, month, week.startDay, week.endDay],
        })).rows as any[];

        let remaining: number;
        if (weekActual === 0 || isPastWeek) {
          remaining = 0;
        } else {
          remaining = Math.max(0, (baseBudgetPerWeek + carryOverPerWeek) - weekActual);
        }

        const txnList = transactions.map((t: any) => ({
          id: Number(t.id), date: t.date, description: t.description, charged_amount: Number(t.charged_amount), pending: false,
        }));

        for (const fp of fixedPayments) {
          if (Number(fp.billing_day) >= week.startDay && Number(fp.billing_day) <= week.endDay) {
            txnList.push({
              id: -Number(fp.id),
              date: `${month}-${String(Number(fp.billing_day)).padStart(2, '0')}`,
              description: `קבועה: ${fp.description}`,
              charged_amount: Number(fp.charged_amount),
              pending: false,
            });
          }
        }

        for (const pf of pendingFixed) {
          if (Number(pf.billing_day) >= week.startDay && Number(pf.billing_day) <= week.endDay) {
            txnList.push({
              id: -100000 - Number(pf.id),
              date: `${month}-${String(Number(pf.billing_day)).padStart(2, '0')}`,
              description: `קבועה: ${pf.description}`,
              charged_amount: Number(pf.charged_amount),
              pending: true,
            });
          }
        }

        txnList.sort((a: any, b: any) => b.date.localeCompare(a.date));

        return { label: week.label, startDay: week.startDay, endDay: week.endDay, actual: weekActual, remaining, transactions: txnList };
      }));

      if (actual >= forecast) {
        for (const wb of weeklyBreakdown) wb.remaining = 0;
      }

      categoryForecasts.push({
        category_id: catId, name: cat.name, icon: cat.icon, color: cat.color,
        forecast, actual, difference: forecast - actual, monthsOfData, weeklyBreakdown,
      });

      totalForecast += forecast;
      totalActual += actual;
    }

    totalForecast += fixedNoCategory;
    totalActual += manualNoCategory;

    categoryForecasts.sort((a: any, b: any) => a.difference - b.difference);

    const remainingToSpend = categoryForecasts.reduce(
      (sum: number, cat: any) => sum + Math.max(0, cat.difference), 0
    );

    res.json({ expectedIncome, actualIncome, variableIncome, totalForecastExpenses: totalForecast, totalActualExpenses: totalActual, categoryForecasts, remainingToSpend });
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/weekly?month=YYYY-MM
router.get('/weekly', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const month = (req.query.month as string) || dayjs().format('YYYY-MM');

    const monthStart = dayjs(month + '-01');
    const daysInMonth = monthStart.daysInMonth();

    const weeks: { label: string; startDay: number; endDay: number; startDate: string; endDate: string }[] = [];
    let currentDay = 1;
    let weekNum = 1;

    while (currentDay <= daysInMonth) {
      const startDate = monthStart.date(currentDay);
      let endDay = currentDay;
      while (endDay < daysInMonth && startDate.date(endDay).day() !== 6) { endDay++; }
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

    const historicalMonths = (await db.execute({
      sql: `SELECT DISTINCT strftime('%Y-%m', COALESCE(processed_date, date)) as month FROM transactions
            WHERE user_id = ? AND charged_amount > 0 AND strftime('%Y-%m', COALESCE(processed_date, date)) < ?
            ORDER BY month`,
      args: [userId, month],
    })).rows as any[];

    const numHistMonths = historicalMonths.length;

    const weeklyData = await Promise.all(weeks.map(async (week) => {
      const actualRow = (await db.execute({
        sql: `SELECT COALESCE(SUM(charged_amount), 0) as total FROM transactions
              WHERE user_id = ? AND charged_amount > 0
                AND COALESCE(processed_date, date) >= ? AND COALESCE(processed_date, date) <= ?`,
        args: [userId, week.startDate, week.endDate],
      })).rows[0] as any;

      let forecast = 0;
      if (numHistMonths > 0) {
        const histRow = (await db.execute({
          sql: `SELECT COALESCE(SUM(charged_amount), 0) as total FROM transactions
                WHERE user_id = ? AND charged_amount > 0
                  AND strftime('%Y-%m', COALESCE(processed_date, date)) < ?
                  AND CAST(strftime('%d', COALESCE(processed_date, date)) AS INTEGER) >= ?
                  AND CAST(strftime('%d', COALESCE(processed_date, date)) AS INTEGER) <= ?`,
          args: [userId, month, week.startDay, week.endDay],
        })).rows[0] as any;
        forecast = Math.round(Number(histRow.total) / numHistMonths);
      }

      return { label: week.label, days: `${week.startDay}-${week.endDay}`, forecast, actual: Number(actualRow.total) };
    }));

    res.json({ weeks: weeklyData });
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/forecast?month=YYYY-MM
router.get('/forecast', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const month = (req.query.month as string) || dayjs().format('YYYY-MM');
    const today = dayjs();

    const incomeRecords = (await db.execute({
      sql: `SELECT ir.*, is2.name, is2.expected_day FROM income_records ir
            JOIN income_sources is2 ON ir.income_source_id = is2.id
            WHERE ir.month = ? AND is2.user_id = ?`,
      args: [month, userId],
    })).rows as any[];

    const forecastVarIncomeRow = (await db.execute({
      sql: `SELECT COALESCE(SUM(ABS(charged_amount)), 0) as total FROM transactions
            WHERE strftime('%Y-%m', COALESCE(processed_date, date)) = ? AND charged_amount < 0 AND user_id = ?`,
      args: [month, userId],
    })).rows[0] as any;
    const forecastVariableIncome = Number(forecastVarIncomeRow.total);

    const expectedIncome = incomeRecords.reduce((sum: number, r: any) => sum + Number(r.expected_amount), 0) + forecastVariableIncome;
    const actualIncome = incomeRecords.reduce((sum: number, r: any) => sum + Number(r.actual_amount || 0), 0) + forecastVariableIncome;

    const allForecastFixed = (await db.execute({
      sql: 'SELECT * FROM fixed_expenses WHERE is_active = 1 AND user_id = ? ORDER BY billing_day',
      args: [userId],
    })).rows as any[];

    const fixedExpensesDue = allForecastFixed.filter((e: any) =>
      isExpenseDueInMonth(e.frequency as string, e.start_month as string, month)
    );

    const expectedExpenses = fixedExpensesDue.reduce((sum: number, e: any) => sum + Number(e.amount), 0);

    const actualExpRow = (await db.execute({
      sql: `SELECT COALESCE(SUM(charged_amount), 0) as total FROM transactions
            WHERE strftime('%Y-%m', COALESCE(processed_date, date)) = ? AND charged_amount > 0 AND user_id = ?`,
      args: [month, userId],
    })).rows[0] as any;

    const actualExpenses = Number(actualExpRow.total);

    const monthDate = dayjs(month + '-01');
    const upcomingFixedExpenses = fixedExpensesDue.map((e: any) => {
      const billingDate = monthDate.date(Math.min(Number(e.billing_day), monthDate.daysInMonth()));
      const daysUntil = billingDate.diff(today, 'day');
      return { name: e.name, amount: Number(e.amount), billing_day: Number(e.billing_day), days_until: daysUntil };
    }).filter((e: any) => e.days_until >= 0).sort((a: any, b: any) => a.days_until - b.days_until);

    res.json({ expectedIncome, actualIncome, expectedExpenses, actualExpenses, upcomingFixedExpenses });
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/trends?months=12
router.get('/trends', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const numMonths = parseInt(req.query.months as string) || 12;
    const startMonth = dayjs().subtract(numMonths - 1, 'month').format('YYYY-MM');

    const [expenses, income, receivedIncome, variableIncomeByMonth] = await Promise.all([
      db.execute({
        sql: `SELECT strftime('%Y-%m', COALESCE(processed_date, date)) as month, SUM(charged_amount) as total
              FROM transactions WHERE strftime('%Y-%m', COALESCE(processed_date, date)) >= ? AND charged_amount > 0 AND user_id = ?
              GROUP BY strftime('%Y-%m', COALESCE(processed_date, date)) ORDER BY month`,
        args: [startMonth, userId],
      }),
      db.execute({
        sql: `SELECT ir.month, SUM(COALESCE(ir.actual_amount, ir.expected_amount)) as total
              FROM income_records ir JOIN income_sources is2 ON ir.income_source_id = is2.id
              WHERE ir.month >= ? AND is2.user_id = ? GROUP BY ir.month ORDER BY ir.month`,
        args: [startMonth, userId],
      }),
      db.execute({
        sql: `SELECT ir.month, SUM(ir.actual_amount) as total
              FROM income_records ir JOIN income_sources is2 ON ir.income_source_id = is2.id
              WHERE ir.month >= ? AND is2.user_id = ? AND ir.status = 'received' GROUP BY ir.month ORDER BY ir.month`,
        args: [startMonth, userId],
      }),
      db.execute({
        sql: `SELECT strftime('%Y-%m', COALESCE(processed_date, date)) as month, SUM(ABS(charged_amount)) as total
              FROM transactions WHERE strftime('%Y-%m', COALESCE(processed_date, date)) >= ? AND charged_amount < 0 AND user_id = ?
              GROUP BY strftime('%Y-%m', COALESCE(processed_date, date))`,
        args: [startMonth, userId],
      }),
    ]);

    const expenseMap = new Map((expenses.rows as any[]).map((e: any) => [e.month, Number(e.total)]));
    const incomeMap = new Map((income.rows as any[]).map((i: any) => [i.month, Number(i.total)]));
    const receivedIncomeMap = new Map((receivedIncome.rows as any[]).map((i: any) => [i.month, Number(i.total)]));
    const variableIncomeMap = new Map((variableIncomeByMonth.rows as any[]).map((v: any) => [v.month, Number(v.total)]));

    const months: any[] = [];
    let current = dayjs(startMonth + '-01');
    const end = dayjs();

    while (current.isBefore(end) || current.format('YYYY-MM') === end.format('YYYY-MM')) {
      const m = current.format('YYYY-MM');
      const inc = (incomeMap.get(m) || 0) + (variableIncomeMap.get(m) || 0);
      const recInc = receivedIncomeMap.get(m) || 0;
      const exp = expenseMap.get(m) || 0;
      months.push({ month: m, income: inc, receivedIncome: recInc, expenses: exp, balance: inc - exp });
      current = current.add(1, 'month');
    }

    res.json({ months });
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/forecast-overrides
router.get('/forecast-overrides', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const overrides = (await db.execute({
      sql: `SELECT cfo.*, c.name as category_name, c.icon, c.color
            FROM category_forecast_overrides cfo JOIN categories c ON cfo.category_id = c.id
            WHERE cfo.user_id = ?`,
      args: [userId],
    })).rows;
    res.json(overrides);
  } catch (err) {
    next(err);
  }
});

// PUT /api/dashboard/forecast-overrides/:categoryId
router.put('/forecast-overrides/:categoryId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const categoryId = parseInt(req.params.categoryId as string);
    const { monthly_budget } = req.body;

    if (monthly_budget === undefined || monthly_budget === null) {
      await db.execute({
        sql: 'DELETE FROM category_forecast_overrides WHERE category_id = ? AND user_id = ?',
        args: [categoryId, userId],
      });
      res.json({ deleted: true });
      return;
    }

    await db.execute({
      sql: `INSERT INTO category_forecast_overrides (category_id, user_id, monthly_budget)
            VALUES (?, ?, ?)
            ON CONFLICT(category_id, user_id) DO UPDATE SET monthly_budget = ?`,
      args: [categoryId, userId, monthly_budget, monthly_budget],
    });

    res.json({ category_id: categoryId, monthly_budget });
  } catch (err) {
    next(err);
  }
});

// POST /api/dashboard/recalc-rollover
router.post('/recalc-rollover', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const month = (req.query.month as string) || dayjs().format('YYYY-MM');

    await db.execute({
      sql: 'DELETE FROM monthly_rollover WHERE user_id = ? AND month = ?',
      args: [userId, month],
    });

    const rolloverAmount = await getOrCalculateRollover(db, userId, month);
    res.json({ month, rolloverAmount });
  } catch (err) {
    next(err);
  }
});

export default router;
