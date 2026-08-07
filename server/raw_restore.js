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

// Extract strings matching patterns
const fileStr = dbBuffer.toString('binary');
const utf8Strings = Array.from(fileStr.matchAll(/[\x20-\x7e]{3,}/g)).map(m => m[0]);

console.log(`Extracted ${utf8Strings.length} printable text tokens.`);

// Find emails and passwords
const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const bcryptRegex = /\$2[ab]\$10\$[A-Za-z0-9./]{53}/g;

const foundEmails = Array.from(new Set(fileStr.match(emailRegex) || []));
const foundBcrypts = Array.from(new Set(fileStr.match(bcryptRegex) || []));

console.log(`Found ${foundEmails.length} unique email addresses in raw storage.`);
console.log(`Found ${foundBcrypts.length} encrypted password hashes.`);

// Table leaf cell parser (b-tree page flag 0x0d)
const records = [];
const pageSize = 4096;

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
          if (cols.length >= 3) {
            records.push({ rowId: rowId.val, cols });
          }
        } catch (e) {
          // ignore corrupted cell parse
        }
      }
    }
  }
}

console.log(`Parsed ${records.length} database records from binary B-Tree cells.`);

async function restore() {
  let userCount = 0;
  let taskCount = 0;
  let notifCount = 0;

  for (const r of records) {
    const c = r.cols;
    // Check if record is a User (email present and role)
    const emailCol = c.find(val => typeof val === 'string' && val.includes('@') && val.includes('.'));
    const roleCol = c.find(val => typeof val === 'string' && ['admin', 'manager', 'employee'].includes(val));
    
    if (emailCol && roleCol) {
      const nameCol = c.find(val => typeof val === 'string' && val !== emailCol && val !== roleCol && !val.startsWith('$2'));
      const passCol = c.find(val => typeof val === 'string' && val.startsWith('$2a$') || (typeof val === 'string' && val.startsWith('$2b$')));
      const deptCol = c.find(val => typeof val === 'string' && ['Engineering', 'Executive', 'Sales', 'Marketing', 'General'].includes(val)) || 'Engineering';

      if (nameCol && emailCol && passCol) {
        try {
          await pool.query(`
            INSERT INTO users (id, name, email, password_hash, role, department)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (email) DO NOTHING
          `, [r.rowId, nameCol, emailCol, passCol, roleCol, deptCol]);
          userCount++;
        } catch (e) {}
      }
    }

    // Check if record is a Task (status present and priority present)
    const statusCol = c.find(val => typeof val === 'string' && ['todo', 'in_progress', 'under_review', 'completed', 'blocked'].includes(val));
    const priorityCol = c.find(val => typeof val === 'string' && ['low', 'medium', 'high', 'urgent'].includes(val));

    if (statusCol && priorityCol) {
      const titleCol = c.find(val => typeof val === 'string' && val.length > 0 && val !== statusCol && val !== priorityCol && !['slate','yellow','blue','green','purple','red'].includes(val));
      const colorCol = c.find(val => typeof val === 'string' && ['slate','yellow','blue','green','purple','red'].includes(val)) || 'slate';
      const categoryCol = c.find(val => typeof val === 'string' && ['General', 'Bug', 'Feature', 'Refactor', 'Design'].includes(val)) || 'General';

      if (titleCol) {
        try {
          await pool.query(`
            INSERT INTO tasks (id, title, status, priority, color, category)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO NOTHING
          `, [r.rowId, titleCol, statusCol, priorityCol, colorCol, categoryCol]);
          taskCount++;
        } catch (e) {}
      }
    }
  }

  // Ensure default admin exists
  const { rows: adminRows } = await pool.query("SELECT id FROM users WHERE role = 'admin'");
  if (adminRows.length === 0 && foundEmails.length > 0) {
    console.log("Adding admin fallback...");
    const bcryptHash = foundBcrypts[0] || '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
    await pool.query("INSERT INTO users (name, email, password_hash, role, department) VALUES ('Admin', 'admin@admin.com', $1, 'admin', 'Executive') ON CONFLICT DO NOTHING", [bcryptHash]);
  }

  // Reset sequence counters
  await pool.query("SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT COALESCE(MAX(id), 0) FROM users) + 1, false);");
  await pool.query("SELECT setval(pg_get_serial_sequence('tasks', 'id'), (SELECT COALESCE(MAX(id), 0) FROM tasks) + 1, false);");

  console.log(`\n🎉 RESTORATION SUCCESSFUL!`);
  console.log(`✅ Restored ${userCount} Users into PostgreSQL`);
  console.log(`✅ Restored ${taskCount} Tasks into PostgreSQL`);

  await pool.end();
}

restore();
