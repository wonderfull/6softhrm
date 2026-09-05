import { describe, it, expect } from '@jest/globals';
import request from './helpers/http';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import app from '../app';
import { testPrisma as prisma } from './helpers/tenantTest';
import { totpCode, generateTotpSecret } from '../lib/totp';

const secret = () => process.env.JWT_SECRET || 'test-secret-key';

async function makeUser(
  email: string,
  password: string,
  extra: Record<string, unknown> = {},
) {
  await prisma.user.deleteMany({ where: { email } });
  const hash = await bcrypt.hash(password, 10);
  return prisma.user.create({
    data: { email, password: hash, role: 'ADMIN', name: email, ...extra },
  });
}

async function loginToken(email: string, password: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  expect(res.status).toBe(200);
  return res.body.token;
}

// Mirrors createPasswordResetPayload in routes/auth.ts.
function resetTokenFor(
  user: { id: number; email: string; tokenVersion: number },
  opts: jwt.SignOptions = { expiresIn: '1h' },
  signSecret = secret(),
) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      type: 'password-reset',
      tokenVersion: user.tokenVersion,
    },
    signSecret,
    opts,
  );
}

function authedProbe(token?: string) {
  const req = request(app).get('/api/auth/users');
  return token === undefined ? req : req.set('Authorization', token);
}

describe('requireAuth edge cases', () => {
  it('rejects missing, malformed and empty Authorization headers with clean 401s', async () => {
    for (const header of [
      undefined,
      'Token abc',
      'Bearer',
      'Bearer ',
      'Bearer not.a.jwt',
    ]) {
      const res = await authedProbe(header);
      expect(res.status).toBe(401);
      expect(res.body.error).toBeTruthy();
      expect(res.body.stack).toBeUndefined();
    }
  });

  it('rejects a well-formed token signed with the wrong secret', async () => {
    const user = await makeUser(
      'edge.wrongsecret@authflows.test',
      'edge-pass-1',
    );
    const forged = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: 'ADMIN',
        tenantId: user.tenantId,
        tokenVersion: 0,
      },
      'not-the-real-secret',
      { expiresIn: '8h' },
    );
    const res = await authedProbe(`Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  it('rejects a token for a user deleted after issue', async () => {
    const user = await makeUser('edge.deleted@authflows.test', 'edge-pass-2');
    const token = await loginToken(user.email, 'edge-pass-2');
    await prisma.user.deleteMany({ where: { id: user.id } });
    const res = await authedProbe(`Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('rejects a token with a stale tokenVersion', async () => {
    const user = await makeUser('edge.stale@authflows.test', 'edge-pass-3');
    const token = await loginToken(user.email, 'edge-pass-3');
    expect((await authedProbe(`Bearer ${token}`)).status).toBe(200);
    await prisma.user.updateMany({
      where: { id: user.id },
      data: { tokenVersion: { increment: 1 } },
    });
    const res = await authedProbe(`Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('never accepts special-purpose tokens as sessions', async () => {
    const user = await makeUser('edge.special@authflows.test', 'edge-pass-4');
    const reset = resetTokenFor(user);
    const pending = jwt.sign({ id: user.id, type: '2fa-pending' }, secret(), {
      expiresIn: '5m',
    });
    for (const token of [reset, pending]) {
      const res = await authedProbe(`Bearer ${token}`);
      expect(res.status).toBe(401);
    }
  });
});

describe('password reset token lifecycle', () => {
  it('forgot-password answers identically for known and unknown emails', async () => {
    await makeUser('reset.enum@authflows.test', 'reset-pass-0');
    const known = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'reset.enum@authflows.test' });
    const unknown = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@authflows.test' });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
    expect(JSON.stringify(known.body)).not.toContain('token');
  });

  it('rejects a session token used as a reset token', async () => {
    const user = await makeUser(
      'reset.confused@authflows.test',
      'reset-pass-1',
    );
    const session = await loginToken(user.email, 'reset-pass-1');
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: session, newPassword: 'reset-pass-1b' });
    expect(res.status).toBe(400);
    // password unchanged
    expect(
      (
        await request(app)
          .post('/api/auth/login')
          .send({ email: user.email, password: 'reset-pass-1' })
      ).status,
    ).toBe(200);
  });

  it('rejects expired and wrong-secret reset tokens cleanly', async () => {
    const user = await makeUser(
      'reset.badtokens@authflows.test',
      'reset-pass-2',
    );
    const expired = resetTokenFor(user, { expiresIn: -10 });
    const forged = resetTokenFor(
      user,
      { expiresIn: '1h' },
      'not-the-real-secret',
    );
    for (const token of [expired, forged]) {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token, newPassword: 'reset-pass-2b' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid or expired reset token');
      expect(res.body.stack).toBeUndefined();
    }
  });

  it('rejects a reset token for a user that no longer exists', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: resetTokenFor({
          id: 99999999,
          email: 'ghost@authflows.test',
          tokenVersion: 0,
        }),
        newPassword: 'ghost-pass-1',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid or expired reset token');
  });

  it('reset tokens are single-use', async () => {
    const user = await makeUser(
      'reset.singleuse@authflows.test',
      'reset-pass-3',
    );
    const token = resetTokenFor(user);

    const first = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'reset-pass-3b' });
    expect(first.status).toBe(200);
    expect(
      (
        await request(app)
          .post('/api/auth/login')
          .send({ email: user.email, password: 'reset-pass-3b' })
      ).status,
    ).toBe(200);

    const replay = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'attacker-pass-3c' });
    expect(replay.status).toBe(400);
    // replay must not have changed the password
    expect(
      (
        await request(app)
          .post('/api/auth/login')
          .send({ email: user.email, password: 'attacker-pass-3c' })
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/auth/login')
          .send({ email: user.email, password: 'reset-pass-3b' })
      ).status,
    ).toBe(200);
  });

  it('an unredeemed reset token dies when the password changes by another path', async () => {
    const user = await makeUser('reset.revoked@authflows.test', 'reset-pass-4');
    const token = resetTokenFor(user);
    // e.g. an admin reset in the meantime bumps tokenVersion
    await prisma.user.updateMany({
      where: { id: user.id },
      data: { tokenVersion: { increment: 1 } },
    });
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'reset-pass-4b' });
    expect(res.status).toBe(400);
  });

  it('a successful reset kills outstanding sessions', async () => {
    const user = await makeUser(
      'reset.sessions@authflows.test',
      'reset-pass-5',
    );
    const session = await loginToken(user.email, 'reset-pass-5');
    expect((await authedProbe(`Bearer ${session}`)).status).toBe(200);

    const reset = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: resetTokenFor(user), newPassword: 'reset-pass-5b' });
    expect(reset.status).toBe(200);

    expect((await authedProbe(`Bearer ${session}`)).status).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/auth/login')
          .send({ email: user.email, password: 'reset-pass-5b' })
      ).status,
    ).toBe(200);
  });

  it('an admin password reset also kills the victim outstanding sessions', async () => {
    const admin = await makeUser(
      'reset.byadmin.admin@authflows.test',
      'admin-pass-6',
    );
    const victim = await makeUser(
      'reset.byadmin.victim@authflows.test',
      'victim-pass-6',
    );
    const adminToken = await loginToken(admin.email, 'admin-pass-6');
    const victimSession = await loginToken(victim.email, 'victim-pass-6');

    const res = await request(app)
      .post(`/api/auth/users/${victim.id}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ newPassword: 'victim-pass-6b' });
    expect(res.status).toBe(200);

    expect((await authedProbe(`Bearer ${victimSession}`)).status).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/auth/login')
          .send({ email: victim.email, password: 'victim-pass-6b' })
      ).status,
    ).toBe(200);
  });
});

describe('2FA pending token lifecycle', () => {
  async function make2faUser(email: string, password: string) {
    const totpSecret = generateTotpSecret();
    const user = await makeUser(email, password, {
      totpSecret,
      totpEnabled: true,
    });
    return { user, totpSecret };
  }

  async function pendingFor(email: string, password: string): Promise<string> {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.requires2fa).toBe(true);
    return res.body.pendingToken;
  }

  it('rejects an expired pending token', async () => {
    const { user } = await make2faUser(
      'twofa.expired@authflows.test',
      'twofa-pass-1',
    );
    const expired = jwt.sign({ id: user.id, type: '2fa-pending' }, secret(), {
      expiresIn: -10,
    });
    const res = await request(app)
      .post('/api/auth/2fa/complete')
      .send({ pendingToken: expired, code: '123456' });
    expect(res.status).toBe(401);
    expect(res.body.stack).toBeUndefined();
  });

  it('rejects a session token or reset token passed as a pending token', async () => {
    const { user, totpSecret } = await make2faUser(
      'twofa.confused@authflows.test',
      'twofa-pass-2',
    );
    const session = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: 'ADMIN',
        tenantId: user.tenantId,
        tokenVersion: 0,
      },
      secret(),
      { expiresIn: '8h' },
    );
    const reset = resetTokenFor(user);
    for (const token of [session, reset]) {
      const res = await request(app)
        .post('/api/auth/2fa/complete')
        .send({ pendingToken: token, code: totpCode(totpSecret) });
      expect(res.status).toBe(401);
      expect(res.body.token).toBeUndefined();
    }
  });

  it('a failed attempt does not consume the pending token', async () => {
    const { user, totpSecret } = await make2faUser(
      'twofa.retry@authflows.test',
      'twofa-pass-3',
    );
    const pending = await pendingFor(user.email, 'twofa-pass-3');

    const wrong = await request(app)
      .post('/api/auth/2fa/complete')
      .send({ pendingToken: pending, code: '000000' });
    expect(wrong.status).toBe(401);

    const right = await request(app)
      .post('/api/auth/2fa/complete')
      .send({ pendingToken: pending, code: totpCode(totpSecret) });
    expect(right.status).toBe(200);
    expect(right.body.token).toBeTruthy();
  });

  it('a pending token is single-use: replay after completion fails', async () => {
    const { user, totpSecret } = await make2faUser(
      'twofa.replay@authflows.test',
      'twofa-pass-4',
    );
    const pending = await pendingFor(user.email, 'twofa-pass-4');
    const step = Math.floor(Date.now() / 30000);
    const code = totpCode(totpSecret, step);
    const nextCode = totpCode(totpSecret, step + 1);

    const first = await request(app)
      .post('/api/auth/2fa/complete')
      .send({ pendingToken: pending, code });
    expect(first.status).toBe(200);

    // same token + same code
    const sameCode = await request(app)
      .post('/api/auth/2fa/complete')
      .send({ pendingToken: pending, code });
    expect(sameCode.status).toBe(401);
    expect(sameCode.body.token).toBeUndefined();

    // same token + a fresh code — the token itself is spent
    const freshCode = await request(app)
      .post('/api/auth/2fa/complete')
      .send({ pendingToken: pending, code: nextCode });
    expect(freshCode.status).toBe(401);
    expect(freshCode.body.token).toBeUndefined();
  });

  it('an observed TOTP code cannot be replayed on a fresh pending token', async () => {
    const { user, totpSecret } = await make2faUser(
      'twofa.codereplay@authflows.test',
      'twofa-pass-5',
    );
    const pendingA = await pendingFor(user.email, 'twofa-pass-5');
    const pendingB = await pendingFor(user.email, 'twofa-pass-5');
    const step = Math.floor(Date.now() / 30000);
    const code = totpCode(totpSecret, step);

    const first = await request(app)
      .post('/api/auth/2fa/complete')
      .send({ pendingToken: pendingA, code });
    expect(first.status).toBe(200);

    // shoulder-surfed code, replayed within the drift window on another pending token
    const replay = await request(app)
      .post('/api/auth/2fa/complete')
      .send({ pendingToken: pendingB, code });
    expect(replay.status).toBe(401);
    expect(replay.body.token).toBeUndefined();

    // the next code is fresh, so the second pending token still works
    const fresh = await request(app)
      .post('/api/auth/2fa/complete')
      .send({ pendingToken: pendingB, code: totpCode(totpSecret, step + 1) });
    expect(fresh.status).toBe(200);
  });

  it('rejects a pending token when 2FA was disabled after login', async () => {
    const { user, totpSecret } = await make2faUser(
      'twofa.disabled@authflows.test',
      'twofa-pass-6',
    );
    const pending = await pendingFor(user.email, 'twofa-pass-6');
    await prisma.user.updateMany({
      where: { id: user.id },
      data: { totpEnabled: false },
    });
    const res = await request(app)
      .post('/api/auth/2fa/complete')
      .send({ pendingToken: pending, code: totpCode(totpSecret) });
    expect(res.status).toBe(401);
  });
});

describe('2FA enrolment', () => {
  it('setup cannot overwrite the secret of a user with 2FA already enabled', async () => {
    const totpSecret = generateTotpSecret();
    const user = await makeUser(
      'enrol.enabled@authflows.test',
      'enrol-pass-1',
      {
        totpSecret,
        totpEnabled: true,
      },
    );
    const session = await request(app)
      .post('/api/auth/2fa/complete')
      .send({
        pendingToken: (
          await request(app)
            .post('/api/auth/login')
            .send({ email: user.email, password: 'enrol-pass-1' })
        ).body.pendingToken,
        code: totpCode(totpSecret),
      });
    expect(session.status).toBe(200);

    const res = await request(app)
      .post('/api/auth/2fa/setup')
      .set('Authorization', `Bearer ${session.body.token}`);
    expect(res.status).toBe(400);
    const after = await prisma.user.findFirst({ where: { id: user.id } });
    expect(after.totpSecret).toBe(totpSecret);
    expect(after.totpEnabled).toBe(true);
  });

  it('enable without setup is rejected', async () => {
    const user = await makeUser('enrol.nosetup@authflows.test', 'enrol-pass-2');
    const token = await loginToken(user.email, 'enrol-pass-2');
    const res = await request(app)
      .post('/api/auth/2fa/enable')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: '123456' });
    expect(res.status).toBe(400);
  });

  it('re-running setup before enable rotates the pending secret; only the latest enables', async () => {
    const user = await makeUser('enrol.restart@authflows.test', 'enrol-pass-3');
    const token = await loginToken(user.email, 'enrol-pass-3');

    expect(
      (
        await request(app)
          .post('/api/auth/2fa/setup')
          .set('Authorization', `Bearer ${token}`)
      ).status,
    ).toBe(200);
    const first = (await prisma.user.findFirst({ where: { id: user.id } }))
      .totpSecret;
    expect(
      (
        await request(app)
          .post('/api/auth/2fa/setup')
          .set('Authorization', `Bearer ${token}`)
      ).status,
    ).toBe(200);
    const second = (await prisma.user.findFirst({ where: { id: user.id } }))
      .totpSecret;
    expect(second).not.toBe(first);

    const stale = await request(app)
      .post('/api/auth/2fa/enable')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: totpCode(first) });
    expect(stale.status).toBe(400);

    const fresh = await request(app)
      .post('/api/auth/2fa/enable')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: totpCode(second) });
    expect(fresh.status).toBe(200);
  });

  it('disable with a wrong code is rejected and 2FA stays on', async () => {
    const totpSecret = generateTotpSecret();
    const user = await makeUser(
      'enrol.disable@authflows.test',
      'enrol-pass-4',
      {
        totpSecret,
        totpEnabled: true,
      },
    );
    const complete = await request(app)
      .post('/api/auth/2fa/complete')
      .send({
        pendingToken: (
          await request(app)
            .post('/api/auth/login')
            .send({ email: user.email, password: 'enrol-pass-4' })
        ).body.pendingToken,
        code: totpCode(totpSecret),
      });
    expect(complete.status).toBe(200);

    const res = await request(app)
      .post('/api/auth/2fa/disable')
      .set('Authorization', `Bearer ${complete.body.token}`)
      .send({ code: '000000' });
    expect(res.status).toBe(400);
    const after = await prisma.user.findFirst({ where: { id: user.id } });
    expect(after.totpEnabled).toBe(true);
    expect(after.totpSecret).toBe(totpSecret);
  });
});
