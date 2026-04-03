import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth'
import employeeRoutes from './routes/employees'
import sponsorshipRoutes from './routes/sponsorships'
import leaveRoutes from './routes/leave'
import timesheetRoutes from './routes/timesheets'
import projectRoutes from './routes/projects'
import documentRoutes from './routes/documents'
import calendarRoutes from './routes/calendar'
import adminRoutes from './routes/admin'
import gdprRoutes from './routes/gdpr'
import notificationsRoutes from './routes/notifications'
import { verifyEmailConfig } from './lib/emailService'
import { initializeCronJobs } from './lib/cronJobs'

dotenv.config()

// Avoid noisy external SMTP verification in local dev/test unless explicitly enabled.
if (process.env.VERIFY_SMTP_ON_BOOT === 'true') {
  verifyEmailConfig()
}

// Initialize scheduled tasks (daily expiry checks)
initializeCronJobs()

const app = express()

// CORS configuration - allow your frontend domains
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:3000',
  'https://6soft.co.uk',
  'http://6soft.co.uk',
  'https://www.6soft.co.uk',
  'http://www.6soft.co.uk',
  'https://hrm.6soft.co.uk',
  'http://hrm.6soft.co.uk',
]

// If FRONTEND_URL is set in environment, use it
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL)
}

// Log CORS configuration on startup
console.log('🔒 CORS Configuration:')
console.log('NODE_ENV:', process.env.NODE_ENV)
console.log('FRONTEND_URL:', process.env.FRONTEND_URL)
console.log('Allowed Origins:', allowedOrigins)

app.use(cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, Postman, etc)
    if (!origin) return callback(null, true)

    // Allow all subdomains of 6soft.co.uk
    const isAllowedDomain = origin.endsWith('.6soft.co.uk') || origin === 'https://6soft.co.uk' || origin === 'http://6soft.co.uk'

    if (allowedOrigins.indexOf(origin) !== -1 || isAllowedDomain || process.env.NODE_ENV === 'development') {
      callback(null, true)
    } else {
      // Reject with false instead of Error to avoid 500 errors
      console.log(`CORS: Blocked origin ${origin}. Allowed origins:`, allowedOrigins)
      callback(null, false)
    }
  },
  credentials: true
}))

// serve uploaded files
app.use('/uploads', express.static('uploads'))

app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/employees', employeeRoutes)
app.use('/api/sponsorships', sponsorshipRoutes)
app.use('/api/leave', leaveRoutes)
app.use('/api/timesheets', timesheetRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/documents', documentRoutes)
app.use('/api/calendar', calendarRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/gdpr', gdprRoutes)
app.use('/api/notifications', notificationsRoutes)

app.get('/api/health', (req, res) => res.json({ ok: true }))

export default app
