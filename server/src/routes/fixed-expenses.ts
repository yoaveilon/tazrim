import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';
import { isExpenseDueInMonth } from '../utils/expense-frequency.js';

const router = Router();

// GET /api/fixed-expenses
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const expenses = db.prepare(`
    SELECT fe.*, c.name as category_name
    FROM fixed_expenses fe
    LEFT JOIN categories c ON fe.category_id = c.id
    WHERE fe.user_id = ?
    ORDER BY fe.billing_day
  `).all(userId);
  res.json(expenses);
});

// POST /api/fixed-expenses
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const { name, amount, billing_day, category_id, notes, frequency, start_month } = req.body;

  if (!name || amount === undefined || !billing_day) {
    res.status(400).json({ error: 'שם, סכום ויום חיוב נדרשים' });
    return;
  }

  const freq = frequency || 'monthly';
  const sm = freq === 'bimonthly' ? (start_month || null) : null;

  const result = db.prepare(`
    INSERT INTO fixed_expenses (name, amount, billing_day, category_id, notes, frequency, start_month, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, amount, billing_day, category_id || null, notes || null, freq, sm, userId);

  const created = db.prepare(`
    SELECT fe.*, c.name as category_name
    FROM fixed_expenses fe
    LEFT JOIN categories c ON fe.category_id = c.id
    WHERE fe.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(created);
});

// PATCH /api/fixed-expenses/:id
router.patch('/:id', (req: Request, res: Response) => {
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

  params.push(req.params.id, userId);
  db.prepare(`UPDATE fixed_expenses SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(...params);

  const updated = db.prepare(`
    SELECT fe.*, c.name as category_name
    FROM fixed_expenses fe
    LEFT JOIN categories c ON fe.category_id = c.id
    WHERE fe.id = ? AND fe.user_id = ?
  `).get(req.params.id, userId);

  res.json(updated);
});

// POST /api/fixed-expenses/auto-detect?month=YYYY-MM
// Automatically detect fixed expenses that appear in credit card transactions
// and mark them as paid
router.post('/auto-detect', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const { month } = req.body;

  if (!month) {
    res.status(400).json({ error: 'חודש נדרש' });
    return;
  }

  // Get all active fixed expenses for this user
  const fixedExpenses = db.prepare(
    'SELECT * FROM fixed_expenses WHERE is_active = 1 AND user_id = ?'
  ).all(userId) as any[];

  // Get all transactions for this month
  const transactions = db.prepare(`
    SELECT id, description, charged_amount, date
    FROM transactions
    WHERE user_id = ? AND strftime('%Y-%m', COALESCE(processed_date, date)) = ? AND charged_amount > 0
  `).all(userId, month) as any[];

  // Already paid this month
  const alreadyPaid = new Set(
    (db.prepare(
      'SELECT fixed_expense_id FROM fixed_expense_payments WHERE month = ? AND user_id = ?'
    ).all(month, userId) as any[]).map(p => p.fixed_expense_id)
  );

  const matched: { fixedExpenseName: string; transactionDesc: string; amount: number }[] = [];

  const insertPayment = db.prepare(`
    INSERT OR IGNORE INTO fixed_expense_payments (fixed_expense_id, month, amount_paid, user_id)
    VALUES (?, ?, ?, ?)
  `);

  for (const fe of fixedExpenses) {
    if (alreadyPaid.has(fe.id)) continue;
    if (!isExpenseDueInMonth(fe.frequency, fe.start_month, month)) continue;

    // Normalize the fixed expense name for matching
    const feName = fe.name.trim().toLowerCase();

    // Look for a transaction where:
    // - description contains the fixed expense name, OR
    // - the fixed expense name contains the transaction description
    const match = transactions.find((t: any) => {
      const desc = t.description.trim().toLowerCase();
      return desc.includes(feName) || feName.includes(desc);
    });

    if (match) {
      insertPayment.run(fe.id, month, match.charged_amount, userId);
      matched.push({
        fixedExpenseName: fe.name,
        transactionDesc: match.description,
        amount: match.charged_amount,
      });
    }
  }

  res.json({ matched, count: matched.length });
});

// GET /api/fixed-expenses/payments?month=YYYY-MM
// Get all payments for a specific month
router.get('/payments', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const month = req.query.month as string;

  if (!month) {
    res.status(400).json({ error: 'חודש נדרש' });
    return;
  }

  const payments = db.prepare(`
    SELECT fep.*, fe.name, fe.amount as expected_amount, fe.billing_day, fe.category_id,
           c.name as category_name
    FROM fixed_expense_payments fep
    JOIN fixed_expenses fe ON fep.fixed_expense_id = fe.id
    LEFT JOIN categories c ON fe.category_id = c.id
    WHERE fep.month = ? AND fep.user_id = ?
  `).all(month, userId);

  res.json(payments);
});

// POST /api/fixed-expenses/:id/pay
// Mark a fixed expense as paid for a specific month
router.post('/:id/pay', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const fixedExpenseId = parseInt(req.params.id as string);
  const { month, amount_paid } = req.body;

  if (!month) {
    res.status(400).json({ error: 'חודש נדרש' });
    return;
  }

  // Verify the fixed expense belongs to the user
  const expense = db.prepare(
    'SELECT * FROM fixed_expenses WHERE id = ? AND user_id = ?'
  ).get(fixedExpenseId, userId) as any;

  if (!expense) {
    res.status(404).json({ error: 'הוצאה קבועה לא נמצאה' });
    return;
  }

  const actualAmount = amount_paid !== undefined ? amount_paid : expense.amount;

  db.prepare(`
    INSERT INTO fixed_expense_payments (fixed_expense_id, month, amount_paid, user_id)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(fixed_expense_id, month) DO UPDATE SET amount_paid = ?, paid_at = datetime('now')
  `).run(fixedExpenseId, month, actualAmount, userId, actualAmount);

  const payment = db.prepare(`
    SELECT fep.*, fe.name, fe.amount as expected_amount
    FROM fixed_expense_payments fep
    JOIN fixed_expenses fe ON fep.fixed_expense_id = fe.id
    WHERE fep.fixed_expense_id = ? AND fep.month = ?
  `).get(fixedExpenseId, month);

  res.json(payment);
});

// DELETE /api/fixed-expenses/:id/pay
// Unmark a fixed expense payment for a specific month
router.delete('/:id/pay', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const fixedExpenseId = parseInt(req.params.id as string);
  const month = req.query.month as string;

  if (!month) {
    res.status(400).json({ error: 'חודש נדרש' });
    return;
  }

  db.prepare(
    'DELETE FROM fixed_expense_payments WHERE fixed_expense_id = ? AND month = ? AND user_id = ?'
  ).run(fixedExpenseId, month, userId);

  res.json({ success: true });
});

// DELETE /api/fixed-expenses/:id
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  db.prepare('DELETE FROM fixed_expenses WHERE id = ? AND user_id = ?').run(req.params.id, userId);
  res.json({ success: true });
});

export default router;
