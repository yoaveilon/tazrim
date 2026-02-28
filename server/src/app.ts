import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { errorHandler } from './middleware/error-handler.js';
import { authMiddleware } from './middleware/auth.js';
import authRouter from './routes/auth.js';
import transactionsRouter from './routes/transactions.js';
import uploadRouter from './routes/upload.js';
import categoriesRouter from './routes/categories.js';
import classificationRulesRouter from './routes/classification-rules.js';
import incomeRouter from './routes/income.js';
import fixedExpensesRouter from './routes/fixed-expenses.js';
import dashboardRouter from './routes/dashboard.js';
import settingsRouter from './routes/settings.js';
import adminRouter from './routes/admin.js';
import { getDb } from './db/connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(cors());
app.use(express.json());

// Health check (no auth required)
app.get('/api/health', (_req, res) => {
  try {
    const db = getDb();
    const migrations = db.prepare('SELECT name FROM _migrations ORDER BY name').all();
    const dupes = db.prepare(`
      SELECT user_id, date, description, charged_amount, COALESCE(card_last_four, '') as card, COUNT(*) as cnt
      FROM transactions
      GROUP BY user_id, date, description, charged_amount, COALESCE(card_last_four, '')
      HAVING cnt > 1
    `).all();
    res.json({ status: 'ok', migrations: migrations.map((m: any) => m.name), duplicates: dupes.length });
  } catch {
    res.json({ status: 'ok' });
  }
});

// Auth routes (no auth required)
app.use('/api/auth', authRouter);

// Auth middleware - protects all routes below
app.use('/api', authMiddleware);

// API routes (auth required)
app.use('/api/transactions', transactionsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/classification-rules', classificationRulesRouter);
app.use('/api/income', incomeRouter);
app.use('/api/fixed-expenses', fixedExpensesRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/admin', adminRouter);

// Serve client static files in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));

  // SPA fallback - serve index.html for all non-API routes
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Error handler
app.use(errorHandler);

export default app;
