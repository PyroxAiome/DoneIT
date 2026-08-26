import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import db from './db.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'doneit-super-secret-key-2026';

// Multer storage setup for site documents
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.cwd(), 'uploads', 'site_documents');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `doc_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB max
});

const getGroupAssignees = async (parentId, currentTaskId) => {
  const pid = parentId || currentTaskId;
  if (!pid) return { names: [], ids: [] };
  const { rows } = await db.query(`
    SELECT t.assignee_id, u.name
    FROM tasks t
    JOIN users u ON t.assignee_id = u.id
    WHERE t.parent_id = $1 OR t.id = $2
  `, [pid, pid]);

  const names = [];
  const ids = [];
  const seenIds = new Set();
  for (const r of rows) {
    if (r.assignee_id && !seenIds.has(r.assignee_id)) {
      seenIds.add(r.assignee_id);
      names.push(r.name);
      ids.push(r.assignee_id);
    }
  }
  return { names, ids };
};

const enrichTask = async (task) => {
  if (!task) return;
  const group = await getGroupAssignees(task.parent_id, task.id);
  task.group_assignees = group.names;
  task.group_assignee_ids = group.ids;
};

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const auth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

let sseClients = [];

const createNotification = async (recipientId, updaterId, message, taskId) => {
  if (!recipientId || recipientId === updaterId) return;
  try {
    const result = await db.query(
      "INSERT INTO notifications (user_id, message, task_id) VALUES ($1, $2, $3) RETURNING *",
      [recipientId, message, taskId]
    );
    const notificationId = result.rows[0].id;

    const { rows } = await db.query(`
      SELECT n.*, t.title as task_title
      FROM notifications n
      LEFT JOIN tasks t ON n.task_id = t.id
      WHERE n.id = $1
    `, [notificationId]);
    const notification = rows[0];

    console.log(`[Notification SSE Broadcast] sending to recipient user id: ${recipientId}`);
    const clients = sseClients.filter(c => Number(c.userId) === Number(recipientId));
    clients.forEach(client => {
      try {
        client.res.write(`data: ${JSON.stringify(notification)}\n\n`);
      } catch (err) {
        console.error("SSE client write error:", err);
      }
    });
  } catch (err) {
    console.error(`Error sending notification to user ${recipientId}:`, err);
  }
};

const notifyRelevantUsers = async (updaterId, message, taskId, extraRecipientIds = []) => {
  try {
    console.log(`[Notification Triggered] message: "${message}", taskId: ${taskId}`);
    const recipientIds = new Set();

    // 1. All Admins
    const { rows: admins } = await db.query("SELECT id FROM users WHERE role = 'admin'");
    admins.forEach(a => recipientIds.add(a.id));

    // 2. Fetch task assignee, creator, and assignee's department details
    const { rows: taskRows } = await db.query(`
      SELECT t.assignee_id, t.creator_id, u.department as assignee_dept
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.id = $1
    `, [taskId]);
    const taskDetails = taskRows[0];

    if (taskDetails) {
      // Add assignee
      if (taskDetails.assignee_id) {
        recipientIds.add(taskDetails.assignee_id);
      }
      // Add creator
      if (taskDetails.creator_id) {
        recipientIds.add(taskDetails.creator_id);
      }
      // Add department manager
      if (taskDetails.assignee_dept) {
        const { rows: managers } = await db.query(
          "SELECT id FROM users WHERE role = 'manager' AND department = $1",
          [taskDetails.assignee_dept]
        );
        managers.forEach(m => recipientIds.add(m.id));
      }
    }

    // 3. Add extra recipients (e.g. parsed mentions)
    extraRecipientIds.forEach(id => recipientIds.add(id));

    // Send notification to all collected unique IDs
    for (const recipientId of recipientIds) {
      await createNotification(recipientId, updaterId, message, taskId);
    }
  } catch (err) {
    console.error("Error sending notifications to relevant users:", err);
  }
};

const adminOrManager = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Admin or Manager access required' });
  }
  next();
};

// ─── AUTH ───────────────────────────────────────────────────────
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    const { password_hash, ...profile } = user;
    res.json({ token, user: profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/auth/me', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id, name, email, role, department, avatar_url, created_at FROM users WHERE id = $1', [req.user.id]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/auth/change-password', auth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current and new password required' });
    }

    const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!bcrypt.compareSync(current_password, user.password_hash)) {
      return res.status(400).json({ error: 'Incorrect current password' });
    }

    const newHash = bcrypt.hashSync(new_password, 10);
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── USERS ──────────────────────────────────────────────────────
const ALLOWED_ROLES = [
  'admin', 'manager', 'site_manager',
  'software_engineer', 'electronics_engineer', 'mechanical_engineer', 'production_engineer',
  'intern', 'hr', 'employee'
];

router.get('/employees', auth, async (req, res) => {
  try {
    const { rows: users } = await db.query(`
      SELECT u.id, u.name, u.email, u.role, u.department, u.avatar_url, u.created_at,
        (
          SELECT COUNT(DISTINCT t.id)
          FROM tasks t
          WHERE t.assignee_id = u.id OR (u.role = 'admin' AND t.creator_id = u.id)
        ) as task_count,
        COALESCE(
          (
            SELECT ROUND(AVG(t.progress_percent), 0)
            FROM tasks t
            WHERE t.assignee_id = u.id OR (u.role = 'admin' AND t.creator_id = u.id)
          ), 0
        ) as avg_progress
      FROM users u
      ORDER BY u.name
    `);

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users', auth, adminOnly, async (req, res) => {
  try {
    const { name, email, password, role, department } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password, and role required' });
    }
    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ error: `Role must be one of: ${ALLOWED_ROLES.join(', ')}` });
    }
    const { rows: existingRows } = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingRows[0]) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    const hash = bcrypt.hashSync(password, 10);
    const result = await db.query(
      'INSERT INTO users (name, email, password_hash, role, department) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [name, email, hash, role, department || 'General']
    );

    const { rows: userRows } = await db.query('SELECT id, name, email, role, department, avatar_url, created_at FROM users WHERE id = $1', [result.rows[0].id]);
    res.status(201).json(userRows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/users/:id', auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, role, department } = req.body;
    if (!name || !email || !role) {
      return res.status(400).json({ error: 'Name, email, and role are required' });
    }
    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ error: `Role must be one of: ${ALLOWED_ROLES.join(', ')}` });
    }

    const { rows: conflictRows } = await db.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, id]);
    if (conflictRows[0]) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    if (password && password.trim() !== '') {
      const hash = bcrypt.hashSync(password, 10);
      await db.query(`
        UPDATE users
        SET name = $1, email = $2, password_hash = $3, role = $4, department = $5
        WHERE id = $6
      `, [name, email, hash, role, department || 'General', id]);
    } else {
      await db.query(`
        UPDATE users
        SET name = $1, email = $2, role = $3, department = $4
        WHERE id = $5
      `, [name, email, role, department || 'General', id]);
    }

    const { rows: updatedRows } = await db.query('SELECT id, name, email, role, department, avatar_url, created_at FROM users WHERE id = $1', [id]);
    if (!updatedRows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(updatedRows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/users/:id', auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    const result = await db.query('DELETE FROM users WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── TASKS ──────────────────────────────────────────────────────
router.get('/tasks/quota', auth, async (req, res) => {
  try {
    if (req.user.role !== 'employee') {
      return res.json({ role: req.user.role, isRestricted: false });
    }
    const { rows: weekRows } = await db.query(`
      SELECT COUNT(*) as count FROM tasks 
      WHERE creator_id = $1 AND created_at >= DATE_TRUNC('week', CURRENT_TIMESTAMP)
    `, [req.user.id]);
    const { rows: monthRows } = await db.query(`
      SELECT COUNT(*) as count FROM tasks 
      WHERE creator_id = $1 AND created_at >= DATE_TRUNC('month', CURRENT_TIMESTAMP)
    `, [req.user.id]);

    const weekCount = parseInt(weekRows[0]?.count || '0', 10);
    const monthCount = parseInt(monthRows[0]?.count || '0', 10);

    res.json({
      role: 'employee',
      isRestricted: true,
      weekCount,
      weekLimit: 2,
      monthCount,
      monthLimit: 8,
      canCreate: weekCount < 2 && monthCount < 8
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/tasks', auth, async (req, res) => {
  try {
    console.log("Tasks GET Request query:", req.query, "user role:", req.user.role, "user id:", req.user.id);
    let sql = `
      SELECT t.*, 
        u.name as assignee_name, u.email as assignee_email,
        c.name as creator_name, c.role as creator_role, c.department as creator_department, e.name as last_edited_by_name
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      LEFT JOIN users c ON t.creator_id = c.id
      LEFT JOIN users e ON t.last_edited_by = e.id
      WHERE 1=1
    `;
    const params = [];
    let paramIdx = 1;

    if (req.query.assignee_id) {
      sql += ` AND t.assignee_id = $${paramIdx++}`;
      params.push(req.query.assignee_id);
    }
    if (req.query.status) {
      sql += ` AND t.status = $${paramIdx++}`;
      params.push(req.query.status);
    }
    if (req.query.category) {
      sql += ` AND LOWER(t.category) = LOWER($${paramIdx++})`;
      params.push(req.query.category);
    }
    if (req.query.priority) {
      sql += ` AND t.priority = $${paramIdx++}`;
      params.push(req.query.priority);
    }
    if (req.query.search) {
      sql += ` AND (t.title LIKE $${paramIdx++} OR t.description LIKE $${paramIdx++})`;
      params.push(`%${req.query.search}%`, `%${req.query.search}%`);
    }
    if (req.query.project_id) {
      sql += ` AND t.project_id = $${paramIdx++}`;
      params.push(req.query.project_id);
    } else {
      sql += ` AND t.project_id IS NULL`;
    }

    // Admin-exclusive date range filtering
    if (req.user.role === 'admin' && req.query.date_range) {
      if (req.query.date_range === 'today') {
        sql += " AND t.created_at >= DATE_TRUNC('day', CURRENT_TIMESTAMP)";
      } else if (req.query.date_range === 'week') {
        sql += " AND t.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'";
      } else if (req.query.date_range === 'month') {
        sql += " AND t.created_at >= DATE_TRUNC('month', CURRENT_TIMESTAMP)";
      } else if (req.query.date_range === 'year') {
        sql += " AND t.created_at >= DATE_TRUNC('year', CURRENT_TIMESTAMP)";
      } else if (req.query.date_range === 'custom') {
        if (req.query.from) {
          sql += ` AND DATE(t.created_at) >= DATE($${paramIdx++})`;
          params.push(req.query.from);
        }
        if (req.query.to) {
          sql += ` AND DATE(t.created_at) <= DATE($${paramIdx++})`;
          params.push(req.query.to);
        }
      }
    }

    // Deduplicate group task copies for Admin, Manager, and Project views
    // Only apply when not filtering by a specific employee/assignee
    if (!req.query.assignee_id) {
      sql += ' AND (t.parent_id IS NULL OR t.id = t.parent_id)';
    }

    if (req.user.role === 'employee' && !req.query.assignee_id && !req.query.project_id) {
      sql += ` AND t.assignee_id = $${paramIdx++}`;
      params.push(req.user.id);
    }

    sql += ' ORDER BY t.created_at DESC';

    const { rows: tasks } = await db.query(sql, params);
    for (const task of tasks) {
      await enrichTask(task);
    }
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/tasks/:id', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT t.*, u.name as assignee_name, u.email as assignee_email,
        c.name as creator_name, c.role as creator_role, c.department as creator_department, e.name as last_edited_by_name
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      LEFT JOIN users c ON t.creator_id = c.id
      LEFT JOIN users e ON t.last_edited_by = e.id
      WHERE t.id = $1
    `, [req.params.id]);
    const task = rows[0];
    if (!task) return res.status(404).json({ error: 'Task not found' });
    await enrichTask(task);
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tasks', auth, async (req, res) => {
  try {
    const { title, description, color, status, priority, category, assignee_id, assignee_ids,
      start_date, due_date, estimated_hours, project_id } = req.body;

    if (!title) return res.status(400).json({ error: 'Title required' });

    if (req.user.role === 'employee') {
      const { rows: weekRows } = await db.query(`
        SELECT COUNT(*) as count FROM tasks 
        WHERE creator_id = $1 AND created_at >= DATE_TRUNC('week', CURRENT_TIMESTAMP)
      `, [req.user.id]);
      const weekCount = parseInt(weekRows[0]?.count || '0', 10);
      if (weekCount >= 2) {
        return res.status(403).json({ 
          error: 'Weekly task creation limit reached (max 2 self-created tasks per week). Please ask your Manager or Admin to assign tasks.' 
        });
      }

      const { rows: monthRows } = await db.query(`
        SELECT COUNT(*) as count FROM tasks 
        WHERE creator_id = $1 AND created_at >= DATE_TRUNC('month', CURRENT_TIMESTAMP)
      `, [req.user.id]);
      const monthCount = parseInt(monthRows[0]?.count || '0', 10);
      if (monthCount >= 8) {
        return res.status(403).json({ 
          error: 'Monthly task creation limit reached (max 8 self-created tasks per month). Please ask your Manager or Admin to assign tasks.' 
        });
      }
    }

    let assignees = [];
    if (req.user.role === 'employee') {
      assignees = [req.user.id];
    } else if (assignee_ids && Array.isArray(assignee_ids) && assignee_ids.length > 0) {
      assignees = assignee_ids;
    } else {
      assignees = [assignee_id || null];
    }

    const createdTasks = [];

    let parentId = null;
    const insertedIds = [];
    for (let i = 0; i < assignees.length; i++) {
      const targetId = assignees[i];
      const result = await db.query(`
        INSERT INTO tasks (title, description, color, status, priority, category,
          assignee_id, creator_id, start_date, due_date, estimated_hours, parent_id, project_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id
      `, [
        title, description || '', color || 'slate', status || 'todo',
        priority || 'medium', category || 'General',
        targetId, req.user.id,
        start_date || null, due_date || null, estimated_hours || 0,
        i === 0 ? null : parentId,
        project_id || null
      ]);

      const insertedId = result.rows[0].id;
      insertedIds.push(insertedId);
      if (i === 0) {
        parentId = insertedId;
        if (assignees.length > 1) {
          await db.query('UPDATE tasks SET parent_id = $1 WHERE id = $2', [parentId, parentId]);
        }
      }

      if (project_id && targetId) {
        await db.query(`
          INSERT INTO project_members (project_id, user_id)
          VALUES ($1, $2) ON CONFLICT (project_id, user_id) DO NOTHING
        `, [project_id, targetId]);
      }
    }

    for (const insertedId of insertedIds) {
      const { rows } = await db.query(`
        SELECT t.*, u.name as assignee_name, c.name as creator_name, c.role as creator_role, c.department as creator_department, e.name as last_edited_by_name
        FROM tasks t
        LEFT JOIN users u ON t.assignee_id = u.id
        LEFT JOIN users c ON t.creator_id = c.id
        LEFT JOIN users e ON t.last_edited_by = e.id
        WHERE t.id = $1
      `, [insertedId]);
      const task = rows[0];
      await enrichTask(task);
      createdTasks.push(task);

      let msg = '';
      if (task.creator_id === task.assignee_id) {
        msg = `${req.user.name} self-assigned task: "${title}"`;
      } else if (task.assignee_name) {
        msg = `${req.user.name} assigned task: "${title}" to ${task.assignee_name}`;
      } else {
        msg = `${req.user.name} created task: "${title}"`;
      }
      await notifyRelevantUsers(req.user.id, msg, task.id);
    }

    res.status(201).json(createdTasks.length === 1 ? createdTasks[0] : { tasks: createdTasks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tasks/bulk', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can perform bulk imports.' });
    }

    const { tasks } = req.body;
    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({ error: 'Tasks array is required' });
    }

    const createdTasks = [];

    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      for (const t of tasks) {
        const { title, description, priority, category, assignee_id } = t;
        const result = await client.query(`
          INSERT INTO tasks (title, description, color, status, priority, category,
            assignee_id, creator_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
        `, [
          title,
          description || '',
          'slate', // default color
          'todo',  // default status
          priority || 'medium',
          category || 'General',
          assignee_id || null,
          req.user.id
        ]);
        
        const insertedId = result.rows[0].id;
        const { rows } = await client.query(`
          SELECT t.*, u.name as assignee_name, c.name as creator_name, c.role as creator_role, c.department as creator_department, e.name as last_edited_by_name
          FROM tasks t
          LEFT JOIN users u ON t.assignee_id = u.id
          LEFT JOIN users c ON t.creator_id = c.id
          LEFT JOIN users e ON t.last_edited_by = e.id
          WHERE t.id = $1
        `, [insertedId]);
        const task = rows[0];
        // Note: enrichTask uses db.query, which operates outside this client's transaction.
        // It's safe since enrichTask only reads data that's already committed or isn't part of this insert (parent group tasks)
        // But for consistency within transaction we skip enrichTask for now and do it after commit, or let the caller deal with it.
        // Wait, enrichTask looks up group assignees. We can run it after commit.
        createdTasks.push(task);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    
    // Enrich and notify after transaction
    for (const task of createdTasks) {
      await enrichTask(task);
      if (task.assignee_id) {
        const msg = `${req.user.name} assigned task: "${task.title}" to ${task.assignee_name}`;
        await notifyRelevantUsers(req.user.id, msg, task.id);
      }
    }

    res.status(201).json(createdTasks);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to complete bulk import.' });
  }
});

router.put('/tasks/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: taskRows } = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
    const task = taskRows[0];
    if (!task) return res.status(404).json({ error: 'Task not found' });

    if (req.user.role === 'employee' && task.assignee_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to update this task' });
    }

    const { rows: creatorRows } = await db.query('SELECT role, department FROM users WHERE id = $1', [task.creator_id]);
    const creator = creatorRows[0];
    const creatorRole = creator ? creator.role : 'admin';
    const creatorDept = creator ? creator.department : 'Engineering';

    if (req.user.role === 'manager') {
      const isSelf = task.creator_id === req.user.id;
      const isSameDeptEmployee = creatorRole === 'employee' && creatorDept === req.user.department;
      if (!isSelf && !isSameDeptEmployee) {
        const allowedFieldsForRestricted = ['status', 'priority', 'progress_percent', 'logical_explanation'];
        const attemptedFields = Object.keys(req.body);
        const hasDisallowed = attemptedFields.some(f => !allowedFieldsForRestricted.includes(f));
        if (hasDisallowed) {
          return res.status(403).json({ error: 'Managers are only authorized to change status, priority, progress, and explanation for this task.' });
        }
      }
    }

    let verificationRequired = false;
    if (req.user.role !== 'admin' && req.body.status === 'completed') {
      req.body.status = 'under_review';
      verificationRequired = true;
    }

    // Non-admins can change status freely (todo, in_progress, under_review).
    // 'completed' is already intercepted above and converted to 'under_review'.

    const fields = ['title', 'description', 'color', 'status', 'priority', 'category',
      'progress_percent', 'start_date', 'due_date', 'estimated_hours',
      'logical_explanation', 'project_id'];

    const updates = [];
    const values = [];
    let paramIdx = 1;

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIdx++}`);
        values.push(req.body[field]);
      }
    }

    const { rows: currentTaskRows } = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
    const currentTask = currentTaskRows[0];
    if (!currentTask) return res.status(404).json({ error: 'Task not found' });

    const assignee_id = req.body.assignee_id;
    const assignee_ids = req.body.assignee_ids;
    
    let primaryAssignee = null;

    if (assignee_ids && Array.isArray(assignee_ids)) {
      const selectedSet = new Set(assignee_ids.map(Number));
      if (selectedSet.has(Number(currentTask.assignee_id))) {
        primaryAssignee = currentTask.assignee_id;
      } else if (assignee_ids.length > 0) {
        primaryAssignee = assignee_ids[0];
      }
    } else if (assignee_id !== undefined) {
      primaryAssignee = assignee_id;
    }

    if (req.body.assignee_ids !== undefined || req.body.assignee_id !== undefined) {
      updates.push(`assignee_id = $${paramIdx++}`);
      values.push(primaryAssignee);
    }

    let currentParentId = currentTask.parent_id;
    if ((assignee_ids && assignee_ids.length > 1) || currentParentId) {
      currentParentId = currentParentId || currentTask.id;
      updates.push(`parent_id = $${paramIdx++}`);
      values.push(currentParentId);
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    updates.push("updated_at = CURRENT_TIMESTAMP");
    updates.push(`last_edited_by = $${paramIdx++}`);
    values.push(req.user.id);
    
    const fieldValues = [...values];
    
    // 1. Always update the primary task row first
    await db.query(`UPDATE tasks SET ${updates.join(', ')} WHERE id = $${paramIdx}`, [...fieldValues, id]);

    // 2. Fetch the updated task to use as the template for cloning
    const { rows: updatedTaskRows } = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
    const updatedTask = updatedTaskRows[0];

    // 3. Synchronize other tasks in the group if assignee_ids array is provided
    if (assignee_ids && Array.isArray(assignee_ids)) {
      const selectedSet = new Set(assignee_ids.map(Number));

      const { rows: allGroupTasks } = await db.query('SELECT id, assignee_id FROM tasks WHERE id = $1 OR parent_id = $2', [currentParentId, currentParentId]);

      const parentTaskRow = allGroupTasks.find(t => t.id === currentParentId);
      const cloneTaskRows = allGroupTasks.filter(t => t.id !== currentParentId);

      let parentRowTargetAssignee = parentTaskRow && selectedSet.has(parentTaskRow.assignee_id) ? parentTaskRow.assignee_id : null;
      
      if (parentTaskRow && !parentRowTargetAssignee && selectedSet.size > 0) {
        parentRowTargetAssignee = Array.from(selectedSet)[0];
      }

      if (parentTaskRow && parentRowTargetAssignee) {
        const parentUpdates = [...updates];
        const parentValues = [...fieldValues];
        // find the dynamic index for assignee_id
        let assigneeIndex = -1;
        for (let i = 0; i < parentUpdates.length; i++) {
          if (parentUpdates[i].startsWith('assignee_id =')) {
            assigneeIndex = i;
            break;
          }
        }
        if (assigneeIndex !== -1) {
          parentValues[assigneeIndex] = parentRowTargetAssignee;
        }
        await db.query(`UPDATE tasks SET ${parentUpdates.join(', ')} WHERE id = $${paramIdx}`, [...parentValues, currentParentId]);
        
        selectedSet.delete(parentRowTargetAssignee);
      }

      for (const cloneRow of cloneTaskRows) {
        if (cloneRow.id === id) {
          selectedSet.delete(cloneRow.assignee_id);
          continue;
        }

        if (selectedSet.has(cloneRow.assignee_id)) {
          await db.query(`UPDATE tasks SET ${updates.join(', ')} WHERE id = $${paramIdx}`, [...fieldValues, cloneRow.id]);
          selectedSet.delete(cloneRow.assignee_id);
        } else {
          await db.query('DELETE FROM tasks WHERE id = $1', [cloneRow.id]);
        }
      }

      if (selectedSet.size > 0 && currentParentId) {
        const { rows: templateRows } = await db.query('SELECT * FROM tasks WHERE id = $1', [currentParentId]);
        const templateTask = templateRows[0];

        for (const newAssigneeId of selectedSet) {
          await db.query(`
            INSERT INTO tasks (title, description, color, status, priority, category,
              assignee_id, creator_id, start_date, due_date, estimated_hours, parent_id, project_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          `, [
            templateTask.title,
            templateTask.description,
            templateTask.color,
            templateTask.status,
            templateTask.priority,
            templateTask.category,
            newAssigneeId,
            templateTask.creator_id,
            templateTask.start_date,
            templateTask.due_date,
            templateTask.estimated_hours,
            currentParentId,
            templateTask.project_id || null
          ]);
        }
      }
    } else if (currentParentId) {
      const { rows: otherGroupTasks } = await db.query('SELECT id FROM tasks WHERE (parent_id = $1 OR id = $2) AND id != $3', [currentParentId, currentParentId, id]);
      for (const gt of otherGroupTasks) {
        await db.query(`UPDATE tasks SET ${updates.join(', ')} WHERE id = $${paramIdx}`, [...fieldValues, gt.id]);
      }
    }

    const { rows: updatedRows } = await db.query(`
      SELECT t.*, u.name as assignee_name, u.email as assignee_email,
        c.name as creator_name, c.role as creator_role, c.department as creator_department, e.name as last_edited_by_name
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      LEFT JOIN users c ON t.creator_id = c.id
      LEFT JOIN users e ON t.last_edited_by = e.id
      WHERE t.id = $1
    `, [id]);
    
    const updated = updatedRows[0];
    if (!updated) {
      return res.status(404).json({ error: 'Task not found' });
    }

    let msg = '';
    if (updated.creator_id === updated.assignee_id) {
      msg = `${req.user.name} updated self-assigned task: "${updated.title}"`;
    } else if (updated.assignee_name) {
      msg = `${req.user.name} updated task: "${updated.title}" (assigned to ${updated.assignee_name})`;
    } else {
      msg = `${req.user.name} updated task: "${updated.title}"`;
    }
    const groupResult = await getGroupAssignees(updated.parent_id);
    updated.group_assignees = groupResult.names;
    updated.verificationRequired = verificationRequired;
    await notifyRelevantUsers(req.user.id, msg, updated.id);

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/tasks/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
    const task = rows[0];
    if (!task) return res.status(404).json({ error: 'Task not found' });

    if (task.status === 'completed' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete completed tasks' });
    }

    if (req.user.role === 'employee' && task.creator_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this task' });
    }

    const { rows: creatorRows } = await db.query('SELECT role, department FROM users WHERE id = $1', [task.creator_id]);
    const creator = creatorRows[0];
    const creatorRole = creator ? creator.role : 'admin';
    const creatorDept = creator ? creator.department : 'Engineering';

    if (req.user.role === 'manager') {
      const isSelf = task.creator_id === req.user.id;
      const isSameDeptEmployee = creatorRole === 'employee' && creatorDept === req.user.department;
      if (!isSelf && !isSameDeptEmployee) {
        return res.status(403).json({ error: 'Not authorized to delete tasks created by admins or employees in other departments' });
      }
    }

    await db.query('DELETE FROM tasks WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── COMMENTS ───────────────────────────────────────────────────
router.post('/tasks/:id/comments', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { comment_text, parent_id } = req.body;
    if (!comment_text) return res.status(400).json({ error: 'Comment text required' });

    const { rows: taskRows } = await db.query('SELECT id, title FROM tasks WHERE id = $1', [id]);
    const taskDetails = taskRows[0];
    if (!taskDetails) return res.status(404).json({ error: 'Task not found' });

    if (!parent_id && req.user.role === 'employee') {
      return res.status(403).json({ error: 'Employees can only reply to reviews' });
    }

    const result = await db.query(
      'INSERT INTO admin_comments (task_id, admin_id, parent_id, comment_text) VALUES ($1, $2, $3, $4) RETURNING id',
      [id, req.user.id, parent_id || null, comment_text]
    );

    const { rows: commentRows } = await db.query(`
      SELECT ac.*, u.name as admin_name
      FROM admin_comments ac
      LEFT JOIN users u ON ac.admin_id = u.id
      WHERE ac.id = $1
    `, [result.rows[0].id]);
    const comment = commentRows[0];

    const commentMsg = `${req.user.name} reviewed/commented on task "${taskDetails.title}": "${comment_text.substring(0, 30)}${comment_text.length > 30 ? '...' : ''}"`;

    const mentionRegex = /@([a-zA-Z0-9_]+)/g;
    const extraRecipientIds = [];
    let match;
    while ((match = mentionRegex.exec(comment_text)) !== null) {
      const nameToFind = match[1].toLowerCase();
      const { rows: userRows } = await db.query("SELECT id FROM users WHERE LOWER(name) = $1", [nameToFind]);
      if (userRows[0]) {
        extraRecipientIds.push(userRows[0].id);
      }
    }

    await notifyRelevantUsers(req.user.id, commentMsg, id, extraRecipientIds);

    res.status(201).json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/tasks/:id/comments', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: comments } = await db.query(`
      SELECT ac.*, u.name as admin_name
      FROM admin_comments ac
      LEFT JOIN users u ON ac.admin_id = u.id
      WHERE ac.task_id = $1
      ORDER BY ac.parent_id IS NULL DESC, ac.created_at ASC
    `, [id]);
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/tasks/:id/comments/:commentId', auth, async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const { comment_text } = req.body;
    if (!comment_text) return res.status(400).json({ error: 'Comment text required' });

    const { rows: commentRows } = await db.query('SELECT * FROM admin_comments WHERE id = $1 AND task_id = $2', [commentId, id]);
    const comment = commentRows[0];
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    if (req.user.role !== 'admin' && comment.admin_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to edit this comment' });
    }

    await db.query('UPDATE admin_comments SET comment_text = $1 WHERE id = $2', [comment_text, commentId]);

    const { rows: updatedRows } = await db.query(`
      SELECT ac.*, u.name as admin_name
      FROM admin_comments ac
      LEFT JOIN users u ON ac.admin_id = u.id
      WHERE ac.id = $1
    `, [commentId]);

    res.json(updatedRows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/tasks/:id/comments/:commentId', auth, async (req, res) => {
  try {
    const { id, commentId } = req.params;

    const { rows: commentRows } = await db.query('SELECT * FROM admin_comments WHERE id = $1 AND task_id = $2', [commentId, id]);
    const comment = commentRows[0];
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    if (req.user.role !== 'admin' && comment.admin_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }

    await db.query('DELETE FROM admin_comments WHERE id = $1 OR parent_id = $2', [commentId, commentId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DASHBOARD STATS ────────────────────────────────────────────
router.get('/dashboard/stats', auth, adminOrManager, async (req, res) => {
  try {
    const { rows: r1 } = await db.query('SELECT COUNT(*) as cnt FROM tasks');
    const totalTasks = r1[0].cnt;
    const { rows: r2 } = await db.query("SELECT COUNT(*) as cnt FROM users WHERE role = 'employee'");
    const totalEmployees = r2[0].cnt;
    const { rows: r3 } = await db.query("SELECT COUNT(*) as cnt FROM users WHERE role = 'manager'");
    const totalManagers = r3[0].cnt;

    const { rows: r4 } = await db.query('SELECT ROUND(AVG(progress_percent), 0) as avg FROM tasks');
    const avgCompletion = r4[0].avg;

    const { rows: statusBreakdown } = await db.query(`
      SELECT status, COUNT(*) as cnt FROM tasks GROUP BY status
    `);

    const { rows: recentTasks } = await db.query(`
      SELECT t.id, t.title, t.status, t.priority,
        u.name as assignee_name, t.due_date, t.color
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      ORDER BY t.created_at DESC LIMIT 5
    `);

    res.json({
      totalTasks: parseInt(totalTasks) || 0,
      totalEmployees: parseInt(totalEmployees) || 0,
      totalManagers: parseInt(totalManagers) || 0,
      avgCompletion: parseInt(avgCompletion) || 0,
      statusBreakdown,
      recentTasks,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DAILY LOGS ──────────────────────────────────────────────────
router.get('/tasks/:id/daily-logs', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: taskRows } = await db.query('SELECT parent_id FROM tasks WHERE id = $1', [id]);
    const task = taskRows[0];
    const rootId = task && task.parent_id ? task.parent_id : id;
    
    const { rows: logs } = await db.query(`
      SELECT dl.*, u.name as user_name, u.role as user_role,
        (SELECT COUNT(*) FROM task_daily_log_reactions WHERE log_id = dl.id AND reaction_type = 'like') as likes_count,
        (SELECT reaction_type FROM task_daily_log_reactions WHERE log_id = dl.id AND user_id = $1) as user_reaction
      FROM task_daily_logs dl
      LEFT JOIN users u ON dl.user_id = u.id
      WHERE dl.task_id = $2
      ORDER BY dl.log_date DESC, dl.created_at DESC
    `, [req.user.id, id]);

    const logsWithLikesAndComments = [];
    for (const log of logs) {
      const { rows: likes } = await db.query(`
        SELECT u.name
        FROM task_daily_log_reactions r
        JOIN users u ON r.user_id = u.id
        WHERE r.log_id = $1 AND r.reaction_type = 'like'
      `, [log.id]);
      log.liked_by_names = likes.map(l => l.name);

      const { rows: comments } = await db.query(`
        SELECT c.*, u.name as user_name, u.role as user_role
        FROM task_daily_log_comments c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.log_id = $1
        ORDER BY c.created_at ASC
      `, [log.id]);
      logsWithLikesAndComments.push({ ...log, comments });
    }

    res.json(logsWithLikesAndComments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tasks/:id/daily-logs', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { log_date, content } = req.body;
    if (!content) return res.status(400).json({ error: 'Content required' });
    if (!log_date) return res.status(400).json({ error: 'Log date required' });

    const { rows: taskRows } = await db.query('SELECT id, title FROM tasks WHERE id = $1', [id]);
    const task = taskRows[0];
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const { rows: existingRows } = await db.query('SELECT id FROM task_daily_logs WHERE task_id = $1 AND user_id = $2 AND log_date = $3', [id, req.user.id, log_date]);
    const existing = existingRows[0];

    let logId;
    if (existing) {
      await db.query('UPDATE task_daily_logs SET content = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [content, existing.id]);
      logId = existing.id;
    } else {
      const result = await db.query('INSERT INTO task_daily_logs (task_id, user_id, log_date, content) VALUES ($1, $2, $3, $4) RETURNING id', [id, req.user.id, log_date, content]);
      logId = result.rows[0].id;
    }

    const { rows: logRows } = await db.query(`
      SELECT dl.*, u.name as user_name, u.role as user_role,
        0 as likes_count, NULL as user_reaction
      FROM task_daily_logs dl
      LEFT JOIN users u ON dl.user_id = u.id
      WHERE dl.id = $1
    `, [logId]);
    const log = logRows[0];
    log.comments = [];
    log.liked_by_names = [];

    const isUpdate = !!existing;
    const msg = `${req.user.name} ${isUpdate ? 'updated daily log' : 'added daily log'} for task "${task.title}" on ${log_date}`;
    await notifyRelevantUsers(req.user.id, msg, id);

    res.json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/tasks/:id/daily-logs/:logId', auth, async (req, res) => {
  try {
    const { logId } = req.params;
    const { rows: logRows } = await db.query('SELECT * FROM task_daily_logs WHERE id = $1', [logId]);
    const log = logRows[0];
    if (!log) return res.status(404).json({ error: 'Log not found' });

    if (log.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the author can delete this log' });
    }

    await db.query('DELETE FROM task_daily_logs WHERE id = $1', [logId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tasks/:id/daily-logs/:logId/react', auth, async (req, res) => {
  try {
    const { logId } = req.params;

    const { rows: logRows } = await db.query('SELECT * FROM task_daily_logs WHERE id = $1', [logId]);
    const log = logRows[0];
    if (!log) return res.status(404).json({ error: 'Daily log not found' });

    const { rows: existingRows } = await db.query("SELECT id FROM task_daily_log_reactions WHERE log_id = $1 AND user_id = $2 AND reaction_type = 'like'", [logId, req.user.id]);
    const existing = existingRows[0];

    if (existing) {
      await db.query('DELETE FROM task_daily_log_reactions WHERE id = $1', [existing.id]);
    } else {
      await db.query("INSERT INTO task_daily_log_reactions (log_id, user_id, reaction_type) VALUES ($1, $2, 'like')", [logId, req.user.id]);
    }

    const { rows: countsRows } = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM task_daily_log_reactions WHERE log_id = $1 AND reaction_type = 'like') as likes_count,
        (SELECT reaction_type FROM task_daily_log_reactions WHERE log_id = $2 AND user_id = $3) as user_reaction
    `, [logId, logId, req.user.id]);
    const counts = countsRows[0];

    const { rows: likes } = await db.query(`
      SELECT u.name
      FROM task_daily_log_reactions r
      JOIN users u ON r.user_id = u.id
      WHERE r.log_id = $1 AND r.reaction_type = 'like'
    `, [logId]);
    counts.liked_by_names = likes.map(l => l.name);

    res.json(counts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tasks/:id/daily-logs/:logId/comments', auth, async (req, res) => {
  try {
    const { id: taskId, logId } = req.params;
    const { comment_text } = req.body;
    if (!comment_text) return res.status(400).json({ error: 'Comment text required' });

    const { rows: logRows } = await db.query('SELECT * FROM task_daily_logs WHERE id = $1', [logId]);
    const log = logRows[0];
    if (!log) return res.status(404).json({ error: 'Daily log not found' });

    const result = await db.query('INSERT INTO task_daily_log_comments (log_id, user_id, comment_text) VALUES ($1, $2, $3) RETURNING id', [logId, req.user.id, comment_text]);

    const { rows: commentRows } = await db.query(`
      SELECT c.*, u.name as user_name, u.role as user_role
      FROM task_daily_log_comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.id = $1
    `, [result.rows[0].id]);
    const comment = commentRows[0];

    const { rows: taskRows } = await db.query('SELECT title FROM tasks WHERE id = $1', [taskId]);
    const task = taskRows[0];
    const msg = `${req.user.name} commented on daily log of task "${task.title}": "${comment_text.substring(0, 30)}${comment_text.length > 30 ? '...' : ''}"`;
    await notifyRelevantUsers(req.user.id, msg, taskId);

    res.status(201).json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/tasks/:id/daily-logs/:logId/comments/:commentId', auth, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { rows: commentRows } = await db.query('SELECT * FROM task_daily_log_comments WHERE id = $1', [commentId]);
    const comment = commentRows[0];
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    if (req.user.role !== 'admin' && comment.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }

    await db.query('DELETE FROM task_daily_log_comments WHERE id = $1', [commentId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── NOTIFICATIONS ──────────────────────────────────────────────
router.get('/notifications', auth, async (req, res) => {
  try {
    const { rows: list } = await db.query(`
      SELECT n.*, t.title as task_title 
      FROM notifications n
      LEFT JOIN tasks t ON n.task_id = t.id
      WHERE n.user_id = $1 
      ORDER BY n.created_at DESC 
      LIMIT 50
    `, [req.user.id]);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/notifications/sse', (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(401).end();

  let userId;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    userId = decoded.id;
  } catch {
    return res.status(401).end();
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const client = { userId, res };
  sseClients.push(client);

  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 20000);

  req.on('close', () => {
    clearInterval(keepAlive);
    sseClients = sseClients.filter(c => c !== client);
    res.end();
  });
});

router.put('/notifications/:id/read', auth, async (req, res) => {
  try {
    await db.query('UPDATE notifications SET is_read = 1 WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/notifications/read-all', auth, async (req, res) => {
  try {
    await db.query('UPDATE notifications SET is_read = 1 WHERE user_id = $1', [req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/notifications/:id', auth, async (req, res) => {
  try {
    await db.query('DELETE FROM notifications WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/notifications', auth, async (req, res) => {
  try {
    await db.query('DELETE FROM notifications WHERE user_id = $1', [req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/tasks/:id/explanations', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: explanations } = await db.query(`
      SELECT te.*, u.name as user_name, u.role as user_role
      FROM task_explanations te
      LEFT JOIN users u ON te.user_id = u.id
      WHERE te.task_id = $1
      ORDER BY te.created_at DESC
    `, [id]);
    res.json(explanations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tasks/:id/explanations', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { explanation_text } = req.body;
    if (!explanation_text) return res.status(400).json({ error: 'Explanation text is required' });

    const { rows: countRows } = await db.query('SELECT COUNT(*) as count FROM task_explanations WHERE task_id = $1 AND user_id = $2', [id, req.user.id]);
    const count = countRows[0].count;
    if (count >= 3) {
      return res.status(400).json({ error: 'You have reached the limit of 3 logical explanations for this task.' });
    }

    const result = await db.query('INSERT INTO task_explanations (task_id, user_id, explanation_text) VALUES ($1, $2, $3) RETURNING id', [id, req.user.id, explanation_text]);

    const { rows: newExpRows } = await db.query(`
      SELECT te.*, u.name as user_name, u.role as user_role
      FROM task_explanations te
      LEFT JOIN users u ON te.user_id = u.id
      WHERE te.id = $1
    `, [result.rows[0].id]);

    res.status(201).json(newExpRows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/tasks/:id/explanations/:expId', auth, async (req, res) => {
  try {
    const { expId } = req.params;
    const { explanation_text } = req.body;
    if (!explanation_text) return res.status(400).json({ error: 'Explanation text is required' });

    const { rows: expRows } = await db.query('SELECT * FROM task_explanations WHERE id = $1', [expId]);
    const exp = expRows[0];
    if (!exp) return res.status(404).json({ error: 'Explanation not found' });
    if (exp.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to update this explanation' });
    }

    await db.query('UPDATE task_explanations SET explanation_text = $1 WHERE id = $2', [explanation_text, expId]);

    const { rows: updatedRows } = await db.query(`
      SELECT te.*, u.name as user_name, u.role as user_role
      FROM task_explanations te
      LEFT JOIN users u ON te.user_id = u.id
      WHERE te.id = $1
    `, [expId]);

    res.json(updatedRows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/tasks/:id/explanations/:expId', auth, async (req, res) => {
  try {
    const { expId } = req.params;
    const { rows: expRows } = await db.query('SELECT * FROM task_explanations WHERE id = $1', [expId]);
    const exp = expRows[0];
    if (!exp) return res.status(404).json({ error: 'Explanation not found' });
    if (req.user.role !== 'admin' && exp.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this explanation' });
    }
    await db.query('DELETE FROM task_explanations WHERE id = $1', [expId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DEPENDENCIES ────────────────────────────────────────────────
router.get('/dependencies/pending', auth, async (req, res) => {
  try {
    let pending;
    if (['admin', 'manager'].includes(req.user.role)) {
      const { rows } = await db.query(`
        SELECT d.*, t.title as task_title, r.name as requester_name, r.email as requester_email,
          tg.name as tagee_name, tg.email as tagee_email
        FROM task_dependencies d
        LEFT JOIN tasks t ON d.task_id = t.id
        LEFT JOIN users r ON d.requester_id = r.id
        LEFT JOIN users tg ON d.tagee_id = tg.id
        WHERE d.status IN ('pending', 'resolved')
        ORDER BY d.created_at DESC
      `);
      pending = rows;
    } else {
      const { rows } = await db.query(`
        SELECT d.*, t.title as task_title, r.name as requester_name, r.email as requester_email,
          tg.name as tagee_name, tg.email as tagee_email
        FROM task_dependencies d
        LEFT JOIN tasks t ON d.task_id = t.id
        LEFT JOIN users r ON d.requester_id = r.id
        LEFT JOIN users tg ON d.tagee_id = tg.id
        WHERE d.tagee_id = $1 AND d.status = 'pending'
        ORDER BY d.created_at DESC
      `, [req.user.id]);
      pending = rows;
    }
    res.json(pending);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/tasks/:id/dependencies', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: deps } = await db.query(`
      SELECT d.*, 
        r.name as requester_name, r.role as requester_role, r.email as requester_email,
        t.name as tagee_name, t.role as tagee_role, t.email as tagee_email
      FROM task_dependencies d
      LEFT JOIN users r ON d.requester_id = r.id
      LEFT JOIN users t ON d.tagee_id = t.id
      WHERE d.task_id = $1
      ORDER BY d.created_at ASC
    `, [id]);
    res.json(deps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tasks/:id/dependencies', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { tagee_id, dependency_text } = req.body;
    if (!tagee_id || !dependency_text || !dependency_text.trim()) {
      return res.status(400).json({ error: 'Tagged person and description are required' });
    }

    const info = await db.query(`
      INSERT INTO task_dependencies (task_id, requester_id, tagee_id, dependency_text)
      VALUES ($1, $2, $3, $4) RETURNING id
    `, [id, req.user.id, tagee_id, dependency_text]);

    const { rows: taskRows } = await db.query('SELECT title FROM tasks WHERE id = $1', [id]);
    const task = taskRows[0];
    const msg = `${req.user.name} tagged you for a dependency on task: "${task ? task.title : 'Task'}"`;
    await createNotification(tagee_id, req.user.id, msg, id);

    const { rows: createdRows } = await db.query(`
      SELECT d.*, 
        r.name as requester_name, r.role as requester_role, r.email as requester_email,
        t.name as tagee_name, t.role as tagee_role, t.email as tagee_email
      FROM task_dependencies d
      LEFT JOIN users r ON d.requester_id = r.id
      LEFT JOIN users t ON d.tagee_id = t.id
      WHERE d.id = $1
    `, [info.rows[0].id]);

    res.status(201).json(createdRows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/tasks/:id/dependencies/:depId/reply', auth, async (req, res) => {
  try {
    const { id, depId } = req.params;
    const { reply_text } = req.body;
    if (!reply_text || !reply_text.trim()) {
      return res.status(400).json({ error: 'Reply text is required' });
    }

    const { rows: depRows } = await db.query('SELECT * FROM task_dependencies WHERE id = $1 AND task_id = $2', [depId, id]);
    const dep = depRows[0];
    if (!dep) {
      return res.status(404).json({ error: 'Dependency not found' });
    }

    if (Number(dep.tagee_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Only the tagged person can reply to this dependency' });
    }

    await db.query(`
      UPDATE task_dependencies
      SET reply_text = $1, status = 'resolved', resolved_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [reply_text, depId]);

    const { rows: taskRows } = await db.query('SELECT title FROM tasks WHERE id = $1', [id]);
    const task = taskRows[0];
    const msg = `${req.user.name} resolved the dependency on task: "${task ? task.title : 'Task'}"`;
    await createNotification(dep.requester_id, req.user.id, msg, id);

    const { rows: updatedRows } = await db.query(`
      SELECT d.*, 
        r.name as requester_name, r.role as requester_role, r.email as requester_email,
        t.name as tagee_name, t.role as tagee_role, t.email as tagee_email
      FROM task_dependencies d
      LEFT JOIN users r ON d.requester_id = r.id
      LEFT JOIN users t ON d.tagee_id = t.id
      WHERE d.id = $1
    `, [depId]);

    res.json(updatedRows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/tasks/:id/dependencies/:depId/confirm', auth, async (req, res) => {
  try {
    const { id, depId } = req.params;
    if (!['admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only admins and managers can confirm dependencies' });
    }

    const { rows: depRows } = await db.query('SELECT * FROM task_dependencies WHERE id = $1 AND task_id = $2', [depId, id]);
    const dep = depRows[0];
    if (!dep) {
      return res.status(404).json({ error: 'Dependency not found' });
    }

    await db.query(`
      UPDATE task_dependencies
      SET status = 'confirmed'
      WHERE id = $1
    `, [depId]);

    const { rows: taskRows } = await db.query('SELECT title FROM tasks WHERE id = $1', [id]);
    const task = taskRows[0];
    const msg = `${req.user.name} confirmed resolution of the dependency on task: "${task ? task.title : 'Task'}"`;
    await createNotification(dep.tagee_id, req.user.id, msg, id);
    await createNotification(dep.requester_id, req.user.id, msg, id);

    const { rows: updatedRows } = await db.query(`
      SELECT d.*, 
        r.name as requester_name, r.role as requester_role, r.email as requester_email,
        t.name as tagee_name, t.role as tagee_role, t.email as tagee_email
      FROM task_dependencies d
      LEFT JOIN users r ON d.requester_id = r.id
      LEFT JOIN users t ON d.tagee_id = t.id
      WHERE d.id = $1
    `, [depId]);

    res.json(updatedRows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PROJECTS ───────────────────────────────────────────────────
router.get('/projects', auth, async (req, res) => {
  try {
    let sql;
    let params = [];
    if (req.user.role === 'admin') {
      sql = `
        SELECT p.*,
          (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) as member_count,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND (t.parent_id IS NULL OR t.id = t.parent_id)) as task_count
        FROM projects p
        ORDER BY p.created_at DESC
      `;
    } else {
      sql = `
        SELECT p.*,
          (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) as member_count,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND (t.parent_id IS NULL OR t.id = t.parent_id)) as task_count
        FROM projects p
        JOIN project_members pm ON p.id = pm.project_id
        WHERE pm.user_id = $1
        ORDER BY p.created_at DESC
      `;
      params.push(req.user.id);
    }
    const { rows } = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/projects', auth, adminOnly, async (req, res) => {
  try {
    const { name, description, status } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    
    const result = await db.query(`
      INSERT INTO projects (name, description, status, creator_id)
      VALUES ($1, $2, $3, $4) RETURNING id
    `, [name, description || '', status || 'active', req.user.id]);
    
    const { rows } = await db.query(`
      SELECT p.*, 0 as member_count, 0 as task_count
      FROM projects p WHERE p.id = $1
    `, [result.rows[0].id]);
    
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/projects/:id', auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    
    const result = await db.query(`
      UPDATE projects SET name = $1, description = $2, status = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 RETURNING id
    `, [name, description || '', status || 'active', id]);
    
    if (result.rowCount === 0) return res.status(404).json({ error: 'Project not found' });
    
    const { rows } = await db.query(`
      SELECT p.*,
        (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) as member_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND (t.parent_id IS NULL OR t.id = t.parent_id)) as task_count
      FROM projects p WHERE p.id = $1
    `, [id]);
    
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/projects/:id', auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM projects WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Project not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/projects/:id/members', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (req.user.role !== 'admin') {
      const { rows: membership } = await db.query('SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2', [id, req.user.id]);
      if (membership.length === 0) return res.status(403).json({ error: 'Not a member of this project' });
    }

    const { rows } = await db.query(`
      SELECT u.id, u.name, u.email, u.role, u.department, u.avatar_url, 
             pm.can_access_inventory, pm.can_access_documents, pm.added_at
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = $1
      ORDER BY u.name
    `, [id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/projects/:id/members', auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, can_access_inventory, can_access_documents } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    
    await db.query(`
      INSERT INTO project_members (project_id, user_id, can_access_inventory, can_access_documents)
      VALUES ($1, $2, $3, $4) 
      ON CONFLICT (project_id, user_id) 
      DO UPDATE SET can_access_inventory = EXCLUDED.can_access_inventory, can_access_documents = EXCLUDED.can_access_documents
    `, [id, user_id, can_access_inventory === true, can_access_documents === true]);
    
    const { rows } = await db.query(`
      SELECT u.id, u.name, u.email, u.role, u.department, u.avatar_url, 
             pm.can_access_inventory, pm.can_access_documents, pm.added_at
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = $1 AND pm.user_id = $2
    `, [id, user_id]);
    
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/projects/:id/members/:userId/permissions', auth, adminOnly, async (req, res) => {
  try {
    const { id, userId } = req.params;
    const { can_access_inventory, can_access_documents } = req.body;
    
    const { rows } = await db.query(`
      UPDATE project_members
      SET can_access_inventory = $1, can_access_documents = $2
      WHERE project_id = $3 AND user_id = $4
      RETURNING *
    `, [can_access_inventory === true, can_access_documents === true, id, userId]);
    
    if (rows.length === 0) return res.status(404).json({ error: 'Member not found in project' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/projects/:id/members/:userId', auth, adminOnly, async (req, res) => {
  try {
    const { id, userId } = req.params;
    await db.query('DELETE FROM project_members WHERE project_id = $1 AND user_id = $2', [id, userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SITE INVENTORY ENDPOINTS ───────────────────────────────────────
router.get('/inventory/master', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM inventory_master ORDER BY category, name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/inventory/master', auth, adminOnly, async (req, res) => {
  try {
    const { name, category, unit, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const { rows } = await db.query(
      'INSERT INTO inventory_master (name, category, unit, description) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, category || 'General', unit || 'pcs', description || '']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/inventory/master/:id', auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, unit, description } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Item name is required' });
    const { rows } = await db.query(
      'UPDATE inventory_master SET name = $1, category = $2, unit = $3, description = $4 WHERE id = $5 RETURNING *',
      [name.trim(), category || 'General', unit || 'pcs', description || '', id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Item not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/inventory/master/:id', auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM inventory_master WHERE id = $1', [id]);
    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/projects/:id/inventory', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: items } = await db.query('SELECT * FROM inventory_master ORDER BY category, name');
    const { rows: receipts } = await db.query(`
      SELECT r.*, im.name as item_name, im.unit as item_unit, 
             u.name as receiver_name, m.name as manager_name, adm.name as admin_name
      FROM project_material_receipts r
      JOIN inventory_master im ON r.item_id = im.id
      LEFT JOIN users u ON r.received_by = u.id
      LEFT JOIN users m ON r.manager_user_id = m.id
      LEFT JOIN users adm ON r.admin_user_id = adm.id
      WHERE r.project_id = $1 ORDER BY r.created_at DESC
    `, [id]);
    const { rows: usage } = await db.query(`
      SELECT u.*, im.name as item_name, im.unit as item_unit, t.title as task_title, usr.name as logger_name
      FROM project_material_usage u
      JOIN inventory_master im ON u.item_id = im.id
      LEFT JOIN tasks t ON u.task_id = t.id
      LEFT JOIN users usr ON u.logged_by = usr.id
      WHERE u.project_id = $1 ORDER BY u.created_at DESC
    `, [id]);
    const { rows: scrap } = await db.query(`
      SELECT s.*, im.name as item_name, im.unit as item_unit, u.name as logger_name
      FROM project_material_scrap s
      JOIN inventory_master im ON s.item_id = im.id
      LEFT JOIN users u ON s.logged_by = u.id
      WHERE s.project_id = $1 ORDER BY s.created_at DESC
    `, [id]);
    const { rows: audits } = await db.query(`
      SELECT a.*, im.name as item_name, im.unit as item_unit, u.name as auditor_name
      FROM project_physical_audits a
      JOIN inventory_master im ON a.item_id = im.id
      LEFT JOIN users u ON a.audited_by = u.id
      WHERE a.project_id = $1 ORDER BY a.created_at DESC
    `, [id]);

    const summaryMap = {};
    for (const item of items) {
      summaryMap[item.id] = {
        item_id: item.id,
        name: item.name,
        category: item.category,
        unit: item.unit,
        description: item.description,
        total_received: 0,
        total_used: 0,
        total_scrapped: 0,
        in_stock: 0,
        latest_audit: null
      };
    }

    // Only count APPROVED receipts into live store balance!
    for (const r of receipts) {
      if (summaryMap[r.item_id] && r.status === 'approved') {
        summaryMap[r.item_id].total_received += Number(r.qty_received);
      }
    }
    for (const u of usage) {
      if (summaryMap[u.item_id]) {
        summaryMap[u.item_id].total_used += Number(u.qty_used);
      }
    }
    for (const s of scrap) {
      if (summaryMap[s.item_id]) {
        summaryMap[s.item_id].total_scrapped += Number(s.qty_scrapped);
      }
    }

    // Attach latest audit per item
    for (const a of audits) {
      if (summaryMap[a.item_id] && !summaryMap[a.item_id].latest_audit) {
        summaryMap[a.item_id].latest_audit = a;
      }
    }

    const balances = Object.values(summaryMap).map(b => {
      b.in_stock = Math.max(0, b.total_received - b.total_used - b.total_scrapped);
      return b;
    });

    const pendingManagerReceipts = receipts.filter(r => r.status === 'pending_manager');
    const pendingAdminReceipts = receipts.filter(r => r.status === 'pending_admin');
    const mySubmissions = receipts.filter(r => r.received_by === req.user.id && ['pending_manager', 'pending_admin', 'rejected'].includes(r.status));

    res.json({ balances, receipts, pendingManagerReceipts, pendingAdminReceipts, mySubmissions, usage, scrap, audits });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/projects/:id/inventory/inward', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { item_id, qty_received, challan_number, challan_photo, notes } = req.body;
    if (!item_id || !qty_received || Number(qty_received) <= 0) {
      return res.status(400).json({ error: 'Valid item_id and positive qty_received required' });
    }

    // Duplicate DC check per project and item (allows multiple different items under the same Delivery Challan)
    if (challan_number && challan_number.trim()) {
      const existing = await db.query(
        `SELECT id FROM project_material_receipts WHERE project_id = $1 AND item_id = $2 AND LOWER(TRIM(challan_number)) = LOWER(TRIM($3)) AND status != 'rejected'`,
        [id, item_id, challan_number.trim()]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ 
          error: `Duplicate Entry! This material on DC #${challan_number.trim()} has already been logged for this project.` 
        });
      }
    }
    
    // Admin logs are auto-approved; Manager logs go to pending_admin; Site Manager & Employees go to pending_manager
    const initialStatus = req.user.role === 'admin' ? 'approved' :
                          req.user.role === 'manager' ? 'pending_admin' : 'pending_manager';

    const { rows } = await db.query(`
      INSERT INTO project_material_receipts 
        (project_id, item_id, qty_received, challan_number, challan_photo, notes, status, received_by, manager_user_id, admin_user_id, verified_at, admin_verified_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *
    `, [
      id, 
      item_id, 
      Number(qty_received), 
      challan_number || '', 
      challan_photo || '', 
      notes || '', 
      initialStatus, 
      req.user.id,
      req.user.role === 'manager' ? req.user.id : null,
      initialStatus === 'approved' ? req.user.id : null,
      req.user.role === 'manager' ? new Date() : null,
      initialStatus === 'approved' ? new Date() : null
    ]);

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Resubmit Rejected Material Receipt
router.put('/projects/:id/inventory/receipts/:receiptId/resubmit', auth, async (req, res) => {
  try {
    const { id, receiptId } = req.params;
    const { qty_received, challan_number, challan_photo, notes } = req.body;

    const { rows } = await db.query(`
      UPDATE project_material_receipts
      SET qty_received = COALESCE($1, qty_received),
          challan_number = COALESCE($2, challan_number),
          challan_photo = COALESCE($3, challan_photo),
          notes = COALESCE($4, notes),
          status = 'pending_manager',
          rejection_reason = ''
      WHERE id = $5 AND project_id = $6 AND received_by = $7
      RETURNING *
    `, [qty_received ? Number(qty_received) : null, challan_number, challan_photo, notes, receiptId, id, req.user.id]);

    if (rows.length === 0) return res.status(404).json({ error: 'Receipt not found or permission denied' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2-Tier Approval Verification Endpoint (Manager or Admin)
router.put('/projects/:id/inventory/receipts/:receiptId/verify', auth, adminOrManager, async (req, res) => {
  try {
    const { id, receiptId } = req.params;
    const { action, rejection_reason } = req.body; // 'manager_verify' | 'admin_approve' | 'reject'
    if (!['manager_verify', 'admin_approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Action must be manager_verify, admin_approve, or reject' });
    }

    let queryText = '';
    let params = [];

    if (action === 'manager_verify') {
      if (req.user.role !== 'manager') {
        return res.status(403).json({ error: 'Tier 1 Verification must be performed by a Manager first' });
      }
      queryText = `
        UPDATE project_material_receipts
        SET status = 'pending_admin', manager_user_id = $1, verified_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND project_id = $3
        RETURNING *
      `;
      params = [req.user.id, receiptId, id];
    } else if (action === 'admin_approve') {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required for final approval' });
      }
      queryText = `
        UPDATE project_material_receipts
        SET status = 'approved', admin_user_id = $1, admin_verified_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND project_id = $3
        RETURNING *
      `;
      params = [req.user.id, receiptId, id];
    } else if (action === 'reject') {
      queryText = `
        UPDATE project_material_receipts
        SET status = 'rejected', rejection_reason = $1, manager_user_id = $2, verified_at = CURRENT_TIMESTAMP
        WHERE id = $3 AND project_id = $4
        RETURNING *
      `;
      params = [rejection_reason || 'Rejected by verifier', req.user.id, receiptId, id];
    }

    const { rows } = await db.query(queryText, params);
    if (rows.length === 0) return res.status(404).json({ error: 'Receipt not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/projects/:id/inventory/usage', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { item_id, task_id, qty_used, installed_location, notes } = req.body;
    if (!item_id || !qty_used || Number(qty_used) <= 0) {
      return res.status(400).json({ error: 'Valid item_id and positive qty_used required' });
    }
    const { rows } = await db.query(`
      INSERT INTO project_material_usage (project_id, task_id, item_id, qty_used, installed_location, notes, logged_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `, [id, task_id || null, item_id, Number(qty_used), installed_location || '', notes || '', req.user.id]);

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/projects/:id/inventory/scrap', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { item_id, qty_scrapped, reason, photo_url } = req.body;
    if (!item_id || !qty_scrapped || Number(qty_scrapped) <= 0 || !reason) {
      return res.status(400).json({ error: 'Item, positive quantity, and reason required' });
    }
    const { rows } = await db.query(`
      INSERT INTO project_material_scrap (project_id, item_id, qty_scrapped, reason, photo_url, logged_by)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [id, item_id, Number(qty_scrapped), reason, photo_url || '', req.user.id]);

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Physical Store Stock Audit Log Endpoint
router.post('/projects/:id/inventory/physical-audit', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { item_id, system_expected_qty, physical_counted_qty, notes } = req.body;
    if (!item_id || physical_counted_qty === undefined) {
      return res.status(400).json({ error: 'Item ID and physical count required' });
    }
    const expected = Number(system_expected_qty || 0);
    const counted = Number(physical_counted_qty);
    const discrepancy = counted - expected;

    const { rows } = await db.query(`
      INSERT INTO project_physical_audits 
        (project_id, item_id, system_expected_qty, physical_counted_qty, discrepancy_qty, audited_by, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `, [id, item_id, expected, counted, discrepancy, req.user.id, notes || '']);

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PROJECT DOCUMENTS ENDPOINTS ───────────────────────────────────────
router.get('/projects/:id/documents', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: allDocs } = await db.query(`
      SELECT d.*, u.name as uploader_name, m.name as manager_name, adm.name as admin_name
      FROM project_documents d
      LEFT JOIN users u ON d.uploaded_by = u.id
      LEFT JOIN users m ON d.manager_user_id = m.id
      LEFT JOIN users adm ON d.admin_user_id = adm.id
      WHERE d.project_id = $1 AND d.status != 'archived'
      ORDER BY d.created_at DESC
    `, [id]);

    const activeDocs = allDocs.filter(d => d.status === 'active');
    const pendingManagerDocs = allDocs.filter(d => d.status === 'pending_manager');
    const pendingAdminDocs = allDocs.filter(d => d.status === 'pending_admin');

    res.json({ documents: activeDocs, pendingManagerDocs, pendingAdminDocs, allDocs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/projects/:id/documents/upload', auth, upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    const { doc_type, title } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = `/uploads/site_documents/${req.file.filename}`;
    const fileName = req.file.originalname;
    const fileSize = req.file.size;

    // Admin uploads are auto-active; Manager uploads go to pending_admin; Site Manager & Employees go to pending_manager
    const initialStatus = req.user.role === 'admin' ? 'active' :
                          req.user.role === 'manager' ? 'pending_admin' : 'pending_manager';

    const { rows } = await db.query(`
      INSERT INTO project_documents 
        (project_id, doc_type, title, file_url, file_name, file_size, uploaded_by, status, manager_user_id, admin_user_id, verified_at, admin_verified_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *
    `, [
      id, 
      doc_type || 'general', 
      title || fileName, 
      fileUrl, 
      fileName, 
      fileSize, 
      req.user.id,
      initialStatus,
      req.user.role === 'manager' ? req.user.id : null,
      initialStatus === 'active' ? req.user.id : null,
      req.user.role === 'manager' ? new Date() : null,
      initialStatus === 'active' ? new Date() : null
    ]);

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Document 2-Tier Verification Endpoint (Manager / Admin)
router.put('/projects/:id/documents/:docId/verify', auth, adminOrManager, async (req, res) => {
  try {
    const { id, docId } = req.params;
    const { action } = req.body; // 'manager_verify' | 'admin_approve' | 'reject'
    if (!['manager_verify', 'admin_approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Action must be manager_verify, admin_approve, or reject' });
    }

    let queryText = '';
    let params = [];

    if (action === 'manager_verify') {
      if (req.user.role !== 'manager') {
        return res.status(403).json({ error: 'Tier 1 Verification must be performed by a Manager first' });
      }
      queryText = `
        UPDATE project_documents
        SET status = 'pending_admin', manager_user_id = $1, verified_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND project_id = $3
        RETURNING *
      `;
      params = [req.user.id, docId, id];
    } else if (action === 'admin_approve') {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required for final approval' });
      }
      queryText = `
        UPDATE project_documents
        SET status = 'active', admin_user_id = $1, admin_verified_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND project_id = $3
        RETURNING *
      `;
      params = [req.user.id, docId, id];
    } else if (action === 'reject') {
      queryText = `
        UPDATE project_documents
        SET status = 'rejected', manager_user_id = $1, verified_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND project_id = $3
        RETURNING *
      `;
      params = [req.user.id, docId, id];
    }

    const { rows } = await db.query(queryText, params);
    if (rows.length === 0) return res.status(404).json({ error: 'Document not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/projects/:id/documents/:docId', auth, adminOrManager, async (req, res) => {
  try {
    const { id, docId } = req.params;
    await db.query(`UPDATE project_documents SET status = 'archived' WHERE id = $1 AND project_id = $2`, [docId, id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
