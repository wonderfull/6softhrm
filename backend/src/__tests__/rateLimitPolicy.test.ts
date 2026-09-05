import { shouldRelaxRateLimits } from '../lib/rateLimitPolicy';

// Playwright drives hundreds of requests a minute through a single IP, so the
// limits that protect production fail the suite instead of protecting
// anything. The opt-out exists for that — and must be impossible to switch on
// in production, where it would remove the brute-force protection entirely.

describe('shouldRelaxRateLimits', () => {
  it('relaxes them under the test runner', () => {
    expect(shouldRelaxRateLimits({ NODE_ENV: 'test' })).toBe(true);
  });

  it('relaxes them for a local end-to-end run that asks', () => {
    expect(
      shouldRelaxRateLimits({
        NODE_ENV: 'development',
        E2E_RELAX_RATE_LIMITS: '1',
      }),
    ).toBe(true);
  });

  it('ignores the flag in production, however it is set', () => {
    for (const value of ['1', 'true', 'yes']) {
      expect(
        shouldRelaxRateLimits({
          NODE_ENV: 'production',
          E2E_RELAX_RATE_LIMITS: value,
        }),
      ).toBe(false);
    }
  });

  it('relaxes them for a jest worker that did not set NODE_ENV', () => {
    expect(shouldRelaxRateLimits({ JEST_WORKER_ID: '1' })).toBe(true);
  });

  it('leaves the limits on by default', () => {
    expect(shouldRelaxRateLimits({ NODE_ENV: 'development' })).toBe(false);
    expect(shouldRelaxRateLimits({})).toBe(false);
    expect(
      shouldRelaxRateLimits({ NODE_ENV: 'development', E2E_RELAX_RATE_LIMITS: '0' }),
    ).toBe(false);
  });
});
