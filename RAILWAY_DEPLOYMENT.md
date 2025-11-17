# Railway Deployment Guide - Backend Only

Deploy your 6soft HRM backend to Railway (free tier) and frontend to Hostinger.

## What You'll Get

- **Backend API:** `https://your-app.railway.app/api`
- **Frontend:** `https://hrm.yourdomain.com` (on Hostinger)
- **Database:** MySQL on Railway or Hostinger
- **SSL:** Automatic HTTPS
- **Cost:** FREE (Railway free tier: $5/month credit)

---

## Prerequisites

- ✅ GitHub account with your code
- ✅ Railway account (sign up with GitHub)
- ✅ Hostinger hosting with MySQL database
- ✅ Domain/subdomain configured in Hostinger

---

## Part 1: Deploy Backend to Railway

### Step 1: Sign Up for Railway

1. Go to https://railway.app
2. Click **"Start a New Project"**
3. Click **"Login With GitHub"**
4. Authorize Railway to access your repositories

### Step 2: Create New Project

1. Click **"+ New Project"**
2. Select **"Deploy from GitHub repo"**
3. Choose **"wonderfull/6softhrm"**
4. Railway will detect it's a Node.js app

### Step 3: Configure Build Settings

Railway needs to know where your backend is:

1. In Railway dashboard, click on your service
2. Go to **Settings** tab
3. Update these settings:

**Root Directory:**
```
backend
```

**Build Command:**
```
npm install && npx prisma generate && npm run build
```

**Note:** If build fails with `seed.ts not under rootDir`, the seed file is excluded from build (it's run separately with `ts-node`).

**Start Command:**
```
npm start
```

**Watch Paths:**
```
backend/**
```

### Step 4: Add Environment Variables

1. Go to **Variables** tab
2. Click **"+ New Variable"**
3. Add these variables:

**PORT** (Railway auto-assigns, but set for consistency)
```
PORT=4000
```

**NODE_ENV**
```
NODE_ENV=production
```

**JWT_SECRET** (generate secure secret)
```bash
# Run this locally to generate:
openssl rand -base64 32
```
Copy output and paste as:
```
JWT_SECRET=<paste-generated-secret-here>
```

**DATABASE_URL** (your Hostinger MySQL)
```
DATABASE_URL=mysql://u104553007_hrmadmin:Netsc@pe99@mysql.hostinger.com:3306/u104553007_sixsoft_hrm
```

**Note:** Replace `mysql.hostinger.com` with your actual Hostinger MySQL host (get from hPanel → Databases → Remote MySQL)

### Step 5: Enable Public Networking

1. Go to **Settings** tab
2. Scroll to **Networking**
3. Click **"Generate Domain"**
4. Railway will give you a URL like: `https://sixsoft-hrm-production.up.railway.app`
5. **Copy this URL** - you'll need it for the frontend

### Step 6: Deploy

1. Click **"Deploy"** button
2. Railway will:
   - Clone your repo
   - Install dependencies
   - Run Prisma generate
   - Build TypeScript
   - Start the server

3. Watch the **Deployments** tab for progress

### Step 7: Run Database Migrations

After first deployment:

1. Go to your service in Railway
2. Click **"..."** menu → **"Deploy Logs"** (wait for deployment to complete)
3. Then click **"..."** menu → **"View Service"** → **"..."** → **"Terminal"**
4. Run these commands:

```bash
# Migrations are already run during build, but verify:
npx prisma migrate deploy

# Seed the database with initial data
npm run seed
```

This creates tables and seeds initial data (admin user, sample employees, etc.).

### Step 8: Test Backend

Visit your Railway URL with `/api/health`:
```
https://your-app.up.railway.app/api/health
```

Should return:
```json
{"status":"ok"}
```

---

## Part 2: Update Frontend for Railway Backend

### Step 1: Create API Configuration

Create `frontend/src/lib/config.ts`:

```typescript
// API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

export { API_BASE_URL }
```

### Step 2: Update API Client

Update `frontend/src/lib/api.ts`:

```typescript
import { API_BASE_URL } from './config'

const token = localStorage.getItem('token')

export async function apiGet(path: string) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: token ? `Bearer ${token}` : '' }
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function apiPost(path: string, body: any) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : ''
    },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function apiPut(path: string, body: any) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : ''
    },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function apiDelete(path: string) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'DELETE',
    headers: { Authorization: token ? `Bearer ${token}` : '' }
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
```

### Step 3: Create Environment File

Create `frontend/.env.production`:

```env
# Railway Backend URL
VITE_API_URL=https://your-app.up.railway.app/api
```

Replace with your actual Railway URL.

### Step 4: Update Backend CORS

Update `backend/src/app.ts` to allow Hostinger domain:

```typescript
import cors from 'cors'

// Add after express() initialization
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://hrm.yourdomain.com',  // Your Hostinger subdomain
    'https://yourdomain.com'        // Your main domain
  ],
  credentials: true
}))
```

### Step 5: Build Frontend

```bash
cd frontend
npm install
npm run build
```

This creates optimized files in `frontend/dist/`

---

## Part 3: Deploy Frontend to Hostinger

### Option A: File Manager (Easy)

1. **Login to Hostinger hPanel**
2. Go to **File Manager**
3. Navigate to your subdomain folder:
   - Usually: `domains/yourdomain.com/public_html/hrm/`
   - Or: `public_html/hrm/` if main domain
4. **Upload all files from `frontend/dist/`**
   - index.html
   - assets/ folder
   - *.js, *.css files
5. Set permissions: `755` for folders, `644` for files

### Option B: FTP/SFTP (Faster for many files)

1. **Get FTP credentials** from hPanel → FTP Accounts
2. **Use FileZilla or similar:**
   - Host: `ftp.yourdomain.com`
   - Username: From hPanel
   - Password: From hPanel
   - Port: 21 (FTP) or 22 (SFTP)
3. **Upload `frontend/dist/*` to subdomain folder**

### Option C: Git Deployment (Advanced)

1. **Enable Git in hPanel**
2. **Connect to your GitHub repo**
3. **Set build commands:**
   - Root directory: `frontend`
   - Build: `npm install && npm run build`
   - Output: `dist`

---

## Part 4: Configure Subdomain

### Step 1: Create Subdomain in Hostinger

1. Go to hPanel → **Domains**
2. Click **Subdomains**
3. Create subdomain: `hrm`
4. Document root: `/public_html/hrm` (or custom path)

### Step 2: Setup .htaccess for SPA

Create `.htaccess` in subdomain root:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>

# Security headers
<IfModule mod_headers.c>
  Header set X-Content-Type-Options "nosniff"
  Header set X-Frame-Options "SAMEORIGIN"
  Header set X-XSS-Protection "1; mode=block"
</IfModule>

# Enable compression
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json
</IfModule>

# Cache static assets
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/jpg "access plus 1 year"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/gif "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType image/svg+xml "access plus 1 year"
  ExpiresByType text/css "access plus 1 month"
  ExpiresByType application/javascript "access plus 1 month"
  ExpiresByType application/font-woff2 "access plus 1 year"
</IfModule>
```

### Step 3: Enable SSL

1. In hPanel → **SSL**
2. Select your subdomain
3. Click **Install SSL** (free Let's Encrypt)
4. Wait 5-10 minutes for activation

---

## Part 5: Testing & Verification

### Test Backend API

```bash
# Health check
curl https://your-app.up.railway.app/api/health

# Login test
curl -X POST https://your-app.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'
```

### Test Frontend

1. Visit: `https://hrm.yourdomain.com`
2. Should see premium login page
3. Login with: `admin@example.com` / `password123`
4. Verify all features work:
   - Employees list
   - Add/edit employees
   - Timesheets
   - Documents upload
   - Leave requests

### Check Browser Console

Open Developer Tools (F12):
- No CORS errors
- API calls go to Railway URL
- No 404 errors for assets

---

## Troubleshooting

### CORS Errors

**Problem:** `Access to fetch blocked by CORS policy`

**Solution:** Update `backend/src/app.ts`:
```typescript
app.use(cors({
  origin: 'https://hrm.yourdomain.com',
  credentials: true
}))
```

Redeploy backend on Railway.

### 404 on Page Refresh

**Problem:** `/employees` gives 404 when refreshing

**Solution:** Ensure `.htaccess` is in subdomain root and mod_rewrite is enabled.

### API Calls Failing

**Problem:** All API calls return errors

**Solution:** 
1. Check Railway deployment logs
2. Verify `VITE_API_URL` in frontend build
3. Test backend directly: `curl https://your-app.railway.app/api/health`

### Database Connection Error

**Problem:** Railway can't connect to Hostinger MySQL

**Solution:**
1. Enable **Remote MySQL** in Hostinger hPanel
2. Add Railway's IP to allowed hosts
3. Use correct host: Check hPanel → Databases → Remote MySQL Host
4. Format: `mysql://user:pass@remote-host.hostinger.com:3306/dbname`

### File Upload Not Working

**Problem:** Documents can't be uploaded

**Solution:** Railway uses ephemeral filesystem. You need cloud storage:

**Quick Fix - Use Railway Volume:**
1. Railway → Service → **Volumes**
2. Create volume: `/app/backend/uploads`
3. Mount point: `/app/backend/uploads`

**Better Fix - Use S3/Cloudinary:**
Implement cloud storage for production uploads.

---

## Railway Free Tier Limits

- **$5/month credit** (no credit card required)
- **500 hours** execution time
- **100GB** outbound bandwidth
- **1GB** RAM
- **1GB** disk space

**Good for:** Small teams (5-10 users), testing, demos
**Not good for:** High traffic, large file storage

---

## Updating Your Application

### Update Backend (Railway)

Railway auto-deploys on git push:

```bash
git add .
git commit -m "Update backend"
git push origin change_to_mysql
```

Railway detects changes and redeploys automatically.

**Manual Deploy:**
1. Railway dashboard → Service
2. Click **"..."** → **"Redeploy"**

### Update Frontend (Hostinger)

```bash
# Rebuild
cd frontend
npm run build

# Upload via FTP or File Manager
# Replace files in public_html/hrm/
```

---

## Cost Breakdown

| Service | Cost | What For |
|---------|------|----------|
| Railway | **FREE** ($5 credit/month) | Backend API + Database |
| Hostinger | **Your plan** | Frontend hosting + MySQL |
| Domain | **Your plan** | Subdomain (included) |
| SSL | **FREE** | Let's Encrypt |
| **Total** | **~$0-5/month** | Complete app |

---

## Production Checklist

- [ ] Railway backend deployed successfully
- [ ] Database migrations run (`npx prisma migrate deploy`)
- [ ] Database seeded (`npm run seed`)
- [ ] Frontend built with production API URL
- [ ] Frontend uploaded to Hostinger subdomain
- [ ] `.htaccess` configured for SPA routing
- [ ] SSL certificate installed on subdomain
- [ ] CORS configured in backend for your domain
- [ ] Test login works end-to-end
- [ ] Test all CRUD operations
- [ ] Test file uploads (if using Railway volume)
- [ ] Change default admin/manager passwords
- [ ] Monitor Railway usage (check dashboard)

---

## Monitoring & Logs

### Railway Logs

1. Railway dashboard → Your service
2. Click **"Logs"** tab
3. Real-time log streaming

### Hostinger Logs

1. hPanel → **Error Logs**
2. Check for 404s, 500 errors
3. Review access patterns

### Application Monitoring

Add simple logging to backend:

```typescript
// backend/src/index.ts
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`)
  next()
})
```

---

## Backup Strategy

### Railway Database Backup

Railway doesn't auto-backup. Set up scheduled backups:

**Option 1: GitHub Actions** (automated)
**Option 2: Manual exports** via Railway CLI
**Option 3: Use Hostinger MySQL** (they backup automatically)

### Recommended: Use Hostinger MySQL

Since you're already paying for Hostinger:
- Railway uses Hostinger MySQL (via DATABASE_URL)
- Hostinger provides automatic backups
- No extra cost

---

## Security Notes

### Environment Variables

- Never commit `.env` with real credentials
- Use Railway dashboard to set variables
- Rotate JWT_SECRET every 90 days

### Database Access

- Use strong password (✅ yours is good)
- Enable Remote MySQL only from Railway IPs
- Monitor for suspicious queries

### HTTPS Only

- Force HTTPS in frontend
- Set secure cookies for JWT
- Use HSTS headers

---

## Need Help?

- **Railway Docs:** https://docs.railway.app/
- **Railway Discord:** https://discord.gg/railway
- **Hostinger Support:** https://www.hostinger.com/tutorials/

---

## Summary

**You now have:**
- ✅ Backend API on Railway (free)
- ✅ Frontend on Hostinger subdomain
- ✅ MySQL database (Hostinger)
- ✅ HTTPS everywhere
- ✅ Auto-deployments from GitHub

**Next steps:**
1. Build and upload frontend with Railway API URL
2. Test the complete application
3. Change default passwords
4. Monitor Railway usage

**Total setup time:** ~30 minutes 🚀
