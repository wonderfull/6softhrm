// Sponsor guidance moves constantly — Part 3 was revised five times in
// seventeen months and Appendix D was updated in August 2026. Versioning the
// rules and showing the version in the UI is both a correctness measure and a
// signal that the compliance logic is maintained rather than shipped once.
//
// Update these alongside any change to the rules they govern, as part of the
// monthly guidance review.

export const GUIDANCE_VERSIONS = {
  sponsorGuidancePart3: {
    version: '05/26',
    reviewedOn: '2026-08-31',
    rules: ['UNAUTHORISED_ABSENCE_10_DAYS (C1.15)', 'SALARY_BELOW_COS (C7.7)'],
  },
  appendixD: {
    version: '08/26',
    reviewedOn: '2026-08-31',
    rules: ['Appendix D evidence manifest'],
  },
} as const;

export function guidanceSummary() {
  return {
    sponsorGuidancePart3: GUIDANCE_VERSIONS.sponsorGuidancePart3.version,
    appendixD: GUIDANCE_VERSIONS.appendixD.version,
    lastReviewed: GUIDANCE_VERSIONS.appendixD.reviewedOn,
  };
}
