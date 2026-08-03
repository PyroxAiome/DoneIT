import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database(join(__dirname, '..', 'doneit.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin','manager','employee')) DEFAULT 'employee',
    department TEXT DEFAULT 'Engineering',
    avatar_url TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  
  CREATE TABLE IF NOT EXISTS admin_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES admin_comments(id) ON DELETE CASCADE,
    comment_text TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS task_daily_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    log_date TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS task_daily_log_reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    log_id INTEGER NOT NULL REFERENCES task_daily_logs(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction_type TEXT CHECK(reaction_type IN ('like', 'dislike')) NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(log_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS task_daily_log_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    log_id INTEGER NOT NULL REFERENCES task_daily_logs(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comment_text TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

const seedAdmin = () => {
  const existing = db.prepare("SELECT id FROM users WHERE email = 'admin@admin.com'").get();
  if (existing) return;

  const hash = bcrypt.hashSync('admin', 10);
  db.prepare(
    'INSERT INTO users (name, email, password_hash, role, department) VALUES (?, ?, ?, ?, ?)'
  ).run('Admin', 'admin@admin.com', hash, 'admin', 'Executive');
};

seedAdmin();

try { db.exec("ALTER TABLE tasks ADD COLUMN logical_explanation TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE tasks ADD COLUMN last_edited_by INTEGER REFERENCES users(id) ON DELETE SET NULL"); } catch {}
try { db.exec("ALTER TABLE tasks ADD COLUMN parent_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL"); } catch {}
try { db.exec("ALTER TABLE admin_comments ADD COLUMN parent_id INTEGER REFERENCES admin_comments(id) ON DELETE CASCADE"); } catch {}
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_explanations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      explanation_text TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
} catch (e) {}

export default db;
