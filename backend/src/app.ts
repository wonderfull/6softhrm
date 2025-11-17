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

dotenv.config()

const app = express()

// CORS configuration - allow your frontend domains
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  // Add your Hostinger subdomain here when deploying
  // 'https://hrm.yourdomain.com'
]

// If FRONTEND_URL is set in environment, use it
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL)
}

app.use(cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, Postman, etc)
    if (!origin) return callback(null, true)
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
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

app.get('/api/health', (req, res) => res.json({ ok: true }))

export default app
