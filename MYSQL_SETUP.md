# MySQL Setup Instructions

## Prerequisites
1. Install MySQL Server (8.0 or higher recommended)
   - macOS: `brew install mysql`
   - Ubuntu/Debian: `sudo apt install mysql-server`
   - Windows: Download from https://dev.mysql.com/downloads/mysql/

2. Start MySQL Service
   - macOS: `brew services start mysql`
   - Ubuntu/Debian: `sudo systemctl start mysql`
   - Windows: Start MySQL service from Services

## Database Setup

### Step 1: Create the Database
Login to MySQL and create the database:

```bash
# Login to MySQL (default root without password on fresh install)
mysql -u root -p

# Or if no password set yet:
mysql -u root
```

Then run these SQL commands:

```sql
CREATE DATABASE sixsoft_hrm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Optional: Create a dedicated user
CREATE USER 'hrm_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON sixsoft_hrm.* TO 'hrm_user'@'localhost';
FLUSH PRIVILEGES;

-- Exit MySQL
EXIT;
```

### Step 2: Update .env File
Edit `backend/.env` and update the DATABASE_URL:

```env
# If using root user:
DATABASE_URL="mysql://root:your_root_password@localhost:3306/sixsoft_hrm"

# If using dedicated user:
DATABASE_URL="mysql://hrm_user:your_secure_password@localhost:3306/sixsoft_hrm"
```

**Important:** Replace `your_root_password` or `your_secure_password` with your actual MySQL password.

### Step 3: Run Prisma Migrations
```bash
cd backend
npx prisma migrate dev --name init
npx prisma generate
```

### Step 4: Seed the Database (Optional)
```bash
cd backend
npm run seed
```

This will create:
- Admin user: `admin@example.com` / `password123`
- Regular user: `user@example.com` / `password123`
- Sample employees and data

### Step 5: Start the Application
```bash
# From project root
npm run dev:all

# Or separately:
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

## Troubleshooting

### Connection Issues
1. **Can't connect to MySQL server:**
   - Verify MySQL is running: `mysql.server status` (macOS) or `sudo systemctl status mysql` (Linux)
   - Check if MySQL is listening on port 3306: `netstat -an | grep 3306`

2. **Access denied for user:**
   - Check username and password in DATABASE_URL
   - Verify user has permissions: Login to MySQL and run `SHOW GRANTS FOR 'your_user'@'localhost';`

3. **Database doesn't exist:**
   - Create it manually using the SQL commands above

### Reset Database
If you need to reset the database:

```bash
cd backend

# Drop and recreate database in MySQL:
mysql -u root -p -e "DROP DATABASE IF EXISTS sixsoft_hrm; CREATE DATABASE sixsoft_hrm;"

# Reset Prisma migrations
npx prisma migrate reset

# Or manually:
rm -rf prisma/migrations
npx prisma migrate dev --name init
```

## Migration from SQLite

Your SQLite data has been backed up to `dev.db.sqlite-backup-*` files.

To migrate data from SQLite to MySQL, you can:

1. **Export SQLite data:**
   ```bash
   sqlite3 dev.db.sqlite-backup-YYYYMMDD-HHMMSS .dump > sqlite_dump.sql
   ```

2. **Convert and import to MySQL:**
   - Manual approach: Export data as CSV from SQLite and import to MySQL
   - Or use a migration tool like `prisma db push` after setting up both connections

3. **Alternative: Use Prisma Studio:**
   - Export data from SQLite using Prisma Studio
   - Switch to MySQL connection
   - Import data through Prisma Studio or seed scripts

## Performance Tips

1. **Enable Query Logging (Development):**
   Add to `backend/src/prismaClient.ts`:
   ```typescript
   export const prisma = new PrismaClient({
     log: ['query', 'info', 'warn', 'error'],
   })
   ```

2. **Connection Pooling:**
   MySQL connection string supports pool settings:
   ```
   DATABASE_URL="mysql://user:pass@localhost:3306/sixsoft_hrm?connection_limit=10"
   ```

3. **Indexes:**
   The schema already includes indexes on unique fields and foreign keys.

## Security Notes

- Never commit `.env` file with real credentials
- Use strong passwords for production databases
- Consider using environment-specific `.env` files
- For production, use connection pooling and SSL connections
- Regularly backup your MySQL database

## Additional Resources

- [Prisma MySQL Documentation](https://www.prisma.io/docs/concepts/database-connectors/mysql)
- [MySQL Documentation](https://dev.mysql.com/doc/)
- [Prisma Migrate Guide](https://www.prisma.io/docs/concepts/components/prisma-migrate)
