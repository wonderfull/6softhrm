# Deployment Files

This directory contains configuration files for deploying 6soft HRM to Hostinger VPS.

## Files

- **DEPLOYMENT.md** - Complete step-by-step deployment guide
- **deploy.sh** - Automated deployment script (edit variables first)
- **ecosystem.config.js** - PM2 process manager configuration
- **nginx.conf** - Nginx server configuration template
- **backend/.env.production** - Production environment variables template

## Quick Start

### Option 1: Automated Deployment (Recommended)

1. **Edit `deploy.sh`** with your details:
   ```bash
   DOMAIN="hrm.yourdomain.com"
   SERVER_IP="YOUR_SERVER_IP"
   DB_NAME="your_database_name"
   DB_USER="your_db_user"
   DB_PASSWORD="your_db_password"
   ```

2. **Upload to server and run:**
   ```bash
   # On your local machine
   scp deploy.sh root@YOUR_SERVER_IP:/root/
   
   # SSH to server
   ssh root@YOUR_SERVER_IP
   
   # Run deployment script
   chmod +x /root/deploy.sh
   /root/deploy.sh
   ```

3. **Configure DNS** (Hostinger hPanel):
   - Add A record: `hrm` → `YOUR_SERVER_IP`
   - Wait 5-30 minutes for propagation

4. **Install SSL certificate:**
   ```bash
   certbot --nginx -d hrm.yourdomain.com
   ```

### Option 2: Manual Deployment

Follow the detailed instructions in **DEPLOYMENT.md**.

## Post-Deployment

- Visit: `https://hrm.yourdomain.com`
- Login: `admin@example.com` / `password123`
- Change default passwords immediately
- Setup backups (see DEPLOYMENT.md)

## Updating After Deployment

```bash
# SSH to server
ssh root@YOUR_SERVER_IP

# Pull latest changes
cd /var/www/6softhrm
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
```

## Troubleshooting

See **DEPLOYMENT.md** → Troubleshooting section for common issues and solutions.

## Support

- Hostinger Support: https://www.hostinger.com/tutorials/
- Check logs: `pm2 logs 6soft-hrm-backend`
- Check Nginx logs: `tail -f /var/log/nginx/hrm.yourdomain.com.error.log`
