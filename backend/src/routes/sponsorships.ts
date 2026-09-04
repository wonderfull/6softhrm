import { Router } from 'express'
import archiver from 'archiver'
import prisma from '../prismaClient'
import { currentTenantId } from '../lib/tenantContext'
import { requireAuth } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import { auditLog } from '../middleware/audit'
import {
  canManageSponsorshipCompliance,
  canUploadSponsorshipEvidence,
  canViewSponsorships,
  normalizeRole,
  ROLES,
} from '../lib/roles'
import {
  WorkingDayConfig,
  addUtcDays,
  addWorkingDays,
} from '../lib/workingDays'
import {
  APPENDIX_D_KEYS,
  assessCompleteness,
  collectLatestEvidence,
  isSponsoredRoute,
  sponsorRetentionUntil,
} from '../lib/appendixD'
import { loadWorkingDayConfig } from '../lib/tenantSettings'
import { getStorage, assertKeyInTenant } from '../lib/storage'
import { scoreReadiness } from '../lib/auditReadiness'
import { guidanceSummary } from '../lib/guidanceVersion'
import { assessPeriods } from '../lib/salaryReconciliation'

const router = Router()

const REPORTABLE_EVENT_TYPES = new Set([
  'DELAYED_START',
  'UNAUTHORISED_ABSENCE_10_DAYS',
  'EMPLOYMENT_ENDED',
  'WORK_LOCATION_CHANGED',
  'UNPAID_LEAVE_OVER_4_WEEKS',
  'SALARY_BELOW_COS',
])

function summarizeEmployee(employee: any) {
  return {
    id: employee.id,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    jobTitle: employee.jobTitle,
  }
}

// Human-readable index so an auditor opening the ZIP sees the state of the file
// immediately, including what is absent — omissions are the point of an audit.
function buildPackIndex(pack: any, employee: any) {
  const lines: string[] = []
  lines.push(`# Appendix D audit pack — ${employee.firstName} ${employee.lastName}`)
  lines.push('')
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push(`Evidence complete: ${pack.completeCount}/${pack.requiredCount} (${pack.completenessPercentage}%)`)
  if (pack.retainUntil) {
    lines.push(`Retain until: ${new Date(pack.retainUntil).toISOString().slice(0, 10)} (sponsorship end + 1 year)`)
  }
  lines.push('')
  lines.push('| Evidence | Reference | Status | Verified | File |')
  lines.push('|---|---|---|---|---|')
  for (const item of pack.requiredEvidence) {
    const file = item.evidence?.document?.name ?? '—'
    lines.push(
      `| ${item.label} | ${item.reference} | ${item.status} | ${item.verified ? 'yes' : 'no'} | ${file} |`,
    )
  }
  lines.push('')
  const missing = pack.requiredEvidence.filter((i: any) => i.status === 'MISSING')
  if (missing.length) {
    lines.push('## Missing evidence')
    for (const item of missing) lines.push(`- ${item.label} (${item.reference})`)
  } else {
    lines.push('All required evidence is present.')
  }
  lines.push('')
  return lines.join('\n')
}

function buildCompliancePack(sponsorship: any) {
  const existingEvidence = sponsorship.complianceEvidence || []
  const completeness = assessCompleteness(collectLatestEvidence(sponsorship), {
    sponsored: isSponsoredRoute(sponsorship),
  })
  const requiredEvidence = completeness.items

  return {
    sponsorship: {
      id: sponsorship.id,
      visaType: sponsorship.visaType,
      sponsorLicenseNumber: sponsorship.sponsorLicenseNumber,
      cosType: sponsorship.cosType,
      cosAssignedDate: sponsorship.cosAssignedDate,
      cosStartBy: sponsorship.cosStartBy,
      startDate: sponsorship.startDate,
      endDate: sponsorship.endDate,
      active: sponsorship.active,
      sponsoredRoute: isSponsoredRoute(sponsorship),
    },
    employee: summarizeEmployee(sponsorship.employee),
    requiredEvidence,
    existingEvidence,
    missingCount: completeness.missingCount,
    completeCount: completeness.completeCount,
    requiredCount: completeness.requiredCount,
    completenessPercentage: completeness.percentage,
    guidance: guidanceSummary(),
    retainUntil: sponsorRetentionUntil(sponsorship.endDate ?? null),
  }
}

function parseRequiredDate(value: unknown) {
  if (typeof value !== 'string' || value.trim() === '') return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function buildDelayedStartAlert(sponsorship: any, config: WorkingDayConfig) {
  const eventDate = addUtcDays(sponsorship.startDate, 28)

  return {
    id: null,
    sponsorshipId: sponsorship.id,
    eventType: 'DELAYED_START',
    eventDate,
    dueDate: addWorkingDays(eventDate, 10, config),
    status: 'OPEN',
    notes: 'Sponsored worker has not started within 28 days of expected start date',
    reportedAt: null,
    reportedBy: null,
    createdAt: new Date(),
    alertSource: 'AUTO',
    sponsorship,
  }
}

async function findAuthorizedSponsorshipForCompliance(req: any, res: any, id: number) {
  const user = req.user
  const role = normalizeRole(user?.role)

  const sponsorship = await prisma.sponsorship.findFirst({
    where: { id },
    include: {
      employee: {
        include: {
          rightToWorkChecks: {
            orderBy: { checkDate: 'desc' },
            take: 1,
            include: { document: true },
          },
        },
      },
      complianceEvidence: {
        include: { document: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!sponsorship) {
    res.status(404).json({ error: 'Sponsorship not found' })
    return null
  }

  if (role === ROLES.EMPLOYEE) {
    if (!user.employeeId || sponsorship.employeeId !== user.employeeId) {
      res.status(404).json({ error: 'Sponsorship not found' })
      return null
    }

    return sponsorship
  }

  if (!canManageSponsorshipCompliance(role)) {
    res.status(403).json({ error: 'forbidden' })
    return null
  }

  return sponsorship
}

// List sponsorships
router.get('/', requireAuth, async (req: any, res) => {
  const user = req.user
  const role = normalizeRole(user?.role)

  if (role === ROLES.EMPLOYEE) {
    if (!user.employeeId) return res.json([])

    const ownItems = await prisma.sponsorship.findMany({
      where: { employeeId: user.employeeId },
      include: { employee: true },
    })
    await auditLog(req, 'READ', 'Sponsorship', undefined, {
      selfAccess: true,
      count: ownItems.length,
    })
    return res.json(ownItems)
  }

  if (!canViewSponsorships(role)) {
    return res.status(403).json({ error: 'forbidden' })
  }

  const items = await prisma.sponsorship.findMany({ include: { employee: true } })
  await auditLog(req, 'READ', 'Sponsorship', undefined, { count: items.length })
  res.json(items)
})

// Get expiring sponsorships (for dashboard alerts)
// Audit-readiness score for the whole tenant. Every input is returned with the
// number so it is always explainable, and drillable, rather than a bare score.
router.get('/audit-readiness', requireAuth, requireRole('ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT'), async (req: any, res) => {
  try {
    const now = new Date()
    const in30Days = addUtcDays(now, 30)

    // Scoring only needs evidence presence and verification, so the evidence
    // documents themselves are deliberately not selected.
    const sponsorships = await prisma.sponsorship.findMany({
      where: { active: true },
      include: {
        employee: {
          select: {
            niNumber: true,
            rightToWorkChecks: {
              orderBy: { checkDate: 'desc' },
              take: 1,
              select: { id: true, checkDate: true, outcome: true, method: true },
            },
          },
        },
        complianceEvidence: {
          select: { evidenceType: true, verifiedAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    const sponsoredEmployeeIds = sponsorships.map((s) => s.employeeId)
    const withCosTerms = sponsorships.filter((s) => s.cosSalary || s.goingRateSalary)

    // One query for every sponsored worker's pay, grouped in memory — this ran
    // per sponsorship, so a 60-worker tenant issued 60 serial queries per load.
    const payRecords = await prisma.payRecord.findMany({
      where: { employeeId: { in: withCosTerms.map((s) => s.employeeId) } },
    })
    const payByEmployee = new Map<number, typeof payRecords>()
    for (const record of payRecords) {
      const list = payByEmployee.get(record.employeeId)
      if (list) list.push(record)
      else payByEmployee.set(record.employeeId, [record])
    }

    let completenessTotal = 0
    let missingCosTerms = 0
    let salaryFailures = 0

    for (const sponsorship of sponsorships) {
      completenessTotal += assessCompleteness(collectLatestEvidence(sponsorship), {
        sponsored: isSponsoredRoute(sponsorship),
      }).percentage

      if (!sponsorship.cosSalary && !sponsorship.goingRateSalary) {
        missingCosTerms += 1
        continue
      }
      salaryFailures += assessPeriods(payByEmployee.get(sponsorship.employeeId) ?? [], {
        cosSalary: sponsorship.cosSalary,
        goingRateSalary: sponsorship.goingRateSalary,
      }).filter((a) => !a.compliant).length
    }

    const [openEvents, overdueEvents, expiringVisas, unknownAbsences] = await Promise.all([
      prisma.sponsorshipReportableEvent.count({ where: { status: 'OPEN' } }),
      prisma.sponsorshipReportableEvent.count({
        where: { status: 'OPEN', dueDate: { lt: now } },
      }),
      prisma.employee.count({
        where: {
          id: { in: sponsoredEmployeeIds },
          visaExpiryDate: { gte: now, lte: in30Days },
        },
      }),
      prisma.absenceRecord.count({ where: { status: 'UNKNOWN' } }),
    ])

    const report = scoreReadiness({
      evidenceCompleteness: sponsorships.length
        ? completenessTotal / sponsorships.length
        : 100,
      overdueEvents,
      // Overdue events are already penalised far more heavily; don't count twice.
      openEvents: Math.max(0, openEvents - overdueEvents),
      expiringDocuments: expiringVisas,
      unresolvedAbsenceFlags: unknownAbsences,
      salaryFailures,
      sponsorshipsMissingCosTerms: missingCosTerms,
      activeSponsorships: sponsorships.length,
    })

    res.json({
      ...report,
      activeSponsorships: sponsorships.length,
      generatedAt: now,
      guidance: guidanceSummary(),
    })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/expiring', requireAuth, async (req: any, res) => {
  try {
    const user = req.user
    const role = normalizeRole(user?.role)
    const now = new Date()
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

    const whereClause: any = {
      endDate: {
        not: null,
        gte: now,
        lte: thirtyDaysFromNow,
      },
    }

    if (role === ROLES.EMPLOYEE) {
      if (!user.employeeId) return res.json([])
      whereClause.employeeId = user.employeeId
    } else if (!canViewSponsorships(role)) {
      return res.status(403).json({ error: 'forbidden' })
    }

    const expiringSponsorships = await prisma.sponsorship.findMany({
      where: whereClause,
      include: { employee: true },
      orderBy: { endDate: 'asc' },
    })

    await auditLog(req, 'READ', 'Sponsorship', undefined, {
      expiring: true,
      count: expiringSponsorships.length,
      selfAccess: role === ROLES.EMPLOYEE,
    })
    res.json(expiringSponsorships)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// List open reportable sponsorship events
router.get('/reportable-events/open', requireAuth, requireRole('ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT'), async (req: any, res) => {
  try {
    const now = new Date()
    const delayedStartCutoff = addUtcDays(now, -28)
    const events = await prisma.sponsorshipReportableEvent.findMany({
      where: { status: 'OPEN' },
      include: {
        sponsorship: {
          include: { employee: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    })
    const delayedStartEventSponsorshipIds = new Set(
      events
        .filter((event) => event.eventType === 'DELAYED_START')
        .map((event) => event.sponsorshipId),
    )
    const delayedStartSponsorships = await prisma.sponsorship.findMany({
      where: {
        active: true,
        startDate: { lte: delayedStartCutoff },
        employee: { startDate: null },
        id: { notIn: Array.from(delayedStartEventSponsorshipIds) },
      },
      include: { employee: true },
    })
    const workingDayConfig = await loadWorkingDayConfig(currentTenantId())
    const delayedStartAlerts = delayedStartSponsorships.map((sponsorship) =>
      buildDelayedStartAlert(sponsorship, workingDayConfig),
    )
    const openItems = [...events, ...delayedStartAlerts].sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    )

    await auditLog(req, 'READ', 'SponsorshipReportableEvent', undefined, {
      status: 'OPEN',
      count: openItems.length,
    })
    res.json(openItems)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// Mark a reportable sponsorship event as reported
router.put('/reportable-events/:eventId/mark-reported', requireAuth, requireRole('ADMIN', 'DIRECTOR'), async (req: any, res) => {
  const eventId = Number(req.params.eventId)

  if (!Number.isInteger(eventId)) {
    return res.status(400).json({ error: 'Invalid eventId' })
  }

  try {
    const updatedCount = await prisma.sponsorshipReportableEvent.updateMany({
      where: { id: eventId },
      data: {
        status: 'REPORTED',
        reportedAt: new Date(),
        reportedBy: req.user?.id,
      },
    })
    if (updatedCount.count === 0)
      return res.status(404).json({ error: 'Reportable event not found' })
    const event = await prisma.sponsorshipReportableEvent.findFirst({
      where: { id: eventId },
    })
    if (!event)
      return res.status(404).json({ error: 'Reportable event not found' })

    await auditLog(req, 'UPDATE', 'SponsorshipReportableEvent', event.id, {
      sponsorshipId: event.sponsorshipId,
      eventType: event.eventType,
      status: event.status,
    })
    res.json(event)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// View sponsorship compliance pack
router.get('/:id/compliance', requireAuth, async (req: any, res) => {
  const id = Number(req.params.id)

  try {
    const sponsorship = await findAuthorizedSponsorshipForCompliance(req, res, id)
    if (!sponsorship) return

    await auditLog(req, 'READ', 'SponsorshipComplianceEvidence', sponsorship.id, {
      sponsorshipId: sponsorship.id,
      employeeId: sponsorship.employeeId,
      selfAccess: normalizeRole(req.user?.role) === ROLES.EMPLOYEE,
    })
    res.json(buildCompliancePack(sponsorship))
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// Add sponsorship compliance evidence
// Appendix D audit pack: every stored document for the worker plus an index
// naming what is present and what is still missing. The guidance prescribes no
// storage format, only that the evidence can be produced on request — and a
// Home Office visit can be unannounced (C7.9), so this is a one-click export.
router.get('/:id/compliance/pack', requireAuth, requireRole('ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT'), async (req: any, res) => {
  const id = Number(req.params.id)

  try {
    const sponsorship = await findAuthorizedSponsorshipForCompliance(req, res, id)
    if (!sponsorship) return

    const pack = buildCompliancePack(sponsorship)
    const employee = sponsorship.employee
    const safeName = `${employee.firstName}_${employee.lastName}`.replace(/[^A-Za-z0-9_-]/g, '')
    const filename = `AuditPack_${safeName}_${new Date().toISOString().slice(0, 10)}.zip`

    await auditLog(req, 'EXPORT', 'SponsorshipCompliancePack', sponsorship.id, {
      sponsorshipId: sponsorship.id,
      employeeId: sponsorship.employeeId,
      completenessPercentage: pack.completenessPercentage,
    })

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    const archive = archiver('zip', { zlib: { level: 9 } })
    archive.on('error', (err) => {
      console.error('Error building audit pack:', err)
      res.destroy()
    })
    archive.pipe(res)

    archive.append(buildPackIndex(pack, employee), { name: 'INDEX.md' })

    const store = getStorage()
    for (const item of pack.requiredEvidence) {
      const doc = item.evidence?.document
      if (!doc?.path) continue
      assertKeyInTenant(doc.path)
      if (await store.exists(doc.path)) {
        archive.append(await store.getStream(doc.path), {
          name: `${item.key}/${doc.name}`,
        })
      }
    }

    await archive.finalize()
  } catch (e: any) {
    if (!res.headersSent) res.status(400).json({ error: e.message })
  }
})

router.post('/:id/compliance/evidence', requireAuth, async (req: any, res) => {
  const id = Number(req.params.id)
  const role = normalizeRole(req.user?.role)

  if (!canUploadSponsorshipEvidence(role)) {
    return res.status(403).json({ error: 'forbidden' })
  }

  const { evidenceType, documentId, notes, verifiedAt } = req.body
  if (!APPENDIX_D_KEYS.has(evidenceType)) {
    return res.status(400).json({ error: 'Invalid evidenceType' })
  }

  try {
    const sponsorship = await prisma.sponsorship.findFirst({
      where: { id },
      include: { employee: true },
    })
    if (!sponsorship) return res.status(404).json({ error: 'Sponsorship not found' })

    if (documentId) {
      const document = await prisma.document.findFirst({ where: { id: Number(documentId) } })
      if (!document) return res.status(400).json({ error: 'Document not found' })
      if (document.employeeId !== sponsorship.employeeId) {
        return res.status(400).json({ error: 'Document must belong to the sponsored employee' })
      }
    }

    const evidence = await prisma.sponsorshipComplianceEvidence.create({
      data: {
        tenantId: currentTenantId(),
        sponsorshipId: sponsorship.id,
        documentId: documentId ? Number(documentId) : undefined,
        evidenceType,
        notes,
        verifiedAt: verifiedAt ? new Date(verifiedAt) : undefined,
        verifiedBy: req.user?.id,
      },
      include: { document: true },
    })

    await auditLog(req, 'CREATE', 'SponsorshipComplianceEvidence', evidence.id, {
      sponsorshipId: sponsorship.id,
      employeeId: sponsorship.employeeId,
      documentId: evidence.documentId,
      evidenceType: evidence.evidenceType,
    })
    res.status(201).json(evidence)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// Create reportable sponsorship event
router.post('/:id/reportable-events', requireAuth, requireRole('ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT'), async (req: any, res) => {
  const sponsorshipId = Number(req.params.id)
  const { eventType, eventDate, dueDate, notes } = req.body
  const parsedEventDate = parseRequiredDate(eventDate)
  const parsedDueDate = parseRequiredDate(dueDate)

  if (!Number.isInteger(sponsorshipId)) {
    return res.status(400).json({ error: 'Invalid sponsorshipId' })
  }
  if (!REPORTABLE_EVENT_TYPES.has(eventType)) {
    return res.status(400).json({ error: 'Invalid eventType' })
  }
  if (!parsedEventDate || !parsedDueDate) {
    return res.status(400).json({ error: 'eventDate and dueDate are required valid dates' })
  }

  try {
    const sponsorship = await prisma.sponsorship.findFirst({
      where: { id: sponsorshipId },
      select: { id: true, employeeId: true },
    })
    if (!sponsorship) return res.status(404).json({ error: 'Sponsorship not found' })

    const event = await prisma.sponsorshipReportableEvent.create({
      data: {
        tenantId: currentTenantId(),
        sponsorshipId: sponsorship.id,
        eventType,
        eventDate: parsedEventDate,
        dueDate: parsedDueDate,
        notes,
      },
    })

    await auditLog(req, 'CREATE', 'SponsorshipReportableEvent', event.id, {
      sponsorshipId: sponsorship.id,
      employeeId: sponsorship.employeeId,
      eventType: event.eventType,
      dueDate: event.dueDate,
    })
    res.status(201).json(event)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// View sponsorship
router.get('/:id', requireAuth, async (req: any, res) => {
  const id = Number(req.params.id)
  const user = req.user
  const role = normalizeRole(user?.role)

  try {
    const sponsorship = await prisma.sponsorship.findFirst({
      where: { id },
      include: { employee: true },
    })
    if (!sponsorship) return res.status(404).json({ error: 'Sponsorship not found' })

    if (role === ROLES.EMPLOYEE) {
      if (!user.employeeId || sponsorship.employeeId !== user.employeeId) {
        return res.status(404).json({ error: 'Sponsorship not found' })
      }
    } else if (!canViewSponsorships(role)) {
      return res.status(403).json({ error: 'forbidden' })
    }

    await auditLog(req, 'READ', 'Sponsorship', sponsorship.id, {
      selfAccess: role === ROLES.EMPLOYEE,
    })
    res.json(sponsorship)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// Create sponsorship
const COS_TYPES = new Set(['DEFINED', 'UNDEFINED'])

// A CoS must be used within three months of assignment or it lapses.
function defaultCosStartBy(assigned: Date) {
  const out = new Date(assigned)
  out.setUTCMonth(out.getUTCMonth() + 3)
  return out
}

// Certificate-of-Sponsorship fields from a form body. Returns a 400 message
// or the parsed fields; `cosStartBy` is filled from the assignment date when
// the caller leaves it blank.
function parseCosFields(body: any): { error?: string; data: any } {
  const data: any = {}
  if (body.cosType !== undefined) {
    if (body.cosType === null || body.cosType === '') data.cosType = null
    else if (!COS_TYPES.has(body.cosType)) return { error: 'cosType must be DEFINED or UNDEFINED', data }
    else data.cosType = body.cosType
  }
  for (const field of ['cosAssignedDate', 'cosStartBy']) {
    if (body[field] === undefined) continue
    if (body[field] === null || body[field] === '') {
      data[field] = null
      continue
    }
    const date = parseRequiredDate(body[field])
    if (!date) return { error: `${field} must be a valid date`, data }
    data[field] = date
  }
  if (body.iscAmount !== undefined) {
    data.iscAmount = body.iscAmount === null || body.iscAmount === '' ? null : Number(body.iscAmount)
    if (Number.isNaN(data.iscAmount)) return { error: 'iscAmount must be a number', data }
  }
  if (data.cosAssignedDate && !data.cosStartBy) {
    data.cosStartBy = defaultCosStartBy(data.cosAssignedDate)
  }
  return { data }
}

async function defaultLicenceNumber() {
  const licence = await prisma.sponsorLicence.findFirst({ select: { licenceNumber: true } })
  return licence?.licenceNumber ?? undefined
}

router.post('/', requireAuth, requireRole('ADMIN', 'DIRECTOR'), async (req: any, res) => {
  const {
    employeeId,
    visaType,
    casNumber,
    sponsorLicenseNumber,
    startDate,
    endDate,
    complianceNotes,
    socCode,
    jobTitleOnCos,
    cosSalary,
    cosWeeklyHours,
    workLocation,
    goingRateSalary,
  } = req.body
  if (!employeeId || !visaType || !startDate) return res.status(400).json({ error: 'missing fields' })
  const num = (value: unknown) => (value === undefined || value === null || value === '' ? undefined : Number(value))
  const cos = parseCosFields(req.body)
  if (cos.error) return res.status(400).json({ error: cos.error })
  try {
    const s = await prisma.sponsorship.create({
      data: {
        tenantId: currentTenantId(),
        employeeId,
        visaType,
        casNumber,
        sponsorLicenseNumber: sponsorLicenseNumber || (await defaultLicenceNumber()),
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : undefined,
        complianceNotes,
        socCode,
        jobTitleOnCos,
        cosSalary: num(cosSalary),
        cosWeeklyHours: num(cosWeeklyHours),
        workLocation,
        goingRateSalary: num(goingRateSalary),
        ...cos.data,
      },
    })
    await auditLog(req, 'CREATE', 'Sponsorship', s.id, {
      employeeId,
      visaType,
      sponsorLicenseNumber,
    })
    res.json(s)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// Update sponsorship
router.put('/:id', requireAuth, requireRole('ADMIN', 'DIRECTOR'), async (req: any, res) => {
  const id = Number(req.params.id)
  try {
    const { startDate, endDate } = req.body
    // Explicit pick-list: spreading the body would let a caller move the
    // record to another employee or tenant.
    const data: any = {}
    for (const field of [
      'employeeId',
      'visaType',
      'casNumber',
      'sponsorLicenseNumber',
      'complianceNotes',
      'socCode',
      'jobTitleOnCos',
      'workLocation',
      'active',
    ]) {
      if (req.body[field] !== undefined) data[field] = req.body[field]
    }
    if (startDate) data.startDate = new Date(startDate)
    if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null
    // Numeric CoS fields arrive as strings from a form post.
    for (const field of ['cosSalary', 'cosWeeklyHours', 'goingRateSalary']) {
      if (req.body[field] !== undefined) {
        data[field] = req.body[field] === null || req.body[field] === '' ? null : Number(req.body[field])
      }
    }
    if (data.employeeId !== undefined) {
      data.employeeId = Number(data.employeeId)
      const target = await prisma.employee.findFirst({ where: { id: data.employeeId } })
      if (!target) return res.status(400).json({ error: 'employee not found' })
    }
    const cos = parseCosFields(req.body)
    if (cos.error) return res.status(400).json({ error: cos.error })
    Object.assign(data, cos.data)
    if (data.sponsorLicenseNumber === '' || data.sponsorLicenseNumber === null) {
      data.sponsorLicenseNumber = (await defaultLicenceNumber()) ?? null
    }

    const updated = await prisma.sponsorship.updateMany({ where: { id }, data })
    if (updated.count === 0)
      return res.status(404).json({ error: 'Sponsorship not found' })
    const s = await prisma.sponsorship.findFirst({ where: { id } })
    if (!s) return res.status(404).json({ error: 'Sponsorship not found' })
    await auditLog(req, 'UPDATE', 'Sponsorship', s.id, {
      updatedFields: Object.keys(data),
    })
    res.json(s)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// Delete
router.delete('/:id', requireAuth, requireRole('ADMIN', 'DIRECTOR'), async (req: any, res) => {
  const id = Number(req.params.id)
  try {
    const existing = await prisma.sponsorship.findFirst({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Sponsorship not found' })
    await prisma.sponsorship.deleteMany({ where: { id } })
    await auditLog(req, 'DELETE', 'Sponsorship', id, {
      employeeId: existing?.employeeId,
      visaType: existing?.visaType,
    })
    res.json({ ok: true })
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

export default router
