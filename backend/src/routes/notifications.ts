import { Router } from 'express';
import prisma from '../prismaClient';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';
import { sendEmail } from '../lib/emailService';
import { getCronStatus } from '../lib/cronJobs';
import { sweepTenantExpiries } from '../lib/expirySweep';
import type { Employee, Sponsorship } from '@prisma/client';

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
router.get(
  '/upcoming-expiries',
  requireAuth,
  requireRole('ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT'),
  async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 90;
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + days);

      const daysBetween = (date: Date) =>
        Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // Visa expiries — overdue (already past) and upcoming
      const visaRecords = await prisma.sponsorship.findMany({
        where: {
          active: true,
          endDate: { not: null, lte: futureDate },
        },
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { endDate: 'asc' },
      });

      const visaMapped = visaRecords.map(
        (
          v: Sponsorship & {
            employee: Pick<Employee, 'id' | 'firstName' | 'lastName' | 'email'>;
          },
        ) => ({
          id: v.id,
          employeeId: v.employee.id,
          employeeName: `${v.employee.firstName} ${v.employee.lastName}`,
          email: v.employee.email,
          visaType: v.visaType,
          expiryDate: v.endDate,
          daysRemaining: daysBetween(v.endDate!),
        }),
      );
      const overdueVisas = visaMapped.filter((v) => v.daysRemaining < 0);
      const visaExpiries = visaMapped.filter((v) => v.daysRemaining >= 0);

      // Contract expiries — overdue and upcoming
      const contractRecords = await prisma.employee.findMany({
        where: { endDate: { not: null, lte: futureDate } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          jobTitle: true,
          endDate: true,
        },
        orderBy: { endDate: 'asc' },
      });

      const contractMapped = contractRecords.map(
        (
          e: Pick<
            Employee,
            'id' | 'firstName' | 'lastName' | 'email' | 'jobTitle' | 'endDate'
          >,
        ) => ({
          id: e.id,
          employeeName: `${e.firstName} ${e.lastName}`,
          email: e.email,
          jobTitle: e.jobTitle,
          expiryDate: e.endDate,
          daysRemaining: daysBetween(e.endDate!),
        }),
      );
      const overdueContracts = contractMapped.filter(
        (c) => c.daysRemaining < 0,
      );
      const contractExpiries = contractMapped.filter(
        (c) => c.daysRemaining >= 0,
      );

      res.json({
        overdueVisas,
        overdueContracts,
        visaExpiries,
        contractExpiries,
      });
    } catch (error: any) {
      console.error('Error fetching upcoming expiries:', error);
      res.status(500).json({ error: 'Failed to fetch expiries' });
    }
  },
);

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
