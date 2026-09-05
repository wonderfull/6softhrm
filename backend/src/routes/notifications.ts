import { Router } from 'express';
import prisma from '../prismaClient';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';
import { sendEmail } from '../lib/emailService';
import { getCronStatus } from '../lib/cronJobs';
import {
  collectTenantExpiringItems,
  sweepTenantExpiries,
} from '../lib/expirySweep';

const router = Router();

// Force-run the daily 09:00 UK expiry sweep for the caller's tenant only.
// Shares the cron implementation so behaviour stays in sync.
router.post(
  '/check-expiries',
  requireAuth,
  requireRole('ADMIN', 'DIRECTOR'),
  async (req, res) => {
    try {
      const result = await sweepTenantExpiries();
      await auditLog(req, 'CHECK_EXPIRIES_MANUAL', 'System', undefined, result);
      res.json({
        success: true,
        message: 'Expiry check completed',
        results: {
          visasChecked: 0, // legacy field, kept for UI compatibility
          contractsChecked: 0,
          visaNotifications: result.visaNotifications,
          contractNotifications: result.contractNotifications,
          otherNotifications: result.otherNotifications,
          inAppNotifications: result.inAppNotifications,
        },
      });
    } catch (error: any) {
      console.error('Error checking expiries:', error);
      res.status(500).json({ error: 'Failed to check expiries' });
    }
  },
);

// Get upcoming expiries (for dashboard/reports)
// Includes already-expired but still-active sponsorships/contracts under `overdue*`.
// `other` carries every further dated obligation (passport, DBS, RTW recheck,
// licence, action plan, CoS start-by) in the sweep's own shape.
router.get(
  '/upcoming-expiries',
  requireAuth,
  requireRole('ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT'),
  async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 90;
      const items = await collectTenantExpiringItems(new Date(), days);

      const visaMapped = items
        .filter((i) => i.kind === 'VISA')
        .map((i) => ({
          id: i.id,
          employeeId: i.employeeId,
          employeeName: i.employeeName,
          email: i.employeeEmail,
          visaType: i.detail,
          expiryDate: i.expiryDate,
          daysRemaining: i.daysRemaining,
        }));
      const contractMapped = items
        .filter((i) => i.kind === 'CONTRACT')
        .map((i) => ({
          id: i.id,
          employeeName: i.employeeName,
          email: i.employeeEmail,
          jobTitle: i.jobTitle,
          expiryDate: i.expiryDate,
          daysRemaining: i.daysRemaining,
        }));

      res.json({
        overdueVisas: visaMapped.filter((v) => v.daysRemaining < 0),
        overdueContracts: contractMapped.filter((c) => c.daysRemaining < 0),
        visaExpiries: visaMapped.filter((v) => v.daysRemaining >= 0),
        contractExpiries: contractMapped.filter((c) => c.daysRemaining >= 0),
        other: items.filter((i) => i.kind !== 'VISA' && i.kind !== 'CONTRACT'),
      });
    } catch (error: any) {
      console.error('Error fetching upcoming expiries:', error);
      res.status(500).json({ error: 'Failed to fetch expiries' });
    }
  },
);

// The bell. Own rows only — a notification is addressed to one person, and
// no role escalates that.
router.get('/inbox', requireAuth, async (req: any, res) => {
  const unreadOnly = req.query.unread === '1' || req.query.unread === 'true';
  const take = Math.min(Number(req.query.limit) || 50, 200);

  const rows = await prisma.notification.findMany({
    where: { userId: req.user.id, ...(unreadOnly ? { readAt: null } : {}) },
    orderBy: { createdAt: 'desc' },
    take,
  });
  res.json(rows);
});

router.put('/inbox/read-all', requireAuth, async (req: any, res) => {
  const updated = await prisma.notification.updateMany({
    where: { userId: req.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  res.json({ updated: updated.count });
});

router.put('/inbox/:id/read', requireAuth, async (req: any, res) => {
  const id = Number(req.params.id);
  const updated = await prisma.notification.updateMany({
    where: { id, userId: req.user.id },
    data: { readAt: new Date() },
  });
  if (updated.count === 0)
    return res.status(404).json({ error: 'Notification not found' });

  const row = await prisma.notification.findFirst({
    where: { id, userId: req.user.id },
  });
  res.json(row);
});

// Test email configuration
router.post(
  '/test-email',
  requireAuth,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const { to } = req.body;

      if (!to) {
        return res.status(400).json({ error: 'Missing recipient email' });
      }

      const sent = await sendEmail({
        to,
        subject: '✅ Test Email from OnsideHR',
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #10b981; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">✅ Email Configuration Test</h2>
          </div>
          <div style="padding: 20px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; color: #111827;">
              This is a test email from your OnsideHR system.
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
      });

      await auditLog(req, 'TEST_EMAIL', 'System', undefined, { to, sent });
      res.json({
        success: sent,
        message: sent
          ? 'Test email sent successfully'
          : 'Email not configured. Check SMTP settings in .env',
      });
    } catch (error: any) {
      console.error('Error sending test email:', error);
      res.status(500).json({ error: 'Failed to send test email' });
    }
  },
);

// In-process cron status — used by the Notifications page to render the
// "last automated run" badge.
router.get(
  '/cron-status',
  requireAuth,
  requireRole('ADMIN', 'DIRECTOR'),
  async (_req, res) => {
    try {
      const lastAuditRun = await prisma.auditLog.findFirst({
        where: { action: 'CRON_EXPIRY_CHECK' },
        orderBy: { timestamp: 'desc' },
      });
      res.json({
        ...getCronStatus(),
        lastAuditRunAt: lastAuditRun?.timestamp ?? null,
      });
    } catch (error: any) {
      console.error('Error reading cron status:', error);
      res.status(500).json({ error: 'Failed to read cron status' });
    }
  },
);

export default router;
