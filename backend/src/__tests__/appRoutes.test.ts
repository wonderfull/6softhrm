import request from './helpers/http';
import app from '../app';
import { signTestToken } from './helpers/tenantTest';

// Every other suite mounts one router into a bare express app, which means
// nothing checks that app.ts actually mounts them — a route file can be
// written, tested and never reachable in production. This walks the real app.

const ROUTES = [
  { path: '/api/employees', roles: ['ADMIN'] },
  { path: '/api/leave', roles: ['ADMIN', 'EMPLOYEE'] },
  { path: '/api/timesheets', roles: ['ADMIN'] },
  { path: '/api/projects', roles: ['ADMIN'] },
  { path: '/api/documents', roles: ['ADMIN'] },
  { path: '/api/notifications/inbox', roles: ['ADMIN'] },
  { path: '/api/tenant/settings', roles: ['ADMIN'] },
  { path: '/api/reports/summary', roles: ['ADMIN'] },
  { path: '/api/reviews', roles: ['ADMIN'] },
  { path: '/api/expenses', roles: ['ADMIN'] },
  { path: '/api/training', roles: ['ADMIN'] },
  { path: '/api/cases', roles: ['ADMIN'] },
  { path: '/api/document-templates', roles: ['ADMIN'] },
];

let adminToken: string;

beforeAll(() => {
  adminToken = signTestToken({
    id: 999999,
    email: 'route-check@app-routes.test',
    role: 'ADMIN',
  });
});

describe('the routes app.ts actually mounts', () => {
  it('answers every one of them rather than falling through to the 404 handler', async () => {
    for (const route of ROUTES) {
      const res = await request(app)
        .get(route.path)
        .set('Authorization', `Bearer ${adminToken}`);
      // The token has no matching user row, so auth refuses it — which is
      // itself proof the router is mounted and its middleware ran. What must
      // never happen is the catch-all "endpoint not found".
      expect([200, 401, 403]).toContain(res.status);
      expect(res.body?.error).not.toMatch(/not found/i);
    }
  });

  // /api/calendar was a placeholder that handed users a Google URL containing
  // the literal YOUR_CLIENT_ID, and whose callback took input from anyone at
  // all — it had no requireAuth. Nothing ever called it.
  it('no longer exposes the abandoned calendar stub', async () => {
    for (const path of ['/api/calendar/connect/google', '/api/calendar/callback/google']) {
      const res = await request(app).get(path);
      expect(res.status).toBe(404);
    }
  });

  it('still 404s something that was never mounted', async () => {
    const res = await request(app)
      .get('/api/does-not-exist')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it('refuses an unauthenticated request to each of them', async () => {
    for (const route of ROUTES) {
      const res = await request(app).get(route.path);
      expect(res.status).toBe(401);
    }
  });
});
