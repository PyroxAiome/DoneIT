// Usage: DATABASE_URL=postgresql://user:pass@host/db node server/migrate-data.js
// Or set DATABASE_URL in .env file and run: node server/migrate-data.js

import Database from 'better-sqlite3';
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, '..', 'doneit.db');

if (!process.env.DATABASE_URL) {
  console.error("❌ ERROR: DATABASE_URL environment variable is not set.");
  process.exit(1);
}

if (!fs.existsSync(dbPath)) {
  console.error(`❌ ERROR: SQLite database not found at ${dbPath}`);
  process.exit(1);
}

const sqliteDb = new Database(dbPath, { readonly: true });
const { Client } = pg;
const pgClient = new Client({
  connectionString: process.env.DATABASE_URL,
});

const tables = [
  'users',
  'tasks',
  'admin_comments',
  'notifications',
  'task_daily_logs',
  'task_daily_log_reactions',
  'task_daily_log_comments',
  'task_explanations',
  'task_dependencies'
];

async function migrate() {
  await pgClient.connect();
  console.log("Connected to PostgreSQL.");
  
  try {
    await pgClient.query('BEGIN');
    
    // Truncate existing tables so SQLite data can be imported cleanly without ID collisions
    const tableListStr = tables.join(', ');
    await pgClient.query(`TRUNCATE TABLE ${tableListStr} CASCADE`);
    
    for (const table of tables) {
      const rows = sqliteDb.prepare(`SELECT * FROM ${table}`).all();
      
      if (rows.length === 0) {
        console.log(`Migrating ${table}... 0 rows migrated.`);
        continue;
      }
      
      const columns = Object.keys(rows[0]);
      
      for (const row of rows) {
        const values = columns.map(col => row[col]);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        
        const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
        await pgClient.query(query, values);
      }
      
      // Reset sequence
      if (columns.includes('id')) {
        await pgClient.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), (SELECT COALESCE(MAX(id), 0) FROM ${table}) + 1, false);`);
      }
      
      console.log(`Migrating ${table}... ${rows.length} rows migrated.`);
    }
    
    await pgClient.query('COMMIT');
    console.log("Migration committed successfully.");
    
    // Verification step
    console.log("\nVerifying migration...");
    console.log(`╔══════════════════════════════╦═══════════╦════════════════╦═════════╗`);
    console.log(`║ Table                        ║ SQLite    ║ PostgreSQL     ║ Status  ║`);
    console.log(`╠══════════════════════════════╬═══════════╬════════════════╬═════════╣`);
    
    let allOk = true;
    for (const table of tables) {
      const sqliteCountResult = sqliteDb.prepare(`SELECT count(*) as count FROM ${table}`).get();
      const sqliteCount = sqliteCountResult.count;
      
      const pgCountResult = await pgClient.query(`SELECT count(*) FROM ${table}`);
      const pgCount = parseInt(pgCountResult.rows[0].count, 10);
      
      const isMatch = sqliteCount === pgCount;
      const status = isMatch ? '✅ OK   ' : '❌ ERR  ';
      if (!isMatch) allOk = false;
      
      const tableNamePadded = table.padEnd(28, ' ');
      const sqliteCountPadded = sqliteCount.toString().padEnd(9, ' ');
      const pgCountPadded = pgCount.toString().padEnd(14, ' ');
      
      console.log(`║ ${tableNamePadded} ║ ${sqliteCountPadded} ║ ${pgCountPadded} ║ ${status} ║`);
    }
    console.log(`╚══════════════════════════════╩═══════════╩════════════════╩═════════╝`);
    
    if (!allOk) {
      console.error("\n❌ MISMATCH detected in data verification.");
      process.exit(1);
    } else {
      console.log("\n✅ All tables migrated and verified successfully.");
    }
    
  } catch (err) {
    await pgClient.query('ROLLBACK');
    console.error("❌ ERROR during migration:", err);
    process.exit(1);
  } finally {
    sqliteDb.close();
    await pgClient.end();
  }
}

migrate();
