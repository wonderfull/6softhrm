import { Router } from 'express';
import prisma from '../prismaClient';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';
import { parseId } from '../lib/routeParams';
import { currentTenantId } from '../lib/tenantContext';
import { canDecideLeave, visibleEmployeeIds } from '../lib/reportingLine';
import { notifyUsers } from '../lib/notify';
import { ROLES, normalizeRole } from '../lib/roles';

// Expense claims. Approval follows the same rule as leave: your line manager
// decides, and nobody decides their own.

const router = Router();

const CATEGORIES = new Set([
  'TRAVEL',
  'SUBSISTENCE',
  'EQUIPMENT',
  'TRAINING',
  'OTHER',
]);

const INCLUDE = {
  employee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      department: true,
      managerId: true,
    },
  },
  receipt: { select: { id: true, name: true } },
};

router.get('/', requireAuth, async (req: any, res) => {
  const visible = await visibleEmployeeIds(req.user);
  const where: any = {};
  if (visible !== null) where.employeeId = { in: visible };
  if (req.query.status) where.status = String(req.query.status);

  const claims = await prisma.expenseClaim.findMany({
    where,
    include: INCLUDE,
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
  });
  res.json(claims);
});

router.post('/', requireAuth, async (req: any, res) => {
  const user = req.user;
  const role = normalizeRole(user.role);
  let { employeeId, date, category, amount, description, receiptDocumentId } =
    req.body ?? {};

  if (role === ROLES.EMPLOYEE) {
    if (!user.employeeId)
      return res
        .status(403)
        .json({ error: 'User account is not linked to an employee record' });
    employeeId = user.employeeId;
  } else if (!employeeId && user.employeeId) {
    employeeId = user.employeeId;
  }
  if (!employeeId || !date || !category || amount === undefined)
    return res
      .status(400)
      .json({ error: 'employeeId, date, category and amount are required' });
  if (!CATEGORIES.has(category))
    return res
      .status(400)
      .json({ error: `category must be one of ${[...CATEGORIES].join(', ')}` });

  const when = new Date(date);
  if (Number.isNaN(when.getTime()))
    return res.status(400).json({ error: 'date must be a date' });
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0)
    return res.status(400).json({ error: 'amount must be more than zero' });

  const claim = await prisma.expenseClaim.create({
    data: {
      tenantId: currentTenantId(),
      employeeId: Number(employeeId),
      date: when,
      category,
      amount: Math.round(value * 100) / 100,
      description: description ? String(description) : null,
      receiptDocumentId: receiptDocumentId ? Number(receiptDocumentId) : null,
    },
    include: INCLUDE,
  });
  await auditLog(req, 'CREATE', 'ExpenseClaim', claim.id, {
    employeeId: claim.employeeId,
    amount: claim.amount,
  });

  try {
    const manager = claim.employee.managerId
      ? await prisma.user.findFirst({
          where: { employeeId: claim.employee.managerId },
          select: { id: true },
        })
      : null;
    if (manager)
      await notifyUsers([manager.id], {
        type: 'EXPENSE',
        title: `${claim.employee.firstName} ${claim.employee.lastName} claimed £${claim.amount.toFixed(2)}`,
        body: claim.description ?? undefined,
        link: '/expenses',
      });
  } catch (err) {
    console.error('Failed to notify about an expense claim:', err);
  }

  res.json(claim);
});

async function decide(req: any, res: any, status: 'APPROVED' | 'REJECTED' | 'PAID') {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });
  const existing = await prisma.expenseClaim.findFirst({
    where: { id },
    include: { employee: { select: { managerId: true } } },
  });
  if (!existing) return res.status(404).json({ error: 'Claim not found' });
  if (!canDecideLeave(req.user, existing))
    return res.status(403).json({ error: 'Unauthorized' });

  // PAID only makes sense once someone has agreed to pay it.
  if (status === 'PAID' && existing.status !== 'APPROVED')
    return res
      .status(409)
      .json({ error: 'Only an approved claim can be marked paid' });
  if (status !== 'PAID' && existing.status !== 'PENDING')
    return res
      .status(409)
      .json({ error: `Claim already ${existing.status.toLowerCase()}` });

  const note = req.body?.note ? String(req.body.note) : null;
  await prisma.expenseClaim.updateMany({
    where: { id },
    data: {
      status,
      decidedBy: req.user?.email ?? null,
      decidedAt: new Date(),
      decisionNote: note,
    },
  });
  const claim = await prisma.expenseClaim.findFirst({
    where: { id },
    include: INCLUDE,
  });
  await auditLog(req, status === 'REJECTED' ? 'REJECT' : 'APPROVE', 'ExpenseClaim', id, {
    status,
    note,
  });

  try {
    const account = await prisma.user.findFirst({
      where: { employeeId: existing.employeeId },
      select: { id: true },
    });
    if (account)
      await notifyUsers([account.id], {
        type: 'EXPENSE',
        title: `Expense claim ${status.toLowerCase()}`,
        body: note ?? undefined,
        link: '/expenses',
      });
  } catch (err) {
    console.error('Failed to notify about an expense decision:', err);
  }

  res.json(claim);
}

router.put('/:id/approve', requireAuth, (req, res) => decide(req, res, 'APPROVED'));
router.put('/:id/reject', requireAuth, (req, res) => decide(req, res, 'REJECTED'));
router.put('/:id/paid', requireAuth, requireRole('ADMIN', 'DIRECTOR'), (req, res) =>
  decide(req, res, 'PAID'),
);

router.delete('/:id', requireAuth, async (req: any, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });
  const existing = await prisma.expenseClaim.findFirst({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Claim not found' });

  const elevated = normalizeRole(req.user.role) !== ROLES.EMPLOYEE;
  const own = req.user.employeeId === existing.employeeId;
  if (!elevated && !own) return res.status(403).json({ error: 'Unauthorized' });
  if (!elevated && existing.status !== 'PENDING')
    return res
      .status(409)
      .json({ error: 'Only a pending claim can be withdrawn' });

  await prisma.expenseClaim.deleteMany({ where: { id } });
  await auditLog(req, 'DELETE', 'ExpenseClaim', id, {
    employeeId: existing.employeeId,
  });
  res.json({ success: true });
});

export default router;
