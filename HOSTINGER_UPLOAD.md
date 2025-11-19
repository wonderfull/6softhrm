# Hostinger Frontend Deployment Instructions

## ✅ Build Complete!

Your frontend has been built successfully with the Render backend API:
- **API URL:** `https://sixsoft-hrm.onrender.com/api`
- **Build Location:** `/frontend/dist/`
- **Deployment Package:** `/frontend/hrm-frontend-hostinger.zip` (192 KB)

---

## 📦 Upload to Hostinger

### Method 1: Using File Manager (Recommended)

1. **Login to Hostinger hPanel**
   - Go to: https://hpanel.hostinger.com
   - Login with your credentials

2. **Navigate to File Manager**
   - Dashboard → File Manager
   - Or go to: Files → File Manager

3. **Choose Upload Location**
   
   **Option A: Main Domain (recommended)**
   ```
   /public_html/
   ```
   Your site will be at: `https://yourdomain.com`
   
   **Option B: Subdirectory**
   ```
   /public_html/hrm/
   ```
   Your site will be at: `https://yourdomain.com/hrm`

4. **Upload Files**
   
   **Using ZIP (Easiest):**
   - Click **"Upload"** button in File Manager
   - Select: `/frontend/hrm-frontend-hostinger.zip`
   - Wait for upload to complete
   - Right-click the ZIP → **"Extract"**
   - Move contents of `dist/` folder to your target directory
   - Delete the ZIP and empty `dist/` folder
   
   **OR Manual Upload:**
   - Open `/frontend/dist/` folder on your computer
   - Select ALL files (including `.htaccess`)
   - Drag and drop to File Manager

5. **Verify .htaccess**
   - In File Manager settings, enable **"Show Hidden Files"**
   - Confirm `.htaccess` is present in the root directory
   - This file enables SPA routing (prevents 404 errors)

### Method 2: Using FTP (Alternative)

1. **Get FTP Credentials**
   - Hostinger hPanel → FTP Accounts
   - Or use main hosting credentials

2. **Connect with FTP Client** (FileZilla, Cyberduck, etc.)
   ```
   Host: ftp.yourdomain.com
   Username: your_username
   Password: your_password
   Port: 21 (or 22 for SFTP)
   ```

3. **Upload Files**
   - Navigate to `/public_html/` (or your chosen directory)
   - Upload entire contents of `/frontend/dist/`
   - **Important:** Include `.htaccess` file!

---

## 🔧 Post-Deployment Configuration

### 1. Test the Deployment

Open your domain in browser:
```
https://yourdomain.com
```

You should see the HRM login page.

### 2. Test API Connection

1. Open browser DevTools (F12) → Network tab
2. Try to login with test credentials
3. Check if API calls are going to: `https://sixsoft-hrm.onrender.com/api`

If you see CORS errors, the backend needs the frontend domain added to allowed origins.

### 3. Check .htaccess (If Page Refresh Gives 404)

If refreshing pages gives 404 errors, verify:
```bash
# .htaccess should be in the root directory where index.html is
ls -la /public_html/.htaccess
```

Content should be:
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

### 4. Enable HTTPS (If Not Automatic)

Hostinger usually auto-enables SSL. If not:
1. hPanel → SSL → Manage
2. Enable **"Free SSL Certificate"**
3. Wait 5-10 minutes for activation

---

## 🔍 Troubleshooting

### Issue: 404 Error on Page Refresh

**Solution:** 
- Ensure `.htaccess` is uploaded and in correct location
- Check File Manager settings → Enable "Show Hidden Files"

### Issue: Blank White Page

**Solution:**
- Check browser console (F12) for errors
- Verify API URL is correct in the build
- Check network tab - is API responding?

### Issue: API Connection Failed

**Solution:**
- Ensure Render backend is running (check Render dashboard)
- Add your Hostinger domain to CORS_ORIGIN in Render environment variables:
  ```
  CORS_ORIGIN=https://yourdomain.com
  ```

### Issue: CSS Not Loading

**Solution:**
- Clear browser cache (Ctrl+F5 or Cmd+Shift+R)
- Check if assets folder was uploaded correctly
- Verify file permissions (should be 644 for files, 755 for folders)

---

## 📋 Post-Deployment Checklist

- [ ] Frontend uploaded to Hostinger
- [ ] .htaccess file present
- [ ] Site loads at `https://yourdomain.com`
- [ ] Login page displays correctly
- [ ] Test login works
- [ ] API calls reaching Render backend
- [ ] All pages navigate correctly
- [ ] Page refresh works (no 404)
- [ ] SSL certificate active (https://)
- [ ] Backend database password changed (security!)

---

## 🚀 Quick Upload Commands (if using SSH)

If you have SSH access to Hostinger:

```bash
# Login to Hostinger via SSH
ssh username@yourdomain.com

# Navigate to public_html
cd public_html

# Upload and extract (from your local machine)
scp hrm-frontend-hostinger.zip username@yourdomain.com:~/public_html/
ssh username@yourdomain.com "cd public_html && unzip hrm-frontend-hostinger.zip && mv dist/* . && rm -rf dist hrm-frontend-hostinger.zip"
```

---

## 📞 Next Steps

1. **Upload Frontend to Hostinger** (using instructions above)
2. **Test the Application** at your domain
3. **Change Database Password** (the old one was exposed in git history)
4. **Update Backend CORS** if needed (add your domain)
5. **Run Database Migrations** on Render (if not done yet)
6. **Link Users to Employees** in production database

---

## 🎉 You're Almost Done!

The frontend is built and ready. Just upload to Hostinger and you'll have a fully deployed HRM system!

**Support:**
- Render Dashboard: https://dashboard.render.com
- Hostinger hPanel: https://hpanel.hostinger.com
- Backend API: https://sixsoft-hrm.onrender.com/api
