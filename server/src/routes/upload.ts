import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { getDb } from '../db/connection.js';
import { parseFile } from '../services/parser/index.js';
import { classifyTransactions } from '../services/classifier/index.js';
import type { SoftDuplicate } from 'shared/src/types.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
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

// POST /api/upload/parse
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

// POST /api/upload/import
router.post('/import', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { transactions, sourceCompany, filename } = req.body;

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      res.status(400).json({ error: 'אין עסקאות לייבוא' });
      return;
    }

    const db = getDb();

    // Load exchange rates
    const settingsRows = (await db.execute({
      sql: "SELECT key, value FROM settings WHERE user_id = ? AND key IN ('usd_rate', 'eur_rate')",
      args: [userId],
    })).rows as any[];

    const rates: Record<string, number> = { USD: 3.6, EUR: 3.9 };
    for (const row of settingsRows) {
      if (row.key === 'usd_rate') rates.USD = parseFloat(row.value) || 3.6;
      if (row.key === 'eur_rate') rates.EUR = parseFloat(row.value) || 3.9;
    }

    // Convert foreign currency transactions to ILS
    for (const txn of transactions) {
      if (txn.original_currency && txn.original_currency !== 'ILS') {
        const rate = rates[txn.original_currency];
        if (rate && txn.charged_amount === txn.original_amount) {
          txn.charged_amount = Math.round(txn.original_amount * rate * 100) / 100;
        }
      }
    }

    const classified = await classifyTransactions(transactions, userId);

    let imported = 0;
    let skipped = 0;
    let failed = 0;
    let autoClassified = 0;
    const newlyImportedForeignIds: { id: number; txn: typeof classified[0] }[] = [];

    // Use interactive transaction for the import loop
    const tx = await db.transaction('write');
    try {
      for (const txn of classified) {
        try {
          const result = await tx.execute({
            sql: `INSERT OR IGNORE INTO transactions (
                    date, processed_date, description, original_amount, original_currency,
                    charged_amount, category_id, type, installment_number, installment_total,
                    card_last_four, source_file, source_company, classification_method, user_id
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
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
              userId,
            ],
          });

          if (result.rowsAffected > 0) {
            imported++;
            if (txn.category_id && (txn.classification_method === 'history' || txn.classification_method === 'keyword')) {
              autoClassified++;
            }
            if (txn.original_currency && txn.original_currency !== 'ILS') {
              newlyImportedForeignIds.push({ id: Number(result.lastInsertRowid!), txn });
            }
          } else {
            skipped++;
            await tx.execute({
              sql: `UPDATE transactions
                    SET description = ?,
                        processed_date = COALESCE(?, processed_date),
                        source_file = ?,
                        source_company = ?
                    WHERE user_id = ? AND date = ? AND charged_amount = ?
                      AND COALESCE(card_last_four, '') = ?`,
              args: [
                txn.description,
                txn.processed_date || null,
                filename,
                sourceCompany,
                userId,
                txn.date,
                txn.charged_amount,
                txn.card_last_four || '',
              ],
            });
          }
        } catch {
          failed++;
        }
      }
      await tx.commit();
    } catch (err) {
      await tx.rollback();
      throw err;
    }

    // Detect soft duplicates
    const softDuplicates: SoftDuplicate[] = [];
    for (const { id: newId, txn } of newlyImportedForeignIds) {
      const existing = (await db.execute({
        sql: `SELECT id, description, date, charged_amount, original_amount, original_currency, card_last_four
              FROM transactions
              WHERE user_id = ? AND date = ? AND description = ?
                AND COALESCE(card_last_four, '') = ?
                AND charged_amount != ?
                AND original_currency != 'ILS'
                AND id != ?`,
        args: [userId, txn.date, txn.description, txn.card_last_four || '', txn.charged_amount, newId],
      })).rows[0] as any;

      if (existing) {
        softDuplicates.push({
          newTransaction: {
            id: newId,
            description: txn.description,
            date: txn.date,
            charged_amount: txn.charged_amount,
            original_amount: txn.original_amount,
            original_currency: txn.original_currency,
            card_last_four: txn.card_last_four || null,
          },
          existingTransaction: {
            id: Number(existing.id),
            description: existing.description as string,
            date: existing.date as string,
            charged_amount: Number(existing.charged_amount),
            original_amount: Number(existing.original_amount),
            original_currency: existing.original_currency as string,
            card_last_four: existing.card_last_four as string | null,
          },
        });
      }
    }

    // Record upload history
    await db.execute({
      sql: `INSERT INTO upload_history (filename, source_company, rows_total, rows_imported, rows_skipped, rows_failed, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [filename, sourceCompany, transactions.length, imported, skipped, failed, userId],
    });

    res.json({ imported, skipped, failed, autoClassified, softDuplicates });
  } catch (err) {
    next(err);
  }
});

// POST /api/upload/resolve-duplicate
router.post('/resolve-duplicate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { keepId, removeId } = req.body;

    if (!keepId || !removeId) {
      res.status(400).json({ error: 'חסרים פרמטרים' });
      return;
    }

    const db = getDb();

    const keepTxn = (await db.execute({
      sql: 'SELECT id FROM transactions WHERE id = ? AND user_id = ?',
      args: [keepId, userId],
    })).rows[0];

    const removeTxn = (await db.execute({
      sql: 'SELECT id FROM transactions WHERE id = ? AND user_id = ?',
      args: [removeId, userId],
    })).rows[0];

    if (!keepTxn || !removeTxn) {
      res.status(404).json({ error: 'עסקה לא נמצאה' });
      return;
    }

    await db.execute({
      sql: 'DELETE FROM transactions WHERE id = ? AND user_id = ?',
      args: [removeId, userId],
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/upload/history
router.get('/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const history = (await db.execute({
      sql: 'SELECT * FROM upload_history WHERE user_id = ? ORDER BY uploaded_at DESC',
      args: [userId],
    })).rows;
    res.json(history);
  } catch (err) {
    next(err);
  }
});

export default router;
