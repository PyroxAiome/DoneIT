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
      role TEXT NOT NULL DEFAULT 'employee' CHECK(role IN ('admin','manager','site_manager','employee')),
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

    -- ── Site Inventory Tables ──────────────────────────────────────
    CREATE TABLE IF NOT EXISTS inventory_master (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'General',
      unit TEXT NOT NULL DEFAULT 'pcs',
      description TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS project_material_receipts (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES inventory_master(id) ON DELETE CASCADE,
      qty_received REAL NOT NULL CHECK(qty_received > 0),
      challan_number TEXT DEFAULT '',
      challan_photo TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      status TEXT CHECK(status IN ('pending_manager', 'pending_admin', 'approved', 'rejected')) DEFAULT 'approved',
      received_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      qs_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      manager_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      admin_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      verified_at TIMESTAMP DEFAULT NULL,
      admin_verified_at TIMESTAMP DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS project_material_usage (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
      item_id INTEGER NOT NULL REFERENCES inventory_master(id) ON DELETE CASCADE,
      qty_used REAL NOT NULL CHECK(qty_used > 0),
      installed_location TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      logged_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS project_material_scrap (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES inventory_master(id) ON DELETE CASCADE,
      qty_scrapped REAL NOT NULL CHECK(qty_scrapped > 0),
      reason TEXT NOT NULL,
      photo_url TEXT DEFAULT '',
      logged_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS project_documents (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      doc_type TEXT NOT NULL CHECK(doc_type IN ('dc_stamped', 'quality_report', 'safety_permit', 'handover_sheet', 'general')),
      title TEXT NOT NULL,
      file_url TEXT NOT NULL,
      file_name TEXT DEFAULT '',
      file_size INTEGER DEFAULT 0,
      uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS project_physical_audits (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES inventory_master(id) ON DELETE CASCADE,
      system_expected_qty REAL NOT NULL,
      physical_counted_qty REAL NOT NULL,
      discrepancy_qty REAL NOT NULL,
      audited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      notes TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Migration alter for existing receipts table and role checks
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE users ADD CONSTRAINT users_role_check CHECK(role IN ('admin','manager','site_manager','employee'));

    ALTER TABLE project_members ADD COLUMN IF NOT EXISTS can_access_inventory BOOLEAN DEFAULT false;
    ALTER TABLE project_members ADD COLUMN IF NOT EXISTS can_access_documents BOOLEAN DEFAULT false;

    ALTER TABLE project_material_receipts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved';
    ALTER TABLE project_material_receipts ADD COLUMN IF NOT EXISTS qs_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE project_material_receipts ADD COLUMN IF NOT EXISTS manager_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE project_material_receipts ADD COLUMN IF NOT EXISTS admin_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE project_material_receipts ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP DEFAULT NULL;
    ALTER TABLE project_material_receipts ADD COLUMN IF NOT EXISTS admin_verified_at TIMESTAMP DEFAULT NULL;
    
    ALTER TABLE project_material_receipts ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT '';
    ALTER TABLE project_material_receipts DROP CONSTRAINT IF EXISTS project_material_receipts_status_check;
    ALTER TABLE project_material_receipts ADD CONSTRAINT project_material_receipts_status_check CHECK(status IN ('pending_manager', 'pending_admin', 'approved', 'rejected'));

    ALTER TABLE project_documents ADD COLUMN IF NOT EXISTS manager_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE project_documents ADD COLUMN IF NOT EXISTS admin_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE project_documents ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP DEFAULT NULL;
    ALTER TABLE project_documents ADD COLUMN IF NOT EXISTS admin_verified_at TIMESTAMP DEFAULT NULL;
    ALTER TABLE project_documents ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT '';
    
    ALTER TABLE project_documents DROP CONSTRAINT IF EXISTS project_documents_status_check;
    ALTER TABLE project_documents ADD CONSTRAINT project_documents_status_check CHECK(status IN ('pending_manager', 'pending_admin', 'active', 'rejected', 'archived'));
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
    CREATE INDEX IF NOT EXISTS idx_inv_receipts_proj ON project_material_receipts(project_id);
    CREATE INDEX IF NOT EXISTS idx_inv_usage_proj ON project_material_usage(project_id);
    CREATE INDEX IF NOT EXISTS idx_inv_scrap_proj ON project_material_scrap(project_id);
    CREATE INDEX IF NOT EXISTS idx_proj_docs ON project_documents(project_id);
    CREATE INDEX IF NOT EXISTS idx_proj_audits ON project_physical_audits(project_id);
  `);

  // ── Seed / Ensure Default Master Items ──────────────────────────
  const requiredMasterItems = [
    ['VictoFire 7000 Control Panel', 'Panels', 'sets', 'High-capacity addressable fire cum PA panel'],
    ['VictoFire 300 Addressable Panel', 'Panels', 'sets', 'Addressable fire alarm panel'],
    ['Two Four Zone Panel', 'Panels', 'pcs', '2 Zone / 4 Zone Fire Alarm Panel'],
    ['Multisensor Panel', 'Panels', 'pcs', 'Multisensor Fire Alarm Panel'],
    ['Amplifier', 'Panels', 'pcs', 'Audio Power Amplifier for PA/VA System'],
    ['UPS', 'Panels', 'pcs', 'Uninterruptible Power Supply Unit'],
    ['Repeater Panel', 'Panels', 'pcs', 'Remote Repeater Display Panel'],
    ['Beam Detector', 'Detectors', 'pcs', 'Optical Beam Smoke Detector'],
    ['VictoFire 2508 Smoke Detector', 'Detectors', 'pcs', 'False-alarm immune optical smoke detector'],
    ['Thermal / Heat Detector', 'Detectors', 'pcs', 'Fixed temperature thermal detector'],
    ['VictoFire Flat Module', 'Modules', 'pcs', 'Residential unit interface module'],
    ['VictoFire Lobby Module', 'Modules', 'pcs', 'Floor/corridor interface module'],
    ['VictoFire Area Module', 'Modules', 'pcs', 'Commercial zone interface module'],
    ['Manual Call Point (MCP)', 'Notifiers', 'pcs', 'Break-glass manual call point'],
    ['PA Speaker & Sounder', 'Notifiers', 'pcs', 'Public address speaker cum hooter'],
    ['2-Core FRLS Armoured Cable', 'Cabling', 'meters', 'Fire resistant low smoke cable'],
    ['PVC Conduit Pipe 25mm', 'Accessories', 'meters', 'Heavy duty rigid PVC conduit']
  ];

  for (const item of requiredMasterItems) {
    const { rows: existing } = await pool.query('SELECT id FROM inventory_master WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))', [item[0]]);
    if (existing.length === 0) {
      await pool.query(
        'INSERT INTO inventory_master (name, category, unit, description) VALUES ($1, $2, $3, $4)',
        item
      );
    }
  }

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
