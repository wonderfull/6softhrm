# Database Safety Guide

## ⚠️ IMPORTANT: Test Database Configuration

**The tests are now configured to use a SEPARATE test database** to prevent data loss.

### Configuration

- **Development Database**: `sixsoft_hrm`
- **Test Database**: `sixsoft_hrm_test`

When you run `npm test`, the tests automatically use `sixsoft_hrm_test` database, which is configured in `/src/__tests__/setup.ts`.

### Database Backups

#### Automatic Backup Before Tests

A backup was created at: `backup_YYYYMMDD_HHMMSS.sql`

#### Manual Backup Command

```bash
mysqldump -u root -pNetscape99 --single-transaction sixsoft_hrm > backup_$(date +%Y%m%d_%H%M%S).sql
```

#### Restore from Backup

```bash
mysql -u root -pNetscape99 sixsoft_hrm < backup_YYYYMMDD_HHMMSS.sql
```

### Test Database Setup

The test database is created and migrated automatically, but if you need to reset it manually:

```bash
# Drop and recreate test database
mysql -u root -pNetscape99 -e "DROP DATABASE IF EXISTS sixsoft_hrm_test; CREATE DATABASE sixsoft_hrm_test;"

# Run migrations
DATABASE_URL="mysql://root:Netscape99@localhost:3306/sixsoft_hrm_test" npx prisma migrate deploy
```

### What Was Fixed

Previously, tests were using the same database as development, which caused:

- ❌ Tests deleted all employee data when running `beforeAll` cleanup
- ❌ Production data was lost when running tests

Now:

- ✅ Tests use separate `sixsoft_hrm_test` database
- ✅ Development data in `sixsoft_hrm` is safe
- ✅ Tests can run without affecting your work

### Current Data Status (as of backup)

- **Users**: 3 (admin@example.com, manager@example.com, wonderfull@gmail.com) ✅
- **Employees**: 1 (test employee from tests - safe to delete)
- **Audit Logs**: 101 entries ✅
- **Other tables**: Clean (data was removed by tests before fix)

### Recommendation

Run regular backups before:

- Running tests (now safe with separate DB)
- Major migrations
- Deploying to production
- Making structural changes

### Verify Test Database

To confirm tests are using the correct database:

```bash
# Check which database tests connect to
grep -r "sixsoft_hrm" backend/src/__tests__/setup.ts
```

You should see: `sixsoft_hrm_test`
