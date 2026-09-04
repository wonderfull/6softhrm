// Appendix D (v08/26) evidence manifest. The guidance is explicit that "there
// is no prescribed method for storing the documents but you must be able to
// make them available to us on request" — it specifies what, never how. This
// is the what, turned into a checklist we can score and export.

export type EvidenceItem = {
  key: string;
  label: string;
  /** Appendix D reference, shown in the UI so the requirement is traceable. */
  reference: string;
  /** Only required for workers on a sponsored route. */
  sponsoredOnly?: boolean;
};

export const APPENDIX_D_EVIDENCE: EvidenceItem[] = [
  {
    key: 'RIGHT_TO_WORK_CHECK',
    label: 'Right-to-work check',
    reference: 'Appendix D 2(a)',
  },
  {
    key: 'PASSPORT_OR_EVISA',
    label: 'Passport or eVisa share-code evidence',
    reference: 'Appendix D 2(b)',
  },
  {
    key: 'COS_RECORD',
    label: 'Certificate of Sponsorship record',
    reference: 'Appendix D 3(a)',
    sponsoredOnly: true,
  },
  {
    key: 'SIGNED_CONTRACT',
    label: 'Signed employment contract',
    reference: 'Appendix D 3(b)',
  },
  {
    key: 'EMPLOYMENT_RIGHTS_NOTIFICATION',
    label: 'Employment rights notification',
    reference: 'Appendix D 3(c)',
  },
  {
    key: 'RECRUITMENT_EVIDENCE',
    label: 'Recruitment evidence',
    reference: 'Appendix D 4',
  },
  {
    key: 'SKILL_LEVEL_EVIDENCE',
    label: 'Skill-level evidence',
    reference: 'Appendix D 4',
  },
  {
    key: 'SALARY_EVIDENCE',
    label: 'Salary evidence',
    reference: 'Appendix D 5(a)',
  },
  {
    key: 'PAYSLIPS_12_MONTHS',
    label: 'Payslips (12 months)',
    reference: 'Appendix D 5(b)',
  },
  {
    key: 'BANK_TRANSFER_EVIDENCE',
    label: 'Bank transfer evidence (named worker)',
    reference: 'Appendix D 5(c)',
  },
  {
    key: 'CONTACT_DETAILS',
    label: 'Up-to-date contact details',
    reference: 'Appendix D 6(a)',
  },
  {
    key: 'NI_NUMBER',
    label: 'National Insurance number',
    reference: 'Appendix D 6(a)',
  },
  {
    key: 'ABSENCE_RECORDS',
    label: 'Absence records',
    reference: 'Appendix D 6(b)',
  },
];

export const APPENDIX_D_KEYS = new Set(
  APPENDIX_D_EVIDENCE.map((item) => item.key),
);

// Routes that carry no Certificate of Sponsorship. Anything else — or any row
// with CoS data on it — is treated as sponsored, because under-asking for
// evidence is the expensive mistake.
const UNSPONSORED_ROUTE =
  /\b(graduate(?! trainee)|dependant|dependent|student|indefinite leave|ilr|settled|settlement|youth mobility|ancestry|global talent|high potential|hpi|bno|british national|family|spouse|partner|refugee|humanitarian|eea)\b/i;

export function isSponsoredRoute(sponsorship: {
  visaType?: string | null;
  casNumber?: string | null;
  cosType?: string | null;
  cosAssignedDate?: Date | null;
}): boolean {
  if (
    sponsorship.casNumber ||
    sponsorship.cosType ||
    sponsorship.cosAssignedDate
  )
    return true;
  return !UNSPONSORED_ROUTE.test(sponsorship.visaType ?? '');
}

/**
 * Latest evidence row per type, plus evidence the system already holds
 * elsewhere: a stored NI number is the NI number, and a logged right-to-work
 * check is the check, whether or not someone also filed an evidence row.
 * Callers pass `complianceEvidence` ordered newest first.
 */
export function collectLatestEvidence(sponsorship: {
  complianceEvidence?: any[] | null;
  employee?: {
    niNumber?: string | null;
    rightToWorkChecks?: any[] | null;
  } | null;
}): Map<string, any> {
  const latest = new Map<string, any>();
  for (const evidence of sponsorship.complianceEvidence ?? []) {
    if (!latest.has(evidence.evidenceType))
      latest.set(evidence.evidenceType, evidence);
  }

  const employee = sponsorship.employee;
  if (!latest.has('NI_NUMBER') && employee?.niNumber) {
    latest.set('NI_NUMBER', {
      evidenceType: 'NI_NUMBER',
      source: 'EMPLOYEE_RECORD',
      verifiedAt: null,
      document: null,
    });
  }

  const check = employee?.rightToWorkChecks?.[0];
  if (!latest.has('RIGHT_TO_WORK_CHECK') && check && check.outcome === 'PASS') {
    latest.set('RIGHT_TO_WORK_CHECK', {
      evidenceType: 'RIGHT_TO_WORK_CHECK',
      source: 'RTW_CHECK',
      rightToWorkCheckId: check.id,
      checkDate: check.checkDate,
      method: check.method,
      recheckDue: check.recheckDue ?? null,
      verifiedAt: check.checkDate,
      documentId: check.documentId ?? null,
      document: check.document ?? null,
      notes: check.notes ?? null,
    });
  }

  return latest;
}

export type EvidenceStatus = {
  key: string;
  label: string;
  reference: string;
  status: 'COMPLETE' | 'MISSING';
  verified: boolean;
  evidence: any | null;
};

export type CompletenessReport = {
  items: EvidenceStatus[];
  requiredCount: number;
  completeCount: number;
  missingCount: number;
  /** 0-100, rounded. */
  percentage: number;
};

/**
 * Score a sponsorship's evidence against the manifest. `latestByType` should
 * hold the most recent evidence row per type. Unsponsored routes are not
 * asked for CoS evidence they cannot have.
 */
export function assessCompleteness(
  latestByType: Map<string, any>,
  options: { sponsored?: boolean } = {},
): CompletenessReport {
  const sponsored = options.sponsored ?? true;
  const required = APPENDIX_D_EVIDENCE.filter(
    (item) => sponsored || !item.sponsoredOnly,
  );
  const items: EvidenceStatus[] = required.map((item) => {
    const evidence = latestByType.get(item.key) ?? null;
    return {
      key: item.key,
      label: item.label,
      reference: item.reference,
      status: evidence ? 'COMPLETE' : 'MISSING',
      verified: Boolean(evidence?.verifiedAt),
      evidence,
    };
  });

  const completeCount = items.filter((i) => i.status === 'COMPLETE').length;
  const requiredCount = items.length;

  return {
    items,
    requiredCount,
    completeCount,
    missingCount: requiredCount - completeCount,
    percentage:
      requiredCount === 0
        ? 0
        : Math.round((completeCount / requiredCount) * 100),
  };
}

/**
 * Retention cutoff for a sponsored worker's records: the sponsor must keep them
 * throughout sponsorship and for one year after it ends. Distinct from the
 * 6-year HMRC default that applies to general payroll records.
 */
export function sponsorRetentionUntil(
  sponsorshipEnd: Date | null,
): Date | null {
  if (!sponsorshipEnd) return null;
  const until = new Date(sponsorshipEnd);
  until.setUTCFullYear(until.getUTCFullYear() + 1);
  return until;
}
