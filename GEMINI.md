# DoneIT Project Rules — MANDATORY

## Production Server Safety Rules

These rules exist because a database corruption incident occurred on Aug 7, 2026 when `git checkout .` was run on the production server while the app was running, which overwrote live SQLite WAL files that were accidentally committed to Git.

### 1. NEVER Run Destructive Git Commands on Production
- NEVER suggest `git checkout .`, `git reset`, or `git clean` on the production server without explicitly warning about data loss risk and getting user confirmation.
- Always suggest `git stash` instead of `git checkout .` when discarding server-side changes.

### 2. Stop the Server Before Git Operations
- Before ANY `git pull`, `git checkout`, or `git merge` on the production server, always include a step to stop PM2 / Node.js processes FIRST.
- Command order: `pm2 stop all` → git operations → `pm2 start all`

### 3. Database Backup Before Any Data Operation
- Before running ANY SQL that modifies data (UPDATE, DELETE, ALTER, DROP), always provide a backup command first:
  ```bash
  sudo -u postgres pg_dump doneit > ~/backup_$(date +%Y%m%d_%H%M%S).sql
  ```
- This is NON-NEGOTIABLE for production database operations.

### 4. Never Bulk-Add Files to Git
- NEVER use `git add .` or `git add -A` — always add specific files explicitly.
- NEVER commit database files (`.db`, `.db-wal`, `.db-shm`), `.env` files, or `node_modules/`.
- Always run `git status` and review before committing.

### 5. Test Locally Before Production
- All code changes must be tested on the local dev environment first.
- Only deploy to production (3.235.7.188) after local verification and user approval.

### 6. User Approves All Server Commands
- Never run commands on the production server autonomously.
- Always present the exact command to the user for review before execution.

### 7. Git Ignore Rules
- The `.gitignore` MUST always exclude: `*.db`, `*.db-wal`, `*.db-shm`, `.env`, `node_modules/`, `dist/`
- If any of these files are already tracked, run `git rm --cached <file>` to untrack them BEFORE committing.

### 8. Always Verify Schema Before Writing ANY SQL
These rules exist because on Sept 12, 2026, wrong column names were given 4 times in a row (target_completion_date, pillar, verifier_id, author_id) causing repeated errors on the production server.

- Before writing ANY SQL command (INSERT, UPDATE, SELECT, ALTER), **MUST read `server/db.js`** to verify exact column names and data types.
- NEVER assume column names from memory, context summaries, or previous conversations.
- When working with backup/temporary schemas, **MUST query the schema's column list first**:
  ```sql
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = '<schema_name>' AND table_name = '<table_name>';
  ```
- Cross-check that every column in the SQL statement exists in BOTH the source and target tables.

### 9. Test SQL on a Single Record First
- Before running any bulk INSERT, UPDATE, or DELETE, **always run a SELECT with LIMIT 1 first** to verify the query structure works.
- Example workflow:
  1. First: `SELECT id, title FROM backup_schema.tasks LIMIT 1;`
  2. Then: Full INSERT statement
- This catches column name errors before they affect production.

### 10. Schema Comparison Before Cross-Schema Operations
- When copying data between schemas (backup → live, live → backup), **MUST first compare column lists** between source and target tables.
- Run this comparison query before any cross-schema INSERT:
  ```sql
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = '<table>'
  INTERSECT
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_schema = '<backup_schema>' AND table_name = '<table>';
  ```
- Only include columns that exist in BOTH schemas in the INSERT statement.

### 11. Protect Existing Data During Feature Development
- Any new feature that modifies how data is queried (e.g., changing WHERE clauses, adding JOINs, modifying API endpoints) **MUST be tested against existing completed tasks** before deployment.
- Specifically test against: completed tasks, group tasks with child tasks, tasks with daily logs, tasks with explanations, tasks from different employees.
- Write a verification query that counts records before and after the change.
- If any existing feature breaks or data disappears, **STOP and fix before deploying**.

### 12. Mandatory Post-Deployment Verification
- After deploying ANY database or API change to production, run this verification check:
  ```sql
  SELECT 'tasks' AS tbl, COUNT(*) FROM tasks
  UNION ALL SELECT 'daily_logs', COUNT(*) FROM task_daily_logs
  UNION ALL SELECT 'explanations', COUNT(*) FROM task_explanations
  UNION ALL SELECT 'users', COUNT(*) FROM users;
  ```
- Compare counts with pre-deployment numbers. If any count decreased, **STOP and investigate immediately**.
- Present the before/after comparison to the user for confirmation.

### 13. Ask User Before ANY Action — No Assumptions
- NEVER assume anything — always verify from source code, database schema, or ask the user.
- Before providing ANY command, SQL query, or code change, explicitly state what you checked and confirm the approach with the user.
- If there is ANY uncertainty about column names, table structure, data relationships, or business logic, ASK the user first rather than guessing.
- Present commands in clear, numbered steps so the user can review each one individually.
- After any error, STOP and re-verify from the source files before attempting a fix.

## Database Configuration
- **Engine**: PostgreSQL 17
- **Connection**: `DATABASE_URL` from `.env` file
- **Server Access**: `sudo -u postgres psql -d doneit`
- **Business Rule**: Employees can only self-assign tasks. Only Admin/Manager can assign tasks to others.

## Tech Stack
- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **Database**: PostgreSQL 17
- **Process Manager**: PM2 (production)
- **Server**: Ubuntu on AWS (3.235.7.188)
