import {
  annualisePay,
  assessPeriods,
  failingPeriods,
  periodDays,
  requiredAnnualSalary,
} from '../lib/salaryReconciliation';
import { parsePayImportFile } from '../lib/payImport';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const month = (start: string, end: string, grossPay: number) => ({
  periodStart: d(start),
  periodEnd: d(end),
  grossPay,
});

describe('period arithmetic', () => {
  it('counts an inclusive calendar month', () => {
    expect(periodDays(month('2026-01-01', '2026-01-31', 0))).toBe(31);
  });

  it('annualises a monthly period', () => {
    // £2,500 over 31 days annualises to about £29,435.
    const annual = annualisePay(month('2026-01-01', '2026-01-31', 2500));
    expect(Math.round(annual)).toBe(29435);
  });

  it('annualises a four-weekly period on the same basis', () => {
    const annual = annualisePay(month('2026-01-01', '2026-01-28', 2300));
    expect(Math.round(annual)).toBe(29982);
  });
});

describe('requiredAnnualSalary', () => {
  it('takes the higher of CoS salary and going rate', () => {
    expect(
      requiredAnnualSalary({ cosSalary: 30000, goingRateSalary: 38700 }),
    ).toBe(38700);
    expect(
      requiredAnnualSalary({ cosSalary: 45000, goingRateSalary: 38700 }),
    ).toBe(45000);
  });

  it('works from either figure alone', () => {
    expect(requiredAnnualSalary({ cosSalary: 30000 })).toBe(30000);
    expect(requiredAnnualSalary({ goingRateSalary: 38700 })).toBe(38700);
  });

  it('returns null when neither is recorded', () => {
    expect(requiredAnnualSalary({})).toBeNull();
    expect(
      requiredAnnualSalary({ cosSalary: 0, goingRateSalary: null }),
    ).toBeNull();
  });
});

describe('assessPeriods', () => {
  const terms = { cosSalary: 30000 };

  it('passes a compliant period', () => {
    const [a] = assessPeriods([month('2026-01-01', '2026-01-31', 2600)], terms);
    expect(a.compliant).toBe(true);
    expect(a.shortfall).toBe(0);
  });

  it('fails a period paid below the CoS salary', () => {
    const [a] = assessPeriods([month('2026-01-01', '2026-01-31', 2000)], terms);
    expect(a.compliant).toBe(false);
    expect(a.shortfall).toBeGreaterThan(0);
  });

  // The whole point of the 8 April 2026 change: the annual average passing
  // does not excuse an individual period that falls short.
  it('flags a single short month even when the year averages out', () => {
    const periods = [
      month('2026-01-01', '2026-01-31', 1500), // short
      month('2026-02-01', '2026-02-28', 4000), // makes up for it
    ];
    const failures = failingPeriods(periods, terms);
    expect(failures).toHaveLength(1);
    expect(failures[0].periodStart).toEqual(d('2026-01-01'));
  });

  it('returns nothing to assess when no threshold is recorded', () => {
    expect(assessPeriods([month('2026-01-01', '2026-01-31', 1)], {})).toEqual(
      [],
    );
    expect(failingPeriods([month('2026-01-01', '2026-01-31', 1)], {})).toEqual(
      [],
    );
  });

  it('tolerates rounding pence', () => {
    // Exactly on threshold, give or take rounding in the payroll export.
    const [a] = assessPeriods(
      [month('2026-01-01', '2026-01-31', 2547.94)],
      terms,
    );
    expect(a.compliant).toBe(true);
  });
});

describe('pay CSV import', () => {
  const csv = (body: string) => Buffer.from(body, 'utf8');

  it('parses a valid file', () => {
    const { rows, headerErrors } = parsePayImportFile(
      csv(
        'Email,Period Start,Period End,Gross Pay,Hours Worked\n' +
          'a@b.com,2026-01-01,2026-01-31,2500,160\n',
      ),
    );
    expect(headerErrors).toEqual([]);
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].data.grossPay).toBe(2500);
    expect(rows[0].data.hoursWorked).toBe(160);
  });

  it('reports a missing required column', () => {
    const { headerErrors } = parsePayImportFile(
      csv('Email,Period Start\na@b.com,2026-01-01\n'),
    );
    expect(headerErrors.join(' ')).toMatch(/Gross Pay/);
  });

  it('accepts UK dates and pound signs', () => {
    const { rows } = parsePayImportFile(
      csv(
        'Email,Period Start,Period End,Gross Pay\na@b.com,31/01/2026,28/02/2026,"£2,500"\n',
      ),
    );
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].data.grossPay).toBe(2500);
    expect(rows[0].data.periodStart).toEqual(d('2026-01-31'));
  });

  it('allows the same employee across several periods', () => {
    const { rows } = parsePayImportFile(
      csv(
        'Email,Period Start,Period End,Gross Pay\n' +
          'a@b.com,2026-01-01,2026-01-31,2500\n' +
          'a@b.com,2026-02-01,2026-02-28,2500\n',
      ),
    );
    expect(rows.every((r) => r.errors.length === 0)).toBe(true);
  });

  it('rejects a duplicated period for the same employee', () => {
    const { rows } = parsePayImportFile(
      csv(
        'Email,Period Start,Period End,Gross Pay\n' +
          'a@b.com,2026-01-01,2026-01-31,2500\n' +
          'a@b.com,2026-01-01,2026-01-31,2600\n',
      ),
    );
    expect(rows[1].errors.join(' ')).toMatch(/Duplicate pay period/);
  });

  it('rejects a period that ends before it starts', () => {
    const { rows } = parsePayImportFile(
      csv(
        'Email,Period Start,Period End,Gross Pay\na@b.com,2026-02-01,2026-01-01,2500\n',
      ),
    );
    expect(rows[0].errors.join(' ')).toMatch(/cannot be before/);
  });

  it('rejects negative and non-numeric pay', () => {
    const { rows } = parsePayImportFile(
      csv(
        'Email,Period Start,Period End,Gross Pay\n' +
          'a@b.com,2026-01-01,2026-01-31,-100\n' +
          'b@b.com,2026-01-01,2026-01-31,abc\n',
      ),
    );
    expect(rows[0].errors.join(' ')).toMatch(/negative/);
    expect(rows[1].errors.join(' ')).toMatch(/not a number/);
  });
});
