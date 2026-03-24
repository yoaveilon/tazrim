import { Router, Request, Response, NextFunction } from 'express';
import { getDb } from '../db/connection.js';

const router = Router();

// GET /api/settings
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const rows = (await db.execute({
      sql: 'SELECT key, value FROM settings WHERE user_id = ?',
      args: [userId],
    })).rows as any[];

    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/settings
router.patch('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const updates = req.body;

    const stmts = Object.entries(updates).map(([key, value]) => ({
      sql: `INSERT INTO settings (key, value, user_id) VALUES (?, ?, ?)
            ON CONFLICT(key, user_id) DO UPDATE SET value = excluded.value`,
      args: [key, String(value), userId],
    }));

    if (stmts.length > 0) {
      await db.batch(stmts, 'write');
    }

    const rows = (await db.execute({
      sql: 'SELECT key, value FROM settings WHERE user_id = ?',
      args: [userId],
    })).rows as any[];

    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

export default router;
