import { Router, Request, Response, NextFunction } from 'express';
import { getDb } from '../db/connection.js';

const router = Router();

// GET /api/income
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const sources = (await db.execute({
      sql: 'SELECT * FROM income_sources WHERE user_id = ? ORDER BY expected_day',
      args: [userId],
    })).rows;
    res.json(sources);
  } catch (err) {
    next(err);
  }
});

// POST /api/income
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const { name, amount, expected_day, notes } = req.body;

    if (!name || amount === undefined || !expected_day) {
      res.status(400).json({ error: 'שם, סכום ויום צפוי נדרשים' });
      return;
    }

    const result = await db.execute({
      sql: `INSERT INTO income_sources (name, amount, expected_day, notes, user_id) VALUES (?, ?, ?, ?, ?)`,
      args: [name, amount, expected_day, notes || null, userId],
    });

    const created = (await db.execute({
      sql: 'SELECT * FROM income_sources WHERE id = ?',
      args: [result.lastInsertRowid!],
    })).rows[0];

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/income/:id
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
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

    params.push(String(req.params.id), userId);
    await db.execute({
      sql: `UPDATE income_sources SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      args: params as any,
    });

    const updated = (await db.execute({
      sql: 'SELECT * FROM income_sources WHERE id = ? AND user_id = ?',
      args: [String(req.params.id), userId],
    })).rows[0];

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/income/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    await db.execute({
      sql: 'DELETE FROM income_sources WHERE id = ? AND user_id = ?',
      args: [String(req.params.id), userId],
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/income/records?month=YYYY-MM
router.get('/records', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const { month } = req.query as Record<string, string>;

    if (!month) {
      res.status(400).json({ error: 'חודש נדרש (פורמט: YYYY-MM)' });
      return;
    }

    const activeSources = (await db.execute({
      sql: 'SELECT * FROM income_sources WHERE is_active = 1 AND user_id = ?',
      args: [userId],
    })).rows as any[];

    const insertStmts = activeSources.map((source: any) => ({
      sql: `INSERT OR IGNORE INTO income_records (income_source_id, month, expected_amount, status) VALUES (?, ?, ?, 'expected')`,
      args: [source.id, month, source.amount],
    }));

    if (insertStmts.length > 0) {
      await db.batch(insertStmts, 'write');
    }

    const records = (await db.execute({
      sql: `
        SELECT ir.*, is2.name as source_name
        FROM income_records ir
        JOIN income_sources is2 ON ir.income_source_id = is2.id
        WHERE ir.month = ? AND is2.user_id = ?
        ORDER BY is2.expected_day
      `,
      args: [month, userId],
    })).rows;

    res.json(records);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/income/records/:id
router.patch('/records/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
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

    params.push(String(req.params.id), userId);
    await db.execute({
      sql: `
        UPDATE income_records SET ${updates.join(', ')}
        WHERE id = ? AND income_source_id IN (SELECT id FROM income_sources WHERE user_id = ?)
      `,
      args: params as any,
    });

    const updated = (await db.execute({
      sql: `
        SELECT ir.*, is2.name as source_name
        FROM income_records ir
        JOIN income_sources is2 ON ir.income_source_id = is2.id
        WHERE ir.id = ? AND is2.user_id = ?
      `,
      args: [String(req.params.id), userId],
    })).rows[0];

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// GET /api/income/variable?month=YYYY-MM
router.get('/variable', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const { month } = req.query as Record<string, string>;

    if (!month) {
      res.status(400).json({ error: 'חודש נדרש (פורמט: YYYY-MM)' });
      return;
    }

    const refunds = (await db.execute({
      sql: `
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
      `,
      args: [month, userId],
    })).rows as any[];

    const total = refunds.reduce((sum: number, r: any) => sum + Math.abs(Number(r.charged_amount)), 0);

    res.json({
      refunds: refunds.map((r: any) => ({ ...r, amount: Math.abs(Number(r.charged_amount)) })),
      total,
      count: refunds.length,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
