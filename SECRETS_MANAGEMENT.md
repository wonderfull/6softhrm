# 🔐 Secrets Management - Summary

## The Problem You Identified

You correctly noticed that putting database passwords and JWT secrets in files committed to Git is a **major security risk**.

## ✅ The Solution Implemented

### 1. **Template Files Only in Git**

**backend/.env.production** (in Git):

```env
# This file has PLACEHOLDERS only
JWT_SECRET=REPLACE_WITH_OUTPUT_OF_openssl_rand_base64_32
DATABASE_URL="mysql://DB_USERNAME:DB_PASSWORD@DB_HOST:3306/DB_NAME"
```

**backend/.env** (NOT in Git - excluded by .gitignore):

```env
# This file has REAL credentials
JWT_SECRET=K8f2nX7pQ9mR...  # Real generated secret
DATABASE_URL="mysql://u123_hrm:RealPassword123@localhost:3306/u123_hrm"
```

### 2. **Automatic Secret Generation**

The deployment script (`deploy.sh`) now:

- Auto-generates JWT secret: `openssl rand -base64 32`
- Creates `.env` file on the server (never committed to Git)
- Secures the file with `chmod 600`

### 3. **Security Documentation**

Created comprehensive guides:

- **SECURITY.md** - Complete security best practices
- **backend/ENV_README.md** - How to manage environment variables
- Updated **DEPLOYMENT.md** - Secure deployment steps

## How It Works

### On Your Local Machine (Development)

```bash
# .env is gitignored - safe to have real credentials locally
cp backend/.env.example backend/.env
nano backend/.env  # Add your local MySQL credentials
```

### On Production Server

```bash
# Option 1: Automated (deploy.sh creates it)
./deploy.sh  # Prompts for DB credentials, generates JWT secret

# Option 2: Manual
cp backend/.env.production backend/.env
nano backend/.env  # Fill in real values
openssl rand -base64 32  # Generate JWT secret
chmod 600 backend/.env  # Secure the file
```

## What's Safe in Git

✅ **Safe to commit:**

- `.env.production` - Template with placeholders
- `.env.example` - Example configuration
- `deploy.sh` - Auto-generates secrets (doesn't hardcode)
- All documentation files

❌ **NEVER commit:**

- `.env` - Real credentials (automatically excluded)
- Files with actual passwords, API keys, tokens
- Database connection strings with real passwords

## Verification

```bash
# Check .gitignore
cat .gitignore | grep .env
# Output: .env and .env.*

# Check what's staged for commit
git status
# Should NOT show backend/.env

# Search for hardcoded secrets in code
grep -r "password\|secret" --include="*.ts" backend/src/
# Should find no hardcoded values
```

## Security Checklist

✅ `.env` is in `.gitignore`
✅ `.env.production` has only placeholders
✅ `deploy.sh` generates JWT secret automatically
✅ Real credentials are only on the server
✅ `.env` file has `chmod 600` permissions
✅ Documentation explains security practices
✅ Secret rotation procedures documented

## How to Deploy Securely

### Step 1: Edit deploy.sh (Only Update These)

```bash
DOMAIN="hrm.yourdomain.com"
SERVER_IP="123.456.789.012"
DB_NAME="u123456_hrm"        # From Hostinger
DB_USER="u123456_hrm"        # From Hostinger
DB_PASSWORD="YourDBPass"     # From Hostinger
```

**Note:** JWT_SECRET is auto-generated - don't touch this line:

```bash
JWT_SECRET=$(openssl rand -base64 32)  # Auto-generated ✅
```

### Step 2: Upload and Run

```bash
scp deploy.sh root@YOUR_SERVER_IP:/root/
ssh root@YOUR_SERVER_IP
chmod +x /root/deploy.sh
/root/deploy.sh
```

The script will:

1. Create `.env` file with real credentials
2. Generate unique JWT secret automatically
3. Secure the file (`chmod 600`)
4. Never expose secrets in logs

## After Deployment

### Verify Security

```bash
# SSH to server
ssh root@YOUR_SERVER_IP

# Check .env permissions (should be 600)
ls -la /var/www/6softhrm/backend/.env
# Output: -rw------- (only owner can read/write)

# Verify JWT secret is strong (32+ chars)
grep JWT_SECRET /var/www/6softhrm/backend/.env
# Should show long random string

# Test that .env is not accessible via web
curl https://hrm.yourdomain.com/.env
# Should return 404 or 403
```

### Change Default Passwords

Login to your app and immediately change:

- Admin password (admin@example.com)
- Manager password (manager@example.com)

## Secret Rotation

### Every 90 Days - Rotate JWT Secret

```bash
ssh root@YOUR_SERVER_IP
cd /var/www/6softhrm/backend

# Generate new secret
NEW_JWT=$(openssl rand -base64 32)

# Update .env
sed -i "s/JWT_SECRET=.*/JWT_SECRET=$NEW_JWT/" .env

# Restart backend
pm2 restart 6soft-hrm-backend
```

**Effect:** All users will need to re-login (tokens invalidated)

### Every 180 Days - Rotate Database Password

```bash
# 1. Change in MySQL
mysql -u root -p
ALTER USER 'u123_hrm'@'localhost' IDENTIFIED BY 'NewSecurePassword';
FLUSH PRIVILEGES;
EXIT;

# 2. Update .env
nano /var/www/6softhrm/backend/.env
# Change DATABASE_URL password

# 3. Restart backend
pm2 restart 6soft-hrm-backend
```

## Emergency: Secrets Compromised

If you accidentally committed real credentials:

```bash
# 1. Immediately rotate ALL secrets
# (Follow rotation steps above)

# 2. Remove from Git history
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch backend/.env' \
  --prune-empty --tag-name-filter cat -- --all

# 3. Force push (if repo is not shared)
git push origin --force --all

# 4. Review access logs
ssh root@YOUR_SERVER_IP
tail -f /var/log/nginx/hrm.*.log
tail -f /var/log/auth.log
```

## Best Practices Summary

1. **Never hardcode secrets** - Use environment variables
2. **Use templates in Git** - Real values only on servers
3. **Generate strong secrets** - `openssl rand -base64 32`
4. **Secure files** - `chmod 600 .env`
5. **Unique per environment** - Different secrets for dev/prod
6. **Rotate regularly** - JWT every 90 days, DB every 180 days
7. **Monitor logs** - Watch for suspicious activity
8. **Document procedures** - Team knows what to do

## Resources

- **SECURITY.md** - Complete security guide
- **backend/ENV_README.md** - Environment variables explained
- **DEPLOYMENT.md** - Step-by-step deployment
- **deploy.sh** - Automated secure deployment

## Questions?

**Q: Can I commit `.env.production`?**
A: Yes! It only has placeholders, no real credentials.

**Q: Where do real credentials go?**
A: Only in `.env` on the actual server (never committed to Git).

**Q: How do I update secrets?**
A: SSH to server, edit `/var/www/6softhrm/backend/.env`, restart PM2.

**Q: What if I accidentally committed secrets?**
A: Follow the "Emergency" steps above immediately.

**Q: Do I need different secrets for dev/staging/prod?**
A: YES! Always use unique secrets for each environment.

---

**Your app is now secure! 🔐** All credentials are managed properly and never exposed in Git.
