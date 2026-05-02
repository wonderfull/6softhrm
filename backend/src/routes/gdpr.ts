import { Router } from 'express'
import prisma from '../prismaClient'
import { requireAuth } from '../middleware/auth'
import { auditLog } from '../middleware/audit'
import * as XLSX from 'xlsx'
import type { Document, LeaveRequest, Timesheet } from '@prisma/client'
import { isHrAdminRole, normalizeRole, ROLES } from '../lib/roles'

const router = Router()

// Get audit logs (admin only)
router.get('/audit-logs', requireAuth, async (req: any, res) => {
  try {
    const userRole = req.user?.role || 'USER'
    if (userRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { limit = 100, offset = 0, entity, action, userId } = req.query
    
    const where: any = {}
    if (entity) where.entity = entity
    if (action) where.action = action
    if (userId) where.userId = parseInt(userId as string)

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string)
    })

    const total = await prisma.auditLog.count({ where })

    await auditLog(req, 'READ', 'AuditLog', undefined, { count: logs.length })

    res.json({ logs, total, limit, offset })
  } catch (error: any) {
    console.error('Error fetching audit logs:', error)
    res.status(500).json({ error: 'Failed to fetch audit logs' })
  }
})

// Subject Access Request - Export all personal data for an employee
router.get('/subject-access-request/:employeeId', requireAuth, async (req: any, res) => {
  try {
    const { employeeId } = req.params
    const userRole = req.user?.role || 'USER'
    const userEmail = req.user?.email

    // Check permissions - admin or the employee themselves
    if (userRole !== 'ADMIN') {
      const employee = await prisma.employee.findUnique({ where: { id: parseInt(employeeId) } })
      if (!employee || employee.email !== userEmail) {
        return res.status(403).json({ error: 'Access denied' })
      }
    }

    // Fetch all data for the employee
    const employee = await prisma.employee.findUnique({
      where: { id: parseInt(employeeId) },
      include: {
        sponsorships: true,
        documents: true,
        timesheets: {
          include: { project: true }
        },
        leaveRequests: true
      }
    })

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' })
    }

    // Get related user account if exists
    const user = await prisma.user.findUnique({
      where: { email: employee.email },
      select: { id: true, email: true, name: true, role: true, createdAt: true }
    })

    // Get audit logs for this employee
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { entityId: parseInt(employeeId), entity: 'Employee' },
          { userEmail: employee.email }
        ]
      },
      orderBy: { timestamp: 'desc' }
    })

    // Get consent records
    const consents = await prisma.dataConsent.findMany({
      where: { employeeId: parseInt(employeeId) }
    })

    const exportData = {
      exportDate: new Date().toISOString(),
      requestedBy: req.user?.email,
      employee: {
        ...employee,
        sponsorships: employee.sponsorships,
        documents: employee.documents.map((d: Document) => ({
          id: d.id,
          name: d.name,
          uploadedAt: d.uploadedAt,
          path: d.path
        })),
        timesheets: employee.timesheets,
        leaveRequests: employee.leaveRequests
      },
      userAccount: user,
      auditLogs: auditLogs.slice(0, 1000), // Limit to recent 1000 logs
      consents
    }

    await auditLog(req, 'DATA_EXPORT', 'Employee', parseInt(employeeId), { type: 'Subject Access Request' })

    res.json(exportData)
  } catch (error: any) {
    console.error('Error processing subject access request:', error)
    res.status(500).json({ error: 'Failed to process request' })
  }
})

// Export employee data to Excel (GDPR compliant export)
router.get('/export-employee-data/:employeeId', requireAuth, async (req: any, res) => {
  try {
    const { employeeId } = req.params
    const userRole = req.user?.role || 'USER'
    const userEmail = req.user?.email

    // Check permissions
    if (userRole !== 'ADMIN') {
      const employee = await prisma.employee.findUnique({ where: { id: parseInt(employeeId) } })
      if (!employee || employee.email !== userEmail) {
        return res.status(403).json({ error: 'Access denied' })
      }
    }

    const employee = await prisma.employee.findUnique({
      where: { id: parseInt(employeeId) },
      include: {
        sponsorships: true,
        documents: true,
        timesheets: { include: { project: true } },
        leaveRequests: true
      }
    })

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' })
    }

    // Create workbook
    const wb = XLSX.utils.book_new()

    // Personal Info sheet
    const personalData = [{
      'First Name': employee.firstName,
      'Last Name': employee.lastName,
      'Email': employee.email,
      'Phone': employee.phoneNumber || '',
      'Job Title': employee.jobTitle || '',
      'Department': employee.department || '',
      'Employee Type': employee.employeeType,
      'NI Number': employee.niNumber || '',
      'Start Date': employee.startDate ? new Date(employee.startDate).toLocaleDateString() : '',
      'Bank Name': employee.bankName || '',
      'Sort Code': employee.sortCode || '',
      'Account Number': employee.accountNumber || '',
      'Emergency Contact Name': employee.emergencyContactName || '',
      'Emergency Contact Phone': employee.emergencyContactPhone || '',
      'Emergency Contact Relation': employee.emergencyContactRelation || ''
    }]
    const wsPersonal = XLSX.utils.json_to_sheet(personalData)
    XLSX.utils.book_append_sheet(wb, wsPersonal, 'Personal Data')

    // Timesheets sheet
    if (employee.timesheets.length > 0) {
      const timesheetData = employee.timesheets.map((ts: Timesheet & { project: { name: string } | null }) => ({
        'Date': new Date(ts.date).toLocaleDateString(),
        'Project': ts.project?.name || 'No Project',
        'Hours': ts.hours,
        'Notes': ts.notes || ''
      }))
      const wsTimesheets = XLSX.utils.json_to_sheet(timesheetData)
      XLSX.utils.book_append_sheet(wb, wsTimesheets, 'Timesheets')
    }

    // Leave Requests sheet
    if (employee.leaveRequests.length > 0) {
      const leaveData = employee.leaveRequests.map((lr: LeaveRequest) => ({
        'Type': lr.type,
        'Start Date': new Date(lr.startDate).toLocaleDateString(),
        'End Date': new Date(lr.endDate).toLocaleDateString(),
        'Status': lr.status,
        'Reason': lr.reason || ''
      }))
      const wsLeave = XLSX.utils.json_to_sheet(leaveData)
      XLSX.utils.book_append_sheet(wb, wsLeave, 'Leave Requests')
    }

    // Documents sheet
    if (employee.documents.length > 0) {
      const docData = employee.documents.map((d: Document) => ({
        'Document Name': d.name,
        'Upload Date': new Date(d.uploadedAt).toLocaleDateString(),
        'File Path': d.path
      }))
      const wsDocs = XLSX.utils.json_to_sheet(docData)
      XLSX.utils.book_append_sheet(wb, wsDocs, 'Documents')
    }

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    await auditLog(req, 'DATA_EXPORT', 'Employee', parseInt(employeeId), { format: 'Excel' })

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename=employee-${employeeId}-data-${new Date().toISOString().split('T')[0]}.xlsx`)
    res.send(buffer)
  } catch (error: any) {
    console.error('Error exporting employee data:', error)
    res.status(500).json({ error: 'Failed to export data' })
  }
})

// Record or update consent
router.post('/consent', requireAuth, async (req: any, res) => {
  try {
    const { employeeId, consentType, consentGiven, version } = req.body
    
    if (!employeeId || !consentType || consentGiven === undefined) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const targetEmployeeId = parseInt(employeeId)
    const userRole = normalizeRole(req.user?.role)
    if (userRole === ROLES.EMPLOYEE) {
      if (!req.user?.employeeId) {
        return res.status(403).json({ error: 'User account is not linked to an employee record' })
      }
      if (req.user.employeeId !== targetEmployeeId) {
        return res.status(403).json({ error: 'Unauthorized' })
      }
    } else if (!isHrAdminRole(userRole)) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    const ipAddress = req.ip || req.connection.remoteAddress || null

    const consent = await prisma.dataConsent.create({
      data: {
        employeeId: targetEmployeeId,
        consentType,
        consentGiven,
        consentDate: consentGiven ? new Date() : null,
        withdrawnDate: consentGiven ? null : new Date(),
        ipAddress,
        version
      }
    })

    await auditLog(req, consentGiven ? 'CONSENT_GIVEN' : 'CONSENT_WITHDRAWN', 'DataConsent', consent.id, { consentType, employeeId: targetEmployeeId })

    res.json(consent)
  } catch (error: any) {
    console.error('Error recording consent:', error)
    res.status(500).json({ error: 'Failed to record consent' })
  }
})

// Get consent history for an employee
router.get('/consent/:employeeId', requireAuth, async (req: any, res) => {
  try {
    const { employeeId } = req.params
    const userRole = req.user?.role || 'USER'
    const userEmail = req.user?.email

    // Check permissions
    if (userRole !== 'ADMIN') {
      const employee = await prisma.employee.findUnique({ where: { id: parseInt(employeeId) } })
      if (!employee || employee.email !== userEmail) {
        return res.status(403).json({ error: 'Access denied' })
      }
    }

    const consents = await prisma.dataConsent.findMany({
      where: { employeeId: parseInt(employeeId) },
      orderBy: { createdAt: 'desc' }
    })

    res.json(consents)
  } catch (error: any) {
    console.error('Error fetching consents:', error)
    res.status(500).json({ error: 'Failed to fetch consents' })
  }
})

export default router
