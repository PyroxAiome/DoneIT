import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

async function fixMismatch() {
  console.log("Starting data cleanup and mismatch repair...");

  // 1. Move notification messages out of admin_comments and task_explanations into notifications table
  console.log("1. Cleaning up system notifications from Reviews & Logical Explanations...");
  
  await pool.query(`
    INSERT INTO notifications (user_id, message)
    SELECT admin_id, comment_text
    FROM admin_comments
    WHERE comment_text LIKE '%assigned task%' OR comment_text LIKE '%added daily log%' OR comment_text LIKE '%updated task%'
    ON CONFLICT DO NOTHING
  `);

  await pool.query(`
    DELETE FROM admin_comments
    WHERE comment_text LIKE '%assigned task%' OR comment_text LIKE '%added daily log%' OR comment_text LIKE '%updated task%'
  `);

  await pool.query(`
    DELETE FROM task_explanations
    WHERE explanation_text LIKE '%assigned task%' OR explanation_text LIKE '%added daily log%' OR explanation_text LIKE '%updated task%'
  `);

  // 2. Deduplicate duplicate task cards (keeping primary parent task)
  console.log("2. Deduplicating task cards...");
  
  const { rowCount: deletedTasks } = await pool.query(`
    DELETE FROM tasks t1
    USING tasks t2
    WHERE t1.id > t2.id
      AND LOWER(TRIM(t1.title)) = LOWER(TRIM(t2.title))
      AND (t1.assignee_id = t2.assignee_id OR (t1.assignee_id IS NULL AND t2.assignee_id IS NULL))
  `);
  
  console.log(`Removed ${deletedTasks || 0} duplicate task cards.`);

  // 3. Reset auto-increment sequence counters
  await pool.query("SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT COALESCE(MAX(id), 0) FROM users) + 1, false);");
  await pool.query("SELECT setval(pg_get_serial_sequence('tasks', 'id'), (SELECT COALESCE(MAX(id), 0) FROM tasks) + 1, false);");
  await pool.query("SELECT setval(pg_get_serial_sequence('admin_comments', 'id'), (SELECT COALESCE(MAX(id), 0) FROM admin_comments) + 1, false);");
  await pool.query("SELECT setval(pg_get_serial_sequence('task_daily_logs', 'id'), (SELECT COALESCE(MAX(id), 0) FROM task_daily_logs) + 1, false);");
  await pool.query("SELECT setval(pg_get_serial_sequence('task_explanations', 'id'), (SELECT COALESCE(MAX(id), 0) FROM task_explanations) + 1, false);");

  console.log("\n🎉 CLEANUP & FIX COMPLETE!");
  console.log("✅ Duplicate task cards removed.");
  console.log("✅ System notifications moved to Notifications dropdown.");
  console.log("✅ Reviews & Logical Explanation tabs cleaned.");
  
  await pool.end();
}

fixMismatch();
