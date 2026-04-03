import app from './app'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import prisma from './prismaClient'

dotenv.config()

// Render dynamically assigns a port — REQUIRED or you get 502
const PORT = process.env.PORT || 4000

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
  console.log("📁 Created uploads directory:", uploadsDir)
}

// Start server correctly (this is what fixes your 502)
app.listen(PORT, () => {
  console.log(`🚀 Backend running on port: ${PORT}`)
  console.log(`📂 Uploads directory: ${uploadsDir}`)
})

// Check DB on startup
;(async () => {
  try {
    const count = await prisma.employee.count()
    console.log(`👥 Employee rows: ${count}`)
  } catch (e) {
    console.error('❌ Failed to access database or Employee table.')
    console.error(e)
    console.error(
      '⚠️ Make sure your DATABASE_URL is correct and run migrations if needed.'
    )
  }
})()
