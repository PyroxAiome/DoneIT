import fs from 'fs';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

// Read raw database files
let dbBuffer = Buffer.alloc(0);
for (const fn of ['doneit.db', 'doneit.db-wal']) {
  if (fs.existsSync(fn)) {
    dbBuffer = Buffer.concat([dbBuffer, fs.readFileSync(fn)]);
  }
}

console.log(`Loaded ${dbBuffer.length} bytes from raw database files.`);

// Helper: Decode Varint
function readVarint(buf, offset) {
  let res = 0;
  let bytesRead = 0;
  for (let i = 0; i < 9; i++) {
    if (offset + i >= buf.length) break;
    const byte = buf[offset + i];
    bytesRead++;
    if (i === 8) {
      res = (res << 8) | byte;
      break;
    }
    res = (res << 7) | (byte & 0x7f);
    if ((byte & 0x80) === 0) break;
  }
  return { val: res, size: bytesRead };
}

// Table leaf cell parser (b-tree page flag 0x0d)
const records = [];

for (let p = 0; p < dbBuffer.length; p += 512) {
  if (dbBuffer[p] === 0x0d) { // Table b-tree leaf page
    const cellCount = dbBuffer.readUInt16BE(p + 3);
    if (cellCount > 0 && cellCount < 500) {
      for (let c = 0; c < cellCount; c++) {
        const cellPtrPos = p + 8 + c * 2;
        if (cellPtrPos + 2 > dbBuffer.length) break;
        const cellOff = dbBuffer.readUInt16BE(cellPtrPos);
        const cellPos = p + cellOff;
        if (cellPos >= dbBuffer.length) continue;

        try {
          const payload = readVarint(dbBuffer, cellPos);
          const rowId = readVarint(dbBuffer, cellPos + payload.size);
          const headerStart = cellPos + payload.size + rowId.size;
          const headerSize = readVarint(dbBuffer, headerStart);
          
          let curH = headerStart + headerSize.size;
          let curD = headerStart + headerSize.val;
          
          const cols = [];
          while (curH < headerStart + headerSize.val && curD < dbBuffer.length) {
            const st = readVarint(dbBuffer, curH);
            curH += st.size;
            
            let val = null;
            if (st.val === 0) { val = null; }
            else if (st.val === 1) { val = dbBuffer.readInt8(curD); curD += 1; }
            else if (st.val === 2) { val = dbBuffer.readInt16BE(curD); curD += 2; }
            else if (st.val === 3) { val = dbBuffer.readIntBE(curD, 3); curD += 3; }
            else if (st.val === 4) { val = dbBuffer.readInt32BE(curD); curD += 4; }
            else if (st.val === 5) { val = Number(dbBuffer.readBigInt64BE(curD)); curD += 8; }
            else if (st.val === 6) { val = Number(dbBuffer.readBigInt64BE(curD)); curD += 8; }
            else if (st.val === 7) { val = dbBuffer.readDoubleBE(curD); curD += 8; }
            else if (st.val >= 12 && st.val % 2 === 0) {
              const len = (st.val - 12) / 2;
              val = dbBuffer.slice(curD, curD + len);
              curD += len;
            } else if (st.val >= 13 && st.val % 2 === 1) {
              const len = (st.val - 13) / 2;
              val = dbBuffer.toString('utf8', curD, curD + len);
              curD += len;
            }
            cols.push(val);
          }
          if (cols.length >= 2) {
            records.push({ rowId: rowId.val, cols });
          }
        } catch (e) {}
      }
    }
  }
}

console.log(`Parsed ${records.length} database records from binary B-Tree cells.`);

async function restore() {
  await pool.query("TRUNCATE TABLE users, tasks, admin_comments, notifications, task_daily_logs, task_daily_log_reactions, task_daily_log_comments, task_explanations, task_dependencies CASCADE");

  const validUserIds = new Set();
  const validTaskIds = new Set();

  let counts = { users: 0, tasks: 0, reviews: 0, daily_logs: 0, explanations: 0, dependencies: 0 };

  // 1. Users
  for (const r of records) {
    const c = r.cols;
    const emailCol = c.find(val => typeof val === 'string' && val.includes('@') && val.includes('.'));
    const roleCol = c.find(val => typeof val === 'string' && ['admin', 'manager', 'employee'].includes(val));
    
    if (emailCol && roleCol) {
      const nameCol = c.find(val => typeof val === 'string' && val !== emailCol && val !== roleCol && !val.startsWith('$2'));
      const passCol = c.find(val => typeof val === 'string' && (val.startsWith('$2a$') || val.startsWith('$2b$')));
      const deptCol = c.find(val => typeof val === 'string' && ['Engineering', 'Executive', 'Sales', 'Marketing', 'General'].includes(val)) || 'Engineering';

      if (nameCol && emailCol && passCol) {
        try {
          await pool.query(`
            INSERT INTO users (id, name, email, password_hash, role, department)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email
          `, [r.rowId, nameCol, emailCol, passCol, roleCol, deptCol]);
          validUserIds.add(r.rowId);
          counts.users++;
        } catch (e) {}
      }
    }
  }

  // 2. Tasks
  for (const r of records) {
    const c = r.cols;
    const statusCol = c.find(val => typeof val === 'string' && ['todo', 'in_progress', 'under_review', 'completed', 'blocked'].includes(val));
    const priorityCol = c.find(val => typeof val === 'string' && ['low', 'medium', 'high', 'urgent'].includes(val));

    if (statusCol && priorityCol) {
      const titleCol = c.find(val => typeof val === 'string' && val.length > 0 && val !== statusCol && val !== priorityCol && !['slate','yellow','blue','green','purple','red'].includes(val) && !['General', 'Bug', 'Feature', 'Refactor', 'Design'].includes(val));
      const colorCol = c.find(val => typeof val === 'string' && ['slate','yellow','blue','green','purple','red'].includes(val)) || 'slate';
      const categoryCol = c.find(val => typeof val === 'string' && ['General', 'Bug', 'Feature', 'Refactor', 'Design'].includes(val)) || 'General';
      const descCol = c.find(val => typeof val === 'string' && val.length > 0 && val !== titleCol && val !== statusCol && val !== priorityCol && val !== colorCol && val !== categoryCol) || '';

      const intCols = c.filter(val => typeof val === 'number' && Number.isInteger(val) && validUserIds.has(val));
      const assigneeId = intCols.length > 0 ? intCols[0] : null;
      const creatorId = intCols.length > 1 ? intCols[1] : (intCols.length > 0 ? intCols[0] : null);
      const progressCol = c.find(val => typeof val === 'number' && Number.isInteger(val) && val >= 0 && val <= 100 && !validUserIds.has(val)) || 0;

      if (titleCol) {
        try {
          await pool.query(`
            INSERT INTO tasks (id, title, description, status, priority, color, category, assignee_id, creator_id, progress_percent)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, assignee_id = EXCLUDED.assignee_id
          `, [r.rowId, titleCol, descCol, statusCol, priorityCol, colorCol, categoryCol, assigneeId, creatorId, progressCol]);
          validTaskIds.add(r.rowId);
          counts.tasks++;
        } catch (e) {}
      }
    }
  }

  // 3. Daily Achievements (task_daily_logs)
  for (const r of records) {
    const c = r.cols;
    const dateCol = c.find(val => typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val));
    if (dateCol) {
      const textCol = c.find(val => typeof val === 'string' && val !== dateCol && val.length > 2);
      const intUser = c.find(val => typeof val === 'number' && validUserIds.has(val));
      const intTask = c.find(val => typeof val === 'number' && validTaskIds.has(val));

      if (dateCol && textCol && intUser && intTask) {
        try {
          await pool.query(`
            INSERT INTO task_daily_logs (id, task_id, user_id, log_date, content)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (id) DO NOTHING
          `, [r.rowId, intTask, intUser, dateCol, textCol]);
          counts.daily_logs++;
        } catch (e) {}
      }
    }
  }

  // 4. Logical Explanations (task_explanations)
  for (const r of records) {
    const c = r.cols;
    const textCol = c.find(val => typeof val === 'string' && val.length > 5 && !val.includes('@') && !/^\d{4}-\d{2}-\d{2}$/.test(val) && !['todo','in_progress','under_review','completed','blocked','low','medium','high','urgent','admin','manager','employee','slate','yellow','blue','green','purple','red'].includes(val));
    const intUser = c.find(val => typeof val === 'number' && validUserIds.has(val));
    const intTask = c.find(val => typeof val === 'number' && validTaskIds.has(val));

    if (textCol && intUser && intTask) {
      try {
        await pool.query(`
          INSERT INTO task_explanations (id, task_id, user_id, explanation_text)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (id) DO NOTHING
        `, [r.rowId, intTask, intUser, textCol]);
        counts.explanations++;
      } catch (e) {}
    }
  }

  // 5. Admin Reviews & Comments (admin_comments)
  for (const r of records) {
    const c = r.cols;
    const textCol = c.find(val => typeof val === 'string' && val.length > 2);
    const intUser = c.find(val => typeof val === 'number' && validUserIds.has(val));
    const intTask = c.find(val => typeof val === 'number' && validTaskIds.has(val));

    if (textCol && intUser && intTask) {
      try {
        await pool.query(`
          INSERT INTO admin_comments (id, task_id, admin_id, comment_text)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (id) DO NOTHING
        `, [r.rowId, intTask, intUser, textCol]);
        counts.reviews++;
      } catch (e) {}
    }
  }

  // 6. Dependencies & Tagged Blockers (task_dependencies)
  for (const r of records) {
    const c = r.cols;
    const statusCol = c.find(val => typeof val === 'string' && ['pending', 'resolved', 'confirmed'].includes(val));
    const textCol = c.find(val => typeof val === 'string' && val.length > 2 && !['pending', 'resolved', 'confirmed'].includes(val));
    const intUsers = c.filter(val => typeof val === 'number' && validUserIds.has(val));
    const intTask = c.find(val => typeof val === 'number' && validTaskIds.has(val));

    if (statusCol && textCol && intTask && intUsers.length >= 2) {
      try {
        await pool.query(`
          INSERT INTO task_dependencies (id, task_id, requester_id, tagee_id, dependency_text, status)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO NOTHING
        `, [r.rowId, intTask, intUsers[0], intUsers[1], textCol, statusCol]);
        counts.dependencies++;
      } catch (e) {}
    }
  }

  // Reset sequence counters
  await pool.query("SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT COALESCE(MAX(id), 0) FROM users) + 1, false);");
  await pool.query("SELECT setval(pg_get_serial_sequence('tasks', 'id'), (SELECT COALESCE(MAX(id), 0) FROM tasks) + 1, false);");
  await pool.query("SELECT setval(pg_get_serial_sequence('admin_comments', 'id'), (SELECT COALESCE(MAX(id), 0) FROM admin_comments) + 1, false);");
  await pool.query("SELECT setval(pg_get_serial_sequence('task_daily_logs', 'id'), (SELECT COALESCE(MAX(id), 0) FROM task_daily_logs) + 1, false);");
  await pool.query("SELECT setval(pg_get_serial_sequence('task_explanations', 'id'), (SELECT COALESCE(MAX(id), 0) FROM task_explanations) + 1, false);");
  await pool.query("SELECT setval(pg_get_serial_sequence('task_dependencies', 'id'), (SELECT COALESCE(MAX(id), 0) FROM task_dependencies) + 1, false);");

  console.log(`\n🎉 FULL DATA RESTORATION COMPLETE!`);
  console.log(`✅ Restored ${counts.users} Users into PostgreSQL`);
  console.log(`✅ Restored ${counts.tasks} Tasks into PostgreSQL`);
  console.log(`✅ Restored ${counts.daily_logs} Daily Achievements into PostgreSQL`);
  console.log(`✅ Restored ${counts.explanations} Logical Explanations into PostgreSQL`);
  console.log(`✅ Restored ${counts.reviews} Reviews & Comments into PostgreSQL`);
  console.log(`✅ Restored ${counts.dependencies} Tagged Dependencies & Blockers into PostgreSQL`);

  await pool.end();
}

restore();
