import { Router } from 'express'
import prisma from '../prismaClient'
import { requireAuth } from '../middleware/auth'
import fs from 'fs/promises'
import path from 'path'

const router = Router()

// Backup database - exports all data to JSON
router.get('/backup', requireAuth, async (req: any, res) => {
  try {
    // Check if user is admin
    const userRole = req.user?.role || 'USER'
    if (userRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    // Export all tables
    const [users, employees, projects, documents, timesheets, leaveRequests, sponsorships] = await Promise.all([
      prisma.user.findMany(),
      prisma.employee.findMany(),
      prisma.project.findMany(),
      prisma.document.findMany(),
      prisma.timesheet.findMany(),
      prisma.leaveRequest.findMany(),
      prisma.sponsorship.findMany()
    ])

    const backup = {
      exportDate: new Date().toISOString(),
      version: '1.0',
      data: {
        users: users.map((u: any) => ({ ...u, password: '[REDACTED]' })), // Don't export passwords
        employees,
        projects,
        documents,
        timesheets,
        leaveRequests,
        sponsorships
      }
    }

    const filename = `6soft-hrm-backup-${new Date().toISOString().split('T')[0]}.json`
    
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.json(backup)
  } catch (error: any) {
    console.error('Backup error:', error)
    res.status(500).json({ error: 'Failed to create backup' })
  }
})

// Restore database from JSON backup
router.post('/restore', requireAuth, async (req: any, res) => {
  try {
    // Check if user is admin
    const userRole = req.user?.role || 'ADMIN'
    if (userRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { data } = req.body
    
    if (!data) {
      return res.status(400).json({ error: 'No backup data provided' })
    }

    // Restore data (note: this is a simple restore, in production you'd want more validation)
    const results = {
      employees: 0,
      projects: 0,
      documents: 0,
      timesheets: 0,
      leaveRequests: 0,
      sponsorships: 0
    }

    // Restore employees
    if (data.employees && Array.isArray(data.employees)) {
      for (const emp of data.employees) {
        try {
          await prisma.employee.upsert({
            where: { id: emp.id },
            update: emp,
            create: emp
          })
          results.employees++
        } catch (e) {
          console.error('Error restoring employee:', e)
        }
      }
    }

    // Restore projects
    if (data.projects && Array.isArray(data.projects)) {
      for (const proj of data.projects) {
        try {
          await prisma.project.upsert({
            where: { id: proj.id },
            update: proj,
            create: proj
          })
          results.projects++
        } catch (e) {
          console.error('Error restoring project:', e)
        }
      }
    }

    // Restore documents
    if (data.documents && Array.isArray(data.documents)) {
      for (const doc of data.documents) {
        try {
          await prisma.document.upsert({
            where: { id: doc.id },
            update: doc,
            create: doc
          })
          results.documents++
        } catch (e) {
          console.error('Error restoring document:', e)
        }
      }
    }

    // Restore timesheets
    if (data.timesheets && Array.isArray(data.timesheets)) {
      for (const ts of data.timesheets) {
        try {
          await prisma.timesheet.upsert({
            where: { id: ts.id },
            update: ts,
            create: ts
          })
          results.timesheets++
        } catch (e) {
          console.error('Error restoring timesheet:', e)
        }
      }
    }

    // Restore leave requests
    if (data.leaveRequests && Array.isArray(data.leaveRequests)) {
      for (const l of data.leaveRequests) {
        try {
          await prisma.leaveRequest.upsert({
            where: { id: l.id },
            update: l,
            create: l
          })
          results.leaveRequests++
        } catch (e) {
          console.error('Error restoring leave request:', e)
        }
      }
    }

    // Restore sponsorships
    if (data.sponsorships && Array.isArray(data.sponsorships)) {
      for (const s of data.sponsorships) {
        try {
          await prisma.sponsorship.upsert({
            where: { id: s.id },
            update: s,
            create: s
          })
          results.sponsorships++
        } catch (e) {
          console.error('Error restoring sponsorship:', e)
        }
      }
    }

    res.json({ 
      message: 'Restore completed', 
      results 
    })
  } catch (error: any) {
    console.error('Restore error:', error)
    res.status(500).json({ error: 'Failed to restore backup' })
  }
})

export default router
