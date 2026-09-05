import prisma from '../prismaClient';
import { currentTenantId } from '../lib/tenantContext';

// A probation review that nobody books is a probation that quietly passes.
// Recording a probation end date schedules the conversation two weeks before
// it, which is roughly the notice a manager needs to hold one.

const LEAD_DAYS = 14;

/**
 * Create or move the probation review for an employee. Does nothing when
 * there is no probation date, and never touches a review already held.
 */
export async function ensureProbationReview(employee: {
  id: number;
  probationEndDate?: Date | null;
}): Promise<void> {
  const existing = await prisma.performanceReview.findFirst({
    where: { employeeId: employee.id, type: 'PROBATION' },
    select: { id: true, completedAt: true },
  });

  if (!employee.probationEndDate) {
    // The date was cleared, so an unheld review is no longer due.
    if (existing && !existing.completedAt)
      await prisma.performanceReview.deleteMany({ where: { id: existing.id } });
    return;
  }

  const dueDate = new Date(employee.probationEndDate);
  dueDate.setUTCDate(dueDate.getUTCDate() - LEAD_DAYS);

  if (!existing) {
    await prisma.performanceReview.create({
      data: {
        tenantId: currentTenantId(),
        employeeId: employee.id,
        type: 'PROBATION',
        dueDate,
      },
    });
    return;
  }

  if (existing.completedAt) return;
  await prisma.performanceReview.updateMany({
    where: { id: existing.id },
    data: { dueDate },
  });
}
