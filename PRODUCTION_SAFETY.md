# Production Safety Guidelines

## ⚠️ CRITICAL RULES

### NEVER Run These Commands in Production:
```bash
❌ npx prisma migrate reset
❌ npx prisma db push --force-reset
❌ npx prisma migrate dev
❌ npm run db:reset
```

### ✅ Safe Commands for Production:
```bash
✅ npx prisma migrate deploy    # Apply pending migrations
✅ npx prisma generate          # Regenerate Prisma Client
✅ npx prisma studio            # View data (read-only)
```

## 📋 Pre-Deployment Checklist

**Before EVERY production deploy:**

1. **Backup Database**
   - Go to: https://6soft.co.uk/users
   - Double-click "User Management"
   - Click "Download Backup" (when we add this)
   - Or use Clever Cloud dashboard backup

2. **Test on Staging First**
   - Never deploy untested migrations to production
   - Test with realistic data volume

3. **Review Migration Files**
   ```bash
   # Check what will run
   ls backend/prisma/migrations/
   cat backend/prisma/migrations/LATEST_MIGRATION/migration.sql
   ```

4. **Verify Build Command**
   - Render → Settings → Build Command should be:
   ```
   npm install && npx prisma generate && npx prisma migrate deploy && npm run build
   ```

5. **Check Environment Variables**
   - Render → Environment
   - `DATABASE_URL` should point to Clever Cloud MySQL
   - Never point to local or test database!

## 🔒 Migration Safety Patterns

### Adding a New Field (SAFE)
```prisma
// Step 1: Add as optional
model Employee {
  newField String?  // nullable
}
```
Deploy → Populate data → Then make required in next release

### Removing a Field (REQUIRES PLANNING)
```prisma
// DON'T immediately delete - 2 step process:

// Release 1: Stop using the field in code
// (field still in schema, no code reads it)

// Release 2 (next week): Remove from schema
// model Employee {
//   oldField String  ← Remove this
// }
```

### Renaming a Field (REQUIRES DATA MIGRATION)
```prisma
// DON'T just rename - 3 step process:

// Release 1: Add new field, copy data
model Employee {
  oldName String
  newName String?  // Add this
}
// Migration includes: UPDATE Employee SET newName = oldName

// Release 2: Update code to use newName

// Release 3: Remove oldName
```

## 🚨 Emergency Recovery

If data is lost:

1. **Check Clever Cloud Backups**
   - Clever Cloud Dashboard → Your Database → Backups
   - Restore from latest backup

2. **Check Local Backup Files**
   - Look for `backup-*.json` files
   - Use Admin → Restore feature

3. **Check Git History**
   - SQL seed files might have data snapshots

## 📊 Monitoring

After each deployment, check:

1. **Render Logs** (first 5 minutes)
   - Look for migration errors
   - Check for connection issues

2. **Application Health**
   - Test login
   - Check employee list loads
   - Verify critical features work

3. **Database Connection**
   ```bash
   curl https://sixsoft-hrm.onrender.com/api/health
   # Should return: {"ok":true}
   ```

## 🔄 Safe Migration Examples

### ✅ Adding a Column
```sql
ALTER TABLE `Employee` ADD COLUMN `middleName` VARCHAR(191) NULL;
```
**Safe:** Existing rows get NULL, no data lost

### ✅ Creating an Index
```sql
CREATE INDEX `Employee_email_idx` ON `Employee`(`email`);
```
**Safe:** Only improves performance

### ⚠️ Making Column Required
```sql
-- DANGEROUS if existing rows have NULL
ALTER TABLE `Employee` MODIFY COLUMN `phoneNumber` VARCHAR(191) NOT NULL;
```
**Must:** Populate NULL values FIRST, then make required

### ❌ Dropping a Column
```sql
-- DANGEROUS - data lost forever
ALTER TABLE `Employee` DROP COLUMN `oldField`;
```
**Must:** Backup first, ensure column not needed

## 🛡️ Protection Mechanisms

### 1. Multiple Environment Setup
```
Local (dev.db) → Uses SQLite or local MySQL
Staging → Clever Cloud test database
Production → Clever Cloud production database
```

### 2. Database Credentials Protection
- Never commit `DATABASE_URL` with real credentials
- Use environment variables
- Different credentials per environment

### 3. Migration Review Process
1. Create migration locally
2. Review generated SQL
3. Test on staging
4. Deploy to production
5. Monitor for issues

### 4. Automated Backups
- **Daily:** Clever Cloud automatic backups
- **Pre-deploy:** Manual backup via UI
- **Weekly:** Download backup file to local storage

## 📚 Resources

- Prisma Migrations: https://www.prisma.io/docs/concepts/components/prisma-migrate
- Clever Cloud Backups: https://www.clever-cloud.com/doc/administrate/database-backups/
- Zero-downtime migrations: https://www.prisma.io/docs/guides/migrate/production-troubleshooting

## 🎯 Quick Reference

**Is this migration safe?**
- ✅ Adding optional fields
- ✅ Creating new tables
- ✅ Adding indexes
- ✅ Making fields nullable
- ⚠️ Making fields required (populate first)
- ⚠️ Changing data types (test first)
- ❌ Dropping columns (backup first)
- ❌ Dropping tables (backup first)
