import { Router } from 'express'
import prisma from '../prismaClient'
import { requireAuth } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import { sendEmail, EmailTemplates } from '../lib/emailService'
import { canReviewLeaveAndTime, normalizeRole, ROLES } from '../lib/roles'

const router = Router()

router.get('/', requireAuth, async (req: any, res) => {
  const user = req.user
  const role = normalizeRole(user.role)

  if (role === ROLES.EMPLOYEE) {
    if (!user.employeeId) {
      return res.json([])
    }
    const leaves = await prisma.leaveRequest.findMany({
      where: { employeeId: user.employeeId },
      include: { employee: true }
    })
    return res.json(leaves)
  }

  if (!canReviewLeaveAndTime(role)) return res.status(403).json({ error: 'Unauthorized' })

  const leaves = await prisma.leaveRequest.findMany({ include: { employee: true } })
  res.json(leaves)
})

router.post('/', requireAuth, async (req: any, res) => {
  const user = req.user
  const role = normalizeRole(user.role)
  let { employeeId, type, startDate, endDate, reason } = req.body

  if (role === ROLES.EMPLOYEE) {
    if (!user.employeeId) {
      return res.status(403).json({ error: 'User account is not linked to an employee record' })
    }
    employeeId = user.employeeId
  } else if (!canReviewLeaveAndTime(role)) {
    return res.status(403).json({ error: 'Unauthorized' })
  } else if (!employeeId && user.employeeId) {
    employeeId = user.employeeId
  }

  if (!employeeId || !type || !startDate || !endDate) return res.status(400).json({ error: 'missing fields' })
  try {
    const lr = await prisma.leaveRequest.create({
      data: { employeeId, type, startDate: new Date(startDate), endDate: new Date(endDate), reason },
      include: { employee: true }
    })

    // Send notification to operational approvers
    try {
      const admins = await prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT'] } }
      })

      for (const admin of admins) {
        if (admin.email) {
          const template = EmailTemplates.leaveRequestPending(
            `${lr.employee.firstName} ${lr.employee.lastName}`,
            lr.type,
            lr.startDate.toISOString().split('T')[0],
            lr.endDate.toISOString().split('T')[0],
            lr.id
          )
          await sendEmail({
            to: admin.email,
            subject: template.subject,
            html: template.html
          })
        }
      }
    } catch (emailError) {
      console.error('Failed to send leave request notification:', emailError)
      // Don't fail the request if email fails
    }

    res.json(lr)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

router.put('/:id/approve', requireAuth, requireRole('ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT'), async (req, res) => {
  const id = Number(req.params.id)
  try {
    const lr = await prisma.leaveRequest.update({
      where: { id },
      data: { status: 'APPROVED' },
      include: { employee: true }
    })

    // Send notification to employee
    try {
      if (lr.employee.email) {
        const template = EmailTemplates.leaveRequestApproved(
          `${lr.employee.firstName} ${lr.employee.lastName}`,
          lr.type,
          lr.startDate.toISOString().split('T')[0],
          lr.endDate.toISOString().split('T')[0]
        )
        await sendEmail({
          to: lr.employee.email,
          subject: template.subject,
          html: template.html
        })
      }
    } catch (emailError) {
      console.error('Failed to send approval notification:', emailError)
    }

    res.json(lr)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

router.put('/:id/reject', requireAuth, requireRole('ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT'), async (req, res) => {
  const id = Number(req.params.id)
  try {
    const lr = await prisma.leaveRequest.update({
      where: { id },
      data: { status: 'REJECTED' },
      include: { employee: true }
    })

    // Send notification to employee
    try {
      if (lr.employee.email) {
        const template = EmailTemplates.leaveRequestRejected(
          `${lr.employee.firstName} ${lr.employee.lastName}`,
          lr.type,
          lr.startDate.toISOString().split('T')[0],
          lr.endDate.toISOString().split('T')[0],
          req.body.reason || 'No reason provided'
        )
        await sendEmail({
          to: lr.employee.email,
          subject: template.subject,
          html: template.html
        })
      }
    } catch (emailError) {
      console.error('Failed to send rejection notification:', emailError)
    }

    res.json(lr)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

export default router
