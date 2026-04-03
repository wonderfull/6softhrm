# Production Deployment Steps

## 1. Push Code to Repository

```bash
# You need to authenticate and push
git push origin main
```

## 2. Prepare Production Database

### Option A: If deploying to Render with new database

The migrations will run automatically, but you'll need to seed data.

### Option B: If using existing production database

⚠️ **IMPORTANT**: Back up your production database first!

```bash
# On production server or Railway shell
mysqldump -u <username> -p <database_name> > backup_$(date +%Y%m%d_%H%M%S).sql
```

## 3. Run Database Migrations

On your production environment:

```bash
cd backend
npx prisma migrate deploy
```

This will apply these new migrations:

- `20251118215037_add_gdpr_compliance` - Adds GDPR tables
- `20251119093200_add_document_expiry` - Adds expiry dates to documents
- `20251119141150_add_employee_link_to_user` - Links users to employees

## 4. Seed Production Data (IMPORTANT!)

### Create Sample/Production Data

You have two options:

#### Option A: Use the sample data seed (for demo/testing)

```bash
cd backend
mysql -u <username> -p <database_name> < seed-sample-data.sql
```

This creates:

- 6 sample employees
- 4 projects
- Sample timesheets, leave requests, and sponsorships

#### Option B: Manually create initial data

1. **Create Admin User** (via SQL or register endpoint):

```sql
-- Already have users, just need to link them
```

2. **Create Employee Records** (via UI after deployment)

3. **Link Users to Employees**:

```bash
cd backend
node tools/link-users-to-employees.js
```

## 5. Update Environment Variables

Ensure your production `.env` has:

```env
# Database
DATABASE_URL="mysql://user:password@host:port/database"

# JWT Secret (use a strong random string)
JWT_SECRET="your-secure-random-string-here"

# Email Service (if using)
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-specific-password

# Frontend URL (for CORS and links)
FRONTEND_URL=https://your-frontend-domain.com

# Port
PORT=4000
```

## 6. Render Deployment

If deploying to Render:

### Backend Service:

- Build Command: `cd backend && npm install && npx prisma generate && npx prisma migrate deploy`
- Start Command: `cd backend && npm start`

### Frontend Service:

- Build Command: `cd frontend && npm install && npm run build`
- Start Command: `cd frontend && npx serve -s dist -l 3000`

### After Deployment:

1. Open Render shell for backend
2. Run: `node tools/link-users-to-employees.js`

## 8. Verify Deployment

### Check Backend Health:

```bash
curl https://your-backend-domain.com/api/health
```

### Test Login:

1. Go to your frontend URL
2. Try logging in with:
   - Email: `john.smith@company.com` (if you seeded sample data)
   - Password: (the one you set during user creation)

### Check Database:

```bash
# On production
mysql -u user -p database -e "SELECT COUNT(*) as Users FROM User; SELECT COUNT(*) as Employees FROM Employee;"
```

## 9. Link Existing Users to Employees

After deployment, run the linking tool:

```bash
# On production server or via Render shell
cd backend
node tools/link-users-to-employees.js
```

This will output:

```
Starting to link users to employees...
Found X users without employee links
✓ Linked user email@example.com to employee John Doe
...
=== Summary ===
Successfully linked: X
Not found: X
Total processed: X
```

## 10. Post-Deployment Testing

Test these features:

### As Admin:

- [ ] Login works
- [ ] Can see all employees
- [ ] Can see all leave requests
- [ ] Dashboard shows all alerts
- [ ] Can approve/reject leave

### As Employee (if you have employee users):

- [ ] Login works
- [ ] Only sees own data
- [ ] Can request leave
- [ ] Dashboard shows only own alerts
- [ ] Cannot approve leave

## 11. Production Data Seeding (First Time Only)

If this is a fresh production deployment:

```bash
# Option 1: Use sample data (for demo)
mysql -u user -p database < backend/seed-sample-data.sql

# Option 2: Create real data via UI
# 1. Login as admin
# 2. Go to Employees section
# 3. Add real employees
# 4. Go to User Management
# 5. Create user accounts matching employee emails
# 6. Run linking tool
```

## 12. Monitoring

Check these after deployment:

1. **Application Logs**: Check for errors
2. **Database Connections**: Ensure migrations completed
3. **User Authentication**: Test login flow
4. **API Endpoints**: Test key endpoints
5. **Email Notifications**: If configured, test leave request emails

## Rollback Plan (If Issues Occur)

```bash
# 1. Restore database from backup
mysql -u user -p database < backup_YYYYMMDD_HHMMSS.sql

# 2. Revert to previous commit
git revert HEAD
git push origin main

# 3. Redeploy previous version
```

## Common Issues & Solutions

### Issue: "User account is not linked to an employee record"

**Solution**: Run `node tools/link-users-to-employees.js`

### Issue: Employees see all data instead of just their own

**Solution**: Check that JWT token includes `employeeId` and user has `role: 'USER'`

### Issue: Leave request button not showing

**Solution**: Ensure user is linked to employee (check `user.employeeId` exists)

### Issue: Dark mode text not visible

**Solution**: Check that `frontend/src/styles/tailwind.css` was deployed with dark mode CSS

### Issue: Migrations fail on production

**Solution**:

1. Check DATABASE_URL is correct
2. Ensure database user has migration permissions
3. Check for data conflicts (unique constraints)

## Success Checklist

- [ ] Code pushed to GitHub
- [ ] Database backed up
- [ ] Migrations run successfully
- [ ] Users linked to employees
- [ ] Admin can login and see all data
- [ ] Employee can login and see only their data
- [ ] Leave request functionality works
- [ ] Dashboard alerts appear correctly
- [ ] Dark mode works properly
- [ ] All API endpoints responding

## Support

If you encounter issues:

1. Check application logs
2. Verify environment variables
3. Test database connectivity
4. Review migration status: `npx prisma migrate status`
5. Check Prisma Client is generated: `npx prisma generate`

---

**Last Updated**: November 19, 2025
**Version**: 2.0.0 (Employee Self-Service Release)
