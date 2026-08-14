import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

async function claimAdminTasks() {
  console.log("Locating and linking Admin tasks in PostgreSQL...");

  // 1. Find Admin user ID
  const { rows: adminRows } = await pool.query("SELECT id, name, email FROM users WHERE role = 'admin' ORDER BY id ASC");
  if (adminRows.length === 0) {
    console.log("❌ No Admin user found in PostgreSQL.");
    await pool.end();
    return;
  }

  const adminId = adminRows[0].id;
  console.log(`Found Admin User: ${adminRows[0].name} (${adminRows[0].email}) with ID: ${adminId}`);

  // 2. Target specific Admin task keywords from screenshot
  const adminTaskKeywords = [
    '%kirtan%',
    '%yashas%',
    '%aiome%',
    '%hexa%',
    '%patent%',
    '%sbr%'
  ];

  let totalClaimed = 0;
  for (const kw of adminTaskKeywords) {
    const { rowCount } = await pool.query(`
      UPDATE tasks
      SET assignee_id = $1, creator_id = $1
      WHERE LOWER(title) LIKE $2 OR LOWER(description) LIKE $2
    `, [adminId, kw]);
    totalClaimed += (rowCount || 0);
  }

  // 3. Count total tasks now linked to Admin
  const { rows: countRows } = await pool.query('SELECT COUNT(*) as count FROM tasks WHERE assignee_id = $1 OR creator_id = $1', [adminId]);
  const adminTaskCount = countRows[0].count;

  console.log(`\n🎉 SUCCESS!`);
  console.log(`✅ Claimed & assigned ${totalClaimed} Admin tasks ("Kirtan concert...", "Yashas App...", "Aiome Website...", etc.) to Admin (ID ${adminId}).`);
  console.log(`✅ Admin now has ${adminTaskCount} total tasks in PostgreSQL.`);

  await pool.end();
}

claimAdminTasks();
