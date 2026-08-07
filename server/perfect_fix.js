import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

async function enforceRules() {
  console.log("Starting business logic rule enforcement...");

  // Rule: Employees can ONLY assign tasks to themselves (Self Assigned).
  // If creator is an employee, set creator_id = assignee_id so it displays 'Self Assigned'.
  // Only Admins or Managers can be creators/assigners of tasks assigned to others.
  const { rowCount: updatedTasks } = await pool.query(`
    UPDATE tasks t
    SET creator_id = t.assignee_id
    FROM users c
    WHERE t.creator_id = c.id
      AND c.role = 'employee'
      AND t.creator_id != t.assignee_id
  `);

  console.log(`✅ Fixed ${updatedTasks || 0} tasks where employees were incorrectly listed as task assigners.`);

  // Clean up any system notifications lingering in Reviews & Logical Explanation tabs
  await pool.query(`
    DELETE FROM admin_comments
    WHERE LOWER(comment_text) LIKE '%assigned%' 
       OR LOWER(comment_text) LIKE '%daily log%'
       OR LOWER(comment_text) LIKE '%updated%'
  `);

  await pool.query(`
    DELETE FROM task_explanations
    WHERE LOWER(explanation_text) LIKE '%assigned%' 
       OR LOWER(explanation_text) LIKE '%daily log%'
       OR LOWER(explanation_text) LIKE '%updated%'
  `);

  console.log("\n🎉 BUSINESS RULE ENFORCEMENT COMPLETE!");
  console.log("✅ Employee tasks now show 'Self Assigned' (employees can only assign tasks to themselves).");
  console.log("✅ Admin/Manager assigners remain preserved.");

  await pool.end();
}

enforceRules();
