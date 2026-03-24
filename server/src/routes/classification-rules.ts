import { Router, Request, Response, NextFunction } from 'express';
import { getDb } from '../db/connection.js';
import { reclassifyAll } from '../services/classifier/index.js';

const router = Router();

// GET /api/classification-rules
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const rules = (await db.execute({
      sql: `
        SELECT cr.*, c.name as category_name
        FROM classification_rules cr
        JOIN categories c ON cr.category_id = c.id
        WHERE cr.user_id = ? OR cr.user_id IS NULL
        ORDER BY cr.priority DESC, cr.keyword
      `,
      args: [userId],
    })).rows;
    res.json(rules);
  } catch (err) {
    next(err);
  }
});

// POST /api/classification-rules
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const { keyword, category_id, priority = 10, is_regex = false } = req.body;

    if (!keyword || !category_id) {
      res.status(400).json({ error: 'מילת מפתח וקטגוריה נדרשים' });
      return;
    }

    const result = await db.execute({
      sql: `INSERT INTO classification_rules (keyword, category_id, priority, is_regex, user_id) VALUES (?, ?, ?, ?, ?)`,
      args: [keyword, category_id, priority, is_regex ? 1 : 0, userId],
    });

    const created = (await db.execute({
      sql: `
        SELECT cr.*, c.name as category_name
        FROM classification_rules cr
        JOIN categories c ON cr.category_id = c.id
        WHERE cr.id = ?
      `,
      args: [result.lastInsertRowid!],
    })).rows[0];

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/classification-rules/:id
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const { keyword, category_id, priority, is_regex } = req.body;

    const updates: string[] = [];
    const params: any[] = [];

    if (keyword !== undefined) { updates.push('keyword = ?'); params.push(keyword); }
    if (category_id !== undefined) { updates.push('category_id = ?'); params.push(category_id); }
    if (priority !== undefined) { updates.push('priority = ?'); params.push(priority); }
    if (is_regex !== undefined) { updates.push('is_regex = ?'); params.push(is_regex ? 1 : 0); }

    if (updates.length === 0) {
      res.status(400).json({ error: 'אין שדות לעדכון' });
      return;
    }

    params.push(String(req.params.id), userId);
    await db.execute({
      sql: `UPDATE classification_rules SET ${updates.join(', ')} WHERE id = ? AND (user_id = ? OR user_id IS NULL)`,
      args: params as any,
    });

    const updated = (await db.execute({
      sql: `
        SELECT cr.*, c.name as category_name
        FROM classification_rules cr
        JOIN categories c ON cr.category_id = c.id
        WHERE cr.id = ?
      `,
      args: [String(req.params.id)],
    })).rows[0];

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/classification-rules/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    await db.execute({
      sql: 'DELETE FROM classification_rules WHERE id = ? AND (user_id = ? OR user_id IS NULL)',
      args: [String(req.params.id), userId],
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/classification-rules/reclassify
router.post('/reclassify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { month } = req.body;
    const result = await reclassifyAll(month, userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
