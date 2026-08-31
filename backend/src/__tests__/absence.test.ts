import { deriveLedger, findUnauthorisedSpells } from '../lib/absence';
import { DEFAULT_WORKING_DAY_CONFIG, toIsoDate } from '../lib/workingDays';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const EW = DEFAULT_WORKING_DAY_CONFIG;

// Mon 7 Sep 2026 .. Fri 25 Sep 2026 — three clean working weeks, no bank holidays.
const FROM = d('2026-09-07');
const TO = d('2026-09-25');

const unauthorised = (isos: string[]) =>
  isos.map((iso) => ({
    date: d(iso),
    status: 'UNAUTHORISED',
    source: 'MANUAL',
  }));

describe('deriveLedger', () => {
  it('omits ordinary attended days', () => {
    expect(deriveLedger({ from: FROM, to: TO, config: EW })).toEqual([]);
  });

  it('marks approved annual leave as authorised', () => {
    const ledger = deriveLedger({
      from: FROM,
      to: TO,
      config: EW,
      leave: [
        {
          type: 'ANNUAL',
          status: 'APPROVED',
          startDate: d('2026-09-07'),
          endDate: d('2026-09-09'),
        },
      ],
    });
    expect(ledger.map((l) => l.iso)).toEqual([
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
    ]);
    expect(ledger.every((l) => l.status === 'AUTHORISED')).toBe(true);
    expect(ledger.every((l) => l.source === 'LEAVE_REQUEST')).toBe(true);
  });

  it('distinguishes sick leave from annual leave', () => {
    const ledger = deriveLedger({
      from: FROM,
      to: TO,
      config: EW,
      leave: [
        {
          type: 'SICK',
          status: 'APPROVED',
          startDate: d('2026-09-07'),
          endDate: d('2026-09-07'),
        },
      ],
    });
    expect(ledger[0].status).toBe('SICK');
  });

  it('ignores leave that was never approved', () => {
    for (const status of ['PENDING', 'REJECTED', 'CANCELLED']) {
      const ledger = deriveLedger({
        from: FROM,
        to: TO,
        config: EW,
        leave: [
          {
            type: 'ANNUAL',
            status,
            startDate: d('2026-09-07'),
            endDate: d('2026-09-09'),
          },
        ],
      });
      expect(ledger).toEqual([]);
    }
  });

  it('skips weekends when expanding a leave range', () => {
    const ledger = deriveLedger({
      from: FROM,
      to: TO,
      config: EW,
      leave: [
        {
          type: 'ANNUAL',
          status: 'APPROVED',
          startDate: d('2026-09-11'),
          endDate: d('2026-09-14'),
        },
      ],
    });
    expect(ledger.map((l) => l.iso)).toEqual(['2026-09-11', '2026-09-14']);
  });

  it('lets a manual mark override approved leave', () => {
    const ledger = deriveLedger({
      from: FROM,
      to: TO,
      config: EW,
      leave: [
        {
          type: 'ANNUAL',
          status: 'APPROVED',
          startDate: d('2026-09-07'),
          endDate: d('2026-09-07'),
        },
      ],
      manual: [
        { date: d('2026-09-07'), status: 'UNAUTHORISED', source: 'MANUAL' },
      ],
    });
    expect(ledger[0].status).toBe('UNAUTHORISED');
    expect(ledger[0].source).toBe('MANUAL');
  });

  it('never infers UNAUTHORISED from a timesheet gap', () => {
    const ledger = deriveLedger({
      from: FROM,
      to: TO,
      config: EW,
      useTimesheetGaps: true,
      timesheetDates: [],
    });
    expect(ledger.length).toBeGreaterThan(0);
    expect(ledger.every((l) => l.status === 'UNKNOWN')).toBe(true);
    expect(findUnauthorisedSpells(ledger, FROM, TO, EW)).toEqual([]);
  });

  it('ignores timesheets entirely unless the tenant opts in', () => {
    expect(
      deriveLedger({ from: FROM, to: TO, config: EW, timesheetDates: [] }),
    ).toEqual([]);
  });
});

describe('findUnauthorisedSpells', () => {
  it('finds nothing in a clean ledger', () => {
    expect(findUnauthorisedSpells([], FROM, TO, EW)).toEqual([]);
  });

  it('counts a run across a weekend as consecutive working days', () => {
    // Thu 10th, Fri 11th, then Mon 14th — the weekend does not break the run.
    const ledger = deriveLedger({
      from: FROM,
      to: TO,
      config: EW,
      manual: unauthorised(['2026-09-10', '2026-09-11', '2026-09-14']),
    });
    const spells = findUnauthorisedSpells(ledger, FROM, TO, EW);
    expect(spells).toHaveLength(1);
    expect(spells[0].workingDays).toBe(3);
    expect(toIsoDate(spells[0].start)).toBe('2026-09-10');
    expect(toIsoDate(spells[0].end)).toBe('2026-09-14');
  });

  it('breaks the run on a day the employee attended', () => {
    const ledger = deriveLedger({
      from: FROM,
      to: TO,
      config: EW,
      manual: unauthorised([
        '2026-09-07',
        '2026-09-08',
        '2026-09-10',
        '2026-09-11',
      ]),
    });
    const spells = findUnauthorisedSpells(ledger, FROM, TO, EW);
    expect(spells.map((s) => s.workingDays)).toEqual([2, 2]);
  });

  it('breaks the run on authorised leave taken mid-absence', () => {
    const ledger = deriveLedger({
      from: FROM,
      to: TO,
      config: EW,
      leave: [
        {
          type: 'ANNUAL',
          status: 'APPROVED',
          startDate: d('2026-09-09'),
          endDate: d('2026-09-09'),
        },
      ],
      manual: unauthorised(['2026-09-07', '2026-09-08', '2026-09-10']),
    });
    expect(
      findUnauthorisedSpells(ledger, FROM, TO, EW).map((s) => s.workingDays),
    ).toEqual([2, 1]);
  });

  // The C1.15 boundary: the report is due at 10 consecutive working days.
  it('reaches exactly 10 working days across two weekends', () => {
    const isos = [
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
      '2026-09-18',
    ];
    const ledger = deriveLedger({
      from: FROM,
      to: TO,
      config: EW,
      manual: unauthorised(isos),
    });
    const spells = findUnauthorisedSpells(ledger, FROM, TO, EW);
    expect(spells[0].workingDays).toBe(10);
    expect(toIsoDate(spells[0].end)).toBe('2026-09-18');
  });

  it('does not count a bank holiday inside the spell', () => {
    // Christmas week 2026: 25 Dec and 28 Dec are holidays in England & Wales.
    const from = d('2026-12-21');
    const to = d('2026-12-31');
    const isos = [
      '2026-12-21',
      '2026-12-22',
      '2026-12-23',
      '2026-12-24',
      '2026-12-29',
    ];
    const ledger = deriveLedger({
      from,
      to,
      config: EW,
      manual: unauthorised(isos),
    });
    const spells = findUnauthorisedSpells(ledger, from, to, EW);
    expect(spells).toHaveLength(1);
    expect(spells[0].workingDays).toBe(5);
  });
});
