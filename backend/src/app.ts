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

// serve uploaded files
app.use('/uploads', express.static('uploads'))

app.use(cors())
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
