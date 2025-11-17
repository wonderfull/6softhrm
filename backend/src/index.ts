import app from './app'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import prisma from './prismaClient'

dotenv.config()

const PORT = process.env.PORT || 4000

// ensure uploads directory exists for document storage
const uploadsDir = path.join(process.cwd(), 'uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

// Ensure DB file exists - restore from backup if missing
const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')
const backupPath = path.join(process.cwd(), 'prisma', 'dev.db.backup')
if (!fs.existsSync(dbPath) && fs.existsSync(backupPath)) {
  console.log('⚠️  Database file missing - restoring from backup...')
  fs.copyFileSync(backupPath, dbPath)
  console.log('✅ Database restored from backup')
} else if (!fs.existsSync(dbPath)) {
  console.log('⚠️  No database file found. Run `npm run prisma:migrate` and `npm run seed`')
}

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
  console.log(`Uploads directory: ${uploadsDir}`)
})

// At startup, check the DB tables are present (specifically Employee) and warn/exit if not
;(async () => {
  try {
    const count = await prisma.employee.count()
    console.log(`Employee rows: ${count}`)
  } catch (e: any) {
    console.error('Failed to access database or read Employee table. It may be missing.');
    console.error(`Error: ${e.message || e}`)
    console.error('If this is a fresh workspace, run `npm --prefix backend run sync-db` or `npm --prefix backend run prisma:migrate` then `npm --prefix backend run seed`.')
    // Do not exit; let the developer decide; but log prominently so it's noticed.
  }
})()
