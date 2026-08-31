import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app';
import { testPrisma as prisma, testTenantId } from './helpers/tenantTest';
import { totpCode, verifyTotp, base32Decode, base32Encode } from '../lib/totp';

describe('Two-factor authentication', () => {
  const email = 'admin@twofactor.test';
  const password = 'twofactor-pass-1';
  let token: string;

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    const hash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: { email, password: hash, role: 'ADMIN', name: '2FA Admin' },
    });
    const login = await request(app).post('/api/auth/login').send({ email, password });
    token = `Bearer ${login.body.token}`;
  });

  it('base32 round-trips and codes verify', () => {
    const buf = Buffer.from('hello totp world!');
    expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true);
    const secret = base32Encode(Buffer.from('12345678901234567890'));
    // RFC 6238 SHA-1 test vector: T=59s → step 1 → code 287082
    expect(totpCode(secret, 1)).toBe('287082');
    expect(verifyTotp(totpCode(secret), secret)).toBe(true);
    expect(verifyTotp('000000', secret)).toBe(false);
  });

  it('enrols: setup → enable with a valid code', async () => {
    const setup = await request(app)
      .post('/api/auth/2fa/setup')
      .set('Authorization', token);
    expect(setup.status).toBe(200);
    expect(setup.body.otpauth).toContain('otpauth://totp/OnsideHR');
    expect(setup.body.qrDataUrl).toContain('data:image/png');

    const user = await prisma.user.findFirst({ where: { email } });
    const bad = await request(app)
      .post('/api/auth/2fa/enable')
      .set('Authorization', token)
      .send({ code: '000000' });
    expect(bad.status).toBe(400);

    const good = await request(app)
      .post('/api/auth/2fa/enable')
      .set('Authorization', token)
      .send({ code: totpCode(user.totpSecret) });
    expect(good.status).toBe(200);
    expect(good.body.enabled).toBe(true);
  });

  it('login becomes two-step and completes with a valid code', async () => {
    const login = await request(app).post('/api/auth/login').send({ email, password });
    expect(login.status).toBe(200);
    expect(login.body.requires2fa).toBe(true);
    expect(login.body.token).toBeUndefined();

    const wrong = await request(app)
      .post('/api/auth/2fa/complete')
      .send({ pendingToken: login.body.pendingToken, code: '123456' });
    expect(wrong.status).toBe(401);

    const user = await prisma.user.findFirst({ where: { email } });
    const done = await request(app)
      .post('/api/auth/2fa/complete')
      .send({ pendingToken: login.body.pendingToken, code: totpCode(user.totpSecret) });
    expect(done.status).toBe(200);
    expect(done.body.token).toBeTruthy();
    expect(done.body.user.tenant.id).toBe(testTenantId());

    // pending token is NOT a session token
    const misuse = await request(app)
      .get('/api/employees')
      .set('Authorization', `Bearer ${login.body.pendingToken}`);
    expect(misuse.status).toBe(401);
  });

  it('disable requires a valid current code', async () => {
    const user = await prisma.user.findFirst({ where: { email } });
    const noCode = await request(app)
      .post('/api/auth/2fa/disable')
      .set('Authorization', token);
    expect(noCode.status).toBe(400);

    const ok = await request(app)
      .post('/api/auth/2fa/disable')
      .set('Authorization', token)
      .send({ code: totpCode(user.totpSecret) });
    expect(ok.status).toBe(200);

    const login = await request(app).post('/api/auth/login').send({ email, password });
    expect(login.body.requires2fa).toBeUndefined();
    expect(login.body.token).toBeTruthy();
  });
});
