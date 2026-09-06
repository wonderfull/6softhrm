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
 ACTIVE: 'bg-ok-tint text-ok ',
 TRIAL: 'bg-surface-2 text-ink-2 ',
 SUSPENDED: 'bg-warn-tint text-warn ',
 CANCELLED: 'bg-bad-tint text-bad ',
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
    <div className="min-h-screen bg-surface-2 text-ink">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold">Platform Console</h1>
            <p className="text-sm text-ink-3">Tenant management</p>
          </div>
          <div className="flex items-center gap-3">
            <button
 onClick={() => setShowCreate((v) => !v)}
 className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent"
            >
              {showCreate ? 'Close' : 'New tenant'}
            </button>
            <button
 onClick={logout}
 className="rounded-md border border-line-2 px-4 py-2 text-sm "
            >
 Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6 space-y-6">
        {error && (
          <div className="rounded-md border border-red-300 bg-bad-tint px-4 py-3 text-sm text-bad ">
            {error}
          </div>
        )}
        {status && (
          <div className="rounded-md border border-emerald-300 bg-ok-tint px-4 py-3 text-sm text-ok ">
            {status}
          </div>
        )}
        {setupLink && (
          <div className="rounded-md border border-line bg-surface-2 px-4 py-3 text-sm text-ink-2">
            <div className="font-semibold mb-1">One-time setup link (valid 7 days)</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto whitespace-nowrap rounded bg-surface/60 px-2 py-1 text-xs ">
                {setupLink}
              </code>
              <button
 onClick={() => navigator.clipboard.writeText(setupLink)}
 className="rounded-md bg-accent px-3 py-1 text-xs font-semibold text-white hover:bg-accent"
              >
 Copy
              </button>
            </div>
          </div>
        )}

        {showCreate && (
          <form
 onSubmit={createTenant}
 className="rounded-xl border border-line bg-surface p-6 "
          >
            <h2 className="mb-4 text-lg font-semibold">New tenant</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium">Company name</span>
                <input
 required
 value={form.name}
 onChange={(e) => updateForm('name', e.target.value)}
 className="mt-1 w-full rounded-md border border-line-2 px-3 py-2 "
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Slug</span>
                <input
 required
 pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]"
 value={form.slug}
 onChange={(e) => updateForm('slug', e.target.value)}
 className="mt-1 w-full rounded-md border border-line-2 px-3 py-2 font-mono text-sm "
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Plan</span>
                <select
 value={form.plan}
 onChange={(e) => updateForm('plan', e.target.value)}
 className="mt-1 w-full rounded-md border border-line-2 px-3 py-2 "
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
 className="mt-1 w-full rounded-md border border-line-2 px-3 py-2 "
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Trial days (blank = starts active)</span>
                <input
 type="number"
 min="0"
 value={form.trialDays}
 onChange={(e) => updateForm('trialDays', e.target.value)}
 className="mt-1 w-full rounded-md border border-line-2 px-3 py-2 "
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">First admin email</span>
                <input
 required
 type="email"
 value={form.adminEmail}
 onChange={(e) => updateForm('adminEmail', e.target.value)}
 className="mt-1 w-full rounded-md border border-line-2 px-3 py-2 "
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">First admin name</span>
                <input
 value={form.adminName}
 onChange={(e) => updateForm('adminName', e.target.value)}
 className="mt-1 w-full rounded-md border border-line-2 px-3 py-2 "
                />
              </label>
            </div>
            <button
 type="submit"
 className="mt-5 rounded-md bg-accent px-5 py-2 font-semibold text-white hover:bg-accent"
            >
 Create tenant
            </button>
          </form>
        )}

        <div className="overflow-x-auto rounded-xl border border-line bg-surface ">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-ink-3 dark:text-ink-3">
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
                <tr key={t.id} className="border-b border-line last:border-0 /60">
                  <td className="px-4 py-3">
                    <div className="font-medium">{t.name}</div>
                    <div className="font-mono text-xs text-ink-3">{t.slug}</div>
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
 className="rounded-md border border-line-2 px-2 py-1 text-xs hover:bg-surface-2 "
                        >
 Impersonate
                        </button>
                      )}
                      {(t.status === 'ACTIVE' || t.status === 'TRIAL') && (
                        <button
 onClick={() => setTenantStatus(t, 'SUSPENDED')}
 className="rounded-md border border-amber-300 px-2 py-1 text-xs text-warn hover:bg-warn-tint dark:hover:bg-amber-900/30"
                        >
 Suspend
                        </button>
                      )}
                      {t.status === 'SUSPENDED' && (
                        <button
 onClick={() => setTenantStatus(t, 'ACTIVE')}
 className="rounded-md border border-emerald-300 px-2 py-1 text-xs text-ok hover:bg-ok-tint dark:hover:bg-emerald-900/30"
                        >
 Reactivate
                        </button>
                      )}
                      {t.status !== 'CANCELLED' && (
                        <button
 onClick={() => setTenantStatus(t, 'CANCELLED')}
 className="rounded-md border border-red-300 px-2 py-1 text-xs text-bad hover:bg-bad-tint dark:hover:bg-red-900/30"
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
                  <td colSpan={7} className="px-4 py-8 text-center text-ink-3">
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
