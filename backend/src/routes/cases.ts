import { Router } from 'express';
import prisma from '../prismaClient';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';
import { parseId } from '../lib/routeParams';
import { currentTenantId } from '../lib/tenantContext';

// Disciplinary, grievance and capability cases. The most sensitive records in
// the system: owners and directors only, never the office assistant, never the
// employee, and every single read is logged — who looked at a live grievance
// is itself a question that gets asked.

const router = Router();

const TYPES = new Set(['DISCIPLINARY', 'GRIEVANCE', 'CAPABILITY']);
const STAGES = new Set([
  'INFORMAL',
  'INVESTIGATION',
  'HEARING',
  'APPEAL',
  'CLOSED',
]);

const guard = [requireAuth, requireRole('ADMIN', 'DIRECTOR')] as const;

const parseDate = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const INCLUDE = {
  employee: { select: { id: true, firstName: true, lastName: true, department: true } },
};

router.get('/', ...guard, async (req: any, res) => {
  const where: any = {};
  if (req.query.employeeId) where.employeeId = Number(req.query.employeeId);
  if (req.query.open === '1') where.closedAt = null;

  const cases = await prisma.caseRecord.findMany({
    where,
    include: INCLUDE,
    orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
  });
  await auditLog(req, 'READ', 'CaseRecord', undefined, {
    count: cases.length,
    employeeId: where.employeeId,
  });
  res.json(cases);
});

router.get('/:id', ...guard, async (req: any, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });
  const record = await prisma.caseRecord.findFirst({
    where: { id },
    include: INCLUDE,
  });
  if (!record) return res.status(404).json({ error: 'Case not found' });
  await auditLog(req, 'READ', 'CaseRecord', id, {
    employeeId: record.employeeId,
  });
  res.json(record);
});

router.post('/', ...guard, async (req: any, res) => {
  const { employeeId, type, openedAt, stage, outcome, notes } = req.body ?? {};
  if (!employeeId || !type || !openedAt || !stage)
    return res
      .status(400)
      .json({ error: 'employeeId, type, openedAt and stage are required' });
  if (!TYPES.has(type))
    return res
      .status(400)
      .json({ error: `type must be one of ${[...TYPES].join(', ')}` });
  if (!STAGES.has(stage))
    return res
      .status(400)
      .json({ error: `stage must be one of ${[...STAGES].join(', ')}` });

  const opened = parseDate(openedAt);
  if (!opened) return res.status(400).json({ error: 'openedAt must be a date' });

  const employee = await prisma.employee.findFirst({
    where: { id: Number(employeeId) },
    select: { id: true },
  });
  if (!employee) return res.status(404).json({ error: 'Employee not found' });

  const record = await prisma.caseRecord.create({
    data: {
      tenantId: currentTenantId(),
      employeeId: Number(employeeId),
      type,
      openedAt: opened,
      stage,
      outcome: outcome ?? null,
      notes: notes ?? null,
    },
    include: INCLUDE,
  });
  await auditLog(req, 'CREATE', 'CaseRecord', record.id, {
    employeeId: record.employeeId,
    type,
  });
  res.json(record);
});

router.put('/:id', ...guard, async (req: any, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });
  const existing = await prisma.caseRecord.findFirst({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Case not found' });

  const data: any = {};
  if (req.body?.stage !== undefined) {
    if (!STAGES.has(req.body.stage))
      return res
        .status(400)
        .json({ error: `stage must be one of ${[...STAGES].join(', ')}` });
    data.stage = req.body.stage;
  }
  if (req.body?.outcome !== undefined) data.outcome = req.body.outcome || null;
  if (req.body?.notes !== undefined) data.notes = req.body.notes || null;
  if (req.body?.closed !== undefined) {
    data.closedAt = req.body.closed ? new Date() : null;
    if (req.body.closed) data.stage = data.stage ?? 'CLOSED';
  }
  if (Object.keys(data).length === 0)
    return res.status(400).json({ error: 'Nothing to update' });

  await prisma.caseRecord.updateMany({ where: { id }, data });
  const record = await prisma.caseRecord.findFirst({
    where: { id },
    include: INCLUDE,
  });
  await auditLog(req, 'UPDATE', 'CaseRecord', id, {
    employeeId: existing.employeeId,
    fields: Object.keys(data),
  });
  res.json(record);
});

router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req: any, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });
  const existing = await prisma.caseRecord.findFirst({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Case not found' });
  await prisma.caseRecord.deleteMany({ where: { id } });
  await auditLog(req, 'DELETE', 'CaseRecord', id, {
    employeeId: existing.employeeId,
  });
  res.json({ success: true });
});

export default router;
