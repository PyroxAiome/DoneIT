# DoneIt Task Portal

A lightweight, modern, and beautiful workload and task tracking application built for teams.

## Tech Stack
- **Frontend**: React 19, Vite, Tailwind CSS, Lucide Icons
- **Backend**: Node.js, Express, SQLite (`better-sqlite3`), JWT Authentication, bcryptjs
- **Process Manager**: PM2

---

## Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the App Locally
In one terminal, start the Express backend and the Vite development proxy together:
```bash
npm run dev:all
```
The application will be accessible at `http://localhost:5173`.

---

## Production Setup & Deployment (AWS / VPS)

For a cheap and self-contained production environment on AWS EC2 or AWS Lightsail, follow these steps:

### 1. Run Setup Script (on Ubuntu Server)
Clone the repository to your server, then run the automated setup script to install Node.js, PM2, and Nginx:
```bash
chmod +x setup-server.sh
./setup-server.sh
```

### 2. Build the Application
```bash
npm install
npm run build
```

### 3. Start the Server with PM2
To ensure the backend runs continuously in the background, start it using PM2:
```bash
pm2 start ecosystem.config.cjs
pm2 startup
pm2 save
```

Your app will be live at `http://<YOUR_SERVER_IP>` proxied automatically through Nginx.
