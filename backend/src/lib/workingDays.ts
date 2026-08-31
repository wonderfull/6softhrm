import bankHolidays from '../data/bank-holidays.json';

// UK working-day arithmetic for sponsor-duty deadlines. Bank holidays are
// vendored from gov.uk (see src/data/bank-holidays.json) because the regions
// diverge — 2 January and St Andrew's Day are Scotland-only, and getting this
// wrong shifts a Home Office reporting deadline.

export type WorkingDayConfig = {
  workingDays: string; // ISO weekday numbers, e.g. "1,2,3,4,5"
  bankHolidayRegion: string; // england-and-wales | scotland | northern-ireland
};

export const DEFAULT_WORKING_DAY_CONFIG: WorkingDayConfig = {
  workingDays: '1,2,3,4,5',
  bankHolidayRegion: 'england-and-wales',
};

const REGIONS: Record<string, string[]> = {
  'england-and-wales': bankHolidays['england-and-wales'],
  scotland: bankHolidays.scotland,
  'northern-ireland': bankHolidays['northern-ireland'],
};

const REGION_SETS = new Map<string, Set<string>>(
  Object.entries(REGIONS).map(([region, dates]) => [region, new Set(dates)]),
);

const ALL_DATES = Object.values(REGIONS).flat().sort();
export const BANK_HOLIDAY_DATA = {
  source: (bankHolidays as { _source: string })._source,
  fetched: (bankHolidays as { _fetched: string })._fetched,
  from: ALL_DATES[0],
  to: ALL_DATES[ALL_DATES.length - 1],
};

export function toUtcMidnight(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function toIsoDate(date: Date) {
  return toUtcMidnight(date).toISOString().slice(0, 10);
}

export function addUtcDays(date: Date, days: number) {
  const next = toUtcMidnight(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function parseWorkingDays(workingDays: string) {
  const parsed = workingDays
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7);
  return parsed.length ? new Set(parsed) : new Set([1, 2, 3, 4, 5]);
}

// getUTCDay() is Sun=0..Sat=6; TenantSettings.workingDays uses ISO Mon=1..Sun=7.
function isoWeekday(date: Date) {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

export function isBankHoliday(date: Date, region: string) {
  const set = REGION_SETS.get(region) || REGION_SETS.get('england-and-wales')!;
  return set.has(toIsoDate(date));
}

// False once the vendored calendar runs out — callers that care should surface
// this rather than silently treating every later date as a working day.
export function isCoveredByBankHolidayData(date: Date) {
  const iso = toIsoDate(date);
  return iso >= BANK_HOLIDAY_DATA.from && iso <= BANK_HOLIDAY_DATA.to;
}

export function isWorkingDay(
  date: Date,
  config: WorkingDayConfig = DEFAULT_WORKING_DAY_CONFIG,
) {
  const scheduled = parseWorkingDays(config.workingDays);
  if (!scheduled.has(isoWeekday(date))) return false;
  return !isBankHoliday(date, config.bankHolidayRegion);
}

export function addWorkingDays(
  date: Date,
  workingDays: number,
  config: WorkingDayConfig = DEFAULT_WORKING_DAY_CONFIG,
) {
  let remaining = workingDays;
  let next = toUtcMidnight(date);

  while (remaining > 0) {
    next = addUtcDays(next, 1);
    if (isWorkingDay(next, config)) remaining -= 1;
  }

  return next;
}

// Working days in [start, end] inclusive. Used to count absence spells.
export function countWorkingDays(
  start: Date,
  end: Date,
  config: WorkingDayConfig = DEFAULT_WORKING_DAY_CONFIG,
) {
  let count = 0;
  let cursor = toUtcMidnight(start);
  const last = toUtcMidnight(end);

  while (cursor.getTime() <= last.getTime()) {
    if (isWorkingDay(cursor, config)) count += 1;
    cursor = addUtcDays(cursor, 1);
  }

  return count;
}

export function eachWorkingDay(
  start: Date,
  end: Date,
  config: WorkingDayConfig = DEFAULT_WORKING_DAY_CONFIG,
) {
  const days: Date[] = [];
  let cursor = toUtcMidnight(start);
  const last = toUtcMidnight(end);

  while (cursor.getTime() <= last.getTime()) {
    if (isWorkingDay(cursor, config)) days.push(cursor);
    cursor = addUtcDays(cursor, 1);
  }

  return days;
}
