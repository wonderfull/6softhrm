import React from 'react';
import { apiGet, apiPut } from '../lib/api';
import { storeTenant, getTenant } from '../lib/tenant';
import Card from './Card';

// Tenant branding: company display name, logo and accent colour (admin only).
export default function CompanyProfileCard() {
  const [name, setName] = React.useState('');
  const [logoUrl, setLogoUrl] = React.useState('');
  const [primaryColor, setPrimaryColor] = React.useState('#1d4f66');
  const [plan, setPlan] = React.useState('');
  const [seats, setSeats] = React.useState<{ used: number; limit: number | null } | null>(null);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    apiGet('/tenant/profile')
      .then((t) => {
        setName(t.name || '');
        setLogoUrl(t.logoUrl || '');
        setPrimaryColor(t.primaryColor || '#1d4f66');
        setPlan(t.plan);
        setSeats({ used: t.activeEmployees, limit: t.seatLimit });
      })
      .catch((e) => setError(e.message));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const updated = await apiPut('/tenant/profile', { name, logoUrl, primaryColor });
      const current = getTenant();
      storeTenant({ ...(current ?? { id: updated.id, slug: updated.slug }), ...updated });
      setMessage('Company profile saved.');
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
        <span className="text-2xl">🏢</span>
        Company profile
      </h3>
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
        {plan === 'CORE_PLUS_COMPLIANCE' ? 'Core HR + Sponsor Compliance plan' : 'Core HR plan'}
        {seats && ` · ${seats.used} active employee${seats.used === 1 ? '' : 's'}${seats.limit ? ` of ${seats.limit} seats` : ''}`}
      </p>

      {message && (
        <div className="mb-3 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200">
          {error}
        </div>
      )}

      <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm md:col-span-2">
          <span className="font-medium">Company display name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Logo URL (optional)</span>
          <input
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://…/logo.png"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Accent colour</span>
          <input
            type="color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="mt-1 h-10 w-20 cursor-pointer rounded-md border border-slate-300 dark:border-slate-600"
          />
        </label>
        <div className="md:col-span-2">
          <button type="submit" className="btn-primary">
            Save profile
          </button>
        </div>
      </form>
    </Card>
  );
}
