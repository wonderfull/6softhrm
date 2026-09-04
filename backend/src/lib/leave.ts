import {
  WorkingDayConfig,
  addUtcDays,
  countWorkingDays,
  toUtcMidnight,
} from './workingDays';

// Leave policy arithmetic. Everything here is pure so the rules can be tested
// against the UK calendar without a database.

export const LEAVE_TYPES = [
  'ANNUAL',
  'SICK',
  'UNPAID',
  'MATERNITY',
  'PATERNITY',
  'COMPASSIONATE',
  'OTHER',
] as const;

export type LeaveType = (typeof LEAVE_TYPES)[number];

const LEAVE_TYPE_SET: ReadonlySet<string> = new Set(LEAVE_TYPES);

export function isLeaveType(value: unknown): value is LeaveType {
  return typeof value === 'string' && LEAVE_TYPE_SET.has(value);
}

/** Only annual leave draws down an allowance. */
export const DEDUCTS_FROM_ALLOWANCE: ReadonlySet<string> = new Set(['ANNUAL']);

export type LeaveSettings = WorkingDayConfig & {
  /** MM-DD the leave year turns over on. */
  leaveYearStart: string;
  defaultLeaveDays: number;
  carryoverCapDays: number;
};

export type LeaveYear = {
  start: Date;
  end: Date;
  /** "2026" when the year sits inside one calendar year, else "2026/27". */
  label: string;
};

const roundToHalf = (value: number) => Math.round(value * 2) / 2;

const daysInclusive = (start: Date, end: Date) =>
  Math.round((end.getTime() - start.getTime()) / 86400000) + 1;

/**
 * The leave year containing `reference`. A tenant on the default 01-01 gets
 * calendar years; one on 04-06 gets the tax year.
 */
export function leaveYearBounds(
  reference: Date,
  leaveYearStart = '01-01',
): LeaveYear {
  const [month, day] = leaveYearStart.split('-').map(Number);
  const safeMonth = Number.isFinite(month) ? month : 1;
  const safeDay = Number.isFinite(day) ? day : 1;

  const at = toUtcMidnight(reference);
  let start = new Date(Date.UTC(at.getUTCFullYear(), safeMonth - 1, safeDay));
  if (at.getTime() < start.getTime()) {
    start = new Date(Date.UTC(at.getUTCFullYear() - 1, safeMonth - 1, safeDay));
  }
  const end = addUtcDays(
    new Date(Date.UTC(start.getUTCFullYear() + 1, safeMonth - 1, safeDay)),
    -1,
  );

  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();
  const label =
    startYear === endYear
      ? String(startYear)
      : `${startYear}/${String(endYear).slice(-2)}`;

  return { start, end, label };
}

/**
 * Allowance scaled to the part of the leave year the person is actually
 * employed for. Rounded up-or-down to the nearest half day, which is how
 * holiday is booked.
 */
export function proratedAllowance(
  allowanceDays: number,
  year: LeaveYear,
  employment: { startDate?: Date | null; endDate?: Date | null } = {},
): number {
  const joined = employment.startDate
    ? toUtcMidnight(employment.startDate)
    : null;
  const left = employment.endDate ? toUtcMidnight(employment.endDate) : null;

  const from =
    joined && joined.getTime() > year.start.getTime() ? joined : year.start;
  const to = left && left.getTime() < year.end.getTime() ? left : year.end;
  if (to.getTime() < from.getTime()) return 0;

  const served = daysInclusive(from, to);
  const total = daysInclusive(year.start, year.end);
  if (served >= total) return roundToHalf(allowanceDays);
  return roundToHalf((allowanceDays * served) / total);
}

/**
 * Days brought into this leave year. An admin may record an exact figure on
 * the employee — a maternity carryover can exceed policy by agreement — and
 * that wins outright; otherwise last year's unused balance carries, trimmed
 * to the tenant's cap.
 */
export function carryover(
  unusedLastYear: number,
  capDays: number,
  override?: number | null,
): number {
  if (override !== null && override !== undefined)
    return Math.max(0, roundToHalf(override));
  return Math.max(0, roundToHalf(Math.min(unusedLastYear, capDays)));
}

export type BalanceRequest = {
  type: string;
  status: string;
  startDate: Date;
  endDate: Date;
  days: number;
};

export type LeaveBalance = {
  leaveYear: LeaveYear;
  /** Full-year entitlement before proration. */
  allowance: number;
  prorated: number;
  carriedOver: number;
  used: number;
  pending: number;
  remaining: number;
};

/**
 * Working days a request consumes. Rows written before `days` was stored
 * carry 0, so they are counted against today's calendar as a fallback — the
 * stored figure is always preferred because the calendar can change.
 */
export function requestDays(
  request: BalanceRequest,
  config: WorkingDayConfig,
): number {
  if (request.days > 0) return request.days;
  return countWorkingDays(request.startDate, request.endDate, config);
}

/** True when two inclusive date ranges share at least one day. */
export function overlaps(
  a: { startDate: Date; endDate: Date },
  b: { startDate: Date; endDate: Date },
): boolean {
  return (
    toUtcMidnight(a.startDate).getTime() <= toUtcMidnight(b.endDate).getTime() &&
    toUtcMidnight(b.startDate).getTime() <= toUtcMidnight(a.endDate).getTime()
  );
}

export function computeBalance(input: {
  reference?: Date;
  settings: LeaveSettings;
  employee: {
    startDate?: Date | null;
    endDate?: Date | null;
    leaveAllowanceDays?: number | null;
    leaveCarriedOverDays?: number | null;
  };
  requests: BalanceRequest[];
  /** Unused annual leave from the previous year, when the caller has it. */
  unusedLastYear?: number;
}): LeaveBalance {
  const { settings, employee, requests } = input;
  const leaveYear = leaveYearBounds(
    input.reference ?? new Date(),
    settings.leaveYearStart,
  );

  const allowance =
    employee.leaveAllowanceDays ?? settings.defaultLeaveDays ?? 0;
  const prorated = proratedAllowance(allowance, leaveYear, employee);
  const carriedOver = carryover(
    input.unusedLastYear ?? 0,
    settings.carryoverCapDays ?? 0,
    employee.leaveCarriedOverDays,
  );

  let used = 0;
  let pending = 0;
  for (const request of requests) {
    if (!DEDUCTS_FROM_ALLOWANCE.has(request.type)) continue;
    if (!overlaps(request, { startDate: leaveYear.start, endDate: leaveYear.end }))
      continue;
    const days = requestDays(request, settings);
    if (request.status === 'APPROVED') used += days;
    else if (request.status === 'PENDING') pending += days;
  }

  return {
    leaveYear,
    allowance,
    prorated,
    carriedOver,
    used: roundToHalf(used),
    pending: roundToHalf(pending),
    remaining: roundToHalf(prorated + carriedOver - used - pending),
  };
}
