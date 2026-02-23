import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';

const router = Router();

// GET /api/categories
router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const categories = db.prepare('SELECT * FROM categories ORDER BY is_expense DESC, sort_order ASC').all();
  res.json(categories);
});

// GET /api/categories/usage - Get transaction count per category (for current user)
router.get('/usage', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const usage = db.prepare(`
    SELECT category_id, COUNT(*) as count
    FROM transactions
    WHERE user_id = ? AND category_id IS NOT NULL
    GROUP BY category_id
  `).all(userId) as Array<{ category_id: number; count: number }>;

  const usageMap: Record<number, number> = {};
  for (const row of usage) {
    usageMap[row.category_id] = row.count;
  }
  res.json(usageMap);
});

// POST /api/categories
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { name, icon, color, is_expense } = req.body;

  if (!name) {
    res.status(400).json({ error: 'שם הקטגוריה נדרש' });
    return;
  }

  const result = db.prepare(`
    INSERT INTO categories (name, icon, color, is_expense)
    VALUES (?, ?, ?, ?)
  `).run(name, icon || null, color || '#6B7280', is_expense ? 1 : 0);

  const created = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

// PATCH /api/categories/:id
router.patch('/:id', (req: Request, res: Response) => {
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

  params.push(req.params.id);
  db.prepare(`UPDATE categories SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/categories/:id?reassign_to=<id>
// If reassign_to is provided, moves transactions/rules/expenses to that category
// Otherwise, nullifies category on transactions and deletes related rules
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const categoryId = parseInt(req.params.id);
  const reassignTo = req.query.reassign_to ? parseInt(req.query.reassign_to as string) : null;

  const deleteOp = db.transaction(() => {
    if (reassignTo) {
      // Reassign user's transactions to another category
      db.prepare(`
        UPDATE transactions SET category_id = ?, classification_method = 'manual'
        WHERE category_id = ? AND user_id = ?
      `).run(reassignTo, categoryId, userId);

      // Reassign user's classification rules
      db.prepare(`
        UPDATE classification_rules SET category_id = ?
        WHERE category_id = ? AND (user_id = ? OR user_id IS NULL)
      `).run(reassignTo, categoryId, userId);

      // Reassign user's fixed expenses
      db.prepare(`
        UPDATE fixed_expenses SET category_id = ?
        WHERE category_id = ? AND user_id = ?
      `).run(reassignTo, categoryId, userId);
    } else {
      // Nullify category on user's transactions
      db.prepare(`
        UPDATE transactions SET category_id = NULL, classification_method = NULL
        WHERE category_id = ? AND user_id = ?
      `).run(categoryId, userId);

      // Delete user's classification rules for this category
      db.prepare(`
        DELETE FROM classification_rules
        WHERE category_id = ? AND (user_id = ? OR user_id IS NULL)
      `).run(categoryId, userId);

      // Nullify category on user's fixed expenses
      db.prepare(`
        UPDATE fixed_expenses SET category_id = NULL
        WHERE category_id = ? AND user_id = ?
      `).run(categoryId, userId);
    }

    // Delete the category
    db.prepare('DELETE FROM categories WHERE id = ?').run(categoryId);
  });

  deleteOp();
  res.json({ success: true });
});

export default router;
