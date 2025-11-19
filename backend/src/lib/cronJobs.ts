import cron from 'node-cron'
import prisma from '../prismaClient'
import { sendEmail, EmailTemplates } from './emailService'

/**
 * Check for visas and contracts expiring within threshold days
 * and send notifications to admins and affected employees
 */
async function checkExpiringRecords() {
  console.log('[CRON] Running expiry check...')
  const now = new Date()
  const thresholds = [30, 60, 90] // days before expiry to send alerts

  try {
    let visaNotifications = 0
    let contractNotifications = 0

    // Check visa expiries (sponsorship endDate)
    for (const days of thresholds) {
      const thresholdDate = new Date(now)
      thresholdDate.setDate(thresholdDate.getDate() + days)

      const expiringSponsorships = await prisma.sponsorship.findMany({
        where: {
          endDate: {
            not: null,
            gte: now,
            lte: thresholdDate,
          },
          active: true,
        },
        include: { employee: true },
      })

      for (const sponsorship of expiringSponsorships) {
        if (!sponsorship.endDate) continue

        const daysRemaining = Math.ceil(
          (new Date(sponsorship.endDate).getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24)
        )

        // Only send if exactly at threshold (to avoid duplicate notifications)
        if (Math.abs(daysRemaining - days) <= 1) {
          // Get admins to notify
          const admins = await prisma.user.findMany({
            where: { role: { in: ['ADMIN', 'MANAGER'] } },
          })

          const template = EmailTemplates.visaExpiry(
            `${sponsorship.employee.firstName} ${sponsorship.employee.lastName}`,
            sponsorship.visaType,
            sponsorship.endDate.toISOString().split('T')[0],
            daysRemaining
          )

          // Notify admins
          for (const admin of admins) {
            try {
              await sendEmail({
                to: admin.email,
                subject: template.subject,
                html: template.html,
              })
              visaNotifications++
            } catch (err) {
              console.error(`Failed to send visa expiry email to ${admin.email}:`, err)
            }
          }

          // Notify employee if they have an email
          if (sponsorship.employee.email) {
            try {
              await sendEmail({
                to: sponsorship.employee.email,
                subject: template.subject,
                html: template.html,
              })
              visaNotifications++
            } catch (err) {
              console.error(
                `Failed to send visa expiry email to ${sponsorship.employee.email}:`,
                err
              )
            }
          }
        }
      }
    }

    // Check contract expiries
    for (const days of thresholds) {
      const thresholdDate = new Date(now)
      thresholdDate.setDate(thresholdDate.getDate() + days)

      const expiringContracts = await prisma.employee.findMany({
        where: {
          endDate: {
            not: null,
            gte: now,
            lte: thresholdDate,
          },
        },
      })

      for (const employee of expiringContracts) {
        const daysRemaining = Math.ceil(
          (new Date(employee.endDate!).getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24)
        )

        // Only send if exactly at threshold (to avoid duplicate notifications)
        if (Math.abs(daysRemaining - days) <= 1) {
          // Get admins to notify
          const admins = await prisma.user.findMany({
            where: { role: { in: ['ADMIN', 'MANAGER'] } },
          })

          const template = EmailTemplates.contractExpiry(
            `${employee.firstName} ${employee.lastName}`,
            employee.endDate!.toISOString().split('T')[0],
            daysRemaining
          )

          // Notify admins
          for (const admin of admins) {
            try {
              await sendEmail({
                to: admin.email,
                subject: template.subject,
                html: template.html,
              })
              contractNotifications++
            } catch (err) {
              console.error(`Failed to send contract expiry email to ${admin.email}:`, err)
            }
          }

          // Notify employee if they have an email
          if (employee.email) {
            try {
              await sendEmail({
                to: employee.email,
                subject: template.subject,
                html: template.html,
              })
              contractNotifications++
            } catch (err) {
              console.error(
                `Failed to send contract expiry email to ${employee.email}:`,
                err
              )
            }
          }
        }
      }
    }

    console.log(
      `[CRON] Expiry check complete. Visa notifications: ${visaNotifications}, Contract notifications: ${contractNotifications}`
    )
  } catch (error) {
    console.error('[CRON] Error checking expiries:', error)
  }
}

/**
 * Initialize scheduled tasks
 * Runs daily at 9:00 AM
 */
export function initializeCronJobs() {
  console.log('[CRON] Initializing scheduled tasks...')

  // Run daily at 9:00 AM
  cron.schedule(
    '0 9 * * *',
    checkExpiringRecords,
    {
      timezone: 'Europe/London', // UK timezone
    }
  )

  console.log('[CRON] Scheduled daily expiry check at 9:00 AM UK time')

  // Optional: Run immediately on startup (for testing)
  // checkExpiringRecords()
}

// Export for manual testing
export { checkExpiringRecords }
