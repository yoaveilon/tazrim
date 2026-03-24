import { Router, Request, Response, NextFunction } from 'express';
import { getDb } from '../db/connection.js';

const router = Router();

// GET /api/categories
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const categories = (await db.execute(
      'SELECT * FROM categories ORDER BY is_expense DESC, sort_order ASC'
    )).rows;
    res.json(categories);
  } catch (err) {
    next(err);
  }
});

// GET /api/categories/usage
router.get('/usage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const usage = (await db.execute({
      sql: `
        SELECT category_id, COUNT(*) as count
        FROM transactions
        WHERE user_id = ? AND category_id IS NOT NULL
        GROUP BY category_id
      `,
      args: [userId],
    })).rows as unknown as Array<{ category_id: number; count: number }>;

    const usageMap: Record<number, number> = {};
    for (const row of usage) {
      usageMap[Number(row.category_id)] = Number(row.count);
    }
    res.json(usageMap);
  } catch (err) {
    next(err);
  }
});

// POST /api/categories
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const { name, icon, color, is_expense } = req.body;

    if (!name) {
      res.status(400).json({ error: 'שם הקטגוריה נדרש' });
      return;
    }

    const result = await db.execute({
      sql: `INSERT INTO categories (name, icon, color, is_expense) VALUES (?, ?, ?, ?)`,
      args: [name, icon || null, color || '#6B7280', is_expense ? 1 : 0],
    });

    const created = (await db.execute({
      sql: 'SELECT * FROM categories WHERE id = ?',
      args: [result.lastInsertRowid!],
    })).rows[0];

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/categories/:id
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const { name, icon, color, is_expense, sort_order } = req.body;

    const updates: string[] = [];
    const params: any[] = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (icon !== undefined) { updates.push('icon = ?'); params.push(icon); }
    if (color !== undefined) { updates.push('color = ?'); params.push(color); }
    if (is_expense !== undefined) { updates.push('is_expense = ?'); params.push(is_expense ? 1 : 0); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); params.push(sort_order); }

    if (updates.length === 0) {
      res.status(400).json({ error: 'אין שדות לעדכון' });
      return;
    }

    params.push(String(req.params.id));
    await db.execute({
      sql: `UPDATE categories SET ${updates.join(', ')} WHERE id = ?`,
      args: params as any,
    });

    const updated = (await db.execute({
      sql: 'SELECT * FROM categories WHERE id = ?',
      args: [String(req.params.id)],
    })).rows[0];

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/categories/:id?reassign_to=<id>
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const categoryId = parseInt(String(req.params.id) as string);
    const reassignTo = req.query.reassign_to ? parseInt(req.query.reassign_to as string) : null;

    const stmts = reassignTo ? [
      {
        sql: `UPDATE transactions SET category_id = ?, classification_method = 'manual' WHERE category_id = ? AND user_id = ?`,
        args: [reassignTo, categoryId, userId],
      },
      {
        sql: `UPDATE classification_rules SET category_id = ? WHERE category_id = ? AND (user_id = ? OR user_id IS NULL)`,
        args: [reassignTo, categoryId, userId],
      },
      {
        sql: `UPDATE fixed_expenses SET category_id = ? WHERE category_id = ? AND user_id = ?`,
        args: [reassignTo, categoryId, userId],
      },
    ] : [
      {
        sql: `UPDATE transactions SET category_id = NULL, classification_method = NULL WHERE category_id = ? AND user_id = ?`,
        args: [categoryId, userId],
      },
      {
        sql: `DELETE FROM classification_rules WHERE category_id = ? AND (user_id = ? OR user_id IS NULL)`,
        args: [categoryId, userId],
      },
      {
        sql: `UPDATE fixed_expenses SET category_id = NULL WHERE category_id = ? AND user_id = ?`,
        args: [categoryId, userId],
      },
    ];

    stmts.push({ sql: 'DELETE FROM categories WHERE id = ?', args: [categoryId] });
    await db.batch(stmts, 'write');

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
