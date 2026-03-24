import { Router, Request, Response, NextFunction } from 'express';
import { getDb } from '../db/connection.js';

const router = Router();

// GET /api/transactions
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
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

    const countRow = (await db.execute({
      sql: `SELECT COUNT(*) as total FROM transactions t ${whereClause}`,
      args: params as any,
    })).rows[0] as any;
    const total = countRow.total;

    const rows = (await db.execute({
      sql: `
        SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        ${whereClause}
        ORDER BY t.${sortColumn} ${sortDirection}
        LIMIT ? OFFSET ?
      `,
      args: [...params, limitNum, offset] as any,
    })).rows;

    res.json({
      data: rows,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(Number(total) / limitNum),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/transactions/similar
router.get('/similar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const { description, category_id, exclude_id } = req.query as Record<string, string>;

    if (!description) {
      res.status(400).json({ error: 'description is required' });
      return;
    }

    const conditions: string[] = ['t.user_id = ?', 't.description = ?'];
    const params: any[] = [userId, description];

    if (exclude_id) {
      conditions.push('t.id != ?');
      params.push(parseInt(exclude_id));
    }

    if (category_id) {
      conditions.push('(t.category_id IS NULL OR t.category_id != ?)');
      params.push(parseInt(category_id));
    }

    const whereClause = 'WHERE ' + conditions.join(' AND ');

    const rows = (await db.execute({
      sql: `
        SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        ${whereClause}
        ORDER BY t.date DESC
      `,
      args: params as any,
    })).rows;

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/transactions
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const { date, description, charged_amount, category_id, notes } = req.body;

    if (!date || !description || charged_amount == null) {
      res.status(400).json({ error: 'date, description, and charged_amount are required' });
      return;
    }

    const result = await db.execute({
      sql: `
        INSERT INTO transactions (user_id, date, description, charged_amount, original_amount, original_currency, category_id, notes, type, source_company, classification_method)
        VALUES (?, ?, ?, ?, ?, 'ILS', ?, ?, 'normal', 'manual', 'manual')
      `,
      args: [userId, date, description, charged_amount, charged_amount, category_id || null, notes || null],
    });

    const row = (await db.execute({
      sql: 'SELECT * FROM transactions WHERE id = ?',
      args: [result.lastInsertRowid!],
    })).rows[0];

    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

// POST /api/transactions/batch-classify
router.post('/batch-classify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const { transaction_ids, category_id } = req.body;

    if (!Array.isArray(transaction_ids) || transaction_ids.length === 0 || !category_id) {
      res.status(400).json({ error: 'transaction_ids (array) and category_id are required' });
      return;
    }

    const placeholders = transaction_ids.map(() => '?').join(',');
    const result = await db.execute({
      sql: `
        UPDATE transactions
        SET category_id = ?, classification_method = 'manual'
        WHERE id IN (${placeholders}) AND user_id = ?
      `,
      args: [category_id, ...transaction_ids, userId],
    });

    res.json({ updated: result.rowsAffected });
  } catch (err) {
    next(err);
  }
});

// GET /api/transactions/unclassified
router.get('/unclassified', async (req: Request, res: Response, next: NextFunction) => {
  try {
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

    const countRow = (await db.execute({
      sql: `SELECT COUNT(*) as total FROM transactions t ${whereClause}`,
      args: params as any,
    })).rows[0] as any;

    const rows = (await db.execute({
      sql: `SELECT t.* FROM transactions t ${whereClause} ORDER BY t.date DESC LIMIT ? OFFSET ?`,
      args: [...params, limitNum, offset] as any,
    })).rows;

    res.json({
      data: rows,
      total: countRow.total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(Number(countRow.total) / limitNum),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/transactions/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const row = (await db.execute({
      sql: `
        SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.id = ? AND t.user_id = ?
      `,
      args: [String(req.params.id), userId],
    })).rows[0];

    if (!row) {
      res.status(404).json({ error: 'עסקה לא נמצאה' });
      return;
    }
    res.json(row);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/transactions/:id
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
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

    params.push(String(req.params.id), userId);
    await db.execute({
      sql: `UPDATE transactions SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      args: params as any,
    });

    const updated = (await db.execute({
      sql: `
        SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.id = ? AND t.user_id = ?
      `,
      args: [String(req.params.id), userId],
    })).rows[0];

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/transactions/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    await db.execute({
      sql: 'DELETE FROM transactions WHERE id = ? AND user_id = ?',
      args: [String(req.params.id), userId],
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/transactions/by-file/:filename
router.delete('/by-file/:filename', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const result = await db.execute({
      sql: 'DELETE FROM transactions WHERE source_file = ? AND user_id = ?',
      args: [String(req.params.filename), userId],
    });
    res.json({ deleted: result.rowsAffected });
  } catch (err) {
    next(err);
  }
});

export default router;
