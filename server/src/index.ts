import 'dotenv/config';
import app from './app.js';
import { initializeDatabase } from './db/connection.js';

const PORT = process.env.PORT || 3001;

try {
  await initializeDatabase();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
} catch (err) {
  console.error('Failed to initialize database:', err);
  process.exit(1);
}
