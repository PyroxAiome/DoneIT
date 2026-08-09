import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from './db.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'doneit-super-secret-key-2026';

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
router.get('/employees', auth, async (req, res) => {
  try {
    const includeAll = req.query.all === 'true';
    let roleFilter = "role = 'employee'";
    if (includeAll) roleFilter = "role IN ('admin','manager','employee')";

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
      WHERE ${roleFilter}
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
    const { rows: existingRows } = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingRows[0]) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    const hash = bcrypt.hashSync(password, 10);
    const result = await db.query(
      'INSERT INTO users (name, email, password_hash, role, department) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [name, email, hash, role, department || 'Engineering']
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

    // Deduplicate group task copies for Admin and Manager dashboard views
    // Only apply when not filtering by a specific employee/assignee
    if (req.user.role !== 'employee' && !req.query.assignee_id) {
      sql += ' AND (t.parent_id IS NULL OR t.id = t.parent_id)';
    }

    if (req.user.role === 'employee' && !req.query.assignee_id) {
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

    let parentId = null;
    const insertedIds = [];
    for (let i = 0; i < assignees.length; i++) {
      const targetId = assignees[i];
      const result = await db.query(`
        INSERT INTO tasks (title, description, color, status, priority, category,
          assignee_id, creator_id, start_date, due_date, estimated_hours, parent_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id
      `, [
        title, description || '', color || 'slate', status || 'todo',
        priority || 'medium', category || 'General',
        targetId, req.user.id,
        start_date || null, due_date || null, estimated_hours || 0,
        i === 0 ? null : parentId
      ]);

      const insertedId = result.rows[0].id;
      insertedIds.push(insertedId);
      if (i === 0) {
        parentId = insertedId;
        if (assignees.length > 1) {
          await db.query('UPDATE tasks SET parent_id = $1 WHERE id = $2', [parentId, parentId]);
        }
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
              assignee_id, creator_id, start_date, due_date, estimated_hours, parent_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
            currentParentId
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
    const { rows: taskRows } = await db.query('SELECT parent_id FROM tasks WHERE id = $1', [id]);
    const task = taskRows[0];
    const rootId = task && task.parent_id ? task.parent_id : id;
    const { rows: comments } = await db.query(`
      SELECT ac.*, u.name as admin_name
      FROM admin_comments ac
      LEFT JOIN users u ON ac.admin_id = u.id
      WHERE ac.task_id IN (SELECT id FROM tasks WHERE id = $1 OR parent_id = $2)
      ORDER BY ac.parent_id IS NULL DESC, ac.created_at ASC
    `, [rootId, rootId]);
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
      WHERE dl.task_id IN (SELECT id FROM tasks WHERE id = $2 OR parent_id = $3)
      ORDER BY dl.log_date DESC, dl.created_at DESC
    `, [req.user.id, rootId, rootId]);

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

// ─── TASK LOGICAL EXPLANATIONS ────────────────────────────────────
router.get('/tasks/:id/explanations', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: taskRows } = await db.query('SELECT parent_id FROM tasks WHERE id = $1', [id]);
    const task = taskRows[0];
    const rootId = task && task.parent_id ? task.parent_id : id;
    const { rows: explanations } = await db.query(`
      SELECT te.*, u.name as user_name, u.role as user_role
      FROM task_explanations te
      LEFT JOIN users u ON te.user_id = u.id
      WHERE te.task_id IN (SELECT id FROM tasks WHERE id = $1 OR parent_id = $2)
      ORDER BY te.created_at DESC
    `, [rootId, rootId]);
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

export default router;
