import React from 'react';
import {
  platformGet,
  platformPost,
  platformPut,
  getPlatformToken,
  clearPlatformToken,
} from '../lib/platformApi';
import { storeTenant } from '../lib/tenant';

type TenantRow = {
  id: number;
  slug: string;
  name: string;
  status: string;
  plan: string;
  seatLimit: number | null;
  trialEndsAt: string | null;
  createdAt: string;
  userCount?: number;
  employeeCount?: number;
};

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  TRIAL: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  SUSPENDED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

export default function Platform() {
  const [tenants, setTenants] = React.useState<TenantRow[]>([]);
  const [status, setStatus] = React.useState('');
  const [error, setError] = React.useState('');
  const [showCreate, setShowCreate] = React.useState(false);
  const [setupLink, setSetupLink] = React.useState('');
  const [form, setForm] = React.useState({
    name: '',
    slug: '',
    plan: 'CORE',
    seatLimit: '',
    trialDays: '30',
    adminEmail: '',
    adminName: '',
  });

  const load = React.useCallback(async () => {
    try {
      setTenants(await platformGet('/tenants'));
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  React.useEffect(() => {
    if (!getPlatformToken()) {
      window.location.href = '/platform/login';
      return;
    }
    load();
  }, [load]);

  function updateForm(key: string, value: string) {
    setForm((f) => ({
      ...f,
      [key]: value,
      // Auto-derive the slug from the name until it's been hand-edited.
      ...(key === 'name' && (!f.slug || f.slug === slugify(f.name))
        ? { slug: slugify(value) }
        : {}),
    }));
  }

  function slugify(v: string) {
    return v
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
  }

  async function createTenant(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setStatus('');
    setSetupLink('');
    try {
      const res = await platformPost('/tenants', {
        name: form.name,
        slug: form.slug,
        plan: form.plan,
        seatLimit: form.seatLimit ? Number(form.seatLimit) : null,
        trialDays: form.trialDays ? Number(form.trialDays) : null,
        adminEmail: form.adminEmail,
        adminName: form.adminName,
      });
      setStatus(`Tenant ${res.tenant.name} created. Send the setup link to ${res.admin.email}.`);
      setSetupLink(res.setupLink);
      setShowCreate(false);
      setForm({ name: '', slug: '', plan: 'CORE', seatLimit: '', trialDays: '30', adminEmail: '', adminName: '' });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function setTenantStatus(tenant: TenantRow, next: string) {
    const verb = next === 'SUSPENDED' ? 'Suspend' : next === 'CANCELLED' ? 'Cancel' : 'Reactivate';
    if (next !== 'ACTIVE' && !confirm(`${verb} ${tenant.name}? Their users ${next === 'CANCELLED' ? 'lose access permanently (data kept for the retention window)' : 'are locked out until reactivated'}.`)) {
      return;
    }
    setError('');
    try {
      await platformPut(`/tenants/${tenant.id}`, { status: next });
      setStatus(`${tenant.name} → ${next}`);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function impersonate(tenant: TenantRow) {
    if (!confirm(`Open ${tenant.name} as their admin? The session lasts 15 minutes and is recorded in their audit log.`)) return;
    setError('');
    try {
      const res = await platformPost(`/tenants/${tenant.id}/impersonate`, {});
      localStorage.setItem('token', res.token);
      storeTenant({ id: tenant.id, slug: tenant.slug, name: tenant.name, plan: tenant.plan });
      window.open('/dashboard', '_blank');
      setStatus(`Impersonating ${res.user.email} in a new tab (15 min).`);
    } catch (e: any) {
      setError(e.message);
    }
  }

  function logout() {
    clearPlatformToken();
    window.location.href = '/platform/login';
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold">Platform Console</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Tenant management</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreate((v) => !v)}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              {showCreate ? 'Close' : 'New tenant'}
            </button>
            <button
              onClick={logout}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm dark:border-slate-600"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6 space-y-6">
        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200">
            {error}
          </div>
        )}
        {status && (
          <div className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
            {status}
          </div>
        )}
        {setupLink && (
          <div className="rounded-md border border-blue-300 bg-blue-50 px-4 py-3 text-sm dark:border-blue-700 dark:bg-blue-900/30">
            <div className="font-semibold mb-1">One-time setup link (valid 7 days)</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto whitespace-nowrap rounded bg-white/60 px-2 py-1 text-xs dark:bg-slate-800">
                {setupLink}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(setupLink)}
                className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-500"
              >
                Copy
              </button>
            </div>
          </div>
        )}

        {showCreate && (
          <form
            onSubmit={createTenant}
            className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800"
          >
            <h2 className="mb-4 text-lg font-semibold">New tenant</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium">Company name</span>
                <input
                  required
                  value={form.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Slug</span>
                <input
                  required
                  pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]"
                  value={form.slug}
                  onChange={(e) => updateForm('slug', e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm dark:border-slate-600 dark:bg-slate-900"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Plan</span>
                <select
                  value={form.plan}
                  onChange={(e) => updateForm('plan', e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
                >
                  <option value="CORE">Core HR</option>
                  <option value="CORE_PLUS_COMPLIANCE">Core HR + Sponsor Compliance</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium">Seat limit (blank = unlimited)</span>
                <input
                  type="number"
                  min="1"
                  value={form.seatLimit}
                  onChange={(e) => updateForm('seatLimit', e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Trial days (blank = starts active)</span>
                <input
                  type="number"
                  min="0"
                  value={form.trialDays}
                  onChange={(e) => updateForm('trialDays', e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">First admin email</span>
                <input
                  required
                  type="email"
                  value={form.adminEmail}
                  onChange={(e) => updateForm('adminEmail', e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">First admin name</span>
                <input
                  value={form.adminName}
                  onChange={(e) => updateForm('adminName', e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
                />
              </label>
            </div>
            <button
              type="submit"
              className="mt-5 rounded-md bg-blue-600 px-5 py-2 font-semibold text-white hover:bg-blue-500"
            >
              Create tenant
            </button>
          </form>
        )}

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <th className="px-4 py-3">Tenant</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3 text-right">Users</th>
                <th className="px-4 py-3 text-right">Employees</th>
                <th className="px-4 py-3 text-right">Seats</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-b border-slate-100 last:border-0 dark:border-slate-700/60">
                  <td className="px-4 py-3">
                    <div className="font-medium">{t.name}</div>
                    <div className="font-mono text-xs text-slate-500">{t.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[t.status] || ''}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">{t.plan === 'CORE_PLUS_COMPLIANCE' ? 'Core + Compliance' : 'Core'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{t.userCount ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{t.employeeCount ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{t.seatLimit ?? '∞'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {t.status !== 'CANCELLED' && (
                        <button
                          onClick={() => impersonate(t)}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
                        >
                          Impersonate
                        </button>
                      )}
                      {(t.status === 'ACTIVE' || t.status === 'TRIAL') && (
                        <button
                          onClick={() => setTenantStatus(t, 'SUSPENDED')}
                          className="rounded-md border border-amber-300 px-2 py-1 text-xs text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/30"
                        >
                          Suspend
                        </button>
                      )}
                      {t.status === 'SUSPENDED' && (
                        <button
                          onClick={() => setTenantStatus(t, 'ACTIVE')}
                          className="rounded-md border border-emerald-300 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                        >
                          Reactivate
                        </button>
                      )}
                      {t.status !== 'CANCELLED' && (
                        <button
                          onClick={() => setTenantStatus(t, 'CANCELLED')}
                          className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/30"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No tenants yet — create the first one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
