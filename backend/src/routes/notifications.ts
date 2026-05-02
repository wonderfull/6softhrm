import { Router } from 'express'
import prisma from '../prismaClient'
import { requireAuth } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import { sendEmail, EmailTemplates } from '../lib/emailService'
import type { Employee, Sponsorship, User } from '@prisma/client'

const router = Router()

// Check for upcoming expiries and send notifications
router.post('/check-expiries', requireAuth, requireRole('ADMIN', 'DIRECTOR'), async (req, res) => {
  try {
    const results = {
      visasChecked: 0,
      visaNotifications: 0,
      contractsChecked: 0,
      contractNotifications: 0,
    }

    // Check visa expiries (30, 60, 90 days)
    const sponsorships = await prisma.sponsorship.findMany({
      where: {
        active: true,
        endDate: { not: null },
      },
      include: {
        employee: true,
      },
    })

    results.visasChecked = sponsorships.length

    const today = new Date()
    const warningThresholds = [30, 60, 90] // days

    for (const sponsorship of sponsorships) {
      if (!sponsorship.endDate) continue

      const daysUntilExpiry = Math.ceil(
        (sponsorship.endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      )

      // Only notify if within warning thresholds and not expired
      if (daysUntilExpiry > 0 && warningThresholds.includes(daysUntilExpiry)) {
        const template = EmailTemplates.visaExpiry(
          `${sponsorship.employee.firstName} ${sponsorship.employee.lastName}`,
          sponsorship.visaType,
          sponsorship.endDate.toLocaleDateString('en-GB'),
          daysUntilExpiry
        )

        // Get HR admin emails
        const admins = await prisma.user.findMany({
          where: { role: { in: ['ADMIN', 'DIRECTOR'] } },
          select: { email: true },
        })

        const sent = await sendEmail({
          to: admins.map((a: Pick<User, 'email'>) => a.email),
          subject: template.subject,
          html: template.html,
        })

        if (sent) results.visaNotifications++
      }
    }

    // Check contract expiries
    const employees = await prisma.employee.findMany({
      where: {
        endDate: { not: null },
      },
    })

    results.contractsChecked = employees.length

    for (const employee of employees) {
      if (!employee.endDate) continue

      const daysUntilExpiry = Math.ceil(
        (employee.endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      )

      // Only notify if within warning thresholds and not expired
      if (daysUntilExpiry > 0 && warningThresholds.includes(daysUntilExpiry)) {
        const template = EmailTemplates.contractExpiry(
          `${employee.firstName} ${employee.lastName}`,
          employee.endDate.toLocaleDateString('en-GB'),
          daysUntilExpiry
        )

        // Get HR admin emails
        const admins = await prisma.user.findMany({
          where: { role: { in: ['ADMIN', 'DIRECTOR'] } },
          select: { email: true },
        })

        const sent = await sendEmail({
          to: admins.map((a: Pick<User, 'email'>) => a.email),
          subject: template.subject,
          html: template.html,
        })

        if (sent) results.contractNotifications++
      }
    }

    res.json({
      success: true,
      message: 'Expiry check completed',
      results,
    })
  } catch (error: any) {
    console.error('Error checking expiries:', error)
    res.status(500).json({ error: 'Failed to check expiries' })
  }
})

// Get upcoming expiries (for dashboard/reports)
router.get('/upcoming-expiries', requireAuth, async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 90
    const today = new Date()
    const futureDate = new Date()
    futureDate.setDate(today.getDate() + days)

    // Visa expiries
    const visaExpiries = await prisma.sponsorship.findMany({
      where: {
        active: true,
        endDate: {
          gte: today,
          lte: futureDate,
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        endDate: 'asc',
      },
    })

    // Contract expiries
    const contractExpiries = await prisma.employee.findMany({
      where: {
        endDate: {
          gte: today,
          lte: futureDate,
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        jobTitle: true,
        endDate: true,
      },
      orderBy: {
        endDate: 'asc',
      },
    })

    res.json({
      visaExpiries: visaExpiries.map((v: Sponsorship & { employee: Pick<Employee, 'id' | 'firstName' | 'lastName' | 'email'> }) => ({
        id: v.id,
        employeeId: v.employee.id,
        employeeName: `${v.employee.firstName} ${v.employee.lastName}`,
        email: v.employee.email,
        visaType: v.visaType,
        expiryDate: v.endDate,
        daysRemaining: Math.ceil((v.endDate!.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
      })),
      contractExpiries: contractExpiries.map((e: Pick<Employee, 'id' | 'firstName' | 'lastName' | 'email' | 'jobTitle' | 'endDate'>) => ({
        id: e.id,
        employeeName: `${e.firstName} ${e.lastName}`,
        email: e.email,
        jobTitle: e.jobTitle,
        expiryDate: e.endDate,
        daysRemaining: Math.ceil((e.endDate!.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
      })),
    })
  } catch (error: any) {
    console.error('Error fetching upcoming expiries:', error)
    res.status(500).json({ error: 'Failed to fetch expiries' })
  }
})

// Send leave request notification to operational approvers
router.post('/notify-leave-request', requireAuth, async (req, res) => {
  try {
    const { leaveRequestId } = req.body

    if (!leaveRequestId) {
      return res.status(400).json({ error: 'Missing leaveRequestId' })
    }

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: parseInt(leaveRequestId) },
      include: {
        employee: true,
      },
    })

    if (!leaveRequest) {
      return res.status(404).json({ error: 'Leave request not found' })
    }

    const template = EmailTemplates.leaveRequestPending(
      `${leaveRequest.employee.firstName} ${leaveRequest.employee.lastName}`,
      leaveRequest.type,
      leaveRequest.startDate.toLocaleDateString('en-GB'),
      leaveRequest.endDate.toLocaleDateString('en-GB'),
      leaveRequest.id
    )

    // Get operational approver emails
    const admins = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT'] } },
      select: { email: true },
    })

    const sent = await sendEmail({
      to: admins.map((a: Pick<User, 'email'>) => a.email),
      subject: template.subject,
      html: template.html,
    })

    res.json({ success: sent, message: sent ? 'Notification sent' : 'Email not configured' })
  } catch (error: any) {
    console.error('Error sending leave request notification:', error)
    res.status(500).json({ error: 'Failed to send notification' })
  }
})

// Send leave approval/rejection notification to employee
router.post('/notify-leave-status', requireAuth, requireRole('ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT'), async (req, res) => {
  try {
    const { leaveRequestId, status, reason } = req.body

    if (!leaveRequestId || !status) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: parseInt(leaveRequestId) },
      include: {
        employee: true,
      },
    })

    if (!leaveRequest) {
      return res.status(404).json({ error: 'Leave request not found' })
    }

    const template = status === 'APPROVED'
      ? EmailTemplates.leaveRequestApproved(
          `${leaveRequest.employee.firstName} ${leaveRequest.employee.lastName}`,
          leaveRequest.type,
          leaveRequest.startDate.toLocaleDateString('en-GB'),
          leaveRequest.endDate.toLocaleDateString('en-GB')
        )
      : EmailTemplates.leaveRequestRejected(
          `${leaveRequest.employee.firstName} ${leaveRequest.employee.lastName}`,
          leaveRequest.type,
          leaveRequest.startDate.toLocaleDateString('en-GB'),
          leaveRequest.endDate.toLocaleDateString('en-GB'),
          reason
        )

    const sent = await sendEmail({
      to: leaveRequest.employee.email,
      subject: template.subject,
      html: template.html,
    })

    res.json({ success: sent, message: sent ? 'Notification sent' : 'Email not configured' })
  } catch (error: any) {
    console.error('Error sending leave status notification:', error)
    res.status(500).json({ error: 'Failed to send notification' })
  }
})

// Send document upload notification
router.post('/notify-document-upload', requireAuth, async (req: any, res) => {
  try {
    const { employeeId, documentName } = req.body

    if (!employeeId || !documentName) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const employee = await prisma.employee.findUnique({
      where: { id: parseInt(employeeId) },
    })

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' })
    }

    const uploaderName = req.user?.email || 'System'

    const template = EmailTemplates.documentUploaded(
      `${employee.firstName} ${employee.lastName}`,
      documentName,
      uploaderName
    )

    const sent = await sendEmail({
      to: employee.email,
      subject: template.subject,
      html: template.html,
    })

    res.json({ success: sent, message: sent ? 'Notification sent' : 'Email not configured' })
  } catch (error: any) {
    console.error('Error sending document notification:', error)
    res.status(500).json({ error: 'Failed to send notification' })
  }
})

// Test email configuration
router.post('/test-email', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { to } = req.body

    if (!to) {
      return res.status(400).json({ error: 'Missing recipient email' })
    }

    const sent = await sendEmail({
      to,
      subject: '✅ Test Email from 6Soft HRM',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #10b981; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">✅ Email Configuration Test</h2>
          </div>
          <div style="padding: 20px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; color: #111827;">
              This is a test email from your 6Soft HRM system.
            </p>
            <p style="font-size: 16px; color: #111827;">
              If you received this email, your email notifications are configured correctly! ✅
            </p>
            <p style="color: #6b7280; font-size: 14px;">
              Sent at: ${new Date().toLocaleString('en-GB')}
            </p>
          </div>
        </div>
      `,
    })

    res.json({
      success: sent,
      message: sent ? 'Test email sent successfully' : 'Email not configured. Check SMTP settings in .env',
    })
  } catch (error: any) {
    console.error('Error sending test email:', error)
    res.status(500).json({ error: 'Failed to send test email' })
  }
})

export default router
