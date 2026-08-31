import { Router } from 'express';
import multer from 'multer';
import prisma from '../prismaClient';
import { requireAuth, rebindTenant } from '../middleware/auth';
import { requireRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';
import { currentTenantId } from '../lib/tenantContext';
import { parsePayImportFile, payCsvTemplate } from '../lib/payImport';
import { assessPeriods } from '../lib/salaryReconciliation';
import { findReadableEmployee } from '../lib/employeeAccess';
import { toIsoDate } from '../lib/workingDays';

const router = Router();

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

router.get(
  '/import/template',
  requireAuth,
  requireRole('ADMIN', 'DIRECTOR'),
  (_req, res) => {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="onsidehr-pay-import-template.csv"',
    );
    res.send(payCsvTemplate());
  },
);

// Payroll import. Dry run first, then commit — same shape as the employee
// importer so the flow is already familiar.
router.post(
  '/import',
  requireAuth,
  requireRole('ADMIN', 'DIRECTOR'),
  importUpload.single('file'),
  rebindTenant,
  async (req: any, res) => {
    const file = req.file as Express.Multer.File | undefined;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });
    const dryRun = String(req.query.dryRun ?? req.body.dryRun ?? '') === 'true';

    try {
      const { rows, headerErrors } = parsePayImportFile(file.buffer);
      if (headerErrors.length) {
        return res
          .status(400)
          .json({ error: headerErrors.join(' '), headerErrors });
      }

      const employees = await prisma.employee.findMany({
        where: { email: { in: rows.map((r) => r.email).filter(Boolean) } },
        select: { id: true, email: true },
      });
      const employeeIdByEmail = new Map(
        employees.map((e) => [e.email.toLowerCase(), e.id]),
      );

      // A pay row for someone who isn't on the payroll is an error, not a
      // silent skip — it usually means the export covers the wrong company.
      for (const row of rows) {
        if (row.email && !employeeIdByEmail.has(row.email)) {
          row.errors.push(`No employee found with email "${row.email}"`);
        }
      }

      const existing = await prisma.payRecord.findMany({
        where: { employeeId: { in: Array.from(employeeIdByEmail.values()) } },
        select: { id: true, employeeId: true, periodStart: true },
      });
      const existingKey = new Map(
        existing.map((p) => [
          `${p.employeeId}|${toIsoDate(p.periodStart)}`,
          p.id,
        ]),
      );

      const keyFor = (row: (typeof rows)[number]) => {
        const employeeId = employeeIdByEmail.get(row.email);
        if (!employeeId || !row.data.periodStart) return null;
        return `${employeeId}|${toIsoDate(row.data.periodStart)}`;
      };

      const plan = rows.map((r) => {
        const key = keyFor(r);
        return {
          ...r,
          action: r.errors.length
            ? ('error' as const)
            : key && existingKey.has(key)
              ? ('update' as const)
              : ('create' as const),
        };
      });

      const summary = {
        total: plan.length,
        creates: plan.filter((r) => r.action === 'create').length,
        updates: plan.filter((r) => r.action === 'update').length,
        errors: plan.filter((r) => r.action === 'error').length,
      };

      if (dryRun) {
        return res.json({
          dryRun: true,
          summary,
          rows: plan.map(({ data, ...rest }) => ({ ...rest, preview: data })),
        });
      }

      let created = 0;
      let updated = 0;
      for (const r of plan) {
        if (r.action === 'error') continue;
        const employeeId = employeeIdByEmail.get(r.email)!;
        const payload = {
          periodStart: r.data.periodStart,
          periodEnd: r.data.periodEnd,
          grossPay: r.data.grossPay,
          hoursWorked: r.data.hoursWorked ?? null,
          source: 'CSV_IMPORT',
        };
        const key = keyFor(r)!;
        const existingId = existingKey.get(key);
        if (existingId) {
          await prisma.payRecord.updateMany({
            where: { id: existingId },
            data: payload,
          });
          updated += 1;
        } else {
          await prisma.payRecord.create({
            data: { ...payload, employeeId, tenantId: currentTenantId() },
          });
          created += 1;
        }
      }

      await auditLog(req, 'IMPORT', 'PayRecord', undefined, {
        created,
        updated,
        skipped: summary.errors,
        filename: file.originalname,
      });

      res.json({ dryRun: false, summary, created, updated });
    } catch (e: any) {
      if (e?.status)
        return res.status(e.status).json({ error: e.code, message: e.message });
      res.status(500).json({ error: e.message });
    }
  },
);

/** Pay periods for one employee, each assessed against their CoS terms. */
router.get('/employee/:employeeId', requireAuth, async (req: any, res) => {
  try {
    const employeeId = Number(req.params.employeeId);
    if (!Number.isInteger(employeeId)) {
      return res.status(400).json({ error: 'Invalid employeeId' });
    }

    const employee = await findReadableEmployee(req, res, employeeId);
    if (!employee) return;

    const [periods, sponsorship] = await Promise.all([
      prisma.payRecord.findMany({
        where: { employeeId },
        orderBy: { periodStart: 'asc' },
      }),
      prisma.sponsorship.findFirst({ where: { employeeId, active: true } }),
    ]);

    const assessments = sponsorship
      ? assessPeriods(periods, {
          cosSalary: sponsorship.cosSalary,
          goingRateSalary: sponsorship.goingRateSalary,
        })
      : [];

    res.json({
      employeeId,
      cosSalary: sponsorship?.cosSalary ?? null,
      goingRateSalary: sponsorship?.goingRateSalary ?? null,
      // An unknown threshold is reported as such, never as a pass.
      thresholdKnown: assessments.length > 0,
      periods: periods.map((p) => ({
        id: p.id,
        periodStart: toIsoDate(p.periodStart),
        periodEnd: toIsoDate(p.periodEnd),
        grossPay: p.grossPay,
        hoursWorked: p.hoursWorked,
        source: p.source,
      })),
      assessments: assessments.map((a) => ({
        periodStart: toIsoDate(a.periodStart),
        periodEnd: toIsoDate(a.periodEnd),
        annualisedPay: a.annualisedPay,
        requiredAnnualSalary: a.requiredAnnualSalary,
        shortfall: a.shortfall,
        compliant: a.compliant,
      })),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
