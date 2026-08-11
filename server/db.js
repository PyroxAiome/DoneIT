import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/doneit',
});

// Log unexpected connection errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(-1);
});

/**
 * Run a query against the pool.
 * @param {string} text - SQL query text with $1, $2, ... placeholders
 * @param {Array} params - parameter values
 * @returns {Promise<{rows: Array, rowCount: number}>}
 */
const query = (text, params) => pool.query(text, params);

/**
 * Get a dedicated client from the pool (for transactions).
 * Remember to call client.release() when done.
 */
const getClient = () => pool.connect();

/**
 * Initialize all database tables and seed the admin user.
 * Called once at server startup.
 */
const initDatabase = async () => {
  // ── Create Tables ──────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'employee' CHECK(role IN ('admin','manager','employee')),
      department TEXT DEFAULT 'Engineering',
      avatar_url TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      color TEXT CHECK(color IN ('slate','yellow','blue','green','purple','red')) DEFAULT 'slate',
      status TEXT CHECK(status IN ('todo','in_progress','under_review','completed','blocked')) DEFAULT 'todo',
      priority TEXT CHECK(priority IN ('low','medium','high','urgent')) DEFAULT 'medium',
      category TEXT DEFAULT 'General',
      assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      creator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      parent_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
      progress_percent INTEGER DEFAULT 0 CHECK(progress_percent >= 0 AND progress_percent <= 100),
      start_date TEXT,
      due_date TEXT,
      estimated_hours REAL DEFAULT 0,
      logical_explanation TEXT DEFAULT '',
      last_edited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT CHECK(status IN ('active','archived','completed')) DEFAULT 'active',
      creator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS project_members (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(project_id, user_id)
    );

    -- Add project_id to existing tasks table
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;

    CREATE TABLE IF NOT EXISTS admin_comments (
      id SERIAL PRIMARY KEY,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      parent_id INTEGER REFERENCES admin_comments(id) ON DELETE CASCADE,
      comment_text TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
      is_read INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS task_daily_logs (
      id SERIAL PRIMARY KEY,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      log_date TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS task_daily_log_reactions (
      id SERIAL PRIMARY KEY,
      log_id INTEGER NOT NULL REFERENCES task_daily_logs(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reaction_type TEXT CHECK(reaction_type IN ('like', 'dislike')) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(log_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS task_daily_log_comments (
      id SERIAL PRIMARY KEY,
      log_id INTEGER NOT NULL REFERENCES task_daily_logs(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      comment_text TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS task_explanations (
      id SERIAL PRIMARY KEY,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      explanation_text TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS task_dependencies (
      id SERIAL PRIMARY KEY,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tagee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      dependency_text TEXT NOT NULL,
      reply_text TEXT DEFAULT NULL,
      status TEXT CHECK(status IN ('pending', 'resolved', 'confirmed')) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMP DEFAULT NULL
    );
  `);

  // ── Create Indexes ─────────────────────────────────────────────
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
    CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);
    CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
    CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
  `);

  // ── Seed Admin User ────────────────────────────────────────────
  const { rows } = await pool.query("SELECT id FROM users WHERE email = 'admin@admin.com'");
  if (rows.length === 0) {
    const hash = bcrypt.hashSync('admin', 10);
    await pool.query(
      'INSERT INTO users (name, email, password_hash, role, department) VALUES ($1, $2, $3, $4, $5)',
      ['Admin', 'admin@admin.com', hash, 'admin', 'Executive']
    );
    console.log('Admin user seeded.');
  }

  console.log('PostgreSQL database initialized successfully.');
};

const db = { query, getClient, pool };
export { initDatabase };
export default db;
