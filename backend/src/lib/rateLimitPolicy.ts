/**
 * Whether to skip the rate limiters. They exist to blunt brute-force and
 * scraping, so the only reasons to lift them are automated runs against a
 * throwaway database: Jest, and a local end-to-end suite that asks explicitly.
 *
 * Production ignores the opt-in outright. A limiter that can be switched off
 * by an environment variable is no limiter at all, and this is the sort of
 * flag that gets copied into a deployment config by accident.
 */
type RateLimitEnv = {
  NODE_ENV?: string;
  E2E_RELAX_RATE_LIMITS?: string;
  JEST_WORKER_ID?: string;
};

export function shouldRelaxRateLimits(
  env: RateLimitEnv = process.env as RateLimitEnv,
): boolean {
  if (env.NODE_ENV === 'production') return false;
  if (env.NODE_ENV === 'test' || env.JEST_WORKER_ID) return true;
  return env.E2E_RELAX_RATE_LIMITS === '1';
}
