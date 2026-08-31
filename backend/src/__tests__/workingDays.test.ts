import {
  BANK_HOLIDAY_DATA,
  DEFAULT_WORKING_DAY_CONFIG,
  addWorkingDays,
  countWorkingDays,
  isBankHoliday,
  isCoveredByBankHolidayData,
  isWorkingDay,
  toIsoDate,
} from '../lib/workingDays';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const EW = DEFAULT_WORKING_DAY_CONFIG;
const SCOTLAND = { workingDays: '1,2,3,4,5', bankHolidayRegion: 'scotland' };

describe('bank holiday data', () => {
  it('covers all three UK regions into the future', () => {
    expect(BANK_HOLIDAY_DATA.to >= '2027-12-25').toBe(true);
    expect(isCoveredByBankHolidayData(d('2026-12-25'))).toBe(true);
  });

  it('reports dates beyond the vendored calendar as uncovered', () => {
    expect(isCoveredByBankHolidayData(d('2035-01-01'))).toBe(false);
  });
});

describe('isWorkingDay', () => {
  it('excludes weekends', () => {
    expect(isWorkingDay(d('2026-08-29'), EW)).toBe(false); // Saturday
    expect(isWorkingDay(d('2026-08-30'), EW)).toBe(false); // Sunday
  });

  // The previous implementation knew only about the early May bank holiday,
  // so each of these was wrongly treated as a working day.
  it('excludes Christmas, Boxing Day and the August bank holiday', () => {
    expect(isWorkingDay(d('2026-12-25'), EW)).toBe(false);
    expect(isWorkingDay(d('2026-12-28'), EW)).toBe(false); // substitute day
    expect(isWorkingDay(d('2026-08-31'), EW)).toBe(false); // late summer
  });

  it('excludes Good Friday and Easter Monday', () => {
    expect(isWorkingDay(d('2026-04-03'), EW)).toBe(false);
    expect(isWorkingDay(d('2026-04-06'), EW)).toBe(false);
  });

  it('still excludes the early May bank holiday', () => {
    expect(isWorkingDay(d('2026-05-04'), EW)).toBe(false);
  });

  it('treats an ordinary Tuesday as a working day', () => {
    expect(isWorkingDay(d('2026-09-01'), EW)).toBe(true);
  });
});

describe('regional divergence', () => {
  it('St Andrew’s Day is a holiday in Scotland only', () => {
    expect(isBankHoliday(d('2026-11-30'), 'scotland')).toBe(true);
    expect(isBankHoliday(d('2026-11-30'), 'england-and-wales')).toBe(false);
  });

  it('2 January is a holiday in Scotland only', () => {
    expect(isBankHoliday(d('2027-01-04'), 'scotland')).toBe(true);
    expect(isBankHoliday(d('2027-01-04'), 'england-and-wales')).toBe(false);
  });

  it('yields different deadlines for the same start date', () => {
    const from = d('2026-11-26');
    expect(toIsoDate(addWorkingDays(from, 5, EW))).not.toEqual(
      toIsoDate(addWorkingDays(from, 5, SCOTLAND)),
    );
  });
});

describe('tenant working-day patterns', () => {
  it('honours a four-day week', () => {
    const fourDay = {
      workingDays: '1,2,3,4',
      bankHolidayRegion: 'england-and-wales',
    };
    expect(isWorkingDay(d('2026-09-04'), fourDay)).toBe(false); // Friday
    expect(isWorkingDay(d('2026-09-04'), EW)).toBe(true);
  });

  it('honours a Sunday-inclusive shift pattern', () => {
    const shift = {
      workingDays: '1,2,3,4,5,6,7',
      bankHolidayRegion: 'england-and-wales',
    };
    expect(isWorkingDay(d('2026-08-30'), shift)).toBe(true);
  });

  it('falls back to Mon-Fri when the pattern is unparseable', () => {
    const broken = { workingDays: '', bankHolidayRegion: 'england-and-wales' };
    expect(isWorkingDay(d('2026-09-01'), broken)).toBe(true);
    expect(isWorkingDay(d('2026-08-29'), broken)).toBe(false);
  });
});

describe('addWorkingDays', () => {
  it('skips the weekend', () => {
    expect(toIsoDate(addWorkingDays(d('2026-09-03'), 2, EW))).toBe(
      '2026-09-07',
    );
  });

  it('skips bank holidays inside the window', () => {
    // 10 working days from 18 Dec 2026 must step over Christmas and Boxing Day.
    expect(toIsoDate(addWorkingDays(d('2026-12-18'), 10, EW))).toBe(
      '2027-01-06',
    );
  });
});

describe('countWorkingDays', () => {
  it('counts an inclusive range', () => {
    expect(countWorkingDays(d('2026-09-01'), d('2026-09-07'), EW)).toBe(5);
  });

  it('excludes bank holidays from the count', () => {
    // 21-24 and 29-31 are working; 25 Dec (Fri) and the 28th (Boxing Day
    // substitute, as the 26th is a Saturday) are not.
    expect(countWorkingDays(d('2026-12-21'), d('2026-12-31'), EW)).toBe(7);
  });
});
