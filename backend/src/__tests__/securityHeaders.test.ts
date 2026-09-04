import { describe, it, expect } from '@jest/globals';
import request from './helpers/http';
import fs from 'fs';
import path from 'path';
import app from '../app';

const REPO_ROOT = path.resolve(__dirname, '../../..');

// The CSP that protects the SPA document is served by Nginx, not Express —
// Express serves no HTML. Both layers are asserted here because the Nginx
// policy lives in a config file no other test would ever touch, and the
// directives below are load-bearing: dropping frame-src blob: silently breaks
// document preview, and adding 'unsafe-inline' to script-src silently undoes
// the reason this policy exists.
function readConfig(relative: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relative), 'utf8');
}

function extractCsp(config: string) {
  const match = config.match(
    /add_header\s+Content-Security-Policy\s+"([^"]+)"/,
  );
  return match ? match[1] : null;
}

describe('Security headers — Express (API responses)', () => {
  it('sends a locked-down CSP on API responses', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    const csp = res.headers['content-security-policy'];
    expect(csp).toBeDefined();
    // Nothing legitimate is ever loaded from a JSON response or a file stream.
    expect(csp).toContain("default-src 'none'");
    // These three have no fallback to default-src, so they must be explicit.
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("form-action 'none'");
  });

  it('sends the cheap hardening headers on every response', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('no-referrer');

    const permissions = res.headers['permissions-policy'];
    expect(permissions).toBeDefined();
    for (const feature of ['camera', 'microphone', 'geolocation', 'payment']) {
      expect(permissions).toContain(`${feature}=()`);
    }
  });

  it('withholds HSTS outside production so local http is not pinned', async () => {
    // helmet sends HSTS by default even over plain http. app.ts gates it on
    // NODE_ENV === 'production'; the test env must therefore not receive it.
    expect(process.env.NODE_ENV).not.toBe('production');
    const res = await request(app).get('/api/health');
    expect(res.headers['strict-transport-security']).toBeUndefined();
  });

  it('applies the headers to error responses too', async () => {
    const res = await request(app).get('/api/definitely-not-a-route');

    expect(res.status).toBe(404);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain(
      "default-src 'none'",
    );
  });
});

describe('Security headers — Nginx (the layer that serves index.html)', () => {
  const snippet = readConfig('nginx/6soft-security-headers.conf');
  const siteConfig = readConfig('nginx.conf');

  it('defines a CSP in the shared snippet', () => {
    const csp = extractCsp(snippet);
    expect(csp).toBeTruthy();
  });

  it('does not weaken script execution', () => {
    const csp = extractCsp(snippet) as string;
    expect(csp).toContain("script-src 'self'");
    // The whole point of the policy: an injected <script> must not run.
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).not.toMatch(/script-src[^;]*unsafe-eval/);
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });

  it('allows exactly what the built frontend needs', () => {
    const csp = extractCsp(snippet) as string;
    // Google Fonts (frontend/index.html loads Inter).
    expect(csp).toContain('https://fonts.googleapis.com');
    expect(csp).toContain('https://fonts.gstatic.com');
    // Documents.tsx previews PDFs in an iframe pointed at a blob: URL.
    expect(csp).toMatch(/frame-src[^;]*blob:/);
    // Document/image preview and the 2FA QR code.
    expect(csp).toMatch(/img-src[^;]*blob:/);
    expect(csp).toMatch(/img-src[^;]*data:/);
    // Same-origin API behind /api/.
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('carries the other hardening headers', () => {
    expect(snippet).toContain('Strict-Transport-Security');
    expect(snippet).toContain('X-Content-Type-Options "nosniff"');
    expect(snippet).toContain('Referrer-Policy');
    expect(snippet).toContain('Permissions-Policy');
  });

  it('keeps nginx.conf and the shared snippet in agreement', () => {
    expect(extractCsp(siteConfig)).toBe(extractCsp(snippet));
  });

  it('repeats the headers in every location that sets its own add_header', () => {
    // nginx add_header does NOT inherit into a location that declares one of
    // its own — it replaces the inherited set entirely. `location /` serves
    // index.html and sets Cache-Control, so without a repeat the app document
    // would ship with no CSP at all.
    const withoutComments = siteConfig
      .split('\n')
      .filter((line) => !line.trim().startsWith('#'))
      .join('\n');

    // These location blocks contain no nested braces, so a non-greedy match
    // to the first closing brace is the whole block.
    const blocks = withoutComments.match(/location\s[^{]*\{[^}]*\}/g) || [];
    const withAddHeader = blocks.filter((b) => b.includes('add_header'));

    expect(withAddHeader.length).toBeGreaterThan(0);
    for (const block of withAddHeader) {
      const name = (block.match(/location\s+(\S+)/) || [])[1];
      expect(`${name}: ${block}`).toContain('Content-Security-Policy');
      expect(`${name}: ${block}`).toContain('X-Content-Type-Options');
    }
  });
});
