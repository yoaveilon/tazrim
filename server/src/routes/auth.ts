import { Router, Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { getDb } from '../db/connection.js';
import { createToken, type AuthUser } from '../middleware/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'riseup-dev-secret-change-in-production';

const router = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

// POST /api/auth/google - Exchange Google credential for app JWT
router.post('/google', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      res.status(400).json({ error: 'חסר credential מ-Google' });
      return;
    }

    if (!GOOGLE_CLIENT_ID) {
      res.status(500).json({ error: 'GOOGLE_CLIENT_ID לא מוגדר בשרת' });
      return;
    }

    const client = new OAuth2Client(GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email) {
      res.status(400).json({ error: 'טוקן Google לא תקין' });
      return;
    }

    const { sub: googleId, email, name, picture } = payload;

    const db = getDb();

    let user = (await db.execute({
      sql: 'SELECT * FROM users WHERE google_id = ?',
      args: [googleId],
    })).rows[0] as any;

    if (!user) {
      const result = await db.execute({
        sql: `INSERT INTO users (google_id, email, name, picture) VALUES (?, ?, ?, ?)`,
        args: [googleId, email, name || email, picture || null],
      });

      user = (await db.execute({
        sql: 'SELECT * FROM users WHERE id = ?',
        args: [result.lastInsertRowid!],
      })).rows[0] as any;

      // Copy default classification rules and settings for new user
      await db.batch([
        {
          sql: `INSERT INTO classification_rules (keyword, category_id, priority, is_regex, user_id)
                SELECT keyword, category_id, priority, is_regex, ?
                FROM classification_rules WHERE user_id IS NULL`,
          args: [user.id],
        },
        {
          sql: `INSERT INTO settings (key, value, user_id)
                SELECT key, value, ?
                FROM settings WHERE user_id IS NULL`,
          args: [user.id],
        },
      ], 'write');
    } else {
      await db.execute({
        sql: 'UPDATE users SET name = ?, picture = ? WHERE id = ?',
        args: [name || user.name, picture || user.picture, user.id],
      });
    }

    const token = createToken({ id: user.id, email: user.email, name: user.name });
    const adminEmail = process.env.ADMIN_EMAIL;

    res.json({
      token,
      user: {
        id: user.id,
        google_id: user.google_id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        created_at: user.created_at,
        is_admin: !!(adminEmail && user.email === adminEmail),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'לא מחובר' });
      return;
    }

    let decoded: AuthUser;
    try {
      decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET) as AuthUser;
    } catch {
      res.status(401).json({ error: 'טוקן לא תקין' });
      return;
    }

    const db = getDb();
    const user = (await db.execute({
      sql: 'SELECT * FROM users WHERE id = ?',
      args: [decoded.id],
    })).rows[0] as any;

    if (!user) {
      res.status(404).json({ error: 'משתמש לא נמצא' });
      return;
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    res.json({
      id: user.id,
      google_id: user.google_id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      created_at: user.created_at,
      is_admin: !!(adminEmail && user.email === adminEmail),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
