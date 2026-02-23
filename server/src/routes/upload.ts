import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { getDb } from '../db/connection.js';
import { parseFile } from '../services/parser/index.js';
import { classifyTransactions } from '../services/classifier/index.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.csv', '.xlsx', '.xls'];
    const ext = file.originalname.toLowerCase().match(/\.[^.]+$/)?.[0];
    if (ext && allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('סוג קובץ לא נתמך. יש להעלות CSV או Excel.'));
    }
  },
});

// POST /api/upload/parse - Parse file and return preview
router.post('/parse', upload.single('file'), (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'לא נבחר קובץ' });
      return;
    }

    const result = parseFile(req.file.buffer, req.file.originalname);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/upload/import - Import parsed transactions
router.post('/import', (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { transactions, sourceCompany, filename } = req.body;

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      res.status(400).json({ error: 'אין עסקאות לייבוא' });
      return;
    }

    const classified = classifyTransactions(transactions, userId);
    const db = getDb();

    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO transactions (
        date, processed_date, description, original_amount, original_currency,
        charged_amount, category_id, type, installment_number, installment_total,
        card_last_four, source_file, source_company, classification_method, user_id
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    let imported = 0;
    let skipped = 0;
    let failed = 0;
    let autoClassified = 0;

    const importAll = db.transaction(() => {
      for (const txn of classified) {
        try {
          const result = insertStmt.run(
            txn.date,
            txn.processed_date || null,
            txn.description,
            txn.original_amount,
            txn.original_currency,
            txn.charged_amount,
            txn.category_id,
            txn.type,
            txn.installment_number || null,
            txn.installment_total || null,
            txn.card_last_four || null,
            filename,
            sourceCompany,
            txn.classification_method,
            userId
          );

          if (result.changes > 0) {
            imported++;
            if (txn.category_id && (txn.classification_method === 'history' || txn.classification_method === 'keyword')) {
              autoClassified++;
            }
          } else {
            skipped++; // Duplicate
          }
        } catch {
          failed++;
        }
      }
    });

    importAll();

    // Record upload history
    db.prepare(`
      INSERT INTO upload_history (filename, source_company, rows_total, rows_imported, rows_skipped, rows_failed, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(filename, sourceCompany, transactions.length, imported, skipped, failed, userId);

    res.json({ imported, skipped, failed, autoClassified });
  } catch (err) {
    next(err);
  }
});

// GET /api/upload/history
router.get('/history', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const history = db.prepare('SELECT * FROM upload_history WHERE user_id = ? ORDER BY uploaded_at DESC').all(userId);
  res.json(history);
});

export default router;
