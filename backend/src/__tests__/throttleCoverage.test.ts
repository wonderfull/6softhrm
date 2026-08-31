import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from '@jest/globals';
import {
  FAILURE_THRESHOLD,
  LoginThrottle,
  loginThrottle,
} from '../lib/loginThrottle';
import { throttleLoginByAccount } from '../middleware/loginThrottle';

// The per-account throttle originally covered only /api/auth/login. The two
// surfaces below were left open: the platform console reaches every tenant,
// and a 2FA pending token stays valid for five minutes against a six-digit
// code — both are brute-forceable without a throttle.

describe('throttle key isolation', () => {
  it('keeps platform and tenant counters apart for the same email', () => {
    const throttle = new LoginThrottle();
    const email = 'shared@example.com';

    for (let i = 0; i < FAILURE_THRESHOLD; i += 1) {
      throttle.registerFailure(`platform:${email}`);
    }

    // The platform account is locked; the tenant account of the same name
    // must not be, or hammering the console becomes a denial-of-service
    // against ordinary users.
    expect(throttle.check(`platform:${email}`).locked).toBe(true);
    expect(throttle.check(email).locked).toBe(false);
  });

  it('keeps 2FA counters per user', () => {
    const throttle = new LoginThrottle();
    for (let i = 0; i < FAILURE_THRESHOLD; i += 1) {
      throttle.registerFailure('2fa:1');
    }
    expect(throttle.check('2fa:1').locked).toBe(true);
    expect(throttle.check('2fa:2').locked).toBe(false);
  });
});

describe('throttleLoginByAccount middleware', () => {
  const runMiddleware = (prefix: string, email: string) => {
    const req: any = { body: { email } };
    const res: any = {
      statusCode: 0,
      headers: {} as Record<string, string>,
      body: undefined,
      set(key: string, value: string) {
        this.headers[key] = value;
        return this;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        this.body = payload;
        return this;
      },
    };
    let nexted = false;
    throttleLoginByAccount(prefix)(req, res, () => {
      nexted = true;
    });
    return { res, nexted };
  };

  beforeAll(() => {
    loginThrottle.enabled = true;
  });

  afterAll(() => {
    loginThrottle.enabled = false;
    loginThrottle.clear();
  });

  beforeEach(() => {
    loginThrottle.clear();
  });

  it('passes an unknown account through', () => {
    expect(runMiddleware('platform:', 'nobody@example.com').nexted).toBe(true);
  });

  it('blocks once the account is locked, with Retry-After', () => {
    const email = 'admin@example.com';
    for (let i = 0; i < FAILURE_THRESHOLD; i += 1) {
      loginThrottle.registerFailure(`platform:${email}`);
    }

    const { res, nexted } = runMiddleware('platform:', email);
    expect(nexted).toBe(false);
    expect(res.statusCode).toBe(429);
    expect(res.headers['Retry-After']).toBeTruthy();
    expect(res.body.error).toMatch(/Too many failed login attempts/);
  });

  it('does not leak which prefix locked, and an empty body does not throw', () => {
    const req: any = { body: undefined };
    const res: any = {
      set() {
        return this;
      },
      status() {
        return this;
      },
      json() {
        return this;
      },
    };
    let nexted = false;
    expect(() =>
      throttleLoginByAccount('platform:')(req, res, () => {
        nexted = true;
      }),
    ).not.toThrow();
    expect(nexted).toBe(true);
  });
});
