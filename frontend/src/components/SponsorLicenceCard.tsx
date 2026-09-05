import React from 'react';
import { apiGet, apiPut } from '../lib/api';
import Card from './Card';

// Sponsor licence details the Home Office holds on file for this tenant:
// licence number, rating, expiry, key personnel and CoS allocations. Read by
// anyone who works the compliance screens; edited by the owner.

type Person = { name: string; email: string };

type Licence = {
  id: number;
  licenceNumber: string | null;
  rating: 'A' | 'B';
  expiryDate: string | null;
  authorisingOfficer: string | null;
  authorisingOfficerEmail: string | null;
  keyContact: string | null;
  keyContactEmail: string | null;
  level1Users: Person[] | null;
  level2Users: Person[] | null;
  cosDefinedAllocated: number;
  cosUndefinedAllocated: number;
  allocationYearStart: string | null;
  actionPlanIssuedAt: string | null;
  actionPlanDueAt: string | null;
  actionPlanNotes: string | null;
};

type Form = {
  licenceNumber: string;
  rating: 'A' | 'B';
  expiryDate: string;
  authorisingOfficer: string;
  authorisingOfficerEmail: string;
  keyContact: string;
  keyContactEmail: string;
  level1Users: Person[];
  level2Users: Person[];
  cosDefinedAllocated: number;
  cosUndefinedAllocated: number;
  allocationYearStart: string;
  actionPlanIssuedAt: string;
  actionPlanDueAt: string;
  actionPlanNotes: string;
};

const EMPTY: Form = {
  licenceNumber: '',
  rating: 'A',
  expiryDate: '',
  authorisingOfficer: '',
  authorisingOfficerEmail: '',
  keyContact: '',
  keyContactEmail: '',
  level1Users: [],
  level2Users: [],
  cosDefinedAllocated: 0,
  cosUndefinedAllocated: 0,
  allocationYearStart: '',
  actionPlanIssuedAt: '',
  actionPlanDueAt: '',
  actionPlanNotes: '',
};

const day = (value: string | null) => (value ? value.slice(0, 10) : '');

function fromLicence(licence: Licence | null): Form {
  if (!licence) return EMPTY;
  return {
    licenceNumber: licence.licenceNumber ?? '',
    rating: licence.rating,
    expiryDate: day(licence.expiryDate),
    authorisingOfficer: licence.authorisingOfficer ?? '',
    authorisingOfficerEmail: licence.authorisingOfficerEmail ?? '',
    keyContact: licence.keyContact ?? '',
    keyContactEmail: licence.keyContactEmail ?? '',
    level1Users: licence.level1Users ?? [],
    level2Users: licence.level2Users ?? [],
    cosDefinedAllocated: licence.cosDefinedAllocated,
    cosUndefinedAllocated: licence.cosUndefinedAllocated,
    allocationYearStart: day(licence.allocationYearStart),
    actionPlanIssuedAt: day(licence.actionPlanIssuedAt),
    actionPlanDueAt: day(licence.actionPlanDueAt),
    actionPlanNotes: licence.actionPlanNotes ?? '',
  };
}

function daysUntil(value: string) {
  const ms = new Date(value).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

const inputClass =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700 disabled:bg-slate-100 dark:disabled:bg-slate-800';

function PersonList({
  label,
  people,
  onChange,
  disabled,
}: {
  label: string;
  people: Person[];
  onChange: (people: Person[]) => void;
  disabled: boolean;
}) {
  const update = (index: number, patch: Partial<Person>) =>
    onChange(people.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  return (
    <div className="text-sm md:col-span-2">
      <div className="flex items-center justify-between">
        <span className="font-medium">{label}</span>
        {!disabled && (
          <button
            type="button"
            onClick={() => onChange([...people, { name: '', email: '' }])}
            className="text-xs text-blue-600 hover:underline dark:text-blue-400"
          >
            + Add
          </button>
        )}
      </div>
      {people.length === 0 && <p className="mt-1 text-xs text-slate-500">None recorded.</p>}
      {people.map((person, index) => (
        <div key={index} className="mt-1 flex gap-2">
          <input
            value={person.name}
            onChange={(e) => update(index, { name: e.target.value })}
            placeholder="Name"
            disabled={disabled}
            aria-label={`${label} name`}
            className={inputClass}
          />
          <input
            value={person.email}
            onChange={(e) => update(index, { email: e.target.value })}
            placeholder="Email"
            disabled={disabled}
            aria-label={`${label} email`}
            className={inputClass}
          />
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(people.filter((_, i) => i !== index))}
              className="mt-1 px-2 text-slate-500 hover:text-red-600"
              aria-label="Remove"
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export default function SponsorLicenceCard({ canEdit }: { canEdit: boolean }) {
  const [form, setForm] = React.useState<Form>(EMPTY);
  const [usage, setUsage] = React.useState({ cosDefinedUsed: 0, cosUndefinedUsed: 0 });
  const [loaded, setLoaded] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    apiGet('/tenant/licence')
      .then((r) => {
        setForm(fromLicence(r.licence));
        setUsage({ cosDefinedUsed: r.cosDefinedUsed, cosUndefinedUsed: r.cosUndefinedUsed });
        setLoaded(true);
      })
      .catch((e) => setError(e.message));
  }, []);

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const r = await apiPut('/tenant/licence', form);
      setForm(fromLicence(r.licence));
      setUsage({ cosDefinedUsed: r.cosDefinedUsed, cosUndefinedUsed: r.cosUndefinedUsed });
      setMessage('Sponsor licence saved.');
    } catch (e: any) {
      setError(e.message);
    }
  }

  const expiryDays = form.expiryDate ? daysUntil(form.expiryDate) : null;
  const disabled = !canEdit;

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
        <span className="text-2xl">🛂</span>
        Sponsor licence
      </h3>
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
        What UKVI holds on file for you. The licence number is applied to new sponsorships and the
        expiry, action plan and CoS start-by dates feed the reminder emails.
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
      {expiryDays !== null && expiryDays <= 90 && (
        <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
          {expiryDays < 0
            ? `Licence expired ${-expiryDays} day${expiryDays === -1 ? '' : 's'} ago.`
            : `Licence expires in ${expiryDays} day${expiryDays === 1 ? '' : 's'} — renew via the sponsorship management system.`}
        </div>
      )}

      <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">Licence number</span>
          <input
            value={form.licenceNumber}
            onChange={(e) => set('licenceNumber', e.target.value)}
            disabled={disabled}
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Rating</span>
          <select
            value={form.rating}
            onChange={(e) => set('rating', e.target.value as 'A' | 'B')}
            disabled={disabled}
            className={inputClass}
          >
            <option value="A">A — full licence</option>
            <option value="B">B — action plan in place</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium">Licence expiry</span>
          <input
            type="date"
            value={form.expiryDate}
            onChange={(e) => set('expiryDate', e.target.value)}
            disabled={disabled}
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">CoS allocation year starts</span>
          <input
            type="date"
            value={form.allocationYearStart}
            onChange={(e) => set('allocationYearStart', e.target.value)}
            disabled={disabled}
            className={inputClass}
          />
        </label>

        <div className="md:col-span-2 mt-2 text-sm font-semibold">Key personnel</div>
        <label className="block text-sm">
          <span className="font-medium">Authorising officer</span>
          <input
            value={form.authorisingOfficer}
            onChange={(e) => set('authorisingOfficer', e.target.value)}
            disabled={disabled}
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Authorising officer email</span>
          <input
            type="email"
            value={form.authorisingOfficerEmail}
            onChange={(e) => set('authorisingOfficerEmail', e.target.value)}
            disabled={disabled}
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Key contact</span>
          <input
            value={form.keyContact}
            onChange={(e) => set('keyContact', e.target.value)}
            disabled={disabled}
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Key contact email</span>
          <input
            type="email"
            value={form.keyContactEmail}
            onChange={(e) => set('keyContactEmail', e.target.value)}
            disabled={disabled}
            className={inputClass}
          />
        </label>
        <PersonList
          label="Level 1 users"
          people={form.level1Users}
          onChange={(people) => set('level1Users', people)}
          disabled={disabled}
        />
        <PersonList
          label="Level 2 users"
          people={form.level2Users}
          onChange={(people) => set('level2Users', people)}
          disabled={disabled}
        />

        <div className="md:col-span-2 mt-2 text-sm font-semibold">Certificates of Sponsorship</div>
        <label className="block text-sm">
          <span className="font-medium">Defined CoS allocated</span>
          <input
            type="number"
            min={0}
            value={form.cosDefinedAllocated}
            onChange={(e) => set('cosDefinedAllocated', Number(e.target.value))}
            disabled={disabled}
            className={inputClass}
          />
          <span className="mt-1 block text-xs text-slate-500">
            {usage.cosDefinedUsed} used this allocation year
          </span>
        </label>
        <label className="block text-sm">
          <span className="font-medium">Undefined CoS allocated</span>
          <input
            type="number"
            min={0}
            value={form.cosUndefinedAllocated}
            onChange={(e) => set('cosUndefinedAllocated', Number(e.target.value))}
            disabled={disabled}
            className={inputClass}
          />
          <span className="mt-1 block text-xs text-slate-500">
            {usage.cosUndefinedUsed} used this allocation year
          </span>
        </label>

        {form.rating === 'B' && (
          <>
            <div className="md:col-span-2 mt-2 text-sm font-semibold">Action plan</div>
            <label className="block text-sm">
              <span className="font-medium">Issued</span>
              <input
                type="date"
                value={form.actionPlanIssuedAt}
                onChange={(e) => set('actionPlanIssuedAt', e.target.value)}
                disabled={disabled}
                className={inputClass}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Due</span>
              <input
                type="date"
                value={form.actionPlanDueAt}
                onChange={(e) => set('actionPlanDueAt', e.target.value)}
                disabled={disabled}
                className={inputClass}
              />
            </label>
            <label className="block text-sm md:col-span-2">
              <span className="font-medium">Notes</span>
              <textarea
                value={form.actionPlanNotes}
                onChange={(e) => set('actionPlanNotes', e.target.value)}
                disabled={disabled}
                rows={3}
                className={inputClass}
              />
            </label>
          </>
        )}

        {canEdit && (
          <div className="md:col-span-2">
            <button type="submit" className="btn-primary" disabled={!loaded}>
              Save sponsor licence
            </button>
          </div>
        )}
      </form>
    </Card>
  );
}
