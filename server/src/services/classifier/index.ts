import { getDb } from '../../db/connection.js';
import type { ClassificationRule, ParsedTransaction } from 'shared/src/types.js';
import { classifyByKeyword } from './keyword-classifier.js';

export interface ClassifiedTransaction extends ParsedTransaction {
  category_id: number | null;
  classification_method: 'keyword' | 'ai' | 'manual' | 'history' | null;
}

export async function classifyTransactions(
  transactions: ParsedTransaction[],
  userId?: number
): Promise<ClassifiedTransaction[]> {
  const db = getDb();

  const manualHistoryMap = new Map<string, number>();
  if (userId) {
    const manuallyClassified = (await db.execute({
      sql: `SELECT description, category_id FROM transactions
            WHERE user_id = ? AND classification_method = 'manual' AND category_id IS NOT NULL
            ORDER BY date DESC`,
      args: [userId],
    })).rows as unknown as Array<{ description: string; category_id: number }>;

    for (const row of manuallyClassified) {
      const key = (row.description as string).trim().toLowerCase();
      if (!manualHistoryMap.has(key)) {
        manualHistoryMap.set(key, Number(row.category_id));
      }
    }
  }

  let rulesQuery = `SELECT id, keyword, category_id, priority, is_regex FROM classification_rules`;
  const params: any[] = [];

  if (userId) {
    rulesQuery += ' WHERE user_id = ? OR user_id IS NULL';
    params.push(userId);
  }
  rulesQuery += ' ORDER BY priority DESC';

  const rules = (await db.execute({ sql: rulesQuery, args: params })).rows as unknown as ClassificationRule[];

  return transactions.map(txn => {
    const normalizedDesc = txn.description.trim().toLowerCase();
    const historyCategoryId = manualHistoryMap.get(normalizedDesc);
    if (historyCategoryId) {
      return { ...txn, category_id: historyCategoryId, classification_method: 'history' as const };
    }

    const result = classifyByKeyword(txn.description, rules);
    return { ...txn, category_id: result.categoryId, classification_method: result.method };
  });
}

export async function reclassifyAll(month?: string, userId?: number): Promise<{ updated: number }> {
  const db = getDb();

  const manualHistoryMap = new Map<string, number>();
  if (userId) {
    const manuallyClassified = (await db.execute({
      sql: `SELECT description, category_id FROM transactions
            WHERE user_id = ? AND classification_method = 'manual' AND category_id IS NOT NULL
            ORDER BY date DESC`,
      args: [userId],
    })).rows as unknown as Array<{ description: string; category_id: number }>;

    for (const row of manuallyClassified) {
      const key = (row.description as string).trim().toLowerCase();
      if (!manualHistoryMap.has(key)) {
        manualHistoryMap.set(key, Number(row.category_id));
      }
    }
  }

  let rulesQuery = `SELECT id, keyword, category_id, priority, is_regex FROM classification_rules`;
  const rulesParams: any[] = [];
  if (userId) {
    rulesQuery += ' WHERE user_id = ? OR user_id IS NULL';
    rulesParams.push(userId);
  }
  rulesQuery += ' ORDER BY priority DESC';
  const rules = (await db.execute({ sql: rulesQuery, args: rulesParams })).rows as unknown as ClassificationRule[];

  let query = "SELECT id, description FROM transactions WHERE classification_method != 'manual'";
  const conditions: string[] = [];
  const params: any[] = [];

  if (userId) { conditions.push('user_id = ?'); params.push(userId); }
  if (month) {
    conditions.push("strftime('%Y-%m', COALESCE(processed_date, date)) = ?");
    params.push(month);
  }
  if (conditions.length > 0) query += ' AND ' + conditions.join(' AND ');

  const transactions = (await db.execute({ sql: query, args: params })).rows as unknown as Array<{ id: number; description: string }>;

  let updated = 0;
  const updateStmts: any[] = [];

  for (const txn of transactions) {
    const normalizedDesc = (txn.description as string).trim().toLowerCase();
    const historyCategoryId = manualHistoryMap.get(normalizedDesc);

    if (historyCategoryId) {
      updateStmts.push({
        sql: `UPDATE transactions SET category_id = ?, classification_method = ? WHERE id = ?`,
        args: [historyCategoryId, 'history', txn.id],
      });
      updated++;
      continue;
    }

    const result = classifyByKeyword(txn.description as string, rules);
    if (result.categoryId) {
      updateStmts.push({
        sql: `UPDATE transactions SET category_id = ?, classification_method = ? WHERE id = ?`,
        args: [result.categoryId, result.method, txn.id],
      });
      updated++;
    }
  }

  if (updateStmts.length > 0) {
    await db.batch(updateStmts, 'write');
  }

  return { updated };
}
