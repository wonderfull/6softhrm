import { Router } from 'express'
import prisma from '../prismaClient'
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

const router = Router()

const REQUIRED_COMPLIANCE_EVIDENCE = [
  { key: 'RIGHT_TO_WORK_CHECK', label: 'Right-to-work check' },
  { key: 'EMPLOYMENT_RIGHTS_NOTIFICATION', label: 'Employment rights notification' },
  { key: 'RECRUITMENT_EVIDENCE', label: 'Recruitment evidence' },
  { key: 'SALARY_EVIDENCE', label: 'Salary evidence' },
  { key: 'SKILL_LEVEL_EVIDENCE', label: 'Skill-level evidence' },
] as const

const REQUIRED_COMPLIANCE_EVIDENCE_KEYS = new Set(REQUIRED_COMPLIANCE_EVIDENCE.map((item) => item.key))

function summarizeEmployee(employee: any) {
  return {
    id: employee.id,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    jobTitle: employee.jobTitle,
  }
}

function buildCompliancePack(sponsorship: any) {
  const existingEvidence = sponsorship.complianceEvidence || []
  const latestEvidenceByType = new Map<string, any>()

  for (const evidence of existingEvidence) {
    if (!latestEvidenceByType.has(evidence.evidenceType)) {
      latestEvidenceByType.set(evidence.evidenceType, evidence)
    }
  }

  const requiredEvidence = REQUIRED_COMPLIANCE_EVIDENCE.map((item) => {
    const evidence = latestEvidenceByType.get(item.key)

    return {
      ...item,
      status: evidence ? 'COMPLETE' : 'MISSING',
      evidence: evidence || null,
    }
  })

  return {
    sponsorship: {
      id: sponsorship.id,
      visaType: sponsorship.visaType,
      sponsorLicenseNumber: sponsorship.sponsorLicenseNumber,
      startDate: sponsorship.startDate,
      endDate: sponsorship.endDate,
      active: sponsorship.active,
    },
    employee: summarizeEmployee(sponsorship.employee),
    requiredEvidence,
    existingEvidence,
    missingCount: requiredEvidence.filter((item) => item.status === 'MISSING').length,
  }
}

async function findAuthorizedSponsorshipForCompliance(req: any, res: any, id: number) {
  const user = req.user
  const role = normalizeRole(user?.role)

  const sponsorship = await prisma.sponsorship.findUnique({
    where: { id },
    include: {
      employee: true,
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
router.post('/:id/compliance/evidence', requireAuth, async (req: any, res) => {
  const id = Number(req.params.id)
  const role = normalizeRole(req.user?.role)

  if (!canUploadSponsorshipEvidence(role)) {
    return res.status(403).json({ error: 'forbidden' })
  }

  const { evidenceType, documentId, notes, verifiedAt } = req.body
  if (!REQUIRED_COMPLIANCE_EVIDENCE_KEYS.has(evidenceType)) {
    return res.status(400).json({ error: 'Invalid evidenceType' })
  }

  try {
    const sponsorship = await prisma.sponsorship.findUnique({
      where: { id },
      include: { employee: true },
    })
    if (!sponsorship) return res.status(404).json({ error: 'Sponsorship not found' })

    if (documentId) {
      const document = await prisma.document.findUnique({ where: { id: Number(documentId) } })
      if (!document) return res.status(400).json({ error: 'Document not found' })
      if (document.employeeId !== sponsorship.employeeId) {
        return res.status(400).json({ error: 'Document must belong to the sponsored employee' })
      }
    }

    const evidence = await prisma.sponsorshipComplianceEvidence.create({
      data: {
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

// View sponsorship
router.get('/:id', requireAuth, async (req: any, res) => {
  const id = Number(req.params.id)
  const user = req.user
  const role = normalizeRole(user?.role)

  try {
    const sponsorship = await prisma.sponsorship.findUnique({
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
router.post('/', requireAuth, requireRole('ADMIN', 'DIRECTOR'), async (req: any, res) => {
  const { employeeId, visaType, casNumber, sponsorLicenseNumber, startDate, endDate, complianceNotes } = req.body
  if (!employeeId || !visaType || !startDate) return res.status(400).json({ error: 'missing fields' })
  try {
    const s = await prisma.sponsorship.create({
      data: {
        employeeId,
        visaType,
        casNumber,
        sponsorLicenseNumber,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : undefined,
        complianceNotes,
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
    const { startDate, endDate, ...rest } = req.body
    const data: any = { ...rest }
    if (startDate) data.startDate = new Date(startDate)
    if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null
    
    const s = await prisma.sponsorship.update({ where: { id }, data })
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
    const existing = await prisma.sponsorship.findUnique({ where: { id } })
    await prisma.sponsorship.delete({ where: { id } })
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
