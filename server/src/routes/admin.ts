import { Router, Request, Response, NextFunction } from 'express';
import { getDb } from '../db/connection.js';

const router = Router();

function adminOnly(req: Request, res: Response, next: () => void) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || req.user!.email !== adminEmail) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }
  next();
}

router.use(adminOnly);

// GET /api/admin/users
router.get('/users', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const users = (await db.execute(`
      SELECT
        u.id, u.email, u.name, u.picture, u.created_at,
        COALESCE(t.txn_count, 0) as transaction_count,
        t.last_transaction_date,
        uh.last_upload_date,
        uh.upload_count
      FROM users u
      LEFT JOIN (
        SELECT user_id, COUNT(*) as txn_count, MAX(date) as last_transaction_date
        FROM transactions GROUP BY user_id
      ) t ON t.user_id = u.id
      LEFT JOIN (
        SELECT user_id, MAX(uploaded_at) as last_upload_date, COUNT(*) as upload_count
        FROM upload_history GROUP BY user_id
      ) uh ON uh.user_id = u.id
      ORDER BY u.created_at DESC
    `)).rows;

    res.json({ users, total: users.length });
  } catch (err) {
    next(err);
  }
});

export default router;
