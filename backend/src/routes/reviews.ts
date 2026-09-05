import { Router } from 'express';
import prisma from '../prismaClient';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';
import { parseId } from '../lib/routeParams';
import { currentTenantId } from '../lib/tenantContext';
import { visibleEmployeeIds } from '../lib/reportingLine';

// Performance reviews. The product's job is to make sure the conversation
// happens and is recorded — not to score anyone automatically.

const router = Router();

const TYPES = new Set(['PROBATION', 'ANNUAL', 'MID_YEAR']);
const RATINGS = new Set(['EXCEEDS', 'MEETS', 'BELOW', 'TOO_EARLY']);

const parseDate = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const REVIEW_INCLUDE = {
  employee: { select: { id: true, firstName: true, lastName: true, department: true } },
  reviewer: { select: { id: true, firstName: true, lastName: true } },
};

router.get('/', requireAuth, async (req: any, res) => {
  const visible = await visibleEmployeeIds(req.user);
  const filters: any = {};
  if (visible !== null) filters.employeeId = { in: visible };
  if (req.query.employeeId) {
    const employeeId = Number(req.query.employeeId);
    if (visible !== null && !visible.includes(employeeId))
      return res.status(403).json({ error: 'Unauthorized' });
    filters.employeeId = employeeId;
  }
  if (req.query.outstanding === '1') filters.completedAt = null;

  const reviews = await prisma.performanceReview.findMany({
    where: filters,
    include: REVIEW_INCLUDE,
    orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
  });
  res.json(reviews);
});

router.post(
  '/',
  requireAuth,
  requireRole('ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT'),
  async (req: any, res) => {
    const { employeeId, reviewerId, type, dueDate, summary, rating } = req.body ?? {};
    if (!employeeId || !type || !dueDate)
      return res
        .status(400)
        .json({ error: 'employeeId, type and dueDate are required' });
    if (!TYPES.has(type))
      return res
        .status(400)
        .json({ error: `type must be one of ${[...TYPES].join(', ')}` });
    const due = parseDate(dueDate);
    if (!due) return res.status(400).json({ error: 'dueDate must be a date' });
    if (rating && !RATINGS.has(rating))
      return res
        .status(400)
        .json({ error: `rating must be one of ${[...RATINGS].join(', ')}` });

    const employee = await prisma.employee.findFirst({
      where: { id: Number(employeeId) },
      select: { id: true },
    });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const review = await prisma.performanceReview.create({
      data: {
        tenantId: currentTenantId(),
        employeeId: Number(employeeId),
        reviewerId: reviewerId ? Number(reviewerId) : null,
        type,
        dueDate: due,
        rating: rating ?? null,
        summary: summary ?? null,
      },
      include: REVIEW_INCLUDE,
    });
    await auditLog(req, 'CREATE', 'PerformanceReview', review.id, {
      employeeId: review.employeeId,
      type,
    });
    res.json(review);
  },
);

// A line manager completes their own reports' reviews; that is the whole
// point of recording who reports to whom.
router.put('/:id', requireAuth, async (req: any, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });
  const existing = await prisma.performanceReview.findFirst({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Review not found' });

  const visible = await visibleEmployeeIds(req.user);
  const mayEdit =
    visible === null ||
    (visible.includes(existing.employeeId) &&
      existing.employeeId !== req.user?.employeeId);
  if (!mayEdit) return res.status(403).json({ error: 'Unauthorized' });

  const data: any = {};
  if (req.body?.rating !== undefined) {
    if (req.body.rating && !RATINGS.has(req.body.rating))
      return res
        .status(400)
        .json({ error: `rating must be one of ${[...RATINGS].join(', ')}` });
    data.rating = req.body.rating || null;
  }
  if (req.body?.summary !== undefined) data.summary = req.body.summary || null;
  if (req.body?.dueDate !== undefined) {
    const due = parseDate(req.body.dueDate);
    if (!due) return res.status(400).json({ error: 'dueDate must be a date' });
    data.dueDate = due;
  }
  if (req.body?.reviewerId !== undefined)
    data.reviewerId = req.body.reviewerId ? Number(req.body.reviewerId) : null;
  if (req.body?.completed !== undefined)
    data.completedAt = req.body.completed ? new Date() : null;
  if (Object.keys(data).length === 0)
    return res.status(400).json({ error: 'Nothing to update' });

  await prisma.performanceReview.updateMany({ where: { id }, data });
  const review = await prisma.performanceReview.findFirst({
    where: { id },
    include: REVIEW_INCLUDE,
  });
  await auditLog(req, 'UPDATE', 'PerformanceReview', id, {
    fields: Object.keys(data),
  });
  res.json(review);
});

router.delete(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'DIRECTOR'),
  async (req: any, res) => {
    const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });
    const deleted = await prisma.performanceReview.deleteMany({ where: { id } });
    if (deleted.count === 0)
      return res.status(404).json({ error: 'Review not found' });
    await auditLog(req, 'DELETE', 'PerformanceReview', id);
    res.json({ success: true });
  },
);

export default router;
