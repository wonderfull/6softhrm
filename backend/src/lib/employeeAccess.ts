import prisma from '../prismaClient';
import { ROLES, canViewSponsorships, normalizeRole } from './roles';

// Absence carries sick-leave history and pay carries salary — both are private
// to the worker and to HR. Mirrors findAuthorizedSponsorshipForCompliance:
// a worker may read their own record, HR may read anyone's, and anyone else
// gets 404 rather than 403 so the response never confirms the record exists.
export async function findReadableEmployee(
  req: any,
  res: any,
  employeeId: number,
) {
  const user = req.user;
  const role = normalizeRole(user?.role);

  if (role === ROLES.EMPLOYEE) {
    if (!user?.employeeId || Number(user.employeeId) !== employeeId) {
      res.status(404).json({ error: 'Employee not found' });
      return null;
    }
  } else if (!canViewSponsorships(role)) {
    res.status(403).json({ error: 'forbidden' });
    return null;
  }

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId },
  });
  if (!employee) {
    res.status(404).json({ error: 'Employee not found' });
    return null;
  }

  return employee;
}
