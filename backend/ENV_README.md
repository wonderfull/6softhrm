# Environment Configuration Files

## 🔐 Security First

**NEVER commit real credentials to Git!**

## Files in This Directory

### `.env` (Not in Git) ⛔

- **Contains:** Real production secrets and credentials
- **Status:** Excluded from Git via `.gitignore`
- **Location:** Created manually on the server
- **Permissions:** `chmod 600` (read/write by owner only)

### `.env.production` (In Git) ✅

- **Contains:** Template with placeholders only
- **Purpose:** Shows what variables are needed
- **Usage:** Copy to `.env` and fill with real values
- **Safe to commit:** Yes - no real secrets

### `.env.example` (In Git) ✅

- **Contains:** Example configuration for local development
- **Purpose:** Help developers set up local environment
- **Safe to commit:** Yes - no real secrets

## How to Use

### On Your Local Machine (Development)

```bash
# Copy example to .env
cp backend/.env.example backend/.env

# Edit with your local MySQL credentials
nano backend/.env
```

### On Production Server (Hostinger)

```bash
# SSH to server
ssh root@YOUR_SERVER_IP

# Navigate to backend
cd /var/www/6softhrm/backend

# Create .env from template
cp .env.production .env

# Edit with REAL production credentials
nano .env

# Generate JWT secret
openssl rand -base64 32

# Paste the generated secret into .env

# Secure the file
chmod 600 .env
chown root:root .env
```

## Environment Variables Explained

### `PORT`

- **What:** Port number for backend server
- **Default:** 4000
- **Example:** `PORT=4000`

### `NODE_ENV`

- **What:** Environment mode
- **Values:** `development`, `staging`, `production`
- **Example:** `NODE_ENV=production`

### `JWT_SECRET`

- **What:** Secret key for signing JWT authentication tokens
- **Requirements:** Minimum 32 characters, cryptographically random
- **Generate:** `openssl rand -base64 32`
- **Example:** `JWT_SECRET=K8f2n...` (32+ chars)
- **⚠️ CRITICAL:** Never reuse across environments!

### `DATABASE_URL`

- **What:** MySQL connection string
- **Format:** `mysql://USERNAME:PASSWORD@HOST:PORT/DATABASE`
- **Example:** `DATABASE_URL="mysql://u123_hrm:SecurePass123@localhost:3306/u123_hrm"`
- **Get from:** Hostinger hPanel → Databases → MySQL Databases

## Security Best Practices

### ✅ DO:

- Generate unique secrets for each environment
- Use `openssl rand -base64 32` for JWT secret
- Set `.env` permissions to 600 (`chmod 600 .env`)
- Rotate secrets every 90 days
- Use strong database passwords (16+ characters)
- Keep `.env` in `.gitignore`

### ❌ DON'T:

- Commit `.env` to Git
- Share secrets in Slack/Email/Chat
- Use the same secrets for dev/staging/prod
- Use weak passwords like "password123"
- Store secrets in code comments
- Screenshot `.env` files

## Verification

### Check Git Status

```bash
# Should NOT show .env
git status

# Should be in .gitignore
cat .gitignore | grep .env
```

### Check File Permissions

```bash
ls -la backend/.env
# Should show: -rw------- (600)
```

### Check for Accidentally Committed Secrets

```bash
# Search git history
git log --all --full-history -- "*/.env"

# Search for hardcoded secrets
grep -r "JWT_SECRET\|DATABASE_URL" --include="*.ts" --include="*.js" backend/src/
# Should return no hardcoded values
```

## Troubleshooting

### "Environment variable not found: DATABASE_URL"

- Ensure `.env` file exists in `backend/` directory
- Check file permissions: `ls -la backend/.env`
- Verify format: `cat backend/.env`

### "Access denied for user"

- Check DATABASE_URL has correct credentials
- Verify MySQL user has permissions
- Test connection: `mysql -u USER -p DATABASE`

### Backend won't start

- Check PM2 logs: `pm2 logs 6soft-hrm-backend`
- Verify `.env` syntax (no extra spaces)
- Ensure all required variables are set

## For More Information

See **SECURITY.md** for comprehensive security guidelines.

---

**Remember:** Your `.env` file is like your house keys - never leave them lying around! 🔐
