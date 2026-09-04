import {
  carryover,
  computeBalance,
  isLeaveType,
  leaveYearBounds,
  overlaps,
  proratedAllowance,
  requestDays,
} from '../lib/leave';
import { countWorkingDays } from '../lib/workingDays';

// Pure policy arithmetic — no database, no tenant context.

const EW = { workingDays: '1,2,3,4,5', bankHolidayRegion: 'england-and-wales' };
const SCOTLAND = { workingDays: '1,2,3,4,5', bankHolidayRegion: 'scotland' };

const SETTINGS = {
  ...EW,
  leaveYearStart: '01-01',
  defaultLeaveDays: 28,
  carryoverCapDays: 5,
};

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('working-day counting over the Christmas shutdown', () => {
  it('counts 24-29 December 2026 as two working days in England and Wales', () => {
    // 25 Dec and the 28th (Boxing Day substitute) are bank holidays, and the
    // 26th and 27th fall on the weekend.
    expect(countWorkingDays(utc('2026-12-24'), utc('2026-12-29'), EW)).toBe(2);
  });

  it('honours the Scottish 2 January holiday that England does not have', () => {
    expect(countWorkingDays(utc('2026-01-01'), utc('2026-01-05'), EW)).toBe(2);
    expect(countWorkingDays(utc('2026-01-01'), utc('2026-01-05'), SCOTLAND)).toBe(
      1,
    );
  });
});

describe('leaveYearBounds', () => {
  it('gives the calendar year on the default start', () => {
    const year = leaveYearBounds(utc('2026-08-15'), '01-01');
    expect(year.start.toISOString().slice(0, 10)).toBe('2026-01-01');
    expect(year.end.toISOString().slice(0, 10)).toBe('2026-12-31');
    expect(year.label).toBe('2026');
  });

  it('gives the tax year on a 06 April start, and labels it across two years', () => {
    const year = leaveYearBounds(utc('2026-08-15'), '04-06');
    expect(year.start.toISOString().slice(0, 10)).toBe('2026-04-06');
    expect(year.end.toISOString().slice(0, 10)).toBe('2027-04-05');
    expect(year.label).toBe('2026/27');
  });

  it('rolls back to the previous year before the start date', () => {
    const year = leaveYearBounds(utc('2026-02-01'), '04-06');
    expect(year.start.toISOString().slice(0, 10)).toBe('2025-04-06');
    expect(year.end.toISOString().slice(0, 10)).toBe('2026-04-05');
  });
});

describe('proratedAllowance', () => {
  const year = leaveYearBounds(utc('2026-06-01'), '01-01');

  it('gives the full allowance to someone employed all year', () => {
    expect(proratedAllowance(28, year, { startDate: utc('2020-01-01') })).toBe(
      28,
    );
  });

  it('halves it for a mid-year joiner, rounded to the nearest half day', () => {
    expect(proratedAllowance(28, year, { startDate: utc('2026-07-01') })).toBe(
      14,
    );
  });

  it('prorates a leaver by the part of the year they were here', () => {
    expect(
      proratedAllowance(28, year, {
        startDate: utc('2020-01-01'),
        endDate: utc('2026-06-30'),
      }),
    ).toBe(14);
  });

  it('gives nothing to someone who left before the year started', () => {
    expect(
      proratedAllowance(28, year, { endDate: utc('2025-06-30') }),
    ).toBe(0);
  });
});

describe('carryover', () => {
  it('carries last year\'s unused days, trimmed to the cap', () => {
    expect(carryover(10, 5)).toBe(5);
    expect(carryover(3, 5)).toBe(3);
  });

  it('lets a hand-set figure beat the cap', () => {
    expect(carryover(10, 5, 8)).toBe(8);
  });

  it('treats an explicit zero as a decision, not a missing value', () => {
    expect(carryover(10, 5, 0)).toBe(0);
  });

  it('never goes negative', () => {
    expect(carryover(-4, 5)).toBe(0);
    expect(carryover(10, 5, -2)).toBe(0);
  });
});

describe('computeBalance', () => {
  const requests = [
    {
      type: 'ANNUAL',
      status: 'APPROVED',
      startDate: utc('2026-03-02'),
      endDate: utc('2026-03-06'),
      days: 5,
    },
    {
      type: 'ANNUAL',
      status: 'PENDING',
      startDate: utc('2026-04-01'),
      endDate: utc('2026-04-02'),
      days: 2,
    },
    {
      type: 'SICK',
      status: 'APPROVED',
      startDate: utc('2026-05-01'),
      endDate: utc('2026-05-01'),
      days: 1,
    },
    {
      type: 'ANNUAL',
      status: 'APPROVED',
      startDate: utc('2025-06-01'),
      endDate: utc('2025-06-05'),
      days: 5,
    },
  ];

  it('counts only this year\'s annual leave, split into used and pending', () => {
    const balance = computeBalance({
      reference: utc('2026-06-01'),
      settings: SETTINGS,
      employee: { startDate: utc('2020-01-01') },
      requests,
      unusedLastYear: 4,
    });

    expect(balance.leaveYear.label).toBe('2026');
    expect(balance.prorated).toBe(28);
    expect(balance.carriedOver).toBe(4);
    expect(balance.used).toBe(5);
    expect(balance.pending).toBe(2);
    expect(balance.remaining).toBe(25);
  });

  it('caps the carry-in and lets a per-employee allowance override the policy', () => {
    const balance = computeBalance({
      reference: utc('2026-06-01'),
      settings: SETTINGS,
      employee: { startDate: utc('2020-01-01'), leaveAllowanceDays: 33 },
      requests,
      unusedLastYear: 12,
    });

    expect(balance.allowance).toBe(33);
    expect(balance.prorated).toBe(33);
    expect(balance.carriedOver).toBe(5);
    expect(balance.remaining).toBe(31);
  });

  it('counts a legacy row with no stored days against today\'s calendar', () => {
    const legacy = {
      type: 'ANNUAL',
      status: 'APPROVED',
      startDate: utc('2026-09-07'),
      endDate: utc('2026-09-11'),
      days: 0,
    };
    expect(requestDays(legacy, SETTINGS)).toBe(5);

    const balance = computeBalance({
      reference: utc('2026-09-15'),
      settings: SETTINGS,
      employee: { startDate: utc('2020-01-01') },
      requests: [legacy],
    });
    expect(balance.used).toBe(5);
    expect(balance.remaining).toBe(23);
  });
});

describe('overlaps and type validation', () => {
  it('spots a shared day at either end of the range', () => {
    const a = { startDate: utc('2026-05-04'), endDate: utc('2026-05-08') };
    expect(overlaps(a, { startDate: utc('2026-05-08'), endDate: utc('2026-05-12') })).toBe(true);
    expect(overlaps(a, { startDate: utc('2026-05-01'), endDate: utc('2026-05-04') })).toBe(true);
    expect(overlaps(a, { startDate: utc('2026-05-09'), endDate: utc('2026-05-12') })).toBe(false);
  });

  it('accepts only the seven leave types', () => {
    expect(isLeaveType('ANNUAL')).toBe(true);
    expect(isLeaveType('OTHER')).toBe(true);
    expect(isLeaveType('PERSONAL')).toBe(false);
    expect(isLeaveType('Annual Leave')).toBe(false);
  });
});
