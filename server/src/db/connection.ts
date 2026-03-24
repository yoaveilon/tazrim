import { createClient, Client } from '@libsql/client';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db: Client;

export function getDb(): Client {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

export async function initializeDatabase(): Promise<void> {
  const url = process.env.TURSO_CONNECTION_URL
    || `file:${path.join(__dirname, '..', '..', 'data', 'riseup.db')}`;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  db = createClient({ url, authToken });

  // Enable foreign keys (best-effort — not supported in all Turso modes)
  try {
    await db.execute('PRAGMA foreign_keys = ON');
  } catch { /* ignored */ }

  await runMigrations();

  console.log('Database initialized at', url);
}

async function runMigrations(): Promise<void> {
  // Create migrations tracking table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const appliedRows = (await db.execute('SELECT name FROM _migrations ORDER BY name')).rows;
  const applied = new Set(appliedRows.map(r => r.name as string));

  const migrationsDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.warn('No migrations directory found');
    return;
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Migrations: ${applied.size} applied, ${files.length} total`);

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    console.log(`Running migration: ${file}`);

    try {
      // Split into individual statements and batch with migration tracking
      const stmts = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .map(s => ({ sql: s, args: [] as any[] }));

      stmts.push({ sql: 'INSERT INTO _migrations (name) VALUES (?)', args: [file] });

      await db.batch(stmts, 'write');
      console.log(`Migration ${file} completed`);
    } catch (err) {
      console.error(`Migration ${file} failed:`, err);
      throw err;
    }
  }
}
