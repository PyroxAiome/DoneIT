import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from './db.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'doneit-super-secret-key-2026';

const getGroupAssignees = (parentId, currentTaskId) => {
  const pid = parentId || currentTaskId;
  if (!pid) return { names: [], ids: [] };
  const rows = db.prepare(`
    SELECT t.assignee_id, u.name
    FROM tasks t
    JOIN users u ON t.assignee_id = u.id
    WHERE t.parent_id = ? OR t.id = ?
  `).all(pid, pid);

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

const enrichTask = (task) => {
  if (!task) return;
  const group = getGroupAssignees(task.parent_id, task.id);
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

const createNotification = (recipientId, updaterId, message, taskId) => {
  if (!recipientId || recipientId === updaterId) return;
  try {
    const result = db.prepare("INSERT INTO notifications (user_id, message, task_id) VALUES (?, ?, ?)")
      .run(recipientId, message, taskId);
    const notificationId = result.lastInsertRowid;

    const notification = db.prepare(`
      SELECT n.*, t.title as task_title
      FROM notifications n
      LEFT JOIN tasks t ON n.task_id = t.id
      WHERE n.id = ?
    `).get(notificationId);

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

const notifyRelevantUsers = (updaterId, message, taskId, extraRecipientIds = []) => {
  try {
    console.log(`[Notification Triggered] message: "${message}", taskId: ${taskId}`);
    const recipientIds = new Set();

    // 1. All Admins
    const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all();
    admins.forEach(a => recipientIds.add(a.id));

    // 2. Fetch task assignee, creator, and assignee's department details
    const taskDetails = db.prepare(`
      SELECT t.assignee_id, t.creator_id, u.department as assignee_dept
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.id = ?
    `).get(taskId);

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
        const managers = db.prepare("SELECT id FROM users WHERE role = 'manager' AND department = ?")
          .all(taskDetails.assignee_dept);
        managers.forEach(m => recipientIds.add(m.id));
      }
    }

    // 3. Add extra recipients (e.g. parsed mentions)
    extraRecipientIds.forEach(id => recipientIds.add(id));

    // Send notification to all collected unique IDs
    for (const recipientId of recipientIds) {
      createNotification(recipientId, updaterId, message, taskId);
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
  let roleFilter = "role = 'employee'";
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
      c.name as creator_name, c.role as creator_role, c.department as creator_department, e.name as last_edited_by_name
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
  if (req.query.category) {
    sql += ' AND LOWER(t.category) = LOWER(?)';
    params.push(req.query.category);
  }
  if (req.query.priority) {
    sql += ' AND t.priority = ?';
    params.push(req.query.priority);
  }
  if (req.query.search) {
    sql += ' AND (t.title LIKE ? OR t.description LIKE ?)';
    params.push(`%${req.query.search}%`, `%${req.query.search}%`);
  }

  // Admin-exclusive date range filtering
  if (req.user.role === 'admin' && req.query.date_range) {
    if (req.query.date_range === 'today') {
      sql += " AND t.created_at >= datetime('now', 'start of day')";
    } else if (req.query.date_range === 'week') {
      sql += " AND t.created_at >= datetime('now', '-7 days')";
    } else if (req.query.date_range === 'month') {
      sql += " AND t.created_at >= datetime('now', 'start of month')";
    } else if (req.query.date_range === 'year') {
      sql += " AND t.created_at >= datetime('now', 'start of year')";
    }
  }

  // Deduplicate group task copies for Admin and Manager dashboard views
  // Only apply when not filtering by a specific employee/assignee
  if (req.user.role !== 'employee' && !req.query.assignee_id) {
    sql += ' AND (t.parent_id IS NULL OR t.id = t.parent_id)';
  }

  if (req.user.role === 'employee') {
    sql += ' AND t.assignee_id = ?';
    params.push(req.user.id);
  }

  sql += ' ORDER BY t.created_at DESC';

  const tasks = db.prepare(sql).all(...params);
  tasks.forEach(enrichTask);
  res.json(tasks);
});

router.get('/tasks/:id', auth, (req, res) => {
  const task = db.prepare(`
    SELECT t.*, u.name as assignee_name, u.email as assignee_email,
      c.name as creator_name, c.role as creator_role, c.department as creator_department, e.name as last_edited_by_name
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    LEFT JOIN users c ON t.creator_id = c.id
    LEFT JOIN users e ON t.last_edited_by = e.id
    WHERE t.id = ?
  `).get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  enrichTask(task);
  res.json(task);
});

router.post('/tasks', auth, (req, res) => {
  const { title, description, color, status, priority, category, assignee_id, assignee_ids,
    start_date, due_date, estimated_hours } = req.body;

  if (!title) return res.status(400).json({ error: 'Title required' });

  let assignees = [];
  if (req.user.role === 'employee') {
    assignees = [req.user.id];
  } else if (assignee_ids && Array.isArray(assignee_ids) && assignee_ids.length > 0) {
    assignees = assignee_ids;
  } else {
    assignees = [assignee_id || null];
  }

  const createdTasks = [];
  const insertStmt = db.prepare(`
    INSERT INTO tasks (title, description, color, status, priority, category,
      assignee_id, creator_id, start_date, due_date, estimated_hours, parent_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const selectStmt = db.prepare(`
    SELECT t.*, u.name as assignee_name, c.name as creator_name, c.role as creator_role, c.department as creator_department, e.name as last_edited_by_name
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    LEFT JOIN users c ON t.creator_id = c.id
    LEFT JOIN users e ON t.last_edited_by = e.id
    WHERE t.id = ?
  `);

  let parentId = null;
  const insertedIds = [];
  for (let i = 0; i < assignees.length; i++) {
    const targetId = assignees[i];
    const result = insertStmt.run(
      title, description || '', color || 'slate', status || 'todo',
      priority || 'medium', category || 'General',
      targetId, req.user.id,
      start_date || null, due_date || null, estimated_hours || 0,
      i === 0 ? null : parentId
    );

    const insertedId = result.lastInsertRowid;
    insertedIds.push(insertedId);
    if (i === 0) {
      parentId = insertedId;
      if (assignees.length > 1) {
        db.prepare('UPDATE tasks SET parent_id = ? WHERE id = ?').run(parentId, parentId);
      }
    }
  }

  for (const insertedId of insertedIds) {
    const task = selectStmt.get(insertedId);
    enrichTask(task);
    createdTasks.push(task);

    let msg = '';
    if (task.creator_id === task.assignee_id) {
      msg = `${req.user.name} self-assigned task: "${title}"`;
    } else if (task.assignee_name) {
      msg = `${req.user.name} assigned task: "${title}" to ${task.assignee_name}`;
    } else {
      msg = `${req.user.name} created task: "${title}"`;
    }
    notifyRelevantUsers(req.user.id, msg, task.id);
  }

  res.status(201).json(createdTasks.length === 1 ? createdTasks[0] : { tasks: createdTasks });
});

router.post('/tasks/bulk', auth, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can perform bulk imports.' });
  }

  const { tasks } = req.body;
  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    return res.status(400).json({ error: 'Tasks array is required' });
  }

  const insertStmt = db.prepare(`
    INSERT INTO tasks (title, description, color, status, priority, category,
      assignee_id, creator_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const selectStmt = db.prepare(`
    SELECT t.*, u.name as assignee_name, c.name as creator_name, c.role as creator_role, c.department as creator_department, e.name as last_edited_by_name
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    LEFT JOIN users c ON t.creator_id = c.id
    LEFT JOIN users e ON t.last_edited_by = e.id
    WHERE t.id = ?
  `);

  const createdTasks = [];

  const runTransaction = db.transaction(() => {
    for (const t of tasks) {
      const { title, description, priority, category, assignee_id } = t;
      const result = insertStmt.run(
        title,
        description || '',
        'slate', // default color
        'todo',  // default status
        priority || 'medium',
        category || 'General',
        assignee_id || null,
        req.user.id
      );

      const task = selectStmt.get(result.lastInsertRowid);
      enrichTask(task);
      createdTasks.push(task);

      if (task.assignee_id) {
        const msg = `${req.user.name} assigned task: "${title}" to ${task.assignee_name}`;
        notifyRelevantUsers(req.user.id, msg, task.id);
      }
    }
  });

  try {
    runTransaction();
    res.status(201).json(createdTasks);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to complete bulk import.' });
  }
});

router.put('/tasks/:id', auth, (req, res) => {
  const { id } = req.params;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  if (req.user.role === 'employee' && task.assignee_id !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized to update this task' });
  }

  const creator = db.prepare('SELECT role, department FROM users WHERE id = ?').get(task.creator_id);
  const creatorRole = creator ? creator.role : 'admin';
  const creatorDept = creator ? creator.department : 'Engineering';

  if (req.user.role === 'manager') {
    const isSelf = task.creator_id === req.user.id;
    const isSameDeptEmployee = creatorRole === 'employee' && creatorDept === req.user.department;
    if (!isSelf && !isSameDeptEmployee) {
      // Manager is attempting to modify a task created by an admin or employee from another department.
      // They are only allowed to update status, priority, progress_percent, and logical_explanation.
      const allowedFieldsForRestricted = ['status', 'priority', 'progress_percent', 'logical_explanation'];
      const attemptedFields = Object.keys(req.body);
      const hasDisallowed = attemptedFields.some(f => !allowedFieldsForRestricted.includes(f));
      if (hasDisallowed) {
        return res.status(403).json({ error: 'Managers are only authorized to change status, priority, progress, and explanation for this task.' });
      }
    }
  }

  // Prevent status changes on Admin-assigned group tasks by non-admins
  const isGroupTask = task.parent_id !== null;
  if (req.user.role !== 'admin' && isGroupTask && creatorRole === 'admin') {
    if (req.body.status !== undefined && req.body.status !== task.status) {
      return res.status(403).json({ error: 'Status changes on Admin-assigned group tasks can only be made by an Admin.' });
    }
  }

  const fields = ['title', 'description', 'color', 'status', 'priority', 'category',
    'progress_percent', 'start_date', 'due_date', 'estimated_hours',
    'logical_explanation'];

  const updates = [];
  const values = [];

  for (const field of fields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(req.body[field]);
    }
  }

  const currentTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!currentTask) return res.status(404).json({ error: 'Task not found' });

  // Handle assignee_id / assignee_ids updates
  const assignee_id = req.body.assignee_id;
  const assignee_ids = req.body.assignee_ids;
  
  let primaryAssignee = null;
  let extraAssignees = [];

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
    updates.push('assignee_id = ?');
    values.push(primaryAssignee);
  }

  // Set the parent_id if there are multiple assignees or if parent_id exists
  let currentParentId = currentTask.parent_id;
  if ((assignee_ids && assignee_ids.length > 1) || currentParentId) {
    currentParentId = currentParentId || currentTask.id;
    updates.push('parent_id = ?');
    values.push(currentParentId);
  }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  updates.push("updated_at = datetime('now')");
  updates.push('last_edited_by = ?');
  values.push(req.user.id);
  
  // Save field values before pushing specific task ID
  const fieldValues = [...values];
  
  // 1. Always update the primary task row first
  db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...fieldValues, id);

  // 2. Fetch the updated task to use as the template for cloning
  const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);

  // 3. Synchronize other tasks in the group if assignee_ids array is provided
  if (assignee_ids && Array.isArray(assignee_ids)) {
    const selectedSet = new Set(assignee_ids.map(Number));

    // Get all tasks currently in this group
    const allGroupTasks = db.prepare('SELECT id, assignee_id FROM tasks WHERE id = ? OR parent_id = ?').all(currentParentId, currentParentId);

    const parentTaskRow = allGroupTasks.find(t => t.id === currentParentId);
    const cloneTaskRows = allGroupTasks.filter(t => t.id !== currentParentId);

    // If the parent task's assignee is not in selectedSet, reassign the parent row to a selected assignee to preserve it
    let parentRowTargetAssignee = parentTaskRow && selectedSet.has(parentTaskRow.assignee_id) ? parentTaskRow.assignee_id : null;
    
    if (parentTaskRow && !parentRowTargetAssignee && selectedSet.size > 0) {
      parentRowTargetAssignee = Array.from(selectedSet)[0];
    }

    // Now, update the parent row if it exists
    if (parentTaskRow && parentRowTargetAssignee) {
      const parentUpdates = [...updates];
      const parentValues = [...fieldValues];
      const assigneeIndex = parentUpdates.indexOf('assignee_id = ?');
      if (assigneeIndex !== -1) {
        parentValues[assigneeIndex] = parentRowTargetAssignee;
      }
      db.prepare(`UPDATE tasks SET ${parentUpdates.join(', ')} WHERE id = ?`)
        .run(...parentValues, currentParentId);
      
      selectedSet.delete(parentRowTargetAssignee);
    }

    // Process clone task copies
    for (const cloneRow of cloneTaskRows) {
      if (cloneRow.id === id) {
        // Skip current primary task because it was updated first
        selectedSet.delete(cloneRow.assignee_id);
        continue;
      }

      if (selectedSet.has(cloneRow.assignee_id)) {
        // Update this clone copy
        db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`)
          .run(...fieldValues, cloneRow.id);
        selectedSet.delete(cloneRow.assignee_id);
      } else {
        // Safe to delete this clone copy
        db.prepare('DELETE FROM tasks WHERE id = ?').run(cloneRow.id);
      }
    }

    // Insert new clone copies referencing the parent ID
    if (selectedSet.size > 0 && currentParentId) {
      const insertStmt = db.prepare(`
        INSERT INTO tasks (title, description, color, status, priority, category,
          assignee_id, creator_id, start_date, due_date, estimated_hours, parent_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const templateTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(currentParentId);

      for (const newAssigneeId of selectedSet) {
        insertStmt.run(
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
          currentParentId
        );
      }
    }
  } else if (currentParentId) {
    // If it is a group task and assignee list was not modified (e.g. status changed from card dropdown or details modal),
    // synchronize this update to all other task copies in the same group.
    const otherGroupTasks = db.prepare('SELECT id FROM tasks WHERE (parent_id = ? OR id = ?) AND id != ?').all(currentParentId, currentParentId, id);
    for (const gt of otherGroupTasks) {
      const otherUpdateParams = [...fieldValues, req.user.id, gt.id];
      db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...otherUpdateParams);
    }
  }

  const updated = db.prepare(`
    SELECT t.*, u.name as assignee_name, u.email as assignee_email,
      c.name as creator_name, c.role as creator_role, c.department as creator_department, e.name as last_edited_by_name
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    LEFT JOIN users c ON t.creator_id = c.id
    LEFT JOIN users e ON t.last_edited_by = e.id
    WHERE t.id = ?
  `).get(id);

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
  updated.group_assignees = getGroupAssignees(updated.parent_id);
  notifyRelevantUsers(req.user.id, msg, updated.id);

  res.json(updated);
});

router.delete('/tasks/:id', auth, (req, res) => {
  const { id } = req.params;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  if (task.status === 'completed' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can delete completed tasks' });
  }

  if (req.user.role === 'employee' && task.creator_id !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized to delete this task' });
  }

  const creator = db.prepare('SELECT role, department FROM users WHERE id = ?').get(task.creator_id);
  const creatorRole = creator ? creator.role : 'admin';
  const creatorDept = creator ? creator.department : 'Engineering';

  if (req.user.role === 'manager') {
    const isSelf = task.creator_id === req.user.id;
    const isSameDeptEmployee = creatorRole === 'employee' && creatorDept === req.user.department;
    if (!isSelf && !isSameDeptEmployee) {
      return res.status(403).json({ error: 'Not authorized to delete tasks created by admins or employees in other departments' });
    }
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

  const taskDetails = db.prepare('SELECT title FROM tasks WHERE id = ?').get(id);
  const commentMsg = `${req.user.name} reviewed/commented on task "${taskDetails.title}": "${comment_text.substring(0, 30)}${comment_text.length > 30 ? '...' : ''}"`;

  // Parse mentions (e.g. @Teja, @hemant)
  const mentionRegex = /@([a-zA-Z0-9_]+)/g;
  const extraRecipientIds = [];
  let match;
  while ((match = mentionRegex.exec(comment_text)) !== null) {
    const nameToFind = match[1].toLowerCase();
    const mentionedUser = db.prepare("SELECT id FROM users WHERE LOWER(name) = ?").get(nameToFind);
    if (mentionedUser) {
      extraRecipientIds.push(mentionedUser.id);
    }
  }

  notifyRelevantUsers(req.user.id, commentMsg, id, extraRecipientIds);

  res.status(201).json(comment);
});

router.get('/tasks/:id/comments', auth, (req, res) => {
  const { id } = req.params;
  const task = db.prepare('SELECT parent_id FROM tasks WHERE id = ?').get(id);
  const rootId = task && task.parent_id ? task.parent_id : id;
  const comments = db.prepare(`
    SELECT ac.*, u.name as admin_name
    FROM admin_comments ac
    LEFT JOIN users u ON ac.admin_id = u.id
    WHERE ac.task_id IN (SELECT id FROM tasks WHERE id = ? OR parent_id = ?)
    ORDER BY ac.parent_id IS NULL DESC, ac.created_at ASC
  `).all(rootId, rootId);
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

// ─── DAILY LOGS ──────────────────────────────────────────────────
router.get('/tasks/:id/daily-logs', auth, (req, res) => {
  const { id } = req.params;
  const task = db.prepare('SELECT parent_id FROM tasks WHERE id = ?').get(id);
  const rootId = task && task.parent_id ? task.parent_id : id;
  
  const logs = db.prepare(`
    SELECT dl.*, u.name as user_name, u.role as user_role,
      (SELECT COUNT(*) FROM task_daily_log_reactions WHERE log_id = dl.id AND reaction_type = 'like') as likes_count,
      (SELECT reaction_type FROM task_daily_log_reactions WHERE log_id = dl.id AND user_id = ?) as user_reaction
    FROM task_daily_logs dl
    LEFT JOIN users u ON dl.user_id = u.id
    WHERE dl.task_id IN (SELECT id FROM tasks WHERE id = ? OR parent_id = ?)
    ORDER BY dl.log_date DESC, dl.created_at DESC
  `).all(req.user.id, rootId, rootId);

  const logsWithLikesAndComments = logs.map(log => {
    const likes = db.prepare(`
      SELECT u.name
      FROM task_daily_log_reactions r
      JOIN users u ON r.user_id = u.id
      WHERE r.log_id = ? AND r.reaction_type = 'like'
    `).all(log.id);
    log.liked_by_names = likes.map(l => l.name);

    const comments = db.prepare(`
      SELECT c.*, u.name as user_name, u.role as user_role
      FROM task_daily_log_comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.log_id = ?
      ORDER BY c.created_at ASC
    `).all(log.id);
    return { ...log, comments };
  });

  res.json(logsWithLikesAndComments);
});

router.post('/tasks/:id/daily-logs', auth, (req, res) => {
  const { id } = req.params;
  const { log_date, content } = req.body;
  if (!content) return res.status(400).json({ error: 'Content required' });
  if (!log_date) return res.status(400).json({ error: 'Log date required' });

  const task = db.prepare('SELECT id, title FROM tasks WHERE id = ?').get(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const existing = db.prepare('SELECT id FROM task_daily_logs WHERE task_id = ? AND user_id = ? AND log_date = ?')
    .get(id, req.user.id, log_date);

  let logId;
  if (existing) {
    db.prepare('UPDATE task_daily_logs SET content = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(content, existing.id);
    logId = existing.id;
  } else {
    const result = db.prepare('INSERT INTO task_daily_logs (task_id, user_id, log_date, content) VALUES (?, ?, ?, ?)')
      .run(id, req.user.id, log_date, content);
    logId = result.lastInsertRowid;
  }

  const log = db.prepare(`
    SELECT dl.*, u.name as user_name, u.role as user_role,
      0 as likes_count, NULL as user_reaction
    FROM task_daily_logs dl
    LEFT JOIN users u ON dl.user_id = u.id
    WHERE dl.id = ?
  `).get(logId);
  log.comments = [];
  log.liked_by_names = [];

  const isUpdate = !!existing;
  const msg = `${req.user.name} ${isUpdate ? 'updated daily log' : 'added daily log'} for task "${task.title}" on ${log_date}`;
  notifyRelevantUsers(req.user.id, msg, id);

  res.json(log);
});

router.delete('/tasks/:id/daily-logs/:logId', auth, (req, res) => {
  const { logId } = req.params;
  const log = db.prepare('SELECT * FROM task_daily_logs WHERE id = ?').get(logId);
  if (!log) return res.status(404).json({ error: 'Log not found' });

  if (log.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Only the author can delete this log' });
  }

  db.prepare('DELETE FROM task_daily_logs WHERE id = ?').run(logId);
  res.json({ success: true });
});

router.post('/tasks/:id/daily-logs/:logId/react', auth, (req, res) => {
  const { logId } = req.params;

  const log = db.prepare('SELECT * FROM task_daily_logs WHERE id = ?').get(logId);
  if (!log) return res.status(404).json({ error: 'Daily log not found' });

  const existing = db.prepare('SELECT id FROM task_daily_log_reactions WHERE log_id = ? AND user_id = ? AND reaction_type = \'like\'')
    .get(logId, req.user.id);

  if (existing) {
    db.prepare('DELETE FROM task_daily_log_reactions WHERE id = ?').run(existing.id);
  } else {
    db.prepare('INSERT INTO task_daily_log_reactions (log_id, user_id, reaction_type) VALUES (?, ?, \'like\')')
      .run(logId, req.user.id);
  }

  const counts = db.prepare(`
    SELECT 
      (SELECT COUNT(*) FROM task_daily_log_reactions WHERE log_id = ? AND reaction_type = 'like') as likes_count,
      (SELECT reaction_type FROM task_daily_log_reactions WHERE log_id = ? AND user_id = ?) as user_reaction
  `).get(logId, logId, req.user.id);

  const likes = db.prepare(`
    SELECT u.name
    FROM task_daily_log_reactions r
    JOIN users u ON r.user_id = u.id
    WHERE r.log_id = ? AND r.reaction_type = 'like'
  `).all(logId);
  counts.liked_by_names = likes.map(l => l.name);

  res.json(counts);
});

router.post('/tasks/:id/daily-logs/:logId/comments', auth, (req, res) => {
  const { id: taskId, logId } = req.params;
  const { comment_text } = req.body;
  if (!comment_text) return res.status(400).json({ error: 'Comment text required' });

  const log = db.prepare('SELECT * FROM task_daily_logs WHERE id = ?').get(logId);
  if (!log) return res.status(404).json({ error: 'Daily log not found' });

  const result = db.prepare('INSERT INTO task_daily_log_comments (log_id, user_id, comment_text) VALUES (?, ?, ?)')
    .run(logId, req.user.id, comment_text);

  const comment = db.prepare(`
    SELECT c.*, u.name as user_name, u.role as user_role
    FROM task_daily_log_comments c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.id = ?
  `).get(result.lastInsertRowid);

  const task = db.prepare('SELECT title FROM tasks WHERE id = ?').get(taskId);
  const msg = `${req.user.name} commented on daily log of task "${task.title}": "${comment_text.substring(0, 30)}${comment_text.length > 30 ? '...' : ''}"`;
  notifyRelevantUsers(req.user.id, msg, taskId);

  res.status(201).json(comment);
});

router.delete('/tasks/:id/daily-logs/:logId/comments/:commentId', auth, (req, res) => {
  const { commentId } = req.params;
  const comment = db.prepare('SELECT * FROM task_daily_log_comments WHERE id = ?').get(commentId);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });

  if (req.user.role !== 'admin' && comment.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized to delete this comment' });
  }

  db.prepare('DELETE FROM task_daily_log_comments WHERE id = ?').run(commentId);
  res.json({ success: true });
});

// ─── NOTIFICATIONS ──────────────────────────────────────────────
router.get('/notifications', auth, (req, res) => {
  const list = db.prepare(`
    SELECT n.*, t.title as task_title 
    FROM notifications n
    LEFT JOIN tasks t ON n.task_id = t.id
    WHERE n.user_id = ? 
    ORDER BY n.created_at DESC 
    LIMIT 50
  `).all(req.user.id);
  res.json(list);
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

router.put('/notifications/:id/read', auth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

router.post('/notifications/read-all', auth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ success: true });
});

router.delete('/notifications/:id', auth, (req, res) => {
  db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// ─── TASK LOGICAL EXPLANATIONS ────────────────────────────────────
router.get('/tasks/:id/explanations', auth, (req, res) => {
  const { id } = req.params;
  const task = db.prepare('SELECT parent_id FROM tasks WHERE id = ?').get(id);
  const rootId = task && task.parent_id ? task.parent_id : id;
  const explanations = db.prepare(`
    SELECT te.*, u.name as user_name, u.role as user_role
    FROM task_explanations te
    LEFT JOIN users u ON te.user_id = u.id
    WHERE te.task_id IN (SELECT id FROM tasks WHERE id = ? OR parent_id = ?)
    ORDER BY te.created_at DESC
  `).all(rootId, rootId);
  res.json(explanations);
});

router.post('/tasks/:id/explanations', auth, (req, res) => {
  const { id } = req.params;
  const { explanation_text } = req.body;
  if (!explanation_text) return res.status(400).json({ error: 'Explanation text is required' });

  // Restrict to maximum 3 logical explanations per user per task
  const { count } = db.prepare('SELECT COUNT(*) as count FROM task_explanations WHERE task_id = ? AND user_id = ?')
    .get(id, req.user.id);
  if (count >= 3) {
    return res.status(400).json({ error: 'You have reached the limit of 3 logical explanations for this task.' });
  }

  const result = db.prepare('INSERT INTO task_explanations (task_id, user_id, explanation_text) VALUES (?, ?, ?)')
    .run(id, req.user.id, explanation_text);

  const newExp = db.prepare(`
    SELECT te.*, u.name as user_name, u.role as user_role
    FROM task_explanations te
    LEFT JOIN users u ON te.user_id = u.id
    WHERE te.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(newExp);
});

router.put('/tasks/:id/explanations/:expId', auth, (req, res) => {
  const { expId } = req.params;
  const { explanation_text } = req.body;
  if (!explanation_text) return res.status(400).json({ error: 'Explanation text is required' });

  const exp = db.prepare('SELECT * FROM task_explanations WHERE id = ?').get(expId);
  if (!exp) return res.status(404).json({ error: 'Explanation not found' });
  if (exp.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized to update this explanation' });
  }

  db.prepare('UPDATE task_explanations SET explanation_text = ? WHERE id = ?').run(explanation_text, expId);

  const updated = db.prepare(`
    SELECT te.*, u.name as user_name, u.role as user_role
    FROM task_explanations te
    LEFT JOIN users u ON te.user_id = u.id
    WHERE te.id = ?
  `).get(expId);

  res.json(updated);
});

router.delete('/tasks/:id/explanations/:expId', auth, (req, res) => {
  const { expId } = req.params;
  const exp = db.prepare('SELECT * FROM task_explanations WHERE id = ?').get(expId);
  if (!exp) return res.status(404).json({ error: 'Explanation not found' });
  if (req.user.role !== 'admin' && exp.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized to delete this explanation' });
  }
  db.prepare('DELETE FROM task_explanations WHERE id = ?').run(expId);
  res.json({ success: true });
});

export default router;
