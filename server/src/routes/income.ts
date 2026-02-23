import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';

const router = Router();

// GET /api/income
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const sources = db.prepare('SELECT * FROM income_sources WHERE user_id = ? ORDER BY expected_day').all(userId);
  res.json(sources);
});

// POST /api/income
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const { name, amount, expected_day, notes } = req.body;

  if (!name || amount === undefined || !expected_day) {
    res.status(400).json({ error: 'שם, סכום ויום צפוי נדרשים' });
    return;
  }

  const result = db.prepare(`
    INSERT INTO income_sources (name, amount, expected_day, notes, user_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, amount, expected_day, notes || null, userId);

  const created = db.prepare('SELECT * FROM income_sources WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

// PATCH /api/income/:id
router.patch('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const { name, amount, expected_day, is_active, notes } = req.body;

  const updates: string[] = [];
  const params: any[] = [];

  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (amount !== undefined) { updates.push('amount = ?'); params.push(amount); }
  if (expected_day !== undefined) { updates.push('expected_day = ?'); params.push(expected_day); }
  if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }
  if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }

  if (updates.length === 0) {
    res.status(400).json({ error: 'אין שדות לעדכון' });
    return;
  }

  params.push(req.params.id, userId);
  db.prepare(`UPDATE income_sources SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(...params);

  const updated = db.prepare('SELECT * FROM income_sources WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  res.json(updated);
});

// DELETE /api/income/:id
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  db.prepare('DELETE FROM income_sources WHERE id = ? AND user_id = ?').run(req.params.id, userId);
  res.json({ success: true });
});

// GET /api/income/records?month=YYYY-MM
router.get('/records', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const { month } = req.query as Record<string, string>;

  if (!month) {
    res.status(400).json({ error: 'חודש נדרש (פורמט: YYYY-MM)' });
    return;
  }

  // Auto-generate records for active sources that don't have one yet
  const activeSources = db.prepare('SELECT * FROM income_sources WHERE is_active = 1 AND user_id = ?').all(userId) as any[];

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO income_records (income_source_id, month, expected_amount, status)
    VALUES (?, ?, ?, 'expected')
  `);

  for (const source of activeSources) {
    insertStmt.run(source.id, month, source.amount);
  }

  const records = db.prepare(`
    SELECT ir.*, is2.name as source_name
    FROM income_records ir
    JOIN income_sources is2 ON ir.income_source_id = is2.id
    WHERE ir.month = ? AND is2.user_id = ?
    ORDER BY is2.expected_day
  `).all(month, userId);

  res.json(records);
});

// PATCH /api/income/records/:id
router.patch('/records/:id', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const { expected_amount, actual_amount, received_date, status, notes } = req.body;

  const updates: string[] = [];
  const params: any[] = [];

  if (expected_amount !== undefined) { updates.push('expected_amount = ?'); params.push(expected_amount); }
  if (actual_amount !== undefined) { updates.push('actual_amount = ?'); params.push(actual_amount); }
  if (received_date !== undefined) { updates.push('received_date = ?'); params.push(received_date); }
  if (status !== undefined) { updates.push('status = ?'); params.push(status); }
  if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }

  if (updates.length === 0) {
    res.status(400).json({ error: 'אין שדות לעדכון' });
    return;
  }

  // Verify ownership via income_sources join
  params.push(req.params.id);
  db.prepare(`
    UPDATE income_records SET ${updates.join(', ')}
    WHERE id = ? AND income_source_id IN (SELECT id FROM income_sources WHERE user_id = ${userId})
  `).run(...params);

  const updated = db.prepare(`
    SELECT ir.*, is2.name as source_name
    FROM income_records ir
    JOIN income_sources is2 ON ir.income_source_id = is2.id
    WHERE ir.id = ? AND is2.user_id = ?
  `).get(req.params.id, userId);

  res.json(updated);
});

// GET /api/income/variable?month=YYYY-MM
// Returns credit card refunds (negative charged_amount transactions) as "variable income"
router.get('/variable', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const { month } = req.query as Record<string, string>;

  if (!month) {
    res.status(400).json({ error: 'חודש נדרש (פורמט: YYYY-MM)' });
    return;
  }

  // Get individual refund transactions
  const refunds = db.prepare(`
    SELECT
      t.id, t.date, t.description, t.charged_amount,
      t.original_amount, t.original_currency,
      t.card_last_four, t.source_company,
      c.name as category_name, c.icon as category_icon, c.color as category_color
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE strftime('%Y-%m', COALESCE(t.processed_date, t.date)) = ?
      AND t.charged_amount < 0
      AND t.user_id = ?
    ORDER BY COALESCE(t.processed_date, t.date) DESC
  `).all(month, userId) as any[];

  // Calculate total (make it positive for display)
  const total = refunds.reduce((sum: number, r: any) => sum + Math.abs(r.charged_amount), 0);

  res.json({
    refunds: refunds.map((r: any) => ({
      ...r,
      amount: Math.abs(r.charged_amount), // positive for display
    })),
    total,
    count: refunds.length,
  });
});

export default router;
