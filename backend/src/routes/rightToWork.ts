import { Router } from 'express';
import prisma from '../prismaClient';
import { currentTenantId } from '../lib/tenantContext';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';
import { findReadableEmployee } from '../lib/employeeAccess';

// Mounted at /api/employees/:id/rtw. Every check is kept: the statutory
// excuse against a civil penalty rests on showing the check that was done at
// the time, so history is never overwritten, only added to.
const router = Router({ mergeParams: true });

const METHODS = new Set(['MANUAL', 'IDVT', 'HOME_OFFICE_ONLINE']);
const OUTCOMES = new Set(['PASS', 'FAIL']);

const parseDate = (value: unknown) => {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

router.get('/', requireAuth, async (req: any, res) => {
  const employeeId = Number(req.params.id);
  const employee = await findReadableEmployee(req, res, employeeId);
  if (!employee) return;

  const checks = await prisma.rightToWorkCheck.findMany({
    where: { employeeId },
    orderBy: [{ checkDate: 'desc' }, { id: 'desc' }],
    include: { document: { select: { id: true, name: true, type: true } } },
  });
  res.json(checks);
});

router.post(
  '/',
  requireAuth,
  requireRole('ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT'),
  async (req: any, res) => {
    const employeeId = Number(req.params.id);
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId },
    });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const { method, outcome, shareCode, documentId, notes } = req.body ?? {};
    if (!METHODS.has(method))
      return res.status(400).json({ error: 'method must be MANUAL, IDVT or HOME_OFFICE_ONLINE' });
    const result = outcome ?? 'PASS';
    if (!OUTCOMES.has(result))
      return res.status(400).json({ error: 'outcome must be PASS or FAIL' });
    const checkDate = parseDate(req.body?.checkDate) ?? new Date();
    if (checkDate.getTime() > Date.now() + 24 * 60 * 60 * 1000)
      return res.status(400).json({ error: 'checkDate cannot be in the future' });
    // An online check is only evidenced by the share code that was used.
    if (method === 'HOME_OFFICE_ONLINE' && !String(shareCode ?? '').trim())
      return res.status(400).json({ error: 'shareCode is required for an online check' });

    const timeLimited = Boolean(req.body?.timeLimited);
    let recheckDue: Date | null = null;
    if (timeLimited) {
      recheckDue = parseDate(req.body?.recheckDue) ?? employee.visaExpiryDate;
      if (!recheckDue)
        return res.status(400).json({
          error: 'recheckDue is required for a time-limited check (no visa expiry date on record to default to)',
        });
    }

    let docId: number | null = null;
    if (documentId) {
      const document = await prisma.document.findFirst({
        where: { id: Number(documentId) },
      });
      if (!document || document.employeeId !== employeeId)
        return res.status(400).json({ error: 'Document must belong to this employee' });
      docId = document.id;
    }

    try {
      const check = await prisma.rightToWorkCheck.create({
        data: {
          tenantId: currentTenantId(),
          employeeId,
          checkDate,
          method,
          shareCode: method === 'HOME_OFFICE_ONLINE' ? String(shareCode).trim() : null,
          outcome: result,
          timeLimited,
          recheckDue,
          documentId: docId,
          checkedBy: req.user?.id ?? null,
          notes: notes ? String(notes) : null,
        },
      });

      // A passed check is the Appendix D 2(a) evidence for every sponsorship
      // this worker holds, so file it there too rather than asking HR to
      // record the same fact twice.
      let evidenceCreated = 0;
      if (result === 'PASS') {
        const sponsorships = await prisma.sponsorship.findMany({
          where: { employeeId, active: true },
          select: { id: true },
        });
        for (const sponsorship of sponsorships) {
          await prisma.sponsorshipComplianceEvidence.create({
            data: {
              tenantId: currentTenantId(),
              sponsorshipId: sponsorship.id,
              documentId: docId,
              evidenceType: 'RIGHT_TO_WORK_CHECK',
              notes: `${method} check recorded ${checkDate.toISOString().slice(0, 10)}`,
              verifiedAt: checkDate,
              verifiedBy: req.user?.id ?? null,
            },
          });
          evidenceCreated += 1;
        }
      }

      await auditLog(req, 'CREATE', 'RightToWorkCheck', check.id, {
        employeeId,
        method,
        outcome: result,
        timeLimited,
        recheckDue,
        evidenceCreated,
      });
      res.status(201).json(check);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  },
);

router.delete('/:checkId', requireAuth, requireRole('ADMIN'), async (req: any, res) => {
  const employeeId = Number(req.params.id);
  const checkId = Number(req.params.checkId);
  const deleted = await prisma.rightToWorkCheck.deleteMany({
    where: { id: checkId, employeeId },
  });
  if (deleted.count === 0)
    return res.status(404).json({ error: 'Right-to-work check not found' });
  await auditLog(req, 'DELETE', 'RightToWorkCheck', checkId, { employeeId });
  res.json({ success: true });
});

export default router;
