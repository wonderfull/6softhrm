# 🚀 Hostinger Deployment - Quick Start Guide

## What's Ready

All deployment files have been created and committed locally:

✅ **DEPLOYMENT.md** - Complete 12-step deployment guide (5000+ words)
✅ **deploy.sh** - Automated deployment script
✅ **nginx.conf** - Nginx configuration template
✅ **ecosystem.config.js** - PM2 process manager config
✅ **backend/.env.production** - Production environment template

## To Deploy on Hostinger

### Option 1: One-Command Automated (Fastest)

1. **Edit `deploy.sh`** - Update these variables:

   ```bash
   DOMAIN="hrm.yourdomain.com"
   SERVER_IP="123.456.789.012"
   DB_NAME="u123456789_hrm"
   DB_USER="u123456789_hrm"
   DB_PASSWORD="your_secure_password"
   ```

2. **Upload and run:**

   ```bash
   # Upload script to server
   scp deploy.sh root@YOUR_SERVER_IP:/root/

   # SSH to server
   ssh root@YOUR_SERVER_IP

   # Run it
   chmod +x /root/deploy.sh
   /root/deploy.sh
   ```

3. **Configure DNS in Hostinger hPanel:**

   - Go to: Domains → DNS Zone Editor
   - Add A Record: `hrm` → `YOUR_SERVER_IP`
   - Wait 10-30 minutes for propagation

4. **Install SSL:**

   ```bash
   certbot --nginx -d hrm.yourdomain.com
   ```

5. **Done!** Visit `https://hrm.yourdomain.com`

### Option 2: Manual Step-by-Step

Open **DEPLOYMENT.md** and follow all 12 steps for full control.

## What You Need

### Hostinger Requirements

- ✅ VPS or Cloud Hosting plan (not shared hosting)
- ✅ SSH access to server
- ✅ MySQL database created in hPanel
- ✅ Domain with DNS access

### From Hostinger hPanel

Get these from hPanel → Databases → MySQL:

- Database name (usually: `u123456789_something`)
- Username (usually matches DB name)
- Password (you set this)
- Host (usually: `localhost`)

Get these from hPanel → VPS:

- Server IP address
- SSH username (usually `root`)
- SSH password or key

## Default Login Credentials

After deployment, login with:

- **Admin:** admin@example.com / password123
- **Manager:** manager@example.com / password123

⚠️ **Change these immediately after first login!**

## Architecture

```
┌─────────────────────────────────────┐
│   https://hrm.yourdomain.com        │
│   (Your Subdomain)                  │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   Nginx (Port 80/443)               │
│   - Serves React frontend (static)  │
│   - Proxies /api/* to backend       │
│   - SSL/HTTPS with Let's Encrypt    │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   Node.js Backend (Port 4000)       │
│   - Express API server              │
│   - PM2 process manager             │
│   - Handles authentication, CRUD    │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   MySQL Database                    │
│   - Prisma ORM                      │
│   - All application data            │
└─────────────────────────────────────┘
```

## File Structure on Server

```
/var/www/6softhrm/              # Git repo
├── backend/                    # Node.js API
│   ├── dist/                   # Built JS (from TypeScript)
│   ├── .env                    # Database credentials (SECRET!)
│   ├── uploads/                # User uploaded files
│   └── ...
├── frontend/                   # React app
│   └── dist/                   # Built static files
└── ...

/var/www/hrm.yourdomain.com/    # Nginx web root
└── (contents of frontend/dist/) # index.html, assets, etc.

/etc/nginx/sites-available/
└── hrm.yourdomain.com          # Nginx config

/var/log/nginx/
├── hrm.yourdomain.com.access.log
└── hrm.yourdomain.com.error.log

/var/log/pm2/
├── 6soft-hrm-error.log
└── 6soft-hrm-out.log
```

## Common Commands

```bash
# SSH to server
ssh root@YOUR_SERVER_IP

# Check backend status
pm2 status
pm2 logs 6soft-hrm-backend

# Restart backend
pm2 restart 6soft-hrm-backend

# Check Nginx
nginx -t                    # Test config
systemctl status nginx      # Check if running
systemctl reload nginx      # Reload config

# View logs
tail -f /var/log/nginx/hrm.yourdomain.com.error.log
pm2 logs 6soft-hrm-backend --lines 100

# Database
mysql -u u123456789_hrm -p u123456789_hrm

# Update application
cd /var/www/6softhrm
git pull origin change_to_mysql
cd backend && npm install && npm run build && pm2 restart 6soft-hrm-backend
cd ../frontend && npm install && npm run build && cp -r dist/* /var/www/hrm.yourdomain.com/
```

## Troubleshooting

### Site not loading

```bash
# Check Nginx
nginx -t
systemctl status nginx

# Check DNS
dig hrm.yourdomain.com +short
# Should return your server IP
```

### 502 Bad Gateway

```bash
# Backend not running
pm2 status
pm2 restart 6soft-hrm-backend
pm2 logs 6soft-hrm-backend --lines 50
```

### Database errors

```bash
# Check connection
mysql -u u123456789_hrm -p u123456789_hrm

# Check .env file
cat /var/www/6softhrm/backend/.env
# Make sure DATABASE_URL is correct

# Re-run migrations
cd /var/www/6softhrm/backend
npx prisma migrate deploy
```

### SSL certificate issues

```bash
# Check certificate
certbot certificates

# Renew if needed
certbot renew

# Re-install
certbot --nginx -d hrm.yourdomain.com
```

## Security Checklist

After deployment:

- [ ] Change admin/manager passwords
- [ ] Verify `.env` is not accessible via web
- [ ] Enable firewall (UFW)
- [ ] Setup automatic backups
- [ ] Test SSL certificate (A+ rating: ssllabs.com)
- [ ] Review Nginx security headers
- [ ] Setup log rotation
- [ ] Update server packages: `apt update && apt upgrade`

## Performance Tips

- Backend runs on single PM2 instance (sufficient for small teams)
- Nginx serves static files directly (fast)
- Gzip compression enabled
- Static assets cached for 1 year
- MySQL indexes on all foreign keys

## Backup Strategy

Create `/root/backup-hrm.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/root/backups/hrm"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Database
mysqldump -u DB_USER -p'DB_PASSWORD' DB_NAME > $BACKUP_DIR/db_$DATE.sql

# Uploads
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /var/www/6softhrm/backend/uploads

# Keep 7 days
find $BACKUP_DIR -mtime +7 -delete
```

Add to crontab: `0 2 * * * /root/backup-hrm.sh`

## Cost Estimate (Hostinger)

- **VPS Hosting:** $4-8/month (depending on plan)
- **Domain:** $10-15/year (if purchasing)
- **SSL Certificate:** FREE (Let's Encrypt)
- **MySQL Database:** Included
- **Total:** ~$5-10/month

## Next Steps After Deployment

1. ✅ Change all default passwords
2. ✅ Add real employees
3. ✅ Configure email notifications (future)
4. ✅ Setup automated backups
5. ✅ Monitor server resources
6. ✅ Setup staging environment (optional)

## Support Resources

- **Full Guide:** DEPLOYMENT.md
- **Hostinger Docs:** https://www.hostinger.com/tutorials/
- **PM2 Docs:** https://pm2.keymetrics.io/
- **Nginx Docs:** https://nginx.org/en/docs/
- **Prisma Docs:** https://www.prisma.io/docs/

## Need Help?

Check **DEPLOYMENT.md** for:

- Detailed explanations of each step
- Alternative configurations
- Advanced security settings
- Performance optimization
- Monitoring setup

---

**Ready to deploy?** Edit `deploy.sh` and run it on your server! 🚀
