import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';

const db = new Database('./data/riseup.db');
const user = db.prepare('SELECT * FROM users LIMIT 1').get() as any;
const token = jwt.sign({id: user.id, email: user.email, name: user.name}, 'riseup-jwt-secret-yoav-2026-prod', {expiresIn: '1h'});

// Check raw data
console.log('\n=== Transactions for 2026-03, user', user.id, '===');
const txns = db.prepare(`
  SELECT t.category_id, c.name, t.charged_amount, t.date
  FROM transactions t
  LEFT JOIN categories c ON t.category_id = c.id
  WHERE t.user_id = ? AND strftime('%Y-%m', t.date) = '2026-03'
  ORDER BY c.name
  LIMIT 20
`).all(user.id);
console.log(JSON.stringify(txns, null, 2));

console.log('\n=== Historical averages (last 3 months) ===');
const hist = db.prepare(`
  SELECT c.id, c.name,
    SUM(t.charged_amount) as total,
    COUNT(DISTINCT strftime('%Y-%m', t.date)) as months_count,
    ROUND(SUM(t.charged_amount) / COUNT(DISTINCT strftime('%Y-%m', t.date))) as avg
  FROM transactions t
  JOIN categories c ON t.category_id = c.id
  WHERE t.user_id = ? AND t.charged_amount > 0 AND c.is_expense = 1
    AND strftime('%Y-%m', t.date) >= '2025-12'
    AND strftime('%Y-%m', t.date) < '2026-03'
  GROUP BY c.id
`).all(user.id);
console.log(JSON.stringify(hist, null, 2));

console.log('\n=== Actual this month per category ===');
const actual = db.prepare(`
  SELECT c.id, c.name, SUM(t.charged_amount) as actual
  FROM transactions t
  JOIN categories c ON t.category_id = c.id
  WHERE t.user_id = ? AND t.charged_amount > 0 AND c.is_expense = 1
    AND strftime('%Y-%m', t.date) = '2026-03'
  GROUP BY c.id
`).all(user.id);
console.log(JSON.stringify(actual, null, 2));

console.log('\n=== All distinct months of data ===');
const months = db.prepare(`
  SELECT DISTINCT strftime('%Y-%m', date) as month, COUNT(*) as cnt
  FROM transactions
  WHERE user_id = ?
  GROUP BY month
  ORDER BY month
`).all(user.id);
console.log(JSON.stringify(months, null, 2));

// Now test the API
const resp = await fetch('http://localhost:3001/api/dashboard/cashflow?month=2026-03', {
  headers: { Authorization: 'Bearer ' + token }
});
const data = await resp.json();
console.log('\n=== API Response ===');
console.log(JSON.stringify(data, null, 2));

db.close();
