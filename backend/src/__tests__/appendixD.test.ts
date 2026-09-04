import { describe, expect, it } from '@jest/globals';
import {
  APPENDIX_D_EVIDENCE,
  assessCompleteness,
  collectLatestEvidence,
  isSponsoredRoute,
} from '../lib/appendixD';

// Pure checks on the evidence manifest: the NI number is a listed Appendix D
// item, unsponsored routes are not scored against CoS evidence, and facts the
// system already holds (NI number, a logged RTW check) count as evidence.

describe('Appendix D manifest', () => {
  it('lists the National Insurance number as required evidence', () => {
    const item = APPENDIX_D_EVIDENCE.find((i) => i.key === 'NI_NUMBER');
    expect(item).toBeDefined();
    expect(item!.sponsoredOnly).toBeFalsy();
  });

  it('drops sponsored-only items for an unsponsored route', () => {
    const full = assessCompleteness(new Map());
    const unsponsored = assessCompleteness(new Map(), { sponsored: false });
    expect(full.items.some((i) => i.key === 'COS_RECORD')).toBe(true);
    expect(unsponsored.items.some((i) => i.key === 'COS_RECORD')).toBe(false);
    expect(unsponsored.requiredCount).toBe(full.requiredCount - 1);
  });

  it('treats CoS-bearing rows as sponsored whatever the visa type says', () => {
    expect(isSponsoredRoute({ visaType: 'Skilled Worker' })).toBe(true);
    expect(isSponsoredRoute({ visaType: 'Graduate' })).toBe(false);
    expect(isSponsoredRoute({ visaType: 'Graduate Trainee' })).toBe(true);
    expect(isSponsoredRoute({ visaType: 'Dependant' })).toBe(false);
    expect(isSponsoredRoute({ visaType: 'Dependant', casNumber: 'C2G' })).toBe(true);
    expect(isSponsoredRoute({ visaType: 'Student', cosType: 'DEFINED' })).toBe(true);
  });

  it('synthesises NI and RTW evidence from the employee record', () => {
    const check = {
      id: 7,
      checkDate: new Date('2026-01-15'),
      method: 'HOME_OFFICE_ONLINE',
      outcome: 'PASS',
      recheckDue: new Date('2027-01-15'),
      documentId: null,
    };
    const latest = collectLatestEvidence({
      complianceEvidence: [],
      employee: { niNumber: 'QQ123456C', rightToWorkChecks: [check] },
    });
    expect(latest.get('NI_NUMBER')?.source).toBe('EMPLOYEE_RECORD');
    const rtw = latest.get('RIGHT_TO_WORK_CHECK');
    expect(rtw.method).toBe('HOME_OFFICE_ONLINE');
    expect(rtw.verifiedAt).toEqual(check.checkDate);

    const report = assessCompleteness(latest);
    const byKey = Object.fromEntries(report.items.map((i) => [i.key, i]));
    expect(byKey.NI_NUMBER.status).toBe('COMPLETE');
    expect(byKey.NI_NUMBER.verified).toBe(false);
    expect(byKey.RIGHT_TO_WORK_CHECK.status).toBe('COMPLETE');
    expect(byKey.RIGHT_TO_WORK_CHECK.verified).toBe(true);
  });

  it('never counts a failed check as evidence and prefers a filed row', () => {
    const failed = { id: 1, checkDate: new Date(), method: 'MANUAL', outcome: 'FAIL' };
    expect(
      collectLatestEvidence({ employee: { rightToWorkChecks: [failed] } }).has(
        'RIGHT_TO_WORK_CHECK',
      ),
    ).toBe(false);

    const filed = { id: 99, evidenceType: 'RIGHT_TO_WORK_CHECK', verifiedAt: null };
    const latest = collectLatestEvidence({
      complianceEvidence: [filed],
      employee: { rightToWorkChecks: [{ ...failed, outcome: 'PASS' }] },
    });
    expect(latest.get('RIGHT_TO_WORK_CHECK')).toBe(filed);
  });
});
