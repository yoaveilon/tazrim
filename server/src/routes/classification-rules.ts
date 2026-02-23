import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';
import { reclassifyAll } from '../services/classifier/index.js';

const router = Router();

// GET /api/classification-rules
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const rules = db.prepare(`
    SELECT cr.*, c.name as category_name
    FROM classification_rules cr
    JOIN categories c ON cr.category_id = c.id
    WHERE cr.user_id = ? OR cr.user_id IS NULL
    ORDER BY cr.priority DESC, cr.keyword
  `).all(userId);
  res.json(rules);
});

// POST /api/classification-rules
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const { keyword, category_id, priority = 10, is_regex = false } = req.body;

  if (!keyword || !category_id) {
    res.status(400).json({ error: 'מילת מפתח וקטגוריה נדרשים' });
    return;
  }

  const result = db.prepare(`
    INSERT INTO classification_rules (keyword, category_id, priority, is_regex, user_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(keyword, category_id, priority, is_regex ? 1 : 0, userId);

  const created = db.prepare(`
    SELECT cr.*, c.name as category_name
    FROM classification_rules cr
    JOIN categories c ON cr.category_id = c.id
    WHERE cr.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(created);
});

// PATCH /api/classification-rules/:id
router.patch('/:id', (req: Request, res: Response) => {
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

  params.push(req.params.id, userId);
  db.prepare(`UPDATE classification_rules SET ${updates.join(', ')} WHERE id = ? AND (user_id = ? OR user_id IS NULL)`).run(...params);

  const updated = db.prepare(`
    SELECT cr.*, c.name as category_name
    FROM classification_rules cr
    JOIN categories c ON cr.category_id = c.id
    WHERE cr.id = ?
  `).get(req.params.id);

  res.json(updated);
});

// DELETE /api/classification-rules/:id
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  db.prepare('DELETE FROM classification_rules WHERE id = ? AND (user_id = ? OR user_id IS NULL)').run(req.params.id, userId);
  res.json({ success: true });
});

// POST /api/classification-rules/reclassify
router.post('/reclassify', (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { month } = req.body;
  const result = reclassifyAll(month, userId);
  res.json(result);
});

export default router;
