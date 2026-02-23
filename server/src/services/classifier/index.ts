import { getDb } from '../../db/connection.js';
import type { ClassificationRule, ParsedTransaction } from 'shared/src/types.js';
import { classifyByKeyword } from './keyword-classifier.js';

export interface ClassifiedTransaction extends ParsedTransaction {
  category_id: number | null;
  classification_method: 'keyword' | 'ai' | 'manual' | 'history' | null;
}

export function classifyTransactions(
  transactions: ParsedTransaction[],
  userId?: number
): ClassifiedTransaction[] {
  const db = getDb();

  // Build a map of description -> category_id from previously manually classified transactions
  // This allows auto-classifying new transactions based on past manual classifications
  const manualHistoryMap = new Map<string, number>();
  if (userId) {
    const manuallyClassified = db.prepare(`
      SELECT description, category_id
      FROM transactions
      WHERE user_id = ? AND classification_method = 'manual' AND category_id IS NOT NULL
      ORDER BY date DESC
    `).all(userId) as Array<{ description: string; category_id: number }>;

    for (const row of manuallyClassified) {
      const key = row.description.trim().toLowerCase();
      // First match wins (most recent, since sorted by date DESC)
      if (!manualHistoryMap.has(key)) {
        manualHistoryMap.set(key, row.category_id);
      }
    }
  }

  // Load rules sorted by priority DESC - include global rules (user_id IS NULL) and user's rules
  let rulesQuery = `
    SELECT id, keyword, category_id, priority, is_regex
    FROM classification_rules
  `;
  const params: any[] = [];

  if (userId) {
    rulesQuery += ' WHERE user_id = ? OR user_id IS NULL';
    params.push(userId);
  }

  rulesQuery += ' ORDER BY priority DESC';

  const rules = db.prepare(rulesQuery).all(...params) as ClassificationRule[];

  return transactions.map(txn => {
    // Priority 1: Check manual history - if this description was manually classified before, use that
    const normalizedDesc = txn.description.trim().toLowerCase();
    const historyCategoryId = manualHistoryMap.get(normalizedDesc);
    if (historyCategoryId) {
      return {
        ...txn,
        category_id: historyCategoryId,
        classification_method: 'history' as const,
      };
    }

    // Priority 2: Fall back to keyword rules
    const result = classifyByKeyword(txn.description, rules);
    return {
      ...txn,
      category_id: result.categoryId,
      classification_method: result.method,
    };
  });
}

export function reclassifyAll(month?: string, userId?: number): { updated: number } {
  const db = getDb();

  // Build manual history map (skip manually classified transactions themselves)
  const manualHistoryMap = new Map<string, number>();
  if (userId) {
    const manuallyClassified = db.prepare(`
      SELECT description, category_id
      FROM transactions
      WHERE user_id = ? AND classification_method = 'manual' AND category_id IS NOT NULL
      ORDER BY date DESC
    `).all(userId) as Array<{ description: string; category_id: number }>;

    for (const row of manuallyClassified) {
      const key = row.description.trim().toLowerCase();
      if (!manualHistoryMap.has(key)) {
        manualHistoryMap.set(key, row.category_id);
      }
    }
  }

  // Load rules - include global + user-specific
  let rulesQuery = `
    SELECT id, keyword, category_id, priority, is_regex
    FROM classification_rules
  `;
  const rulesParams: any[] = [];

  if (userId) {
    rulesQuery += ' WHERE user_id = ? OR user_id IS NULL';
    rulesParams.push(userId);
  }

  rulesQuery += ' ORDER BY priority DESC';

  const rules = db.prepare(rulesQuery).all(...rulesParams) as ClassificationRule[];

  // Only reclassify non-manually classified transactions
  let query = "SELECT id, description FROM transactions WHERE classification_method != 'manual'";
  const conditions: string[] = [];
  const params: any[] = [];

  if (userId) {
    conditions.push('user_id = ?');
    params.push(userId);
  }

  if (month) {
    conditions.push("strftime('%Y-%m', COALESCE(processed_date, date)) = ?");
    params.push(month);
  }

  if (conditions.length > 0) {
    query += ' AND ' + conditions.join(' AND ');
  }

  const transactions = db.prepare(query).all(...params) as Array<{ id: number; description: string }>;

  const updateStmt = db.prepare(`
    UPDATE transactions
    SET category_id = ?, classification_method = ?
    WHERE id = ?
  `);

  let updated = 0;
  const updateMany = db.transaction(() => {
    for (const txn of transactions) {
      // Priority 1: Check manual history
      const normalizedDesc = txn.description.trim().toLowerCase();
      const historyCategoryId = manualHistoryMap.get(normalizedDesc);
      if (historyCategoryId) {
        updateStmt.run(historyCategoryId, 'history', txn.id);
        updated++;
        continue;
      }

      // Priority 2: Keyword rules
      const result = classifyByKeyword(txn.description, rules);
      if (result.categoryId) {
        updateStmt.run(result.categoryId, result.method, txn.id);
        updated++;
      }
    }
  });

  updateMany();
  return { updated };
}
