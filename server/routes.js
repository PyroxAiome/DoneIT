import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from './db.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'doneit-super-secret-key-2026';

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

const adminOrManager = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Admin or Manager access required' });
  }
  next();
};

// ─── AUTH ───────────────────────────────────────────────────────
router.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
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
});

router.get('/auth/me', auth, (req, res) => {
  const user = db.prepare('SELECT id, name, email, role, department, avatar_url, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

router.put('/auth/change-password', auth, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Current and new password required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (!bcrypt.compareSync(current_password, user.password_hash)) {
    return res.status(400).json({ error: 'Incorrect current password' });
  }

  const newHash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.user.id);

  res.json({ success: true });
});

// ─── USERS ──────────────────────────────────────────────────────
router.get('/employees', auth, (req, res) => {
  const includeAll = req.query.all === 'true';
  let roleFilter = "role IN ('employee','manager')";
  if (includeAll) roleFilter = "role IN ('admin','manager','employee')";

  const users = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.department, u.avatar_url, u.created_at,
      COALESCE(tc.task_count, 0) as task_count,
      COALESCE(tc.avg_progress, 0) as avg_progress
    FROM users u
    LEFT JOIN (
      SELECT assignee_id,
        COUNT(*) as task_count,
        ROUND(AVG(progress_percent), 0) as avg_progress
      FROM tasks
      WHERE assignee_id IS NOT NULL
      GROUP BY assignee_id
    ) tc ON u.id = tc.assignee_id
    WHERE ${roleFilter}
    ORDER BY u.name
  `).all();

  res.json(users);
});

router.post('/users', auth, adminOnly, (req, res) => {
  const { name, email, password, role, department } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Name, email, password, and role required' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'Email already exists' });
  }
  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (name, email, password_hash, role, department) VALUES (?, ?, ?, ?, ?)'
  ).run(name, email, hash, role, department || 'Engineering');

  const user = db.prepare('SELECT id, name, email, role, department, avatar_url, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(user);
});

router.delete('/users/:id', auth, adminOnly, (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'User not found' });
  res.json({ success: true });
});

// ─── TASKS ──────────────────────────────────────────────────────
router.get('/tasks', auth, (req, res) => {
  let sql = `
    SELECT t.*, 
      u.name as assignee_name, u.email as assignee_email,
      c.name as creator_name, e.name as last_edited_by_name
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    LEFT JOIN users c ON t.creator_id = c.id
    LEFT JOIN users e ON t.last_edited_by = e.id
    WHERE 1=1
  `;
  const params = [];

  if (req.query.assignee_id) {
    sql += ' AND t.assignee_id = ?';
    params.push(req.query.assignee_id);
  }
  if (req.query.status) {
    sql += ' AND t.status = ?';
    params.push(req.query.status);
  }
  if (req.query.search) {
    sql += ' AND (t.title LIKE ? OR t.description LIKE ?)';
    params.push(`%${req.query.search}%`, `%${req.query.search}%`);
  }

  if (req.user.role === 'employee') {
    sql += ' AND t.assignee_id = ?';
    params.push(req.user.id);
  }

  sql += ' ORDER BY t.created_at DESC';

  const tasks = db.prepare(sql).all(...params);
  res.json(tasks);
});

router.get('/tasks/:id', auth, (req, res) => {
  const task = db.prepare(`
    SELECT t.*, u.name as assignee_name, u.email as assignee_email,
      c.name as creator_name, e.name as last_edited_by_name
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    LEFT JOIN users c ON t.creator_id = c.id
    LEFT JOIN users e ON t.last_edited_by = e.id
    WHERE t.id = ?
  `).get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

router.post('/tasks', auth, (req, res) => {
  const { title, description, color, status, priority, category, assignee_id,
    start_date, due_date, estimated_hours } = req.body;

  if (!title) return res.status(400).json({ error: 'Title required' });

  // Employee can only create tasks assigned to themselves
  const targetAssignee = req.user.role === 'employee' ? req.user.id : (assignee_id || null);

  const result = db.prepare(`
    INSERT INTO tasks (title, description, color, status, priority, category,
      assignee_id, creator_id, start_date, due_date, estimated_hours)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    title, description || '', color || 'slate', status || 'todo',
    priority || 'medium', category || 'General',
    targetAssignee, req.user.id,
    start_date || null, due_date || null, estimated_hours || 0
  );

  const task = db.prepare(`
    SELECT t.*, u.name as assignee_name, c.name as creator_name, e.name as last_edited_by_name
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    LEFT JOIN users c ON t.creator_id = c.id
    LEFT JOIN users e ON t.last_edited_by = e.id
    WHERE t.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(task);
});

router.put('/tasks/:id', auth, (req, res) => {
  const { id } = req.params;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  if (req.user.role === 'employee' && task.assignee_id !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized to update this task' });
  }

  const fields = ['title', 'description', 'color', 'status', 'priority', 'category',
    'assignee_id', 'progress_percent', 'start_date', 'due_date', 'estimated_hours',
    'logical_explanation'];

  const updates = [];
  const values = [];

  for (const field of fields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(req.body[field]);
    }
  }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  updates.push("updated_at = datetime('now')");
  updates.push('last_edited_by = ?');
  values.push(req.user.id);
  values.push(id);

  db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare(`
    SELECT t.*, u.name as assignee_name, u.email as assignee_email,
      c.name as creator_name, e.name as last_edited_by_name
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    LEFT JOIN users c ON t.creator_id = c.id
    LEFT JOIN users e ON t.last_edited_by = e.id
    WHERE t.id = ?
  `).get(id);

  res.json(updated);
});

router.delete('/tasks/:id', auth, (req, res) => {
  const { id } = req.params;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  if (req.user.role === 'employee' && task.creator_id !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized to delete this task' });
  }

  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  res.json({ success: true });
});

// ─── COMMENTS ───────────────────────────────────────────────────
router.post('/tasks/:id/comments', auth, (req, res) => {
  const { id } = req.params;
  const { comment_text, parent_id } = req.body;
  if (!comment_text) return res.status(400).json({ error: 'Comment text required' });

  const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  // Only admin/manager can create top-level reviews; anyone can reply
  if (!parent_id && req.user.role === 'employee') {
    return res.status(403).json({ error: 'Employees can only reply to reviews' });
  }

  const result = db.prepare(
    'INSERT INTO admin_comments (task_id, admin_id, parent_id, comment_text) VALUES (?, ?, ?, ?)'
  ).run(id, req.user.id, parent_id || null, comment_text);

  const comment = db.prepare(`
    SELECT ac.*, u.name as admin_name
    FROM admin_comments ac
    LEFT JOIN users u ON ac.admin_id = u.id
    WHERE ac.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(comment);
});

router.get('/tasks/:id/comments', auth, (req, res) => {
  const { id } = req.params;
  const comments = db.prepare(`
    SELECT ac.*, u.name as admin_name
    FROM admin_comments ac
    LEFT JOIN users u ON ac.admin_id = u.id
    WHERE ac.task_id = ?
    ORDER BY ac.parent_id IS NULL DESC, ac.created_at ASC
  `).all(id);
  res.json(comments);
});

router.put('/tasks/:id/comments/:commentId', auth, (req, res) => {
  const { id, commentId } = req.params;
  const { comment_text } = req.body;
  if (!comment_text) return res.status(400).json({ error: 'Comment text required' });

  const comment = db.prepare('SELECT * FROM admin_comments WHERE id = ? AND task_id = ?').get(commentId, id);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });

  if (req.user.role !== 'admin' && comment.admin_id !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized to edit this comment' });
  }

  db.prepare('UPDATE admin_comments SET comment_text = ? WHERE id = ?').run(comment_text, commentId);

  const updated = db.prepare(`
    SELECT ac.*, u.name as admin_name
    FROM admin_comments ac
    LEFT JOIN users u ON ac.admin_id = u.id
    WHERE ac.id = ?
  `).get(commentId);

  res.json(updated);
});

router.delete('/tasks/:id/comments/:commentId', auth, (req, res) => {
  const { id, commentId } = req.params;

  const comment = db.prepare('SELECT * FROM admin_comments WHERE id = ? AND task_id = ?').get(commentId, id);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });

  if (req.user.role !== 'admin' && comment.admin_id !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized to delete this comment' });
  }

  db.prepare('DELETE FROM admin_comments WHERE id = ? OR parent_id = ?').run(commentId, commentId);
  res.json({ success: true });
});

// ─── DASHBOARD STATS ────────────────────────────────────────────
router.get('/dashboard/stats', auth, adminOrManager, (req, res) => {
  const totalTasks = db.prepare('SELECT COUNT(*) as cnt FROM tasks').get().cnt;
  const totalEmployees = db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'employee'").get().cnt;
  const totalManagers = db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'manager'").get().cnt;

  const avgCompletion = db.prepare('SELECT ROUND(AVG(progress_percent), 0) as avg FROM tasks').get().avg;

  const statusBreakdown = db.prepare(`
    SELECT status, COUNT(*) as cnt FROM tasks GROUP BY status
  `).all();

  const recentTasks = db.prepare(`
    SELECT t.id, t.title, t.status, t.priority,
      u.name as assignee_name, t.due_date, t.color
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    ORDER BY t.created_at DESC LIMIT 5
  `).all();

  res.json({
    totalTasks,
    totalEmployees,
    totalManagers,
    avgCompletion: avgCompletion || 0,
    statusBreakdown,
    recentTasks,
  });
});

export default router;
