import prisma from '../prismaClient';
import { addUtcDays } from './workingDays';
import {
  assessCompleteness,
  collectLatestEvidence,
  isSponsoredRoute,
} from './appendixD';
import { assessPeriods } from './salaryReconciliation';

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

/**
 * Gather every input the score needs and run it. Lives here rather than in a
 * route because the sponsorship screen and the reports summary both show the
 * same number, and two copies of this arithmetic would eventually disagree.
 * Must run inside a tenant context.
 */
export async function computeAuditReadiness(now = new Date()) {
  const in30Days = addUtcDays(now, 30);

  // Scoring only needs evidence presence and verification, so the evidence
  // documents themselves are deliberately not selected.
  const sponsorships = await prisma.sponsorship.findMany({
    where: { active: true },
    include: {
      employee: {
        select: {
          niNumber: true,
          rightToWorkChecks: {
            orderBy: { checkDate: 'desc' },
            take: 1,
            select: { id: true, checkDate: true, outcome: true, method: true },
          },
        },
      },
      complianceEvidence: {
        select: { evidenceType: true, verifiedAt: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  const sponsoredEmployeeIds = sponsorships.map((s: any) => s.employeeId);
  const withCosTerms = sponsorships.filter(
    (s: any) => s.cosSalary || s.goingRateSalary,
  );

  // One query for every sponsored worker's pay, grouped in memory — this ran
  // per sponsorship, so a 60-worker tenant issued 60 serial queries per load.
  const payRecords = await prisma.payRecord.findMany({
    where: { employeeId: { in: withCosTerms.map((s: any) => s.employeeId) } },
  });
  const payByEmployee = new Map<number, any[]>();
  for (const record of payRecords) {
    const list = payByEmployee.get(record.employeeId);
    if (list) list.push(record);
    else payByEmployee.set(record.employeeId, [record]);
  }

  let completenessTotal = 0;
  let missingCosTerms = 0;
  let salaryFailures = 0;

  for (const sponsorship of sponsorships) {
    completenessTotal += assessCompleteness(
      collectLatestEvidence(sponsorship),
      { sponsored: isSponsoredRoute(sponsorship) },
    ).percentage;

    if (!sponsorship.cosSalary && !sponsorship.goingRateSalary) {
      missingCosTerms += 1;
      continue;
    }
    salaryFailures += assessPeriods(
      payByEmployee.get(sponsorship.employeeId) ?? [],
      {
        cosSalary: sponsorship.cosSalary,
        goingRateSalary: sponsorship.goingRateSalary,
      },
    ).filter((a: any) => !a.compliant).length;
  }

  const [openEvents, overdueEvents, expiringVisas, unknownAbsences] =
    await Promise.all([
      prisma.sponsorshipReportableEvent.count({ where: { status: 'OPEN' } }),
      prisma.sponsorshipReportableEvent.count({
        where: { status: 'OPEN', dueDate: { lt: now } },
      }),
      prisma.employee.count({
        where: {
          id: { in: sponsoredEmployeeIds },
          visaExpiryDate: { gte: now, lte: in30Days },
        },
      }),
      prisma.absenceRecord.count({ where: { status: 'UNKNOWN' } }),
    ]);

  const report = scoreReadiness({
    evidenceCompleteness: sponsorships.length
      ? completenessTotal / sponsorships.length
      : 100,
    overdueEvents,
    // Overdue events are already penalised far more heavily; don't count twice.
    openEvents: Math.max(0, openEvents - overdueEvents),
    expiringDocuments: expiringVisas,
    unresolvedAbsenceFlags: unknownAbsences,
    salaryFailures,
    sponsorshipsMissingCosTerms: missingCosTerms,
    activeSponsorships: sponsorships.length,
  });

  return { ...report, activeSponsorships: sponsorships.length };
}
