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
  // ── Drop legacy restrictive check constraint on users.role ─────────────
  try {
    await pool.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
  } catch (e) {
    console.log('users_role_check drop note:', e.message);
  }

  // ── Add mentor_id column to users for intern supervisor relationship ───
  try {
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS mentor_id INTEGER REFERENCES users(id) ON DELETE SET NULL');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS can_access_nirantar BOOLEAN DEFAULT FALSE');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS can_access_saksham BOOLEAN DEFAULT FALSE');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS can_access_sales BOOLEAN DEFAULT FALSE');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS manual_training_level TEXT DEFAULT NULL');
  } catch (e) {
    console.log('users mentor_id & track permissions column migration note:', e.message);
  }

  // ── Add Nirantar custom columns to tasks ────────────────────────────────
  try {
    await pool.query('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS vacancies_count INTEGER DEFAULT 0');
    await pool.query('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS hiring_stage TEXT DEFAULT \'\'');
    await pool.query('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS hr_strategy_notes TEXT DEFAULT \'\'');
    await pool.query('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS hiring_department TEXT DEFAULT \'\'');
    await pool.query('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS hiring_lead_id INTEGER REFERENCES users(id) ON DELETE SET NULL');
    await pool.query('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS way_of_hiring TEXT DEFAULT \'\'');
    await pool.query('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS hiring_stage_updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL');
    await pool.query('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS hiring_stage_updated_at TIMESTAMP');
  } catch (e) {
    console.log('tasks Nirantar columns migration note:', e.message);
  }

  // ── Add Saksham custom columns to tasks ─────────────────────────────────
  try {
    await pool.query('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS training_module TEXT DEFAULT \'\'');
    await pool.query('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS training_level TEXT DEFAULT \'Beginner\'');
    await pool.query('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS training_video_url TEXT DEFAULT \'\'');
    await pool.query('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS training_doc_url TEXT DEFAULT \'\'');
  } catch (e) {
    console.log('tasks Saksham columns migration note:', e.message);
  }

  // ── Add verification columns to project_physical_audits ──────────────
  try {
    await pool.query('ALTER TABLE project_physical_audits ADD COLUMN IF NOT EXISTS status TEXT DEFAULT \'pending\'');
    await pool.query('ALTER TABLE project_physical_audits ADD COLUMN IF NOT EXISTS verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL');
    await pool.query('ALTER TABLE project_physical_audits ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP');
    await pool.query('ALTER TABLE project_physical_audits ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT \'\'');
  } catch (e) {
    console.log('project_physical_audits verification columns migration note:', e.message);
  }

  // ── Add verification columns to project_material_usage ───────────────
  try {
    await pool.query('ALTER TABLE project_material_usage ADD COLUMN IF NOT EXISTS status TEXT DEFAULT \'approved\'');
    await pool.query('ALTER TABLE project_material_usage ADD COLUMN IF NOT EXISTS manager_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL');
    await pool.query('ALTER TABLE project_material_usage ADD COLUMN IF NOT EXISTS admin_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL');
    await pool.query('ALTER TABLE project_material_usage ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP DEFAULT NULL');
    await pool.query('ALTER TABLE project_material_usage ADD COLUMN IF NOT EXISTS admin_verified_at TIMESTAMP DEFAULT NULL');
    await pool.query('ALTER TABLE project_material_usage ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT \'\'');
    await pool.query('ALTER TABLE project_material_usage DROP CONSTRAINT IF EXISTS project_material_usage_status_check');
    await pool.query('ALTER TABLE project_material_usage ADD CONSTRAINT project_material_usage_status_check CHECK(status IN (\'pending_manager\', \'pending_admin\', \'approved\', \'rejected\'))');
  } catch (e) {
    console.log('project_material_usage verification migration note:', e.message);
  }

  // ── Add verification columns to project_material_scrap ───────────────
  try {
    await pool.query('ALTER TABLE project_material_scrap ADD COLUMN IF NOT EXISTS status TEXT DEFAULT \'approved\'');
    await pool.query('ALTER TABLE project_material_scrap ADD COLUMN IF NOT EXISTS manager_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL');
    await pool.query('ALTER TABLE project_material_scrap ADD COLUMN IF NOT EXISTS admin_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL');
    await pool.query('ALTER TABLE project_material_scrap ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP DEFAULT NULL');
    await pool.query('ALTER TABLE project_material_scrap ADD COLUMN IF NOT EXISTS admin_verified_at TIMESTAMP DEFAULT NULL');
    await pool.query('ALTER TABLE project_material_scrap ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT \'\'');
    await pool.query('ALTER TABLE project_material_scrap DROP CONSTRAINT IF EXISTS project_material_scrap_status_check');
    await pool.query('ALTER TABLE project_material_scrap ADD CONSTRAINT project_material_scrap_status_check CHECK(status IN (\'pending_manager\', \'pending_admin\', \'approved\', \'rejected\'))');
  } catch (e) {
    console.log('project_material_scrap verification migration note:', e.message);
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'employee',
      department TEXT DEFAULT 'Engineering',
      avatar_url TEXT DEFAULT '',
      mentor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
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

    -- Add project_id and verifier columns to existing tasks table
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS verifier_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS pillar TEXT DEFAULT 'general';

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
      status TEXT DEFAULT 'pending_manager' CHECK(status IN ('pending_manager', 'pending_admin', 'approved', 'rejected')),
      logged_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      manager_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      admin_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      verified_at TIMESTAMP DEFAULT NULL,
      admin_verified_at TIMESTAMP DEFAULT NULL,
      rejection_reason TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS project_material_scrap (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES inventory_master(id) ON DELETE CASCADE,
      qty_scrapped REAL NOT NULL CHECK(qty_scrapped > 0),
      reason TEXT NOT NULL,
      photo_url TEXT DEFAULT '',
      status TEXT DEFAULT 'pending_manager' CHECK(status IN ('pending_manager', 'pending_admin', 'approved', 'rejected')),
      logged_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      manager_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      admin_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      verified_at TIMESTAMP DEFAULT NULL,
      admin_verified_at TIMESTAMP DEFAULT NULL,
      rejection_reason TEXT DEFAULT '',
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
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'verified', 'rejected')),
      audited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      verified_at TIMESTAMP DEFAULT NULL,
      rejection_reason TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- ── Repeated Tasks & Periodic Review Tables ──────────────────
    CREATE TABLE IF NOT EXISTS repeated_tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      frequency TEXT CHECK(frequency IN ('daily', 'weekly', 'biweekly', 'monthly')) DEFAULT 'weekly',
      meeting_day TEXT DEFAULT 'Monday',
      meeting_time TEXT DEFAULT '10:00 AM',
      category TEXT DEFAULT 'General',
      priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
      status TEXT CHECK(status IN ('active', 'paused', 'completed')) DEFAULT 'active',
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      creator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS repeated_task_members (
      id SERIAL PRIMARY KEY,
      task_id INTEGER NOT NULL REFERENCES repeated_tasks(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_in_task TEXT DEFAULT 'reviewer',
      added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(task_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS repeated_task_reviews (
      id SERIAL PRIMARY KEY,
      task_id INTEGER NOT NULL REFERENCES repeated_tasks(id) ON DELETE CASCADE,
      logged_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      review_date DATE NOT NULL DEFAULT CURRENT_DATE,
      discussion_notes TEXT NOT NULL,
      action_items TEXT DEFAULT '',
      status_outcome TEXT CHECK(status_outcome IN ('on_track', 'needs_attention', 'blocked', 'completed')) DEFAULT 'on_track',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Migration: remove legacy role check constraint (new roles added)
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

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

    ALTER TABLE project_material_usage ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved';
    ALTER TABLE project_material_usage ADD COLUMN IF NOT EXISTS manager_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE project_material_usage ADD COLUMN IF NOT EXISTS admin_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE project_material_usage ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP DEFAULT NULL;
    ALTER TABLE project_material_usage ADD COLUMN IF NOT EXISTS admin_verified_at TIMESTAMP DEFAULT NULL;
    ALTER TABLE project_material_usage ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT '';
    ALTER TABLE project_material_usage DROP CONSTRAINT IF EXISTS project_material_usage_status_check;
    ALTER TABLE project_material_usage ADD CONSTRAINT project_material_usage_status_check CHECK(status IN ('pending_manager', 'pending_admin', 'approved', 'rejected'));

    ALTER TABLE project_material_scrap ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved';
    ALTER TABLE project_material_scrap ADD COLUMN IF NOT EXISTS manager_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE project_material_scrap ADD COLUMN IF NOT EXISTS admin_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE project_material_scrap ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP DEFAULT NULL;
    ALTER TABLE project_material_scrap ADD COLUMN IF NOT EXISTS admin_verified_at TIMESTAMP DEFAULT NULL;
    ALTER TABLE project_material_scrap ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT '';
    ALTER TABLE project_material_scrap DROP CONSTRAINT IF EXISTS project_material_scrap_status_check;
    ALTER TABLE project_material_scrap ADD CONSTRAINT project_material_scrap_status_check CHECK(status IN ('pending_manager', 'pending_admin', 'approved', 'rejected'));

    ALTER TABLE project_documents ADD COLUMN IF NOT EXISTS manager_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE project_documents ADD COLUMN IF NOT EXISTS admin_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE project_documents ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP DEFAULT NULL;
    ALTER TABLE project_documents ADD COLUMN IF NOT EXISTS admin_verified_at TIMESTAMP DEFAULT NULL;
    ALTER TABLE project_documents ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT '';
    
    ALTER TABLE project_documents DROP CONSTRAINT IF EXISTS project_documents_status_check;
    ALTER TABLE project_documents ADD CONSTRAINT project_documents_status_check CHECK(status IN ('pending_manager', 'pending_admin', 'active', 'rejected', 'archived'));
    -- ── Sales Pipeline Tables ──────────────────────────────────────
    CREATE TABLE IF NOT EXISTS sales_goals (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      target_value REAL DEFAULT 0,
      target_leads INTEGER DEFAULT 0,
      period_type TEXT DEFAULT 'monthly' CHECK(period_type IN ('monthly','quarterly','yearly','custom')),
      period_start TEXT,
      period_end TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','completed','archived')),
      creator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales_leads (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      category TEXT DEFAULT 'general' CHECK(category IN ('general','lakshya')),
      goal_id INTEGER REFERENCES sales_goals(id) ON DELETE SET NULL,
      current_stage TEXT NOT NULL DEFAULT 'suspect' CHECK(current_stage IN ('suspect','prospect','enquiry','presentation','demo','spec_tender','design_negotiation','dfp','order','billing')),
      stage_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      stage_updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      lead_value REAL DEFAULT 0,
      probability_pct INTEGER DEFAULT 5 CHECK(probability_pct >= 0 AND probability_pct <= 100),
      skipped_stages TEXT DEFAULT '[]',
      lead_source TEXT DEFAULT '' CHECK(lead_source IN ('','referral','cold_call','website','exhibition','tender_portal','consultant','existing_client','other')),
      industry TEXT DEFAULT '' CHECK(industry IN ('','real_estate','banking','healthcare','education','government','hospitality','manufacturing','retail','it_ites','infrastructure','energy','other')),
      product_category TEXT DEFAULT '' CHECK(product_category IN ('','building_automation','hvac','electrical','plumbing','fire_safety','integrated_solution','other')),
      priority TEXT DEFAULT 'medium' CHECK(priority IN ('low','medium','high','critical')),
      region TEXT DEFAULT '' CHECK(region IN ('','north_india','south_india','west_india','east_india','central_india','international')),
      country TEXT DEFAULT 'India',
      city TEXT DEFAULT '',
      site_address TEXT DEFAULT '',
      consultant_name TEXT DEFAULT '',
      consultant_firm TEXT DEFAULT '',
      consultant_email TEXT DEFAULT '',
      consultant_phone TEXT DEFAULT '',
      assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      creator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      expected_close_date TEXT,
      actual_close_date TEXT,
      enquiry_month TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales_lead_contacts (
      id SERIAL PRIMARY KEY,
      lead_id INTEGER NOT NULL REFERENCES sales_leads(id) ON DELETE CASCADE,
      contact_name TEXT NOT NULL,
      contact_role TEXT DEFAULT '' CHECK(contact_role IN ('','technical_head','management','procurement','architect','consultant','project_manager','finance','other')),
      contact_email TEXT DEFAULT '',
      contact_phone TEXT DEFAULT '',
      company_name TEXT DEFAULT '',
      is_leverage BOOLEAN DEFAULT FALSE,
      notes TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales_stage_history (
      id SERIAL PRIMARY KEY,
      lead_id INTEGER NOT NULL REFERENCES sales_leads(id) ON DELETE CASCADE,
      from_stage TEXT,
      to_stage TEXT NOT NULL,
      was_skipped BOOLEAN DEFAULT FALSE,
      skipped_list TEXT DEFAULT '[]',
      probability_pct_at INTEGER DEFAULT 0,
      lead_value_at REAL DEFAULT 0,
      notes TEXT DEFAULT '',
      changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales_daily_logs (
      id SERIAL PRIMARY KEY,
      lead_id INTEGER NOT NULL REFERENCES sales_leads(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      log_date TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(lead_id, user_id, log_date)
    );

    CREATE TABLE IF NOT EXISTS sales_daily_log_comments (
      id SERIAL PRIMARY KEY,
      log_id INTEGER NOT NULL REFERENCES sales_daily_logs(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      comment_text TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales_lead_activities (
      id SERIAL PRIMARY KEY,
      lead_id INTEGER NOT NULL REFERENCES sales_leads(id) ON DELETE CASCADE,
      activity_type TEXT NOT NULL CHECK(activity_type IN ('call','meeting','email','site_visit','presentation','negotiation','follow_up','document_shared','positive_event','negative_event')),
      negative_reason TEXT DEFAULT '' CHECK(negative_reason IN ('','client_delay','competitor_entered','budget_cut','contact_changed')),
      stage_at_time TEXT NOT NULL,
      title TEXT DEFAULT '',
      description TEXT NOT NULL,
      probability_change INTEGER DEFAULT 0,
      logged_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      activity_date TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    CREATE INDEX IF NOT EXISTS idx_inv_receipts_proj ON project_material_receipts(project_id);
    CREATE INDEX IF NOT EXISTS idx_inv_usage_proj ON project_material_usage(project_id);
    CREATE INDEX IF NOT EXISTS idx_inv_scrap_proj ON project_material_scrap(project_id);
    CREATE INDEX IF NOT EXISTS idx_proj_docs ON project_documents(project_id);
    CREATE INDEX IF NOT EXISTS idx_proj_audits ON project_physical_audits(project_id);
    CREATE INDEX IF NOT EXISTS idx_sales_leads_assignee ON sales_leads(assignee_id);
    CREATE INDEX IF NOT EXISTS idx_sales_leads_stage ON sales_leads(current_stage);
    CREATE INDEX IF NOT EXISTS idx_sales_leads_goal ON sales_leads(goal_id);
    CREATE INDEX IF NOT EXISTS idx_sales_leads_category ON sales_leads(category);
    CREATE INDEX IF NOT EXISTS idx_sales_lead_contacts ON sales_lead_contacts(lead_id);
    CREATE INDEX IF NOT EXISTS idx_sales_stage_history ON sales_stage_history(lead_id);
    CREATE INDEX IF NOT EXISTS idx_sales_daily_logs ON sales_daily_logs(lead_id);
    CREATE INDEX IF NOT EXISTS idx_sales_activities ON sales_lead_activities(lead_id);
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
  let adminId = null;
  const { rows } = await pool.query("SELECT id FROM users WHERE email = 'admin@admin.com'");
  if (rows.length === 0) {
    const hash = bcrypt.hashSync('admin', 10);
    const { rows: seededAdmin } = await pool.query(
      'INSERT INTO users (name, email, password_hash, role, department) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      ['Admin', 'admin@admin.com', hash, 'admin', 'Executive']
    );
    adminId = seededAdmin[0].id;
    console.log('Admin user seeded.');
  } else {
    adminId = rows[0].id;
  }

  // ── Seed Sample Sales Lakshya Goal & Leads ─────────────────────
  try {
    const { rows: existingGoals } = await pool.query("SELECT id FROM sales_goals WHERE name = 'Q3 2026 — ₹5 Cr Revenue Target'");
    let goalId = null;
    if (existingGoals.length === 0) {
      const { rows: newGoal } = await pool.query(`
        INSERT INTO sales_goals (name, description, target_value, target_leads, period_type, period_start, period_end, status, creator_id)
        VALUES ('Q3 2026 — ₹5 Cr Revenue Target', 'Q3 Strategic enterprise building automation target for West & North regions', 50000000, 10, 'quarterly', '2026-07-01', '2026-09-30', 'active', $1)
        RETURNING id
      `, [adminId]);
      goalId = newGoal[0].id;
      console.log('Sample Lakshya Goal seeded.');
    } else {
      goalId = existingGoals[0].id;
    }

    // Seed General Lead 1
    const { rows: genLeads } = await pool.query("SELECT id FROM sales_leads WHERE title = 'HDFC Bank - Mumbai HQ Automation'");
    if (genLeads.length === 0) {
      const { rows: newGenLead } = await pool.query(`
        INSERT INTO sales_leads (
          title, description, category, current_stage, lead_value, probability_pct,
          lead_source, industry, product_category, priority, region, city, consultant_name,
          consultant_firm, assignee_id, creator_id, enquiry_month
        ) VALUES (
          'HDFC Bank - Mumbai HQ Automation',
          'Complete addressable fire alarm, PA system, and building management integration for 15-story corporate office.',
          'general', 'enquiry', 12000000, 20,
          'referral', 'banking', 'building_automation', 'high', 'west_india', 'Mumbai',
          'Ramesh Kulkarni', 'Mechart Engineering Consultants', $1, $1, '2026-09'
        ) RETURNING id
      `, [adminId]);

      // Add contact for General lead
      await pool.query(`
        INSERT INTO sales_lead_contacts (lead_id, contact_name, contact_role, contact_email, contact_phone, company_name, is_leverage, notes)
        VALUES ($1, 'Vikram Sharma', 'technical_head', 'vikram.sharma@hdfc.com', '+91-9876543210', 'HDFC Bank', true, 'Key technical decision maker and internal champion')
      `, [newGenLead[0].id]);
      console.log('Sample General Lead seeded.');
    }

    // Seed Lakshya Lead 1
    const { rows: lakLeads } = await pool.query("SELECT id FROM sales_leads WHERE title = 'DLF Cyber City - Gurgaon HVAC Solution'");
    if (lakLeads.length === 0) {
      const { rows: newLakLead } = await pool.query(`
        INSERT INTO sales_leads (
          title, description, category, goal_id, current_stage, lead_value, probability_pct,
          lead_source, industry, product_category, priority, region, city, consultant_name,
          consultant_firm, assignee_id, creator_id, enquiry_month
        ) VALUES (
          'DLF Cyber City - Gurgaon HVAC Solution',
          'Integrated smart HVAC and temperature control system for commercial tower 4B.',
          'lakshya', $2, 'demo', 25000000, 40,
          'tender_portal', 'real_estate', 'hvac', 'critical', 'north_india', 'Gurgaon',
          'Anil Mehta', 'Spectra MEP Consultants', $1, $1, '2026-09'
        ) RETURNING id
      `, [adminId, goalId]);

      // Add contact for Lakshya lead
      await pool.query(`
        INSERT INTO sales_lead_contacts (lead_id, contact_name, contact_role, contact_email, contact_phone, company_name, is_leverage, notes)
        VALUES ($1, 'Priya Desai', 'procurement', 'priya.desai@dlf.in', '+91-9811223344', 'DLF Infra', true, 'Lead procurement officer')
      `, [newLakLead[0].id]);
      console.log('Sample Lakshya Lead seeded.');
    }
  } catch (e) {
    console.log('Sales seed note:', e.message);
  }

  console.log('PostgreSQL database initialized successfully.');
};

const db = { query, getClient, pool };
export { initDatabase };
export default db;
