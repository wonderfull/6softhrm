// Leave types and label formatting, shared by the Leave page and the calendar.

export const LEAVE_TYPES = [
  'ANNUAL',
  'SICK',
  'UNPAID',
  'MATERNITY',
  'PATERNITY',
  'COMPASSIONATE',
  'OTHER',
] as const;

// Normalise legacy enum-style values (ANNUAL, SICK, etc.) into the
// human label the rest of the UI uses ("Annual Leave", "Sick Leave"...).
// BEREAVEMENT is no longer offered but older rows still carry it.
export const LEAVE_TYPE_LABELS: Record<string, string> = {
  ANNUAL: 'Annual Leave',
  SICK: 'Sick Leave',
  UNPAID: 'Unpaid Leave',
  MATERNITY: 'Maternity Leave',
  PATERNITY: 'Paternity Leave',
  BEREAVEMENT: 'Bereavement Leave',
  COMPASSIONATE: 'Compassionate Leave',
  OTHER: 'Other',
};

export function formatLeaveType(raw: string | undefined | null) {
  if (!raw) return 'Leave';
  const upper = raw.toUpperCase();
  return LEAVE_TYPE_LABELS[upper] || raw;
}

export function formatWorkingDays(days: number | null | undefined) {
  if (days === null || days === undefined) return '';
  return `${days} working day${days === 1 ? '' : 's'}`;
}
