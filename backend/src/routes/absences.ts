import { Router } from 'express';
import prisma from '../prismaClient';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';
import { currentTenantId } from '../lib/tenantContext';
import { deriveLedger, findUnauthorisedSpells } from '../lib/absence';
import { findReadableEmployee } from '../lib/employeeAccess';
import { loadWorkingDayConfig } from '../lib/tenantSettings';
import { addUtcDays, toIsoDate, toUtcMidnight } from '../lib/workingDays';

const router = Router();

const VALID_STATUSES = new Set([
  'AUTHORISED',
  'UNAUTHORISED',
  'SICK',
  'UNKNOWN',
]);
const DEFAULT_WINDOW_DAYS = 90;

function parseDate(value: unknown) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : toUtcMidnight(date);
}

/**
 * Derived absence ledger for one employee. The stored AbsenceRecord rows are
 * the manual input; everything else is computed from approved leave on read,
 * so the ledger can never drift from the leave it is derived from.
 */
router.get('/employee/:employeeId', requireAuth, async (req: any, res) => {
  try {
    const employeeId = Number(req.params.employeeId);
    if (!Number.isInteger(employeeId)) {
      return res.status(400).json({ error: 'Invalid employeeId' });
    }

    const employee = await findReadableEmployee(req, res, employeeId);
    if (!employee) return;

    const to = parseDate(req.query.to) ?? toUtcMidnight(new Date());
    const from =
      parseDate(req.query.from) ?? addUtcDays(to, -DEFAULT_WINDOW_DAYS);

    const config = await loadWorkingDayConfig(currentTenantId());
    const [leave, manual] = await Promise.all([
      prisma.leaveRequest.findMany({
        where: { employeeId, endDate: { gte: from } },
      }),
      prisma.absenceRecord.findMany({
        where: { employeeId, date: { gte: from, lte: to } },
        orderBy: { date: 'asc' },
      }),
    ]);

    const ledger = deriveLedger({ from, to, config, leave, manual });
    const spells = findUnauthorisedSpells(ledger, from, to, config);

    res.json({
      employeeId,
      from: toIsoDate(from),
      to: toIsoDate(to),
      days: ledger.map((day) => ({
        date: toIsoDate(day.date),
        status: day.status,
        source: day.source,
        notes: day.notes ?? null,
      })),
      unauthorisedSpells: spells.map((spell) => ({
        start: toIsoDate(spell.start),
        end: toIsoDate(spell.end),
        workingDays: spell.workingDays,
        reportable: spell.workingDays >= 10,
      })),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Marking someone unauthorised-absent starts a Home Office reporting clock, so
// it is deliberately a staff-only, explicitly audited action.
router.post(
  '/',
  requireAuth,
  requireRole('ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT'),
  async (req: any, res) => {
    try {
      const { employeeId, date, status, notes } = req.body;
      const parsedDate = parseDate(date);
      const parsedEmployeeId = Number(employeeId);

      if (!Number.isInteger(parsedEmployeeId)) {
        return res.status(400).json({ error: 'Invalid employeeId' });
      }
      if (!parsedDate) return res.status(400).json({ error: 'Invalid date' });
      if (!VALID_STATUSES.has(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const employee = await prisma.employee.findFirst({
        where: { id: parsedEmployeeId },
      });
      if (!employee)
        return res.status(404).json({ error: 'Employee not found' });

      // upsert takes a unique where the tenant extension cannot scope, so the
      // idempotent path is an explicit find-then-write.
      const existing = await prisma.absenceRecord.findFirst({
        where: { employeeId: parsedEmployeeId, date: parsedDate },
      });

      if (existing) {
        await prisma.absenceRecord.updateMany({
          where: { id: existing.id },
          data: {
            status,
            source: 'MANUAL',
            notes: notes ?? null,
            recordedBy: req.user.id,
          },
        });
      } else {
        await prisma.absenceRecord.create({
          data: {
            tenantId: currentTenantId(),
            employeeId: parsedEmployeeId,
            date: parsedDate,
            status,
            source: 'MANUAL',
            notes: notes ?? null,
            recordedBy: req.user.id,
          },
        });
      }

      const record = await prisma.absenceRecord.findFirst({
        where: { employeeId: parsedEmployeeId, date: parsedDate },
      });

      await auditLog(
        req,
        existing ? 'UPDATE' : 'CREATE',
        'AbsenceRecord',
        record?.id ?? undefined,
        {
          employeeId: parsedEmployeeId,
          date: toIsoDate(parsedDate),
          status,
        },
      );

      res.status(existing ? 200 : 201).json(record);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },
);

router.delete(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT'),
  async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id))
        return res.status(400).json({ error: 'Invalid id' });

      const existing = await prisma.absenceRecord.findFirst({ where: { id } });
      if (!existing)
        return res.status(404).json({ error: 'Absence record not found' });

      await prisma.absenceRecord.deleteMany({ where: { id } });
      await auditLog(req, 'DELETE', 'AbsenceRecord', id, {
        employeeId: existing.employeeId,
        date: toIsoDate(existing.date),
      });

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },
);

export default router;
