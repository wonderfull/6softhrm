# Security Best Practices for 6soft HRM

## Environment Variables & Secrets Management

### ⚠️ NEVER Commit Real Credentials to Git

**Files that should NEVER be committed with real values:**

- `.env` - Production secrets
- `backend/.env` - Backend secrets
- Any file with passwords, API keys, or tokens

### ✅ What IS Safe to Commit

- `.env.production` - Template with placeholders only
- `.env.example` - Example configuration
- Documentation about what variables are needed

---

## Secure Deployment Strategy

### Option 1: Manual Environment Variables (Most Secure)

**On the server, create `.env` file manually:**

```bash
ssh root@YOUR_SERVER_IP
cd /var/www/6softhrm/backend

# Create .env file (never synced with Git)
nano .env
```

**Paste this content with REAL values:**

```env
PORT=4000
NODE_ENV=production

# Generate with: openssl rand -base64 32
JWT_SECRET=your-actual-32-plus-character-secret-here

# Your Hostinger MySQL credentials
DATABASE_URL="mysql://u123456_hrm:RealPassword123!@localhost:3306/u123456_hrm"
```

**Secure the file:**

```bash
chmod 600 .env
chown root:root .env
```

This ensures only root can read/write the file.

---

### Option 2: Use Deployment Script with Interactive Prompts

Update `deploy.sh` to prompt for secrets:

```bash
#!/bin/bash
set -e

echo "🔐 Enter your Hostinger MySQL credentials:"
read -p "Database name: " DB_NAME
read -p "Database user: " DB_USER
read -sp "Database password: " DB_PASSWORD
echo ""

read -p "Domain (e.g., hrm.yourdomain.com): " DOMAIN
read -p "Server IP: " SERVER_IP

# Generate JWT secret automatically
JWT_SECRET=$(openssl rand -base64 32)

echo ""
echo "✓ Configuration collected"
# ... rest of script
```

---

### Option 3: Use Environment Variables from Hosting Panel

Some hosts like Hostinger allow setting environment variables in their control panel:

1. Go to Hostinger hPanel → Your VPS → Environment Variables
2. Add variables:
   - `JWT_SECRET`
   - `DATABASE_URL`
   - `NODE_ENV=production`
3. These are loaded automatically without needing a `.env` file

---

## Git Security

### Update .gitignore (Already Done)

Your `.gitignore` already excludes:

```gitignore
.env
.env.*
!.env.production  # Template only
```

### Verify No Secrets in Git History

```bash
# Check if any .env files were committed
git log --all --full-history -- "*/.env"

# If you accidentally committed secrets, clean history:
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch backend/.env' \
  --prune-empty --tag-name-filter cat -- --all
```

### Check for Exposed Secrets

```bash
# Search for potential secrets in committed files
git grep -i "password\|secret\|api.key"
```

---

## Production `.env` File Security

### Server-Side Protection

```bash
# Secure permissions (only owner can read/write)
chmod 600 /var/www/6softhrm/backend/.env

# Ensure owned by deployment user
chown www-data:www-data /var/www/6softhrm/backend/.env

# Verify permissions
ls -la /var/www/6softhrm/backend/.env
# Should show: -rw------- (600)
```

### Nginx Protection

Ensure `.env` files can't be accessed via web:

```nginx
# In your Nginx config
location ~ /\.env {
    deny all;
    return 404;
}

# Also block other sensitive files
location ~ /(\.git|\.gitignore|package\.json|tsconfig\.json) {
    deny all;
    return 404;
}
```

---

## Secrets Management Recommendations

### 1. Generate Strong JWT Secret

```bash
# Generate 32-byte random string
openssl rand -base64 32

# Or 64-byte for extra security
openssl rand -base64 64

# On macOS, you can also use:
LC_ALL=C tr -dc 'A-Za-z0-9!@#$%^&*' < /dev/urandom | head -c 32
```

### 2. Use Strong Database Passwords

```bash
# Generate strong password
openssl rand -base64 24

# Requirements:
# - Minimum 16 characters
# - Mix of uppercase, lowercase, numbers, symbols
# - No dictionary words
# - Unique per environment (dev, staging, prod)
```

### 3. Rotate Secrets Regularly

**JWT Secret Rotation:**

- Every 90 days for production
- After any security incident
- When team member leaves

**Database Password Rotation:**

- Every 180 days
- After suspected compromise

---

## Deployment Secrets Workflow

### Initial Deployment

```bash
# 1. Clone repo (no secrets)
git clone https://github.com/wonderfull/6softhrm.git
cd 6softhrm

# 2. Create .env from template
cp backend/.env.production backend/.env

# 3. Edit with real values (use nano, vim, etc.)
nano backend/.env

# 4. Secure it
chmod 600 backend/.env

# 5. Deploy
npm install
npm run build
```

### Update/Redeploy

```bash
# Pull latest code
git pull origin main

# .env is NOT overwritten (it's gitignored)
# Your secrets remain safe

# Rebuild and restart
npm run build
pm2 restart 6soft-hrm-backend
```

---

## Environment-Specific Secrets

### Development (Local)

```env
# backend/.env (local machine)
PORT=4000
NODE_ENV=development
JWT_SECRET=dev-secret-not-secure
DATABASE_URL="mysql://root:password@localhost:3306/sixsoft_hrm"
```

### Staging (Optional)

```env
# On staging server
PORT=4000
NODE_ENV=staging
JWT_SECRET=<unique-staging-secret>
DATABASE_URL="mysql://staging_user:staging_pass@localhost:3306/hrm_staging"
```

### Production

```env
# On production server
PORT=4000
NODE_ENV=production
JWT_SECRET=<strong-unique-production-secret-32-plus-chars>
DATABASE_URL="mysql://prod_user:SecurePass123!@localhost:3306/hrm_production"
```

**NEVER use the same secrets across environments!**

---

## Backup Security

### Encrypt Database Backups

```bash
#!/bin/bash
# backup-encrypted.sh

BACKUP_DIR="/root/backups/hrm"
DATE=$(date +%Y%m%d_%H%M%S)
ENCRYPTION_KEY="your-backup-encryption-key"

# Dump and encrypt
mysqldump -u $DB_USER -p$DB_PASSWORD $DB_NAME | \
  openssl enc -aes-256-cbc -salt -k "$ENCRYPTION_KEY" > \
  $BACKUP_DIR/db_$DATE.sql.enc

# Restore:
# openssl enc -d -aes-256-cbc -k "$ENCRYPTION_KEY" -in db_backup.sql.enc | mysql -u user -p database
```

### Secure Backup Storage

```bash
# Set permissions
chmod 700 /root/backups
chmod 600 /root/backups/hrm/*

# Consider offsite backup to encrypted S3/storage
```

---

## Security Checklist

### Before Deployment

- [ ] Remove all hardcoded passwords/secrets from code
- [ ] Verify `.env` is in `.gitignore`
- [ ] Generate strong JWT secret (32+ chars)
- [ ] Create strong database password (16+ chars)
- [ ] Plan secret rotation schedule

### After Deployment

- [ ] Verify `.env` has `chmod 600` permissions
- [ ] Test that `.env` is not accessible via web
- [ ] Change all default passwords (admin, manager users)
- [ ] Enable firewall (UFW)
- [ ] Install SSL certificate
- [ ] Setup fail2ban for SSH protection
- [ ] Configure automated encrypted backups
- [ ] Document secret rotation procedures

### Ongoing Security

- [ ] Rotate JWT secret every 90 days
- [ ] Rotate database password every 180 days
- [ ] Monitor access logs: `/var/log/nginx/*.log`
- [ ] Monitor auth failures: `tail -f /var/log/auth.log`
- [ ] Keep server updated: `apt update && apt upgrade`
- [ ] Review PM2 logs for suspicious activity
- [ ] Audit database for unauthorized access

---

## Incident Response

### If Secrets are Compromised

1. **Immediately rotate all secrets:**

   ```bash
   # Generate new JWT secret
   NEW_JWT=$(openssl rand -base64 32)

   # Update .env
   sed -i "s/JWT_SECRET=.*/JWT_SECRET=$NEW_JWT/" /var/www/6softhrm/backend/.env

   # Restart backend
   pm2 restart 6soft-hrm-backend
   ```

2. **Change database password:**

   ```bash
   mysql -u root -p
   ALTER USER 'hrm_user'@'localhost' IDENTIFIED BY 'NewSecurePassword';
   FLUSH PRIVILEGES;
   ```

3. **Update `.env` with new password**

4. **Force all users to re-login** (JWT tokens invalidated)

5. **Review access logs** for suspicious activity

6. **Notify team** if applicable

---

## Additional Security Measures

### SSH Key Authentication (Disable Password Login)

```bash
# Generate SSH key locally
ssh-keygen -t ed25519 -C "your_email@example.com"

# Copy to server
ssh-copy-id root@YOUR_SERVER_IP

# Disable password authentication
nano /etc/ssh/sshd_config
# Set: PasswordAuthentication no

systemctl restart sshd
```

### Fail2Ban (Prevent Brute Force)

```bash
apt install -y fail2ban

cat > /etc/fail2ban/jail.local <<EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
EOF

systemctl enable fail2ban
systemctl start fail2ban
```

### Database Access Restriction

```sql
-- Allow connections only from localhost
-- In MySQL config: /etc/mysql/mysql.conf.d/mysqld.cnf
bind-address = 127.0.0.1

-- Use strong authentication plugin
ALTER USER 'hrm_user'@'localhost' IDENTIFIED WITH mysql_native_password BY 'password';
```

---

## Tools for Secrets Management

### For Teams/Organizations

Consider using:

1. **HashiCorp Vault** - Enterprise secret management
2. **AWS Secrets Manager** - Cloud-based secrets
3. **Azure Key Vault** - Microsoft cloud secrets
4. **1Password / LastPass** - Team password managers
5. **Git-crypt** - Encrypt files in Git

### For Small Teams

- **Pass** - CLI password manager (`apt install pass`)
- **age** - Simple file encryption (`apt install age`)
- **GPG** - GNU Privacy Guard

---

## Quick Security Commands

```bash
# Generate secure random string
openssl rand -base64 32

# Check file permissions
ls -la /var/www/6softhrm/backend/.env

# Secure .env file
chmod 600 /var/www/6softhrm/backend/.env

# Search for hardcoded secrets in code
grep -r "password\|secret\|api.key" --include="*.ts" --include="*.js"

# Check open ports
netstat -tuln

# View recent failed login attempts
grep "Failed password" /var/log/auth.log | tail -20

# Monitor real-time logs
tail -f /var/log/nginx/hrm.yourdomain.com.access.log

# Check SSL certificate expiry
certbot certificates
```

---

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [12 Factor App - Config](https://12factor.net/config)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Prisma Security Guide](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-aws-lambda)

---

**Remember:** Security is an ongoing process, not a one-time setup. Stay vigilant! 🔐
