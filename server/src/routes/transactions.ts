import { Router, Request, Response, NextFunction } from 'express';
import { getDb } from '../db/connection.js';

const router = Router();

// GET /api/transactions
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const {
    month,
    category_id,
    search,
    page = '1',
    limit = '50',
    sort_by = 'date',
    sort_dir = 'DESC',
  } = req.query as Record<string, string>;

  const conditions: string[] = ['t.user_id = ?'];
  const params: any[] = [userId];

  if (month) {
    conditions.push("strftime('%Y-%m', COALESCE(t.processed_date, t.date)) = ?");
    params.push(month);
  }
  if (category_id) {
    conditions.push('t.category_id = ?');
    params.push(parseInt(category_id));
  }
  if (search) {
    conditions.push('t.description LIKE ?');
    params.push(`%${search}%`);
  }

  const whereClause = 'WHERE ' + conditions.join(' AND ');

  const allowedSorts = ['date', 'charged_amount', 'description', 'created_at'];
  const sortColumn = allowedSorts.includes(sort_by) ? sort_by : 'date';
  const sortDirection = sort_dir.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM transactions t ${whereClause}`).get(...params) as any;
  const total = countRow.total;

  const rows = db.prepare(`
    SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    ${whereClause}
    ORDER BY t.${sortColumn} ${sortDirection}
    LIMIT ? OFFSET ?
  `).all(...params, limitNum, offset);

  res.json({
    data: rows,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  });
});

// GET /api/transactions/similar
// Finds transactions with similar descriptions across all months
router.get('/similar', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const { description, category_id, exclude_id } = req.query as Record<string, string>;

  if (!description) {
    res.status(400).json({ error: 'description is required' });
    return;
  }

  // Find transactions with the exact same description that either have no category
  // or have a different category than the one being assigned
  const conditions: string[] = ['t.user_id = ?', 't.description = ?'];
  const params: any[] = [userId, description];

  if (exclude_id) {
    conditions.push('t.id != ?');
    params.push(parseInt(exclude_id));
  }

  if (category_id) {
    // Only find transactions that don't already have this category
    conditions.push('(t.category_id IS NULL OR t.category_id != ?)');
    params.push(parseInt(category_id));
  }

  const whereClause = 'WHERE ' + conditions.join(' AND ');

  const rows = db.prepare(`
    SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    ${whereClause}
    ORDER BY t.date DESC
  `).all(...params);

  res.json(rows);
});

// POST /api/transactions
// Create a manual transaction
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const { date, description, charged_amount, category_id, notes } = req.body;

  if (!date || !description || charged_amount == null) {
    res.status(400).json({ error: 'date, description, and charged_amount are required' });
    return;
  }

  const result = db.prepare(`
    INSERT INTO transactions (user_id, date, description, charged_amount, original_amount, original_currency, category_id, notes, type, source_company, classification_method)
    VALUES (?, ?, ?, ?, ?, 'ILS', ?, ?, 'normal', 'manual', 'manual')
  `).run(userId, date, description, charged_amount, charged_amount, category_id || null, notes || null);

  const row = db.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(row);
});

// POST /api/transactions/batch-classify
// Updates category for multiple transactions at once
router.post('/batch-classify', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const { transaction_ids, category_id } = req.body;

  if (!Array.isArray(transaction_ids) || transaction_ids.length === 0 || !category_id) {
    res.status(400).json({ error: 'transaction_ids (array) and category_id are required' });
    return;
  }

  const placeholders = transaction_ids.map(() => '?').join(',');
  const result = db.prepare(`
    UPDATE transactions
    SET category_id = ?, classification_method = 'manual'
    WHERE id IN (${placeholders}) AND user_id = ?
  `).run(category_id, ...transaction_ids, userId);

  res.json({ updated: result.changes });
});

// GET /api/transactions/unclassified
router.get('/unclassified', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const { month, page = '1', limit = '50' } = req.query as Record<string, string>;

  const conditions: string[] = ['t.category_id IS NULL', 't.user_id = ?'];
  const params: any[] = [userId];

  if (month) {
    conditions.push("strftime('%Y-%m', COALESCE(t.processed_date, t.date)) = ?");
    params.push(month);
  }

  const whereClause = 'WHERE ' + conditions.join(' AND ');
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM transactions t ${whereClause}`).get(...params) as any;

  const rows = db.prepare(`
    SELECT t.* FROM transactions t ${whereClause}
    ORDER BY t.date DESC
    LIMIT ? OFFSET ?
  `).all(...params, limitNum, offset);

  res.json({
    data: rows,
    total: countRow.total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(countRow.total / limitNum),
  });
});

// GET /api/transactions/:id
router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const row = db.prepare(`
    SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.id = ? AND t.user_id = ?
  `).get(req.params.id, userId);

  if (!row) {
    res.status(404).json({ error: 'עסקה לא נמצאה' });
    return;
  }
  res.json(row);
});

// PATCH /api/transactions/:id
router.patch('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const { category_id, description, charged_amount, date, notes } = req.body;

  const updates: string[] = [];
  const params: any[] = [];

  if (category_id !== undefined) {
    updates.push('category_id = ?');
    params.push(category_id);
    updates.push("classification_method = 'manual'");
  }
  if (description !== undefined) {
    updates.push('description = ?');
    params.push(description);
  }
  if (charged_amount !== undefined) {
    updates.push('charged_amount = ?');
    params.push(charged_amount);
    updates.push('original_amount = ?');
    params.push(charged_amount);
  }
  if (date !== undefined) {
    updates.push('date = ?');
    params.push(date);
  }
  if (notes !== undefined) {
    updates.push('notes = ?');
    params.push(notes);
  }

  if (updates.length === 0) {
    res.status(400).json({ error: 'אין שדות לעדכון' });
    return;
  }

  params.push(req.params.id, userId);
  db.prepare(`UPDATE transactions SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(...params);

  const updated = db.prepare(`
    SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.id = ? AND t.user_id = ?
  `).get(req.params.id, userId);

  res.json(updated);
});

// DELETE /api/transactions/:id
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(req.params.id, userId);
  res.json({ success: true });
});

// DELETE /api/transactions/by-file/:filename
router.delete('/by-file/:filename', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const result = db.prepare('DELETE FROM transactions WHERE source_file = ? AND user_id = ?').run(req.params.filename, userId);
  res.json({ deleted: result.changes });
});

export default router;
