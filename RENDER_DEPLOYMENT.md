# Render Deployment Guide - 6soft HRM Backend

Deploy your backend to Render (free tier) and frontend to Hostinger.

## What You'll Get

- **Backend API:** `https://your-app.onrender.com/api`
- **Frontend:** `https://hrm.yourdomain.com` (on Hostinger)
- **Database:** Clever Cloud MySQL (already set up)
- **SSL:** Automatic HTTPS
- **Cost:** FREE (Render free tier)

---

## Part 1: Deploy Backend to Render

### Step 1: Sign Up for Render

1. Go to https://render.com
2. Click **"Get Started"**
3. Sign up with **GitHub** (easiest)
4. Authorize Render to access your repositories

### Step 2: Create New Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository:
   - Search for: **"wonderfull/6softhrm"**
   - Click **"Connect"**
3. Render will analyze your repository

### Step 3: Configure Service Settings

Fill in these settings:

**Name:**

```
sixsoft-hrm
```

(or any name you prefer - this will be part of your URL)

**Region:**

```
Oregon (US West)
```

(or closest to your users)

**Branch:**

```
main
```

**Root Directory:**

```
backend
```

**Runtime:**

```
Node
```

**Build Command:**

```
npm install && npx prisma generate && npm run build
```

**Start Command:**

```
npm start
```

**Instance Type:**

```
Free
```

### Step 4: Add Environment Variables

Scroll down to **Environment Variables** section, click **"Add Environment Variable"** for each:

**PORT**

```
4000
```

**NODE_ENV**

```
production
```

**JWT_SECRET**
Generate a secure secret:

```bash
# Run this locally:
openssl rand -base64 32
```

Copy the output and paste it as JWT_SECRET value.

**DATABASE_URL**

```
mysql://YOUR_DB_USER:YOUR_DB_PASSWORD@YOUR_DB_HOST:3306/YOUR_DATABASE_NAME
```

**FRONTEND_URL** (add after you know your Hostinger subdomain)

```
https://hrm.yourdomain.com
```

(Replace with your actual subdomain - you can update this later)

### Step 5: Create Web Service

1. Click **"Create Web Service"** at the bottom
2. Render will start deploying
3. Watch the logs in real-time
4. First deploy takes 3-5 minutes

### Step 6: Get Your Backend URL

After deployment completes:

1. You'll see: **"Your service is live 🎉"**
2. Copy your URL: `https://sixsoft-hrm.onrender.com`
3. **Save this URL** - you'll need it for the frontend

### Step 7: Run Database Migrations

After first deployment, you need to initialize the database:

**Option A: Render Shell (Recommended)**

1. In Render dashboard, click your service
2. Click **"Shell"** tab in the top menu
3. Run these commands:

```bash
cd backend
npx prisma migrate deploy
npm run seed
```

**Option B: Manually via Render Dashboard**

1. Go to **"Manual Deploy"**
2. Enable **"Clear build cache & deploy"**
3. After deploy, use Shell to run seed

### Step 8: Test Your Backend

Visit these URLs to verify:

**Health Check:**

```
https://sixsoft-hrm.onrender.com/api/health
```

Should return: `{"ok":true}`

**Test Login:**

```bash
curl -X POST https://sixsoft-hrm.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'
```

Should return a JWT token.

---

## Part 2: Configure Frontend for Render Backend

### Step 1: Create Production Environment File

Create `frontend/.env.production`:

```env
# Render Backend URL
VITE_API_URL=https://sixsoft-hrm.onrender.com/api
```

Replace `sixsoft-hrm` with your actual Render service name.

### Step 2: Build Frontend

```bash
cd frontend
npm install
npm run build
```

This creates optimized production files in `frontend/dist/`

---

## Part 3: Deploy Frontend to Hostinger

### Step 1: Create Subdomain in Hostinger

1. Login to **Hostinger hPanel**
2. Go to **Domains** section
3. Click **"Subdomains"**
4. Create new subdomain:
   - **Subdomain:** `hrm`
   - **Document Root:** `/public_html/hrm` (or custom path)
5. Click **"Create"**

### Step 2: Upload Frontend Files

**Option A: File Manager (Easy)**

1. In hPanel, go to **"File Manager"**
2. Navigate to your subdomain folder: `public_html/hrm/`
3. Click **"Upload Files"**
4. Upload ALL files from `frontend/dist/` folder:
   - `index.html`
   - `assets/` folder (all JS, CSS files)
   - `6soft-logo.png`
   - Any other files in `dist/`
5. Wait for upload to complete

**Option B: FTP/SFTP (Faster for many files)**

1. Get FTP credentials:
   - hPanel → **"FTP Accounts"**
   - Note: hostname, username, password
2. Use FileZilla or any FTP client:
   - **Host:** `ftp.yourdomain.com`
   - **Username:** From hPanel
   - **Password:** From hPanel
   - **Port:** 21 (FTP) or 22 (SFTP)
3. Connect and navigate to `public_html/hrm/`
4. Upload all contents from `frontend/dist/`

### Step 3: Create .htaccess File

Create `.htaccess` file in `public_html/hrm/` with this content:

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

**How to create .htaccess:**

- In File Manager, click **"New File"**
- Name it: `.htaccess`
- Edit and paste the content above
- Save

### Step 4: Enable SSL Certificate

1. In hPanel, go to **"SSL"**
2. Find your subdomain: `hrm.yourdomain.com`
3. Click **"Install SSL"**
4. Select **"Free Let's Encrypt SSL"**
5. Wait 5-10 minutes for activation
6. Verify by visiting: `https://hrm.yourdomain.com`

### Step 5: Update Render Backend CORS

Now that your frontend is deployed, update backend environment:

1. Go to Render dashboard
2. Select your service
3. Go to **"Environment"** tab
4. Find **FRONTEND_URL** variable
5. Update to: `https://hrm.yourdomain.com`
6. Click **"Save Changes"**
7. Render will automatically redeploy

---

## Part 4: Verify Everything Works

### Test Backend API

```bash
# Health check
curl https://sixsoft-hrm.onrender.com/api/health

# Should return: {"ok":true}
```

### Test Frontend

1. Visit: `https://hrm.yourdomain.com`
2. You should see the **premium login page**
3. Try logging in:
   - **Email:** `admin@example.com`
   - **Password:** `password123`
4. After login, test these features:
   - ✅ Employees list loads
   - ✅ Add new employee
   - ✅ View/edit employee
   - ✅ Add timesheet entry
   - ✅ Create leave request
   - ✅ Upload document

### Check Browser Console

Press **F12** to open Developer Tools:

- **No CORS errors** ✅
- API calls go to your Render URL
- No 404 errors for assets

---

## Troubleshooting

### CORS Error: "blocked by CORS policy"

**Solution:**

1. Go to Render → Your service → Environment
2. Add or update: `FRONTEND_URL=https://hrm.yourdomain.com`
3. Save (Render auto-redeploys)

### API Calls Return 404

**Check:**

- Frontend `.env.production` has correct URL
- Rebuild frontend: `npm run build`
- Re-upload `dist/` files to Hostinger

### 404 When Refreshing Page

**Solution:**

- Ensure `.htaccess` file exists in subdomain root
- Check file permissions: 644
- Verify mod_rewrite is enabled (Hostinger has it by default)

### Database Connection Failed

**Check:**

1. Verify DATABASE_URL in Render environment variables
2. Test connection:

```bash
mysql -h bea6vkgx2o9qqkhtuvww-mysql.services.clever-cloud.com \
  -u u5zqbjwcw6ccmt0v -p bea6vkgx2o9qqkhtuvww
```

### SSL Not Working

**Wait:** SSL can take 5-30 minutes to activate
**Force HTTPS:** In `.htaccess`, add before `RewriteEngine On`:

```apache
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
```

### Render Free Tier Sleep Mode

**Issue:** Render free tier spins down after 15 min of inactivity
**First request takes 30-60 seconds to wake up**

**Solutions:**

1. Use https://uptimerobot.com (free) to ping every 14 minutes
2. Upgrade to Render paid plan ($7/month) for always-on

---

## Render Free Tier Limits

- **750 hours/month** (more than enough)
- **Spins down after 15 min inactivity**
- **512 MB RAM**
- **100 GB bandwidth**

**Good for:**

- Small teams (5-20 users)
- Internal tools
- MVP/demos

**Limitations:**

- First request after sleep: 30-60 seconds
- Not suitable for high-traffic public apps

---

## Cost Breakdown

| Service            | Cost          | What For          |
| ------------------ | ------------- | ----------------- |
| Render             | **FREE**      | Backend API       |
| Clever Cloud       | **Your plan** | MySQL Database    |
| Hostinger          | **Your plan** | Frontend + Domain |
| SSL                | **FREE**      | Let's Encrypt     |
| **Total New Cost** | **$0**        | Complete app      |

---

## Updating Your Application

### Update Backend (Auto-deploy)

Render auto-deploys on git push:

```bash
git add .
git commit -m "Update backend"
git push origin main
```

Render detects changes and redeploys automatically.

**Manual Deploy:**

1. Render dashboard → Your service
2. Click **"Manual Deploy"** → **"Deploy latest commit"**

### Update Frontend

```bash
# Rebuild
cd frontend
npm run build

# Upload to Hostinger
# Via FTP or File Manager - replace files in public_html/hrm/
```

---

## Monitoring

### Render Logs

1. Render dashboard → Your service
2. **"Logs"** tab
3. Real-time streaming logs
4. Filter by date/time

### Hostinger Logs

1. hPanel → **"Error Logs"**
2. Select your subdomain
3. View PHP/Apache errors

### Application Health

Add monitoring with **UptimeRobot** (free):

1. Sign up: https://uptimerobot.com
2. Add monitor: `https://sixsoft-hrm.onrender.com/api/health`
3. Interval: 5 minutes
4. Keeps your app warm on Render free tier

---

## Security Checklist

- [ ] Change default admin/manager passwords
- [ ] JWT_SECRET is strong and unique (32+ chars)
- [ ] DATABASE_URL kept secret (never in code)
- [ ] SSL certificate installed and working
- [ ] CORS properly configured
- [ ] `.env` files not committed to Git
- [ ] Hostinger file permissions correct (644 for files, 755 for folders)

---

## Production Best Practices

### Backup Strategy

**Database Backups:**

- Clever Cloud provides automatic backups
- Check your Clever Cloud dashboard for backup settings

**Manual Backup:**

```bash
# Export database
mysqldump -h bea6vkgx2o9qqkhtuvww-mysql.services.clever-cloud.com \
  -u u5zqbjwcw6ccmt0v -p bea6vkgx2o9qqkhtuvww > backup.sql

# Import
mysql -h bea6vkgx2o9qqkhtuvww-mysql.services.clever-cloud.com \
  -u u5zqbjwcw6ccmt0v -p bea6vkgx2o9qqkhtuvww < backup.sql
```

### File Storage

**Issue:** Render has ephemeral filesystem - uploaded files lost on redeploy

**Solutions:**

1. **Use Cloudinary** (free tier: 25GB, 25k transformations/month)
2. **Use AWS S3** (pay-as-you-go, ~$0.01/GB/month)
3. **Use Render Disk** (persistent volume, $0.25/GB/month)

For now, files stored temporarily work for testing.

---

## Need Help?

- **Render Docs:** https://render.com/docs
- **Render Community:** https://community.render.com
- **Hostinger Support:** https://www.hostinger.com/tutorials

---

## Summary

**You now have:**

- ✅ Backend API on Render (free)
- ✅ Frontend on Hostinger subdomain
- ✅ MySQL database on Clever Cloud
- ✅ HTTPS everywhere
- ✅ Auto-deployments from GitHub

**Total setup time:** ~20 minutes ⚡

**Access your app:** `https://hrm.yourdomain.com`

**Default credentials:**

- Admin: admin@example.com / password123
- Manager: manager@example.com / password123

**⚠️ Change these immediately after first login!**
