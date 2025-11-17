# Hostinger Deployment Guide - 6soft HRM

This guide explains how to deploy 6soft HRM as a subdomain on Hostinger (e.g., `hrm.yourdomain.com`).

## Prerequisites

### Required
- **Hostinger VPS** or **Cloud Hosting** plan (with SSH access)
- Domain name managed in Hostinger
- MySQL database (Hostinger provides this)
- Basic command line knowledge

### What You'll Get
- Frontend: `https://hrm.yourdomain.com`
- Backend API: `https://hrm.yourdomain.com/api`
- SSL certificate (free via Let's Encrypt)
- Auto-restart on crashes (PM2)

---

## Step 1: Server Access & Prerequisites

### 1.1 Get Your Hostinger VPS/Cloud Details
From Hostinger hPanel:
- Go to **VPS** → Select your server → **SSH Access**
- Note down:
  - Server IP: `___.___.___.___`
  - SSH Username: `root` or your username
  - SSH Password or use SSH keys

### 1.2 Get MySQL Database Details
From Hostinger hPanel:
- Go to **Databases** → **MySQL Databases**
- Create a new database:
  - Database name: `u123456789_hrm` (or similar)
  - Username: `u123456789_hrm`
  - Password: (set a strong password)
  - Host: Usually `localhost` or `127.0.0.1`

Write down these credentials — you'll need them later.

---

## Step 2: Connect to Your Server

```bash
# Replace with your actual server IP and username
ssh root@YOUR_SERVER_IP

# Or if using custom SSH port (Hostinger sometimes uses port 22 or custom)
ssh -p 22 root@YOUR_SERVER_IP
```

---

## Step 3: Install Required Software

```bash
# Update system packages
apt update && apt upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show v10.x.x

# Install PM2 (process manager)
npm install -g pm2

# Install Nginx (web server)
apt install -y nginx

# Install Certbot (for SSL certificates)
apt install -y certbot python3-certbot-nginx

# Install Git
apt install -y git

# Optional: Install MySQL client (if not already installed)
apt install -y mysql-client
```

---

## Step 4: Clone Your Repository

```bash
# Create directory for the application
mkdir -p /var/www
cd /var/www

# Clone the repository
git clone https://github.com/wonderfull/6softhrm.git
cd 6softhrm

# Checkout the MySQL branch
git checkout change_to_mysql

# Verify files
ls -la
```

---

## Step 5: Configure Backend

### 5.1 Install Backend Dependencies

```bash
cd /var/www/6softhrm/backend
npm install --production
```

### 5.2 Create Production Environment File

**⚠️ SECURITY CRITICAL: Never commit real credentials to Git!**

```bash
nano .env
```

Paste the following (replace with your actual values):

```env
# Server Configuration
PORT=4000
NODE_ENV=production

# JWT Secret - Generate with: openssl rand -base64 32
JWT_SECRET=PASTE_GENERATED_SECRET_HERE

# MySQL Database Connection
# Get credentials from Hostinger hPanel → Databases
# Format: mysql://USERNAME:PASSWORD@HOST:PORT/DATABASE
DATABASE_URL="mysql://u123456789_hrm:YOUR_DB_PASSWORD@localhost:3306/u123456789_hrm"
```

**Generate secure JWT secret:**
```bash
openssl rand -base64 32
```

Copy the output and use it as JWT_SECRET.

**Important Security Notes:**
- The `.env` file is automatically excluded from Git
- Never share or commit real credentials
- Use unique secrets for each environment (dev/staging/prod)
- See **SECURITY.md** for complete security guidelines

Save and exit (Ctrl+X, then Y, then Enter).

**Secure the file:**
```bash
chmod 600 .env
chown root:root .env
```

### 5.3 Build Backend

```bash
npm run build
```

### 5.4 Setup Database Schema

```bash
# Generate Prisma client
npx prisma generate

# Run migrations to create tables
npx prisma migrate deploy

# Seed database with initial data (admin user, sample employees)
npm run seed
```

You should see:
```
✅ Seed completed successfully!
   - Users: 1, 2
   - Employees: 1, 2, 3
   ...
```

**Default Login Credentials:**
- Admin: `admin@example.com` / `password123`
- Manager: `manager@example.com` / `password123`

---

## Step 6: Configure Frontend

### 6.1 Install Frontend Dependencies

```bash
cd /var/www/6softhrm/frontend
npm install
```

### 6.2 Update API Configuration (if needed)

The frontend uses relative paths (`/api/...`) which will be proxied by Nginx. No changes needed.

### 6.3 Build Frontend for Production

```bash
npm run build
```

This creates optimized static files in `frontend/dist/`.

### 6.4 Create Web Root for Subdomain

```bash
# Create directory for the subdomain
mkdir -p /var/www/hrm.yourdomain.com

# Copy built frontend files
cp -r /var/www/6softhrm/frontend/dist/* /var/www/hrm.yourdomain.com/

# Set proper permissions
chown -R www-data:www-data /var/www/hrm.yourdomain.com
chmod -R 755 /var/www/hrm.yourdomain.com
```

---

## Step 7: Start Backend with PM2

```bash
cd /var/www/6softhrm/backend

# Start the backend
pm2 start npm --name "6soft-hrm-backend" -- start

# Save PM2 configuration
pm2 save

# Setup PM2 to start on server reboot
pm2 startup

# Check status
pm2 status
pm2 logs 6soft-hrm-backend --lines 50
```

**Useful PM2 Commands:**
```bash
pm2 list                        # List all processes
pm2 logs 6soft-hrm-backend      # View logs
pm2 restart 6soft-hrm-backend   # Restart app
pm2 stop 6soft-hrm-backend      # Stop app
pm2 delete 6soft-hrm-backend    # Remove from PM2
```

---

## Step 8: Configure Nginx

### 8.1 Create Nginx Server Block

```bash
nano /etc/nginx/sites-available/hrm.yourdomain.com
```

Paste the following configuration (replace `hrm.yourdomain.com` with your actual subdomain):

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name hrm.yourdomain.com;

    root /var/www/hrm.yourdomain.com;
    index index.html;

    # Frontend - serve static files
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API - proxy to Node.js
    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # File uploads endpoint
    location /uploads/ {
        proxy_pass http://127.0.0.1:4000/uploads/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Logs
    access_log /var/log/nginx/hrm.yourdomain.com.access.log;
    error_log /var/log/nginx/hrm.yourdomain.com.error.log;

    # Client max body size (for file uploads)
    client_max_body_size 10M;
}
```

Save and exit (Ctrl+X, then Y, then Enter).

### 8.2 Enable the Site

```bash
# Create symbolic link to enable site
ln -s /etc/nginx/sites-available/hrm.yourdomain.com /etc/nginx/sites-enabled/

# Test Nginx configuration
nginx -t

# If test passes, reload Nginx
systemctl reload nginx
```

---

## Step 9: Configure DNS (Hostinger hPanel)

1. Login to **Hostinger hPanel**
2. Go to **Domains** → Select your domain
3. Click **DNS / Name Servers** → **DNS Zone Editor**
4. Add a new **A Record**:
   - **Type:** A
   - **Name:** hrm (or your subdomain prefix)
   - **Points to:** YOUR_SERVER_IP
   - **TTL:** 14400 (or default)
5. Click **Add Record**

**Wait 5-30 minutes** for DNS propagation.

### Verify DNS Propagation

```bash
# Check if DNS is pointing to your server
dig hrm.yourdomain.com +short

# Should return your server IP
```

---

## Step 10: Install SSL Certificate (HTTPS)

```bash
# Obtain and install SSL certificate
certbot --nginx -d hrm.yourdomain.com

# Follow the prompts:
# - Enter email address
# - Agree to terms of service
# - Choose whether to redirect HTTP to HTTPS (recommended: Yes)
```

Certbot will automatically:
- Obtain SSL certificate from Let's Encrypt
- Update Nginx configuration
- Setup auto-renewal

### Test SSL Renewal

```bash
# Dry run to test renewal
certbot renew --dry-run
```

---

## Step 11: Verify Deployment

### Test Backend API

```bash
curl http://localhost:4000/api/health
# Should return: {"status":"ok"}

# Test from outside
curl https://hrm.yourdomain.com/api/health
# Should return: {"status":"ok"}
```

### Test Frontend

1. Open browser: `https://hrm.yourdomain.com`
2. You should see the premium login page
3. Login with: `admin@example.com` / `password123`
4. Verify all pages work (Employees, Time, Leave, Documents, etc.)

---

## Step 12: Post-Deployment Tasks

### Change Default Passwords

```bash
cd /var/www/6softhrm/backend
npm run seed  # Skip if already done
```

Then login to the app and change passwords for admin and manager users through the UI.

### Setup Firewall (UFW)

```bash
# Install UFW if not already installed
apt install -y ufw

# Allow SSH (important - don't lock yourself out!)
ufw allow 22/tcp

# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Enable firewall
ufw enable

# Check status
ufw status
```

### Setup Automatic Backups

Create a backup script:

```bash
nano /root/backup-hrm.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/root/backups/hrm"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup MySQL database
mysqldump -u u123456789_hrm -p'YOUR_DB_PASSWORD' u123456789_hrm > $BACKUP_DIR/db_$DATE.sql

# Backup uploaded files
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /var/www/6softhrm/backend/uploads

# Keep only last 7 days of backups
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completed: $DATE"
```

Make it executable and setup cron:

```bash
chmod +x /root/backup-hrm.sh

# Add to crontab (daily at 2 AM)
crontab -e
```

Add this line:
```
0 2 * * * /root/backup-hrm.sh >> /var/log/hrm-backup.log 2>&1
```

---

## Updating the Application

When you push changes to GitHub:

```bash
# SSH to server
ssh root@YOUR_SERVER_IP

# Navigate to project
cd /var/www/6softhrm

# Pull latest changes
git pull origin change_to_mysql

# Update backend
cd backend
npm install --production
npm run build
npx prisma migrate deploy
pm2 restart 6soft-hrm-backend

# Update frontend
cd ../frontend
npm install
npm run build
rm -rf /var/www/hrm.yourdomain.com/*
cp -r dist/* /var/www/hrm.yourdomain.com/
chown -R www-data:www-data /var/www/hrm.yourdomain.com

# Check logs
pm2 logs 6soft-hrm-backend --lines 50
```

---

## Troubleshooting

### Backend Not Starting

```bash
# Check PM2 logs
pm2 logs 6soft-hrm-backend --lines 100

# Common issues:
# - Wrong DATABASE_URL in .env
# - MySQL not running: systemctl status mysql
# - Port 4000 in use: lsof -i :4000
```

### Frontend Not Loading

```bash
# Check Nginx error logs
tail -f /var/log/nginx/hrm.yourdomain.com.error.log

# Test Nginx config
nginx -t

# Reload Nginx
systemctl reload nginx
```

### Database Connection Issues

```bash
# Test MySQL connection
mysql -u u123456789_hrm -p'YOUR_DB_PASSWORD' -h localhost u123456789_hrm

# Check if MySQL is running
systemctl status mysql

# Check database exists
mysql -u root -p -e "SHOW DATABASES;"
```

### 502 Bad Gateway

```bash
# Backend not running
pm2 status
pm2 restart 6soft-hrm-backend

# Check backend is listening
curl http://localhost:4000/api/health
```

### SSL Certificate Issues

```bash
# Check certificate status
certbot certificates

# Renew certificate
certbot renew

# Check Nginx SSL config
nginx -t
```

---

## Performance Optimization

### Enable Nginx Caching

Add to your Nginx config:

```nginx
location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### Database Optimization

```sql
-- Add indexes for common queries (already in schema)
-- Monitor slow queries
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 2;
```

### Monitor Resources

```bash
# Check server resources
htop

# Check disk space
df -h

# Check memory
free -h

# Check PM2 memory usage
pm2 monit
```

---

## Security Checklist

- [ ] Change default admin/manager passwords
- [ ] Use strong JWT_SECRET (minimum 32 characters)
- [ ] Use strong database password
- [ ] Enable firewall (UFW)
- [ ] SSL certificate installed
- [ ] Regular backups configured
- [ ] Keep server updated: `apt update && apt upgrade`
- [ ] Never commit `.env` file
- [ ] Restrict database access to localhost only
- [ ] Monitor logs regularly: `pm2 logs`

---

## Support & Resources

- **Hostinger Support:** https://www.hostinger.com/tutorials/
- **PM2 Documentation:** https://pm2.keymetrics.io/
- **Nginx Documentation:** https://nginx.org/en/docs/
- **Prisma Documentation:** https://www.prisma.io/docs/
- **Let's Encrypt:** https://letsencrypt.org/

---

## Quick Reference Commands

```bash
# SSH to server
ssh root@YOUR_SERVER_IP

# Navigate to project
cd /var/www/6softhrm

# PM2 commands
pm2 list
pm2 logs 6soft-hrm-backend
pm2 restart 6soft-hrm-backend
pm2 stop 6soft-hrm-backend

# Nginx commands
nginx -t
systemctl reload nginx
systemctl status nginx

# View logs
tail -f /var/log/nginx/hrm.yourdomain.com.error.log
pm2 logs 6soft-hrm-backend --lines 100

# Database
mysql -u u123456789_hrm -p
```

---

**Deployment Complete! 🎉**

Your 6soft HRM should now be live at `https://hrm.yourdomain.com`
