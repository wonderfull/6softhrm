import { Router } from 'express';
import prisma from '../prismaClient';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';
import { parseId } from '../lib/routeParams';
import { currentTenantId } from '../lib/tenantContext';
import { visibleEmployeeIds } from '../lib/reportingLine';

// Training records. Certificates expire, and an expired mandatory certificate
// is the sort of thing an inspector finds before the employer does — so
// `expiresAt` is picked up by the nightly expiry sweep.

const router = Router();

const parseDate = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const INCLUDE = {
  employee: { select: { id: true, firstName: true, lastName: true } },
  certificate: { select: { id: true, name: true } },
};

router.get('/', requireAuth, async (req: any, res) => {
  const visible = await visibleEmployeeIds(req.user);
  const where: any = {};
  if (visible !== null) where.employeeId = { in: visible };
  if (req.query.employeeId) {
    const employeeId = Number(req.query.employeeId);
    if (visible !== null && !visible.includes(employeeId))
      return res.status(403).json({ error: 'Unauthorized' });
    where.employeeId = employeeId;
  }

  const records = await prisma.trainingRecord.findMany({
    where,
    include: INCLUDE,
    orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
  });
  res.json(records);
});

router.post(
  '/',
  requireAuth,
  requireRole('ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT'),
  async (req: any, res) => {
    const { employeeId, title, provider, completedAt, expiresAt, certificateDocumentId } =
      req.body ?? {};
    if (!employeeId || !title || !completedAt)
      return res
        .status(400)
        .json({ error: 'employeeId, title and completedAt are required' });

    const completed = parseDate(completedAt);
    if (!completed)
      return res.status(400).json({ error: 'completedAt must be a date' });
    const expires = expiresAt ? parseDate(expiresAt) : null;
    if (expiresAt && !expires)
      return res.status(400).json({ error: 'expiresAt must be a date' });
    if (expires && expires < completed)
      return res
        .status(400)
        .json({ error: 'expiresAt cannot be before completedAt' });

    const employee = await prisma.employee.findFirst({
      where: { id: Number(employeeId) },
      select: { id: true },
    });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const record = await prisma.trainingRecord.create({
      data: {
        tenantId: currentTenantId(),
        employeeId: Number(employeeId),
        title: String(title).trim(),
        provider: provider ? String(provider).trim() : null,
        completedAt: completed,
        expiresAt: expires,
        certificateDocumentId: certificateDocumentId
          ? Number(certificateDocumentId)
          : null,
      },
      include: INCLUDE,
    });
    await auditLog(req, 'CREATE', 'TrainingRecord', record.id, {
      employeeId: record.employeeId,
      title: record.title,
    });
    res.json(record);
  },
);

router.delete(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'DIRECTOR'),
  async (req: any, res) => {
    const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });
    const deleted = await prisma.trainingRecord.deleteMany({ where: { id } });
    if (deleted.count === 0)
      return res.status(404).json({ error: 'Training record not found' });
    await auditLog(req, 'DELETE', 'TrainingRecord', id);
    res.json({ success: true });
  },
);

export default router;
