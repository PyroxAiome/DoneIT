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
