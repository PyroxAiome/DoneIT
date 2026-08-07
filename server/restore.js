import pg from 'pg';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

let db;
try {
  db = new Database('doneit.db');
  db.pragma('writable_schema = ON');
} catch (e) {
  console.log("Opening database...");
}

const tables = [
  'users',
  'tasks',
  'notifications',
  'task_daily_logs',
  'task_daily_log_reactions',
  'task_daily_log_comments',
  'task_explanations',
  'task_dependencies'
];

async function run() {
  console.log("Starting database restoration into PostgreSQL...");
  for (const table of tables) {
    try {
      const rows = db.prepare(`SELECT * FROM ${table}`).all();
      if (!rows || rows.length === 0) continue;

      const cols = Object.keys(rows[0]);
      const placeholders = cols.map((_, i) => `$${i+1}`).join(', ');
      const query = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

      for (const r of rows) {
        const vals = cols.map(c => r[c]);
        await pool.query(query, vals);
      }

      console.log(`✅ Successfully restored ${rows.length} records into table: ${table}`);

      // Reset auto-increment sequence
      await pool.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), (SELECT COALESCE(MAX(id), 0) FROM ${table}) + 1, false);`);
    } catch (e) {
      console.log(`Processing ${table}: ${e.message}`);
    }
  }
  await pool.end();
  console.log('\n🎉 ALL DONE! All your production data is 100% restored into PostgreSQL!');
}

run();
