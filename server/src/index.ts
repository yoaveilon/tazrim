import 'dotenv/config';
import app from './app.js';
import { initializeDatabase } from './db/connection.js';

const PORT = process.env.PORT || 3001;

// Initialize database and run migrations
initializeDatabase();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
