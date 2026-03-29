import { Router, Request, Response, NextFunction } from 'express';
import { getDb } from '../db/connection.js';
import { isExpenseDueInMonth } from '../utils/expense-frequency.js';

const router = Router();

// GET /api/fixed-expenses
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const expenses = (await db.execute({
      sql: `
        SELECT fe.*, c.name as category_name
        FROM fixed_expenses fe
        LEFT JOIN categories c ON fe.category_id = c.id
        WHERE fe.user_id = ?
        ORDER BY fe.billing_day
      `,
      args: [userId],
    })).rows;
    res.json(expenses);
  } catch (err) {
    next(err);
  }
});

// POST /api/fixed-expenses
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const { name, amount, billing_day, category_id, notes, frequency, start_month } = req.body;

    if (!name || amount === undefined || !billing_day) {
      res.status(400).json({ error: 'שם, סכום ויום חיוב נדרשים' });
      return;
    }

    const freq = frequency || 'monthly';
    const sm = freq === 'bimonthly' ? (start_month || null) : null;

    const result = await db.execute({
      sql: `INSERT INTO fixed_expenses (name, amount, billing_day, category_id, notes, frequency, start_month, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [name, amount, billing_day, category_id || null, notes || null, freq, sm, userId],
    });

    const created = (await db.execute({
      sql: `
        SELECT fe.*, c.name as category_name
        FROM fixed_expenses fe
        LEFT JOIN categories c ON fe.category_id = c.id
        WHERE fe.id = ?
      `,
      args: [result.lastInsertRowid!],
    })).rows[0];

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/fixed-expenses/:id
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const { name, amount, billing_day, category_id, is_active, notes, frequency, start_month } = req.body;

    const updates: string[] = [];
    const params: any[] = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (amount !== undefined) { updates.push('amount = ?'); params.push(amount); }
    if (billing_day !== undefined) { updates.push('billing_day = ?'); params.push(billing_day); }
    if (category_id !== undefined) { updates.push('category_id = ?'); params.push(category_id || null); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }
    if (frequency !== undefined) { updates.push('frequency = ?'); params.push(frequency); }
    if (start_month !== undefined) { updates.push('start_month = ?'); params.push(start_month || null); }

    if (updates.length === 0) {
      res.status(400).json({ error: 'אין שדות לעדכון' });
      return;
    }

    params.push(String(req.params.id), userId);
    await db.execute({
      sql: `UPDATE fixed_expenses SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      args: params as any,
    });

    const updated = (await db.execute({
      sql: `
        SELECT fe.*, c.name as category_name
        FROM fixed_expenses fe
        LEFT JOIN categories c ON fe.category_id = c.id
        WHERE fe.id = ? AND fe.user_id = ?
      `,
      args: [String(req.params.id), userId],
    })).rows[0];

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /api/fixed-expenses/auto-detect?month=YYYY-MM
router.post('/auto-detect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const { month } = req.body;

    if (!month) {
      res.status(400).json({ error: 'חודש נדרש' });
      return;
    }

    const fixedExpenses = (await db.execute({
      sql: 'SELECT * FROM fixed_expenses WHERE is_active = 1 AND user_id = ?',
      args: [userId],
    })).rows as any[];

    const transactions = (await db.execute({
      sql: `SELECT id, description, charged_amount, date FROM transactions WHERE user_id = ? AND strftime('%Y-%m', COALESCE(processed_date, date)) = ? AND charged_amount > 0`,
      args: [userId, month],
    })).rows as any[];

    const alreadyPaidRows = (await db.execute({
      sql: 'SELECT fixed_expense_id FROM fixed_expense_payments WHERE month = ? AND user_id = ?',
      args: [month, userId],
    })).rows as any[];

    const alreadyPaid = new Set(alreadyPaidRows.map((p: any) => Number(p.fixed_expense_id)));
    const matched: { fixedExpenseName: string; transactionDesc: string; amount: number }[] = [];
    const insertStmts: any[] = [];

    for (const fe of fixedExpenses) {
      if (alreadyPaid.has(Number(fe.id))) continue;
      if (!isExpenseDueInMonth(fe.frequency as string, fe.start_month as string, month)) continue;

      const feName = (fe.name as string).trim().toLowerCase();
      const match = transactions.find((t: any) => {
        const desc = (t.description as string).trim().toLowerCase();
        return desc.includes(feName) || feName.includes(desc);
      });

      if (match) {
        insertStmts.push({
          sql: `INSERT OR IGNORE INTO fixed_expense_payments (fixed_expense_id, month, amount_paid, user_id, matched_transaction_id) VALUES (?, ?, ?, ?, ?)`,
          args: [fe.id, month, match.charged_amount, userId, match.id],
        });
        matched.push({
          fixedExpenseName: fe.name as string,
          transactionDesc: match.description as string,
          amount: Number(match.charged_amount),
        });
      }
    }

    if (insertStmts.length > 0) {
      await db.batch(insertStmts, 'write');
    }

    res.json({ matched, count: matched.length });
  } catch (err) {
    next(err);
  }
});

// GET /api/fixed-expenses/payments?month=YYYY-MM
router.get('/payments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const month = req.query.month as string;

    if (!month) {
      res.status(400).json({ error: 'חודש נדרש' });
      return;
    }

    const payments = (await db.execute({
      sql: `
        SELECT fep.*, fe.name, fe.amount as expected_amount, fe.billing_day, fe.category_id,
               c.name as category_name
        FROM fixed_expense_payments fep
        JOIN fixed_expenses fe ON fep.fixed_expense_id = fe.id
        LEFT JOIN categories c ON fe.category_id = c.id
        WHERE fep.month = ? AND fep.user_id = ?
      `,
      args: [month, userId],
    })).rows;

    res.json(payments);
  } catch (err) {
    next(err);
  }
});

// POST /api/fixed-expenses/:id/pay
router.post('/:id/pay', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const fixedExpenseId = parseInt(String(req.params.id) as string);
    const { month, amount_paid } = req.body;

    if (!month) {
      res.status(400).json({ error: 'חודש נדרש' });
      return;
    }

    const expense = (await db.execute({
      sql: 'SELECT * FROM fixed_expenses WHERE id = ? AND user_id = ?',
      args: [fixedExpenseId, userId],
    })).rows[0] as any;

    if (!expense) {
      res.status(404).json({ error: 'הוצאה קבועה לא נמצאה' });
      return;
    }

    const actualAmount = amount_paid !== undefined ? amount_paid : expense.amount;

    await db.execute({
      sql: `
        INSERT INTO fixed_expense_payments (fixed_expense_id, month, amount_paid, user_id)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(fixed_expense_id, month) DO UPDATE SET amount_paid = ?, paid_at = datetime('now')
      `,
      args: [fixedExpenseId, month, actualAmount, userId, actualAmount],
    });

    const payment = (await db.execute({
      sql: `
        SELECT fep.*, fe.name, fe.amount as expected_amount
        FROM fixed_expense_payments fep
        JOIN fixed_expenses fe ON fep.fixed_expense_id = fe.id
        WHERE fep.fixed_expense_id = ? AND fep.month = ?
      `,
      args: [fixedExpenseId, month],
    })).rows[0];

    res.json(payment);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/fixed-expenses/:id/pay
router.delete('/:id/pay', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const fixedExpenseId = parseInt(String(req.params.id) as string);
    const month = req.query.month as string;

    if (!month) {
      res.status(400).json({ error: 'חודש נדרש' });
      return;
    }

    await db.execute({
      sql: 'DELETE FROM fixed_expense_payments WHERE fixed_expense_id = ? AND month = ? AND user_id = ?',
      args: [fixedExpenseId, month, userId],
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/fixed-expenses/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    await db.execute({
      sql: 'DELETE FROM fixed_expenses WHERE id = ? AND user_id = ?',
      args: [String(req.params.id), userId],
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
