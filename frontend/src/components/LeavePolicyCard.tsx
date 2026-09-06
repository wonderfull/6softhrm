import React from 'react';
import { apiGet, apiPut } from '../lib/api';
import Card from './Card';

// Tenant-wide leave policy: the leave year, the default allowance every
// employee inherits, the carryover cap, and the working pattern and bank
// holiday region that decide which days a request actually consumes.

type Settings = {
 leaveYearStart: string;
 defaultLeaveDays: number;
 carryoverCapDays: number;
 bankHolidayRegion: string;
 workingDays: string;
 companyAddress: string | null;
};

type Form = {
 leaveYearStart: string;
 defaultLeaveDays: number;
 carryoverCapDays: number;
 bankHolidayRegion: string;
 workingDays: string;
 companyAddress: string;
};

const EMPTY: Form = {
 leaveYearStart: '04-06',
 defaultLeaveDays: 28,
 carryoverCapDays: 5,
 bankHolidayRegion: 'england-and-wales',
 workingDays: '1,2,3,4,5',
 companyAddress: '',
};

const REGIONS = [
  { value: 'england-and-wales', label: 'England and Wales' },
  { value: 'scotland', label: 'Scotland' },
  { value: 'northern-ireland', label: 'Northern Ireland' },
];

// ISO-8601 weekday numbers: Monday is 1, Sunday is 7.
const WEEKDAYS = [
  { value: '1', label: 'Mon' },
  { value: '2', label: 'Tue' },
  { value: '3', label: 'Wed' },
  { value: '4', label: 'Thu' },
  { value: '5', label: 'Fri' },
  { value: '6', label: 'Sat' },
  { value: '7', label: 'Sun' },
];

const inputClass =
 'form-input mt-1 disabled:bg-surface-2';

function fromSettings(settings: Settings | null): Form {
 if (!settings) return EMPTY;
 return {
 leaveYearStart: settings.leaveYearStart || EMPTY.leaveYearStart,
 defaultLeaveDays: settings.defaultLeaveDays,
 carryoverCapDays: settings.carryoverCapDays,
 bankHolidayRegion: settings.bankHolidayRegion || EMPTY.bankHolidayRegion,
 workingDays: settings.workingDays || EMPTY.workingDays,
 companyAddress: settings.companyAddress ?? '',
  };
}

function toggleWorkingDay(workingDays: string, day: string) {
 const selected = workingDays.split(',').filter(Boolean);
 const next = selected.includes(day)
    ? selected.filter((d) => d !== day)
    : [...selected, day];
 return next.sort().join(',');
}

export default function LeavePolicyCard({ canEdit }: { canEdit: boolean }) {
 const [form, setForm] = React.useState<Form>(EMPTY);
 const [loaded, setLoaded] = React.useState(false);
 const [message, setMessage] = React.useState('');
 const [error, setError] = React.useState('');

 React.useEffect(() => {
 apiGet('/tenant/settings')
      .then((settings) => {
 setForm(fromSettings(settings));
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
 const saved = await apiPut('/tenant/settings', form);
 setForm(fromSettings(saved));
 setMessage('Leave policy saved.');
    } catch (e: any) {
 setError(e.message);
    }
  }

 const selectedDays = form.workingDays.split(',').filter(Boolean);
 const disabled = !canEdit;

 return (
    <Card className="p-6">
      <h3 className="mb-1 text-lg font-semibold">
 Leave policy
      </h3>
      <p className="mb-4 text-sm text-ink-2">
 The leave year, default allowance and working pattern every employee
 inherits. Requests only consume the working days set here, and bank
 holidays for the chosen region are never deducted.
      </p>

      {message && (
        <div className="mb-3 rounded-md border border-ok bg-ok-tint px-3 py-2 text-sm text-ok ">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-3 rounded-md border border-bad bg-bad-tint px-3 py-2 text-sm text-bad ">
          {error}
        </div>
      )}

      <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">Leave year starts (MM-DD)</span>
          <input
 value={form.leaveYearStart}
 onChange={(e) => set('leaveYearStart', e.target.value)}
 pattern="\d{2}-\d{2}"
 placeholder="04-06"
 disabled={disabled}
 className={inputClass}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Bank holiday region</span>
          <select
 value={form.bankHolidayRegion}
 onChange={(e) => set('bankHolidayRegion', e.target.value)}
 disabled={disabled}
 className={inputClass}
          >
            {REGIONS.map((region) => (
              <option key={region.value} value={region.value}>
                {region.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium">Default allowance (days)</span>
          <input
 type="number"
 min={0}
 value={form.defaultLeaveDays}
 onChange={(e) => set('defaultLeaveDays', Number(e.target.value))}
 disabled={disabled}
 className={inputClass}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Carryover cap (days)</span>
          <input
 type="number"
 min={0}
 value={form.carryoverCapDays}
 onChange={(e) => set('carryoverCapDays', Number(e.target.value))}
 disabled={disabled}
 className={inputClass}
          />
        </label>

        <fieldset className="text-sm md:col-span-2">
          <legend className="font-medium">Working days</legend>
          <div className="mt-1 flex flex-wrap gap-3">
            {WEEKDAYS.map((day) => (
              <label key={day.value} className="flex items-center gap-2">
                <input
 type="checkbox"
 checked={selectedDays.includes(day.value)}
 onChange={() =>
 set(
 'workingDays',
 toggleWorkingDay(form.workingDays, day.value),
                    )
                  }
 disabled={disabled}
 className="h-4 w-4"
                />
                {day.label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block text-sm md:col-span-2">
          <span className="font-medium">Company address</span>
          <textarea
 value={form.companyAddress}
 onChange={(e) => set('companyAddress', e.target.value)}
 rows={3}
 disabled={disabled}
 className={inputClass}
          />
        </label>

        {canEdit && (
          <div className="md:col-span-2">
            <button type="submit" className="btn-primary" disabled={!loaded}>
 Save leave policy
            </button>
          </div>
        )}
      </form>
    </Card>
  );
}
