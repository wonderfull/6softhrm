import { Router } from 'express'
import prisma from '../prismaClient'
import { requireAuth } from '../middleware/auth'
import fs from 'fs/promises'
import path from 'path'
import bcrypt from 'bcryptjs'

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

// Seed sample data (employees, projects, timesheets, leave, sponsorships)
router.post('/seed-data', requireAuth, async (req: any, res) => {
  try {
    // Check if user is admin
    const userRole = req.user?.role || 'USER'
    if (userRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const results = {
      employees: 0,
      projects: 0,
      timesheets: 0,
      leaveRequests: 0,
      sponsorships: 0,
      users: 0
    }

    // Create sample employees
    const employees = [
      {
        firstName: 'John', lastName: 'Smith', title: 'Mr', email: 'john.smith@company.com',
        phoneNumber: '+44 7700 900001', niNumber: 'AB123456C', jobTitle: 'Senior Developer',
        employeeType: 'EMPLOYEE', department: 'Engineering', startDate: new Date('2023-01-15'),
        bankName: 'Barclays', accountNumber: '12345678', sortCode: '20-00-00',
        emergencyContactName: 'Jane Smith', emergencyContactPhone: '+44 7700 900002',
        emergencyContactRelation: 'Spouse', emergencyContactAddress: '123 High Street, London, SW1A 1AA'
      },
      {
        firstName: 'Sarah', lastName: 'Johnson', title: 'Ms', email: 'sarah.johnson@company.com',
        phoneNumber: '+44 7700 900003', niNumber: 'CD234567D', jobTitle: 'Product Manager',
        employeeType: 'EMPLOYEE', department: 'Product', startDate: new Date('2023-03-20'),
        bankName: 'HSBC', accountNumber: '23456789', sortCode: '40-00-00',
        emergencyContactName: 'Mike Johnson', emergencyContactPhone: '+44 7700 900004',
        emergencyContactRelation: 'Spouse', emergencyContactAddress: '456 Park Lane, Manchester, M1 1AA'
      },
      {
        firstName: 'Michael', lastName: 'Brown', title: 'Mr', email: 'michael.brown@company.com',
        phoneNumber: '+44 7700 900005', niNumber: 'EF345678E', jobTitle: 'UX Designer',
        employeeType: 'EMPLOYEE', department: 'Design', startDate: new Date('2023-06-10'),
        bankName: 'Lloyds', accountNumber: '34567890', sortCode: '30-00-00',
        emergencyContactName: 'Emma Brown', emergencyContactPhone: '+44 7700 900006',
        emergencyContactRelation: 'Partner', emergencyContactAddress: '789 Queen Street, Birmingham, B1 1AA'
      },
      {
        firstName: 'Emily', lastName: 'Davis', title: 'Ms', email: 'emily.davis@company.com',
        phoneNumber: '+44 7700 900007', niNumber: 'GH456789F', jobTitle: 'HR Manager',
        employeeType: 'EMPLOYEE', department: 'Human Resources', startDate: new Date('2022-09-01'),
        bankName: 'NatWest', accountNumber: '45678901', sortCode: '60-00-00',
        emergencyContactName: 'Tom Davis', emergencyContactPhone: '+44 7700 900008',
        emergencyContactRelation: 'Brother', emergencyContactAddress: '321 King Road, Leeds, LS1 1AA'
      }
    ]

    console.log('[SEED] Creating/updating employees...')
    for (const emp of employees) {
      const created = await prisma.employee.upsert({
        where: { email: emp.email },
        update: emp,
        create: emp
      })
      results.employees++
      console.log(`[SEED] Employee ${created.id}: ${emp.email}`)
      
      // Create user account for first two employees
      if (results.employees <= 2) {
        try {
          const password = await bcrypt.hash('password123', 10)
          const user = await prisma.user.upsert({
            where: { email: emp.email },
            update: {
              name: `${emp.firstName} ${emp.lastName}`,
              employeeId: created.id
            },
            create: {
              email: emp.email,
              password,
              role: 'USER',
              name: `${emp.firstName} ${emp.lastName}`,
              employeeId: created.id
            }
          })
          results.users++
          console.log(`[SEED] User ${user.id}: ${emp.email}`)
        } catch (e: any) {
          console.log('[SEED] User upsert error:', emp.email, e.message)
        }
      }
    }
    console.log(`[SEED] Employees created/updated: ${results.employees}, Users: ${results.users}`)

    // Create sample projects
    const projects = [
      { code: 'HRMS', name: 'HR Management System', description: 'Internal HR system development', active: true },
      { code: 'WEBAPP', name: 'Customer Web Portal', description: 'Public-facing customer portal', active: true },
      { code: 'MOBILE', name: 'Mobile App Development', description: 'iOS and Android mobile applications', active: true },
      { code: 'API', name: 'API Integration', description: 'Third-party API integration project', active: true }
    ]

    console.log('[SEED] Creating/updating projects...')
    for (const proj of projects) {
      const created = await prisma.project.upsert({
        where: { code: proj.code },
        update: proj,
        create: proj
      })
      results.projects++
      console.log(`[SEED] Project ${created.id}: ${proj.code}`)
    }
    console.log(`[SEED] Projects created/updated: ${results.projects}`)

    // Get created employee and project IDs
    const empRecords = await prisma.employee.findMany({ take: 4 })
    const projRecords = await prisma.project.findMany({ take: 4 })
    console.log(`[SEED] Found ${empRecords.length} employees and ${projRecords.length} projects`)

    if (empRecords.length === 0 || projRecords.length === 0) {
      return res.status(400).json({ error: 'No employees or projects found. Please create them first.' })
    }

    // Delete existing sample data first (timesheets, leave, sponsorships for these employees)
    console.log('[SEED] Clearing old timesheets, leave, sponsorships...')
    await prisma.timesheet.deleteMany({
      where: { employeeId: { in: empRecords.map(e => e.id) } }
    })
    await prisma.leaveRequest.deleteMany({
      where: { employeeId: { in: empRecords.map(e => e.id) } }
    })
    await prisma.sponsorship.deleteMany({
      where: { employeeId: { in: empRecords.map(e => e.id) } }
    })

    // Create sample timesheets
    console.log('[SEED] Creating timesheets...')
    const timesheets = [
      { employeeId: empRecords[0].id, projectId: projRecords[0].id, date: new Date('2025-11-18'), hours: 8, notes: 'Working on employee module' },
      { employeeId: empRecords[0].id, projectId: projRecords[0].id, date: new Date('2025-11-19'), hours: 7.5, notes: 'Bug fixes and testing' },
      { employeeId: empRecords[1].id, projectId: projRecords[1].id, date: new Date('2025-11-18'), hours: 8, notes: 'Sprint planning' },
      { employeeId: empRecords[1].id, projectId: projRecords[1].id, date: new Date('2025-11-19'), hours: 7, notes: 'Stakeholder meetings' }
    ]

    for (const ts of timesheets) {
      await prisma.timesheet.create({ data: ts })
      results.timesheets++
    }
    console.log(`[SEED] Timesheets created: ${results.timesheets}`)

    // Create sample leave requests
    console.log('[SEED] Creating leave requests...')
    const leaveRequests = [
      { employeeId: empRecords[0].id, type: 'Annual Leave', startDate: new Date('2025-12-23'), endDate: new Date('2025-12-27'), status: 'PENDING', reason: 'Christmas holiday' },
      { employeeId: empRecords[1].id, type: 'Sick Leave', startDate: new Date('2025-11-10'), endDate: new Date('2025-11-11'), status: 'APPROVED', reason: 'Flu' }
    ]

    for (const lr of leaveRequests) {
      await prisma.leaveRequest.create({ data: lr })
      results.leaveRequests++
    }
    console.log(`[SEED] Leave requests created: ${results.leaveRequests}`)

    // Create sample sponsorships
    console.log('[SEED] Creating sponsorships...')
    const sponsorships = [
      { 
        employeeId: empRecords[0].id, 
        visaType: 'Tier 2 (Skilled Worker)', 
        casNumber: 'CAS12345678', 
        sponsorLicenseNumber: 'SPL123456',
        startDate: new Date('2023-01-01'), 
        endDate: new Date('2026-01-01'), 
        complianceNotes: 'Initial sponsorship - all documents verified',
        active: true
      },
      { 
        employeeId: empRecords[1].id, 
        visaType: 'Tier 2 (Skilled Worker)', 
        casNumber: 'CAS23456789',
        sponsorLicenseNumber: 'SPL123456', 
        startDate: new Date('2023-03-01'), 
        endDate: new Date('2025-12-15'), 
        complianceNotes: 'Expiring soon - needs renewal',
        active: true
      }
    ]

    for (const sp of sponsorships) {
      await prisma.sponsorship.create({ data: sp })
      results.sponsorships++
    }
    console.log(`[SEED] Sponsorships created: ${results.sponsorships}`)
    console.log(`[SEED] Final results:`, results)

    res.json({ 
      message: 'Sample data seeded successfully', 
      results,
      note: 'User accounts created: john.smith@company.com and sarah.johnson@company.com with password: password123'
    })
  } catch (error: any) {
    console.error('Seed error:', error)
    res.status(500).json({ error: 'Failed to seed data: ' + error.message })
  }
})

// Clear all data EXCEPT users (dangerous!)
router.post('/clear-data', requireAuth, async (req: any, res) => {
  try {
    // Check if user is admin
    const userRole = req.user?.role || 'USER'
    if (userRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const results = {
      timesheets: 0,
      leaveRequests: 0,
      sponsorships: 0,
      documents: 0,
      employees: 0,
      projects: 0
    }

    // Delete in correct order due to foreign keys
    const deletedTimesheets = await prisma.timesheet.deleteMany({})
    results.timesheets = deletedTimesheets.count

    const deletedLeave = await prisma.leaveRequest.deleteMany({})
    results.leaveRequests = deletedLeave.count

    const deletedSponsors = await prisma.sponsorship.deleteMany({})
    results.sponsorships = deletedSponsors.count

    const deletedDocs = await prisma.document.deleteMany({})
    results.documents = deletedDocs.count

    // Unlink users from employees before deleting employees
    await prisma.user.updateMany({
      where: { employeeId: { not: null } },
      data: { employeeId: null }
    })

    const deletedEmployees = await prisma.employee.deleteMany({})
    results.employees = deletedEmployees.count

    const deletedProjects = await prisma.project.deleteMany({})
    results.projects = deletedProjects.count

    res.json({ 
      message: 'All data cleared (users preserved)', 
      results 
    })
  } catch (error: any) {
    console.error('Clear error:', error)
    res.status(500).json({ error: 'Failed to clear data: ' + error.message })
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
