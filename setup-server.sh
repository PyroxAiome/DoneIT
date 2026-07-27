#!/bin/bash
# DoneIt Server Setup Script for AWS (Ubuntu)

echo "===================================================="
echo "Starting DoneIt Production Server Setup..."
echo "===================================================="

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (Node 20)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify Node.js version
node -v

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Configure Nginx Reverse Proxy
echo "Configuring Nginx Reverse Proxy..."
sudo tee /etc/nginx/sites-available/default > /dev/null << 'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Restart Nginx
sudo systemctl restart nginx

echo "===================================================="
echo "Setup Complete! Node.js, PM2, and Nginx are installed."
echo "Nginx has been configured to reverse-proxy port 80 to 3000."
echo "===================================================="
