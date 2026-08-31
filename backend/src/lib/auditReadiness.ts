// Audit-readiness score: one number a director looks at once a week. Home
// Office visits can be unannounced (C7.9) with full access on demand (C7.10),
// so the product sells readiness, not record-keeping.
//
// Weights are deliberately blunt. A score is useful because it moves when
// something breaks, not because the arithmetic is subtle — and every component
// is reported alongside it so the number is always explainable.

export type ReadinessInput = {
  /** Mean Appendix D completeness across active sponsorships, 0-100. */
  evidenceCompleteness: number;
  overdueEvents: number;
  openEvents: number;
  expiringDocuments: number;
  unresolvedAbsenceFlags: number;
  salaryFailures: number;
  sponsorshipsMissingCosTerms: number;
  activeSponsorships: number;
};

export type ReadinessComponent = {
  key: string;
  label: string;
  /** Points lost, already capped. */
  penalty: number;
  count: number;
  detail: string;
};

export type ReadinessReport = {
  score: number;
  band: 'READY' | 'AT_RISK' | 'NOT_READY';
  components: ReadinessComponent[];
  evidenceCompleteness: number;
};

const CAPS = {
  overdueEvents: 30,
  openEvents: 10,
  expiringDocuments: 10,
  unresolvedAbsenceFlags: 10,
  salaryFailures: 20,
  missingCosTerms: 10,
};

const PER_ITEM = {
  overdueEvents: 15,
  openEvents: 2,
  expiringDocuments: 2,
  unresolvedAbsenceFlags: 3,
  salaryFailures: 10,
  missingCosTerms: 5,
};

// An outstanding missed deadline caps the band regardless of score: a tenant
// with an overdue reportable event is not "ready" however tidy the rest is.
function band(score: number, overdueEvents: number): ReadinessReport['band'] {
  if (overdueEvents > 0) return score >= 60 ? 'AT_RISK' : 'NOT_READY';
  if (score >= 85) return 'READY';
  if (score >= 60) return 'AT_RISK';
  return 'NOT_READY';
}

export function scoreReadiness(input: ReadinessInput): ReadinessReport {
  // Evidence completeness is the base: a file with nothing in it is not ready
  // however few events are outstanding.
  const base = Math.max(0, Math.min(100, input.evidenceCompleteness));

  const components: ReadinessComponent[] = [
    {
      key: 'overdueEvents',
      label: 'Reportable events past their due date',
      count: input.overdueEvents,
      penalty: Math.min(
        CAPS.overdueEvents,
        input.overdueEvents * PER_ITEM.overdueEvents,
      ),
      detail:
        'A missed Home Office deadline is the single worst audit finding.',
    },
    {
      key: 'salaryFailures',
      label: 'Pay periods below the CoS salary',
      count: input.salaryFailures,
      penalty: Math.min(
        CAPS.salaryFailures,
        input.salaryFailures * PER_ITEM.salaryFailures,
      ),
      detail: 'Salary is assessed per pay period from 8 April 2026.',
    },
    {
      key: 'openEvents',
      label: 'Open reportable events',
      count: input.openEvents,
      penalty: Math.min(
        CAPS.openEvents,
        input.openEvents * PER_ITEM.openEvents,
      ),
      detail: 'Still within their reporting window, but unreported.',
    },
    {
      key: 'unresolvedAbsenceFlags',
      label: 'Unexplained absence days',
      count: input.unresolvedAbsenceFlags,
      penalty: Math.min(
        CAPS.unresolvedAbsenceFlags,
        input.unresolvedAbsenceFlags * PER_ITEM.unresolvedAbsenceFlags,
      ),
      detail: 'Days recorded as UNKNOWN that nobody has confirmed either way.',
    },
    {
      key: 'expiringDocuments',
      label: 'Documents expiring within 30 days',
      count: input.expiringDocuments,
      penalty: Math.min(
        CAPS.expiringDocuments,
        input.expiringDocuments * PER_ITEM.expiringDocuments,
      ),
      detail: 'Visas and passports that lapse before they are replaced.',
    },
    {
      key: 'missingCosTerms',
      label: 'Sponsorships with no salary recorded',
      count: input.sponsorshipsMissingCosTerms,
      penalty: Math.min(
        CAPS.missingCosTerms,
        input.sponsorshipsMissingCosTerms * PER_ITEM.missingCosTerms,
      ),
      detail: 'Salary compliance cannot be checked at all without CoS terms.',
    },
  ];

  const totalPenalty = components.reduce((sum, c) => sum + c.penalty, 0);
  const score = Math.max(0, Math.min(100, Math.round(base - totalPenalty)));

  return {
    score,
    band: band(score, input.overdueEvents),
    components: components.filter((c) => c.count > 0),
    evidenceCompleteness: Math.round(base),
  };
}
