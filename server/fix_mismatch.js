import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

async function fixMismatch() {
  console.log("Starting full cleanup of notifications from Reviews & Logical Explanations...");

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

  // 4. Deduplicate duplicate task cards
  const { rowCount: deletedTasks } = await pool.query(`
    DELETE FROM tasks t1
    USING tasks t2
    WHERE t1.id > t2.id
      AND LOWER(TRIM(t1.title)) = LOWER(TRIM(t2.title))
      AND (t1.assignee_id = t2.assignee_id OR (t1.assignee_id IS NULL AND t2.assignee_id IS NULL))
  `);

  console.log(`Removed ${deletedTasks || 0} duplicate task cards.`);

  // 5. Reset auto-increment sequences
  await pool.query("SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT COALESCE(MAX(id), 0) FROM users) + 1, false);");
  await pool.query("SELECT setval(pg_get_serial_sequence('tasks', 'id'), (SELECT COALESCE(MAX(id), 0) FROM tasks) + 1, false);");
  await pool.query("SELECT setval(pg_get_serial_sequence('admin_comments', 'id'), (SELECT COALESCE(MAX(id), 0) FROM admin_comments) + 1, false);");
  await pool.query("SELECT setval(pg_get_serial_sequence('task_daily_logs', 'id'), (SELECT COALESCE(MAX(id), 0) FROM task_daily_logs) + 1, false);");
  await pool.query("SELECT setval(pg_get_serial_sequence('task_explanations', 'id'), (SELECT COALESCE(MAX(id), 0) FROM task_explanations) + 1, false);");

  console.log("\n🎉 CLEANUP & FIX COMPLETELY SUCCESSFUL!");
  console.log("✅ Suraj fake notification logs removed from Reviews & Logical Explanation tabs.");
  console.log("✅ Duplicate task cards removed.");

  await pool.end();
}

fixMismatch();
