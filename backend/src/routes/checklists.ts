import { Router } from 'express';
import prisma, { platformPrisma } from '../prismaClient';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';
import { parseId } from '../lib/routeParams';
import { currentTenantId } from '../lib/tenantContext';
import { visibleEmployeeIds } from '../lib/reportingLine';
import { computeRetainUntil } from '../lib/retention';
import {
  CHECKLIST_KINDS,
  ChecklistKind,
  buildChecklist,
} from '../lib/checklists';

// Onboarding and offboarding checklists. A few items do the thing as well as
// record it — a checklist that says "revoke the login" and leaves the login
// working is worse than no checklist, because it reads as done.

const router = Router();

const KINDS = new Set<string>(CHECKLIST_KINDS);

router.get('/:employeeId', requireAuth, async (req: any, res) => {
  const employeeId = parseId(req.params.employeeId);
  if (!employeeId) return res.status(400).json({ error: 'Invalid id' });
  const visible = await visibleEmployeeIds(req.user);
  if (visible !== null && !visible.includes(employeeId))
    return res.status(403).json({ error: 'Unauthorized' });

  const items = await prisma.checklistItem.findMany({
    where: { employeeId, ...(req.query.kind ? { kind: String(req.query.kind) } : {}) },
    orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
  });
  res.json(items);
});

// Lay down a template. Idempotent per kind so pressing the button twice does
// not double the list.
router.post(
  '/:employeeId',
  requireAuth,
  requireRole('ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT'),
  async (req: any, res) => {
    const employeeId = parseId(req.params.employeeId);
  if (!employeeId) return res.status(400).json({ error: 'Invalid id' });
    const kind = String(req.body?.kind ?? '');
    if (!KINDS.has(kind))
      return res
        .status(400)
        .json({ error: `kind must be one of ${[...KINDS].join(', ')}` });

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId },
      select: { id: true, startDate: true, endDate: true },
    });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const existing = await prisma.checklistItem.count({
      where: { employeeId, kind },
    });
    if (existing > 0)
      return res
        .status(409)
        .json({ error: `This employee already has a ${kind.toLowerCase()} checklist` });

    const anchor =
      kind === 'ONBOARDING' ? employee.startDate : employee.endDate;
    const rows = buildChecklist(kind as ChecklistKind, anchor ?? null);
    for (const row of rows) {
      await prisma.checklistItem.create({
        data: { tenantId: currentTenantId(), employeeId, ...row },
      });
    }

    await auditLog(req, 'CREATE', 'ChecklistItem', employeeId, {
      kind,
      items: rows.length,
    });
    const items = await prisma.checklistItem.findMany({
      where: { employeeId, kind },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    res.json(items);
  },
);

/** Items that do something when ticked. Failures are reported, never silent. */
async function performAction(
  actionKey: string | null,
  employeeId: number,
): Promise<string | null> {
  if (!actionKey) return null;

  if (actionKey === 'REVOKE_LOGIN') {
    const account = await prisma.user.findFirst({
      where: { employeeId },
      select: { id: true },
    });
    if (!account) return 'No login was linked to this employee';
    await platformPrisma.googleAccount.deleteMany({
      where: { userId: account.id },
    });
    await prisma.user.deleteMany({ where: { id: account.id } });
    return 'Login revoked';
  }

  if (actionKey === 'SET_RETAIN_UNTIL') {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId },
      select: { endDate: true, retainUntil: true },
    });
    if (!employee?.endDate)
      return 'No leaving date on the record, so no retention date was set';
    if (employee.retainUntil) return 'Retention date was already set';
    const sponsorships = await prisma.sponsorship.findMany({
      where: { employeeId },
      select: { endDate: true },
    });
    await prisma.employee.updateMany({
      where: { id: employeeId },
      data: { retainUntil: computeRetainUntil(employee.endDate, sponsorships) },
    });
    return 'Retention date set';
  }

  if (actionKey === 'END_SPONSORSHIP') {
    const open = await prisma.sponsorship.count({
      where: { employeeId, active: true },
    });
    if (open === 0) return 'No active sponsorship to report';
    return `${open} active sponsorship(s) — raise the reportable event on the sponsorship record`;
  }

  return null;
}

router.put(
  '/item/:id',
  requireAuth,
  requireRole('ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT'),
  async (req: any, res) => {
    const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });
    const item = await prisma.checklistItem.findFirst({ where: { id } });
    if (!item) return res.status(404).json({ error: 'Checklist item not found' });

    const completed = req.body?.completed !== false;
    let actionResult: string | null = null;

    if (completed && !item.completedAt) {
      actionResult = await performAction(item.actionKey, item.employeeId);
    }

    await prisma.checklistItem.updateMany({
      where: { id },
      data: {
        completedAt: completed ? new Date() : null,
        completedBy: completed ? (req.user?.email ?? null) : null,
      },
    });
    await auditLog(req, 'UPDATE', 'ChecklistItem', id, {
      employeeId: item.employeeId,
      completed,
      actionKey: item.actionKey,
      actionResult,
    });

    const updated = await prisma.checklistItem.findFirst({ where: { id } });
    res.json({ ...updated, actionResult });
  },
);

router.delete(
  '/item/:id',
  requireAuth,
  requireRole('ADMIN', 'DIRECTOR'),
  async (req: any, res) => {
    const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });
    const deleted = await prisma.checklistItem.deleteMany({ where: { id } });
    if (deleted.count === 0)
      return res.status(404).json({ error: 'Checklist item not found' });
    await auditLog(req, 'DELETE', 'ChecklistItem', id);
    res.json({ success: true });
  },
);

export default router;
