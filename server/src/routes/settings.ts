import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';

const router = Router();

// GET /api/settings
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const rows = db.prepare('SELECT key, value FROM settings WHERE user_id = ?').all(userId) as any[];
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  res.json(settings);
});

// PATCH /api/settings
router.patch('/', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const updates = req.body;

  const upsertStmt = db.prepare(`
    INSERT INTO settings (key, value, user_id) VALUES (?, ?, ?)
    ON CONFLICT(key, user_id) DO UPDATE SET value = excluded.value
  `);

  const updateAll = db.transaction(() => {
    for (const [key, value] of Object.entries(updates)) {
      upsertStmt.run(key, String(value), userId);
    }
  });

  updateAll();

  // Return all settings
  const rows = db.prepare('SELECT key, value FROM settings WHERE user_id = ?').all(userId) as any[];
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  res.json(settings);
});

export default router;
