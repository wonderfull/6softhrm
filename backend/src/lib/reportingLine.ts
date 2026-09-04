import prisma from '../prismaClient';
import { canReviewLeaveAndTime, normalizeRole } from './roles';

// Who reports to whom. A line manager approves their own reports' leave and
// timesheets without needing an elevated role — the alternative is making
// every manager an HR admin, which is how tenants end up over-permissioned.

/** Employee ids reporting directly to `managerEmployeeId`. */
export async function directReportIds(
  managerEmployeeId: number,
): Promise<number[]> {
  const reports = await prisma.employee.findMany({
    where: { managerId: managerEmployeeId },
    select: { id: true },
  });
  return reports.map((r: { id: number }) => r.id);
}

/**
 * May this user decide that leave request? Elevated roles may decide anyone's;
 * a line manager may decide their own reports'. Nobody decides their own,
 * whatever their role.
 */
export function canDecideLeave(
  user: { role?: unknown; employeeId?: number | null } | undefined,
  request: { employeeId: number; employee?: { managerId?: number | null } | null },
): boolean {
  if (!user) return false;
  if (user.employeeId && user.employeeId === request.employeeId) return false;
  if (canReviewLeaveAndTime(normalizeRole(user.role))) return true;
  return Boolean(
    user.employeeId && request.employee?.managerId === user.employeeId,
  );
}

/**
 * Refuse a reporting line that loops back on itself — A reports to B reports
 * to A leaves every "who approves this" walk running forever.
 */
export async function assertNoCycle(
  employeeId: number,
  managerId: number,
): Promise<void> {
  if (employeeId === managerId) {
    throw new Error('An employee cannot report to themselves');
  }

  const seen = new Set<number>([employeeId]);
  let cursor: number | null = managerId;

  while (cursor !== null) {
    if (seen.has(cursor)) {
      throw new Error('That reporting line loops back on itself');
    }
    seen.add(cursor);
    const next: { managerId: number | null } | null =
      await prisma.employee.findFirst({
        where: { id: cursor },
        select: { managerId: true },
      });
    cursor = next?.managerId ?? null;
  }
}
