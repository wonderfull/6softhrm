import {
  APPENDIX_D_EVIDENCE,
  assessCompleteness,
  sponsorRetentionUntil,
} from '../lib/appendixD';
import { scoreReadiness, ReadinessInput } from '../lib/auditReadiness';

const clean: ReadinessInput = {
  evidenceCompleteness: 100,
  overdueEvents: 0,
  openEvents: 0,
  expiringDocuments: 0,
  unresolvedAbsenceFlags: 0,
  salaryFailures: 0,
  sponsorshipsMissingCosTerms: 0,
  activeSponsorships: 3,
};

describe('Appendix D manifest', () => {
  it('keeps the five original evidence keys so existing rows still count', () => {
    const keys = new Set(APPENDIX_D_EVIDENCE.map((i) => i.key));
    for (const legacy of [
      'RIGHT_TO_WORK_CHECK',
      'EMPLOYMENT_RIGHTS_NOTIFICATION',
      'RECRUITMENT_EVIDENCE',
      'SALARY_EVIDENCE',
      'SKILL_LEVEL_EVIDENCE',
    ]) {
      expect(keys.has(legacy)).toBe(true);
    }
  });

  it('scores an empty file at zero', () => {
    const report = assessCompleteness(new Map());
    expect(report.percentage).toBe(0);
    expect(report.completeCount).toBe(0);
    expect(report.missingCount).toBe(report.requiredCount);
  });

  it('scores a full file at one hundred', () => {
    const full = new Map(
      APPENDIX_D_EVIDENCE.map((i) => [
        i.key,
        { id: 1, verifiedAt: new Date() },
      ]),
    );
    const report = assessCompleteness(full);
    expect(report.percentage).toBe(100);
    expect(report.items.every((i) => i.status === 'COMPLETE')).toBe(true);
    expect(report.items.every((i) => i.verified)).toBe(true);
  });

  it('marks evidence present but unverified', () => {
    const partial = new Map([
      ['RIGHT_TO_WORK_CHECK', { id: 1, verifiedAt: null }],
    ]);
    const item = assessCompleteness(partial).items.find(
      (i) => i.key === 'RIGHT_TO_WORK_CHECK',
    )!;
    expect(item.status).toBe('COMPLETE');
    expect(item.verified).toBe(false);
  });

  it('retains sponsored records for a year after sponsorship ends', () => {
    expect(
      sponsorRetentionUntil(new Date('2026-06-30T00:00:00Z'))?.toISOString(),
    ).toBe('2027-06-30T00:00:00.000Z');
    expect(sponsorRetentionUntil(null)).toBeNull();
  });
});

describe('audit readiness score', () => {
  it('gives a clean tenant full marks', () => {
    const report = scoreReadiness(clean);
    expect(report.score).toBe(100);
    expect(report.band).toBe('READY');
    expect(report.components).toEqual([]);
  });

  it('caps the score at the evidence completeness', () => {
    const report = scoreReadiness({ ...clean, evidenceCompleteness: 50 });
    expect(report.score).toBe(50);
  });

  it('penalises an overdue event hardest', () => {
    const overdue = scoreReadiness({ ...clean, overdueEvents: 1 });
    const open = scoreReadiness({ ...clean, openEvents: 1 });
    expect(overdue.score).toBeLessThan(open.score);
    expect(overdue.band).not.toBe('READY');
  });

  it('caps each penalty so one bad category cannot zero the score alone', () => {
    const report = scoreReadiness({ ...clean, openEvents: 500 });
    expect(report.score).toBe(90);
  });

  it('never drops below zero', () => {
    const report = scoreReadiness({
      evidenceCompleteness: 0,
      overdueEvents: 20,
      openEvents: 20,
      expiringDocuments: 20,
      unresolvedAbsenceFlags: 20,
      salaryFailures: 20,
      sponsorshipsMissingCosTerms: 20,
      activeSponsorships: 5,
    });
    expect(report.score).toBe(0);
    expect(report.band).toBe('NOT_READY');
  });

  it('reports only the components that actually apply', () => {
    const report = scoreReadiness({
      ...clean,
      salaryFailures: 2,
      expiringDocuments: 1,
    });
    expect(report.components.map((c) => c.key).sort()).toEqual([
      'expiringDocuments',
      'salaryFailures',
    ]);
  });

  it('bands the score', () => {
    expect(scoreReadiness({ ...clean, evidenceCompleteness: 90 }).band).toBe(
      'READY',
    );
    expect(scoreReadiness({ ...clean, evidenceCompleteness: 70 }).band).toBe(
      'AT_RISK',
    );
    expect(scoreReadiness({ ...clean, evidenceCompleteness: 40 }).band).toBe(
      'NOT_READY',
    );
  });
});
