// Per-pay-period salary reconciliation. From 8 April 2026 salary compliance is
// assessed per individual pay period rather than annually, so a worker who
// averages the right salary across a year can still breach in a given month.
//
// The threshold is the higher of the CoS salary and the going rate for the SOC
// code. The going rate is recorded per sponsorship rather than looked up from a
// vendored table, because those rates move with every guidance revision and a
// stale table would silently under-report.

export const SALARY_SHORTFALL_EVENT = 'SALARY_BELOW_COS';

// Tolerance for rounding in payroll exports — a few pence either way on an
// annualised figure is not a compliance breach.
const TOLERANCE = 1;

export type PayPeriod = {
  id?: number;
  periodStart: Date;
  periodEnd: Date;
  grossPay: number;
  hoursWorked?: number | null;
};

export type CosTerms = {
  cosSalary?: number | null;
  goingRateSalary?: number | null;
};

export type PeriodAssessment = {
  periodStart: Date;
  periodEnd: Date;
  days: number;
  grossPay: number;
  annualisedPay: number;
  requiredAnnualSalary: number;
  shortfall: number;
  compliant: boolean;
};

export function periodDays(period: PayPeriod) {
  const ms = period.periodEnd.getTime() - period.periodStart.getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

/**
 * Annualise a period's gross pay by its own length, so a four-weekly payroll
 * and a monthly one are compared on the same basis.
 */
export function annualisePay(period: PayPeriod) {
  return (period.grossPay * 365) / periodDays(period);
}

export function requiredAnnualSalary(terms: CosTerms): number | null {
  const candidates = [terms.cosSalary, terms.goingRateSalary].filter(
    (value): value is number => typeof value === 'number' && value > 0,
  );
  return candidates.length ? Math.max(...candidates) : null;
}

/**
 * Assess each period against the CoS terms. Returns an empty list when the
 * sponsorship has no salary recorded — an unknown threshold must never be
 * treated as a pass, so callers surface that as missing data instead.
 */
export function assessPeriods(
  periods: PayPeriod[],
  terms: CosTerms,
): PeriodAssessment[] {
  const required = requiredAnnualSalary(terms);
  if (required === null) return [];

  return periods.map((period) => {
    const annualisedPay = annualisePay(period);
    const shortfall = required - annualisedPay;
    return {
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      days: periodDays(period),
      grossPay: period.grossPay,
      annualisedPay: Math.round(annualisedPay * 100) / 100,
      requiredAnnualSalary: required,
      shortfall: Math.round(Math.max(0, shortfall) * 100) / 100,
      compliant: shortfall <= TOLERANCE,
    };
  });
}

export function failingPeriods(periods: PayPeriod[], terms: CosTerms) {
  return assessPeriods(periods, terms).filter(
    (assessment) => !assessment.compliant,
  );
}
