# 🚀 Quick Deploy to Railway - Step by Step

## What You Need

✅ Your Hostinger MySQL database:
- Database: `u104553007_sixsoft_hrm`
- User: `u104553007_hrmadmin`
- Password: `Netsc@pe99`
- Host: Find in hPanel → Databases → Remote MySQL

## Deploy in 5 Steps

### Step 1: Sign Up & Connect GitHub (2 min)

1. Go to https://railway.app
2. Click "Login With GitHub"
3. Authorize Railway

### Step 2: Create Project (1 min)

1. Click "+ New Project"
2. Select "Deploy from GitHub repo"
3. Choose "wonderfull/6softhrm"
4. Wait for Railway to detect Node.js app

### Step 3: Configure Backend (3 min)

Click on your service → **Settings**:

**Root Directory:**
```
backend
```

**Build Command:**
```
npm install && npx prisma generate && npm run build
```

**Start Command:**
```
npm start
```

### Step 4: Add Environment Variables (2 min)

Click **Variables** tab, add these:

```
PORT=4000
```

```
NODE_ENV=production
```

```bash
# Generate JWT secret locally:
openssl rand -base64 32
# Copy output and paste as JWT_SECRET
```

```
JWT_SECRET=<paste-your-generated-secret>
```

```
DATABASE_URL=mysql://u104553007_hrmadmin:Netsc@pe99@YOUR_MYSQL_HOST:3306/u104553007_sixsoft_hrm
```

**⚠️ Important:** Replace `YOUR_MYSQL_HOST` with:
- Get from: Hostinger hPanel → Databases → Remote MySQL
- Usually: `mysql.yourhostingdomain.com` or similar
- **NOT** `localhost` or `127.0.0.1`

### Step 5: Generate Domain & Deploy (2 min)

1. Go to **Settings** → **Networking**
2. Click "Generate Domain"
3. Copy your URL: `https://something.up.railway.app`
4. Click "Deploy"
5. Watch **Deployments** tab

## After Deployment

### Run Database Migrations (1 min)

1. Service → "..." menu → "Terminal"
2. Run:

```bash
npx prisma migrate deploy
npm run seed
```

### Test Backend (1 min)

Visit: `https://your-app.up.railway.app/api/health`

Should return: `{"ok":true}`

## Deploy Frontend to Hostinger

### Step 1: Build with Railway API URL

Create `frontend/.env.production`:

```env
VITE_API_URL=https://your-app.up.railway.app/api
```

Replace with your actual Railway URL.

Build:

```bash
cd frontend
npm install
npm run build
```

### Step 2: Upload to Hostinger

**Option A: File Manager**
1. Login to Hostinger hPanel
2. File Manager → `public_html/hrm/` (or subdomain folder)
3. Upload all files from `frontend/dist/`
4. Upload this `.htaccess`:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

**Option B: FTP**
1. Get FTP credentials from hPanel
2. Use FileZilla
3. Upload `frontend/dist/*` to subdomain folder

### Step 3: Enable SSL

1. hPanel → SSL
2. Select subdomain
3. Install SSL (free Let's Encrypt)

### Step 4: Update Backend CORS

Add to Railway environment variables:

```
FRONTEND_URL=https://hrm.yourdomain.com
```

This allows your frontend to call the backend.

## Test Complete App

1. Visit: `https://hrm.yourdomain.com`
2. Login: `admin@example.com` / `password123`
3. Test features:
   - ✅ Employees list loads
   - ✅ Add employee works
   - ✅ Timesheets work
   - ✅ Documents upload
   - ✅ Leave requests

## Troubleshooting

### CORS Error

**Add to Railway Variables:**
```
FRONTEND_URL=https://hrm.yourdomain.com
```

Redeploy.

### Database Connection Failed

**Check:**
1. hPanel → Databases → Enable "Remote MySQL"
2. Add Railway's IP to allowed hosts (or allow all: `%`)
3. Verify MySQL host is correct (not `localhost`)

**Test connection:**
```bash
mysql -h YOUR_MYSQL_HOST -u u104553007_hrmadmin -p u104553007_sixsoft_hrm
```

### 404 on Routes

**Add `.htaccess` to Hostinger:**
(See frontend deployment step above)

## Cost Summary

| What | Cost |
|------|------|
| Railway Backend | **FREE** ($5/month credit) |
| Hostinger Hosting | **Your existing plan** |
| MySQL Database | **Included with Hostinger** |
| SSL Certificate | **FREE** |
| **Total New Cost** | **$0** |

## Monitoring

**Railway:**
- Dashboard → Logs → Real-time logs
- Check usage: $5 credit should last all month for small team

**Hostinger:**
- hPanel → Error Logs
- Monitor for 404s or 500 errors

## Updating

**Backend (Auto-deploy):**
```bash
git push origin change_to_mysql
```

Railway automatically redeploys.

**Frontend:**
```bash
cd frontend
npm run build
# Upload dist/* to Hostinger via FTP or File Manager
```

## Default Credentials

After seeding:
- **Admin:** admin@example.com / password123
- **Manager:** manager@example.com / password123

**⚠️ Change these immediately after first login!**

---

## Need Help?

See **RAILWAY_DEPLOYMENT.md** for detailed troubleshooting and advanced configuration.

**Total setup time: ~15 minutes** ⚡
