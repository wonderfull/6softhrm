import { describe, it, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import app from '../app';

// The rate limiters key on req.ip. With `trust proxy: true` Express takes the
// LEFTMOST X-Forwarded-For entry, which the client sends — so a fresh fake IP
// per request walks straight through them. Trusting exactly one hop makes
// req.ip the address Nginx appended, which the client cannot forge.

const SPOOFED = '203.0.113.9';
const REAL = '198.51.100.7';

describe('trust proxy', () => {
  it('trusts exactly one hop, not every forwarded address', () => {
    expect(app.get('trust proxy')).toBe(1);
  });

  it('ignores a client-supplied X-Forwarded-For entry', async () => {
    // Mirror the app's setting on a probe app so we can read req.ip back.
    const probe = express();
    probe.set('trust proxy', app.get('trust proxy'));
    probe.get('/whoami', (req, res) => res.json({ ip: req.ip }));

    // Models the real chain: the client sends a forged entry, then Nginx
    // appends the address it actually saw. Testing a lone forged entry would
    // prove nothing, because without a proxy there is no real address to prefer.
    const spoofed = await request(probe)
      .get('/whoami')
      .set('X-Forwarded-For', `${SPOOFED}, ${REAL}`);

    expect(spoofed.body.ip).toBe(REAL);
    expect(spoofed.body.ip).not.toBe(SPOOFED);
  });

  it('would have honoured the spoof under the permissive setting', async () => {
    // Documents precisely what was wrong before, so a revert to `true` is
    // recognisable rather than silently reopening the bypass.
    const permissive = express();
    permissive.set('trust proxy', true);
    permissive.get('/whoami', (req, res) => res.json({ ip: req.ip }));

    const spoofed = await request(permissive)
      .get('/whoami')
      .set('X-Forwarded-For', `${SPOOFED}, ${REAL}`);

    // The forged leftmost entry wins — a fresh fake per request defeats every
    // IP-keyed limiter.
    expect(spoofed.body.ip).toBe(SPOOFED);
  });
});
