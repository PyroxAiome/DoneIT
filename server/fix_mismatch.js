import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

async function fixMismatch() {
  console.log("Starting full cleanup of notifications and group task linkage...");

  // 1. Move all system notifications out of admin_comments into notifications table
  await pool.query(`
    INSERT INTO notifications (user_id, message)
    SELECT admin_id, comment_text
    FROM admin_comments
    WHERE comment_text LIKE '%assigned%' 
       OR comment_text LIKE '%updated%' 
       OR comment_text LIKE '%created%' 
       OR comment_text LIKE '%daily log%'
       OR comment_text LIKE '%dependency%'
    ON CONFLICT DO NOTHING
  `);

  // 2. Delete ALL system notification messages from admin_comments (Reviews tab)
  const { rowCount: deletedReviews } = await pool.query(`
    DELETE FROM admin_comments
    WHERE comment_text LIKE '%assigned%' 
       OR comment_text LIKE '%updated%' 
       OR comment_text LIKE '%created%' 
       OR comment_text LIKE '%daily log%'
       OR comment_text LIKE '%dependency%'
  `);

  console.log(`Cleaned ${deletedReviews || 0} system notifications from Reviews tab.`);

  // 3. Delete ALL system notification messages from task_explanations (Logical Explanation tab)
  const { rowCount: deletedExplanations } = await pool.query(`
    DELETE FROM task_explanations
    WHERE explanation_text LIKE '%assigned%' 
       OR explanation_text LIKE '%updated%' 
       OR explanation_text LIKE '%created%' 
       OR explanation_text LIKE '%daily log%'
       OR explanation_text LIKE '%dependency%'
  `);

  console.log(`Cleaned ${deletedExplanations || 0} system notifications from Logical Explanation tab.`);

  // 4. Properly group multi-assignee tasks using parent_id instead of showing duplicate cards
  console.log("4. Linking multi-assignee group tasks using parent_id...");

  const { rows: duplicateGroups } = await pool.query(`
    SELECT LOWER(TRIM(title)) as title_clean, MIN(id) as parent_task_id, COUNT(*) as copy_count
    FROM tasks
    GROUP BY LOWER(TRIM(title))
    HAVING COUNT(*) > 1
  `);

  let linkedCount = 0;
  for (const group of duplicateGroups) {
    const { rowCount } = await pool.query(`
      UPDATE tasks
      SET parent_id = $1
      WHERE LOWER(TRIM(title)) = $2
    `, [group.parent_task_id, group.title_clean]);
    linkedCount += (rowCount || 0);
  }

  console.log(`Linked ${duplicateGroups.length} multi-assignee group tasks (${linkedCount} total task copies connected).`);

  // 5. Reset auto-increment sequences
  await pool.query("SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT COALESCE(MAX(id), 0) FROM users) + 1, false);");
  await pool.query("SELECT setval(pg_get_serial_sequence('tasks', 'id'), (SELECT COALESCE(MAX(id), 0) FROM tasks) + 1, false);");
  await pool.query("SELECT setval(pg_get_serial_sequence('admin_comments', 'id'), (SELECT COALESCE(MAX(id), 0) FROM admin_comments) + 1, false);");
  await pool.query("SELECT setval(pg_get_serial_sequence('task_daily_logs', 'id'), (SELECT COALESCE(MAX(id), 0) FROM task_daily_logs) + 1, false);");
  await pool.query("SELECT setval(pg_get_serial_sequence('task_explanations', 'id'), (SELECT COALESCE(MAX(id), 0) FROM task_explanations) + 1, false);");

  console.log("\n🎉 GROUP TASK LINKAGE & CLEANUP COMPLETE!");
  console.log("✅ Group tasks properly linked: only 1 card will show on Admin/Manager dashboard, while all assigned employees keep their task copies!");
  console.log("✅ Suraj fake notification logs removed from Reviews & Logical Explanation tabs.");

  await pool.end();
}

fixMismatch();
