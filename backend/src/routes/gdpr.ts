import { Router } from 'express'
import prisma from '../prismaClient'
import { currentTenantId } from '../lib/tenantContext'
import { requireAuth } from '../middleware/auth'
import { auditLog } from '../middleware/audit'
import * as XLSX from 'xlsx'
import archiver from 'archiver'
import path from 'path'
import { getStorage, assertKeyInTenant } from '../lib/storage'
import type { Document, LeaveRequest, Timesheet } from '@prisma/client'
import { canViewAuditLogs, isHrAdminRole, isOwnerRole, normalizeRole, ROLES } from '../lib/roles'
import { requireRole } from '../middleware/roles'
import { anonymiseEmployee } from '../lib/retention'

const router = Router()

function safeArchiveName(value: string) {
  return value.replace(/[<>:"/\\|?*\x00-\x1F]/g, '-').replace(/\s+/g, ' ').trim() || 'document'
}

function auditLogFilter(query: any) {
  const { entity, action, userId, from, to } = query
  const where: any = {}
  if (entity) where.entity = entity
  if (action) where.action = action
  if (userId) where.userId = parseInt(userId as string)
  if (from || to) {
    where.timestamp = {}
    if (from) where.timestamp.gte = new Date(`${from}T00:00:00.000Z`)
    if (to) where.timestamp.lte = new Date(`${to}T23:59:59.999Z`)
  }
  return where
}

// Get audit logs (admin only)
router.get('/audit-logs', requireAuth, async (req: any, res) => {
  try {
    if (!canViewAuditLogs(req.user?.role)) {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { limit = 100, offset = 0 } = req.query
    const where = auditLogFilter(req.query)

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

// Same filters as the list, as a spreadsheet. Capped so a multi-year tenant
// cannot pull the whole table into memory in one request.
const AUDIT_EXPORT_CAP = 50000

router.get('/audit-logs/export', requireAuth, async (req: any, res) => {
  try {
    if (!canViewAuditLogs(req.user?.role)) {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const where = auditLogFilter(req.query)
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: AUDIT_EXPORT_CAP,
    })

    const rows = logs.map((l) => ({
      Timestamp: l.timestamp.toISOString(),
      User: l.userEmail ?? '',
      Action: l.action,
      Entity: l.entity,
      'Entity ID': l.entityId ?? '',
      Details: l.details ?? '',
      'IP Address': l.ipAddress ?? '',
      'User Agent': l.userAgent ?? '',
    }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Audit Log')
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    await auditLog(req, 'EXPORT', 'AuditLog', undefined, {
      count: logs.length,
      truncated: logs.length === AUDIT_EXPORT_CAP,
      filters: req.query,
    })

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename=audit-log-${new Date().toISOString().split('T')[0]}.xlsx`)
    res.send(buffer)
  } catch (error: any) {
    console.error('Error exporting audit logs:', error)
    res.status(500).json({ error: 'Failed to export audit logs' })
  }
})

// Subject Access Request - Export all personal data for an employee
router.get('/subject-access-request/:employeeId', requireAuth, async (req: any, res) => {
  try {
    const { employeeId } = req.params
    const userEmail = req.user?.email

    // Check permissions - admin or the employee themselves
    if (!isOwnerRole(req.user?.role)) {
      const employee = await prisma.employee.findFirst({ where: { id: parseInt(employeeId) } })
      if (!employee || employee.email !== userEmail) {
        return res.status(403).json({ error: 'Access denied' })
      }
    }

    // Fetch all data for the employee
    const employee = await prisma.employee.findFirst({
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
    const user = await prisma.user.findFirst({
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
    const userEmail = req.user?.email

    // Check permissions
    if (!isOwnerRole(req.user?.role)) {
      const employee = await prisma.employee.findFirst({ where: { id: parseInt(employeeId) } })
      if (!employee || employee.email !== userEmail) {
        return res.status(403).json({ error: 'Access denied' })
      }
    }

    const employee = await prisma.employee.findFirst({
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

// Export all HRM data and uploaded document files as a single ZIP backup.
router.get('/export-all', requireAuth, async (req: any, res) => {
  try {
    const userRole = normalizeRole(req.user?.role)
    if (userRole !== ROLES.ADMIN) {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const [
      users,
      employees,
      projects,
      documents,
      timesheets,
      leaveRequests,
      sponsorships,
      sponsorshipComplianceEvidence,
      sponsorshipReportableEvents,
      dataConsents,
      auditLogs,
      googleAccounts,
    ] = await Promise.all([
      prisma.user.findMany(),
      prisma.employee.findMany(),
      prisma.project.findMany(),
      prisma.document.findMany({ include: { employee: true } }),
      prisma.timesheet.findMany(),
      prisma.leaveRequest.findMany(),
      prisma.sponsorship.findMany(),
      prisma.sponsorshipComplianceEvidence.findMany(),
      prisma.sponsorshipReportableEvent.findMany(),
      prisma.dataConsent.findMany(),
      prisma.auditLog.findMany({ orderBy: { timestamp: 'desc' } }),
      prisma.googleAccount.findMany(),
    ])

    const store = getStorage()
    const documentManifest = await Promise.all(
      documents.map(async (document) => ({
        id: document.id,
        employeeId: document.employeeId,
        employeeName: document.employee ? `${document.employee.firstName} ${document.employee.lastName}` : null,
        name: document.name,
        type: document.type,
        path: document.path,
        uploadedAt: document.uploadedAt,
        expiryDate: document.expiryDate,
        includedInZip: await store.exists(document.path),
      })),
    )

    const backup = {
      exportDate: new Date().toISOString(),
      requestedBy: req.user?.email,
      version: '2.0',
      includes: {
        databaseJson: true,
        documentMetadata: true,
        documentFiles: true,
      },
      data: {
        users: users.map((user: any) => ({ ...user, password: '[REDACTED]' })),
        employees,
        projects,
        documents: documentManifest,
        timesheets,
        leaveRequests,
        sponsorships,
        sponsorshipComplianceEvidence,
        sponsorshipReportableEvents,
        dataConsents,
        auditLogs,
        googleAccounts: googleAccounts.map((account: any) => ({
          ...account,
          refreshToken: account.refreshToken ? '[REDACTED]' : account.refreshToken,
          accessToken: account.accessToken ? '[REDACTED]' : account.accessToken,
        })),
      },
    }

    const filename = `onsidehr-full-backup-${new Date().toISOString().split('T')[0]}.zip`
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    const archive = archiver('zip', { zlib: { level: 9 } })
    archive.on('error', (error) => {
      throw error
    })
    archive.pipe(res)

    archive.append(JSON.stringify(backup, null, 2), { name: 'data/backup.json' })
    archive.append(JSON.stringify(documentManifest, null, 2), { name: 'data/documents-manifest.json' })

    for (const document of documents) {
      assertKeyInTenant(document.path)
      if (!(await store.exists(document.path))) continue

      const employeeFolder = document.employee
        ? `${document.employeeId}-${safeArchiveName(`${document.employee.firstName} ${document.employee.lastName}`)}`
        : `${document.employeeId}-employee`
      const extension = path.extname(document.path)
      const archiveName = `documents/${employeeFolder}/${document.id}-${safeArchiveName(document.name)}${extension && !document.name.endsWith(extension) ? extension : ''}`
      archive.append(await store.getStream(document.path), { name: archiveName })
    }

    await auditLog(req, 'DATA_EXPORT', 'System', undefined, {
      type: 'Full backup',
      documentCount: documents.length,
      includedDocumentFiles: documentManifest.filter((document) => document.includedInZip).length,
    })

    await archive.finalize()
  } catch (error: any) {
    console.error('Error exporting all data:', error)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to export all data' })
    }
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
        tenantId: currentTenantId(),
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
    const userEmail = req.user?.email

    // Check permissions
    if (!isOwnerRole(req.user?.role)) {
      const employee = await prisma.employee.findFirst({ where: { id: parseInt(employeeId) } })
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

// Right to erasure. Refused while a legal duty to keep the record is live —
// an active sponsorship (Appendix D) or an unexpired retention date — unless
// the owner overrides with `force`, which the audit row records.
router.post('/erase/:employeeId', requireAuth, requireRole('ADMIN'), async (req: any, res) => {
  const employeeId = Number(req.params.employeeId)
  const { reason, force } = req.body ?? {}
  if (!reason || !String(reason).trim()) return res.status(400).json({ error: 'reason is required' })

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId },
    include: { sponsorships: { where: { active: true }, select: { id: true } } },
  })
  if (!employee) return res.status(404).json({ error: 'Employee not found' })
  if (employee.anonymisedAt) return res.status(409).json({ error: 'Employee record is already anonymised' })
  if (employee.id === req.user?.employeeId) return res.status(400).json({ error: 'You cannot erase your own record' })

  const blockers: string[] = []
  if (employee.sponsorships.length > 0) blockers.push('active sponsorship')
  if (employee.retainUntil && employee.retainUntil > new Date())
    blockers.push(`retention period runs until ${employee.retainUntil.toISOString().slice(0, 10)}`)
  if (!employee.endDate) blockers.push('employment has not ended')
  if (blockers.length && !force) {
    return res.status(409).json({ error: `Cannot erase: ${blockers.join('; ')}`, blockers })
  }

  try {
    const outcome = await anonymiseEmployee(employeeId)
    await auditLog(req, 'ERASURE', 'Employee', employeeId, {
      reason: String(reason).trim(),
      forced: Boolean(force) && blockers.length > 0,
      overriddenBlockers: force ? blockers : [],
      ...outcome,
    })
    res.json({ success: true, ...outcome })
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

export default router
