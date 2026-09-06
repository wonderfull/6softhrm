import React from 'react';
import Card from '../components/Card';
import { apiGet, apiPost, apiUpload } from '../lib/api';

// Compliance workspace: the two inputs the sponsor duties are computed from.
// Absence marking feeds the 10-working-day unauthorised-absence report
// (guidance Part 3 C1.15); payroll import feeds the per-pay-period salary
// reconciliation that became mandatory on 8 April 2026.

const STATUS_LABELS: Record<string, string> = {
 UNAUTHORISED: 'Unauthorised',
 AUTHORISED: 'Authorised',
 SICK: 'Sick',
 UNKNOWN: 'Unexplained',
};

const STATUS_STYLES: Record<string, string> = {
 UNAUTHORISED:
 'bg-bad-tint text-bad ',
 AUTHORISED:
 'bg-ok-tint text-ok ',
 SICK: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
 UNKNOWN:
 'bg-warn-tint text-warn ',
};

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function Compliance() {
 const [employees, setEmployees] = React.useState<any[]>([]);
 const [employeeId, setEmployeeId] = React.useState('');
 const [ledger, setLedger] = React.useState<any>(null);
 const [absenceDate, setAbsenceDate] = React.useState(todayIso());
 const [absenceStatus, setAbsenceStatus] = React.useState('UNAUTHORISED');
 const [absenceNotes, setAbsenceNotes] = React.useState('');
 const [pay, setPay] = React.useState<any>(null);
 const [payFile, setPayFile] = React.useState<File | null>(null);
 const [payPreview, setPayPreview] = React.useState<any>(null);
 const [message, setMessage] = React.useState<string | null>(null);
 const [error, setError] = React.useState<string | null>(null);
 const [busy, setBusy] = React.useState(false);

 React.useEffect(() => {
 apiGet('/employees')
      .then((rows) => setEmployees(Array.isArray(rows) ? rows : []))
      .catch(() => setEmployees([]));
  }, []);

 const loadEmployee = React.useCallback(async (id: string) => {
 if (!id) {
 setLedger(null);
 setPay(null);
 return;
    }
 const [ledgerRes, payRes] = await Promise.all([
 apiGet(`/absences/employee/${id}`).catch(() => null),
 apiGet(`/pay/employee/${id}`).catch(() => null),
    ]);
 setLedger(ledgerRes);
 setPay(payRes);
  }, []);

 React.useEffect(() => {
 loadEmployee(employeeId);
  }, [employeeId, loadEmployee]);

 const notify = (ok: string | null, bad: string | null = null) => {
 setMessage(ok);
 setError(bad);
  };

 const markAbsence = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!employeeId) return;
 setBusy(true);
 try {
 await apiPost('/absences', {
 employeeId: Number(employeeId),
 date: absenceDate,
 status: absenceStatus,
 notes: absenceNotes || undefined,
      });
 setAbsenceNotes('');
 await loadEmployee(employeeId);
 notify(`Recorded ${STATUS_LABELS[absenceStatus]} on ${absenceDate}.`);
    } catch (err: any) {
 notify(null, err?.message || 'Could not record the absence.');
    } finally {
 setBusy(false);
    }
  };

 const uploadPay = async (dryRun: boolean) => {
 if (!payFile) return;
 setBusy(true);
 try {
 const form = new FormData();
 form.append('file', payFile);
 const res = await apiUpload(
 `/pay/import${dryRun ? '?dryRun=true' : ''}`,
 form,
      );
 if (dryRun) {
 setPayPreview(res);
 notify(
 `Preview: ${res.summary.creates} new, ${res.summary.updates} updated, ${res.summary.errors} with errors.`,
        );
      } else {
 setPayPreview(null);
 setPayFile(null);
 await loadEmployee(employeeId);
 notify(
 `Imported ${res.created} new and ${res.updated} updated records.`,
        );
      }
    } catch (err: any) {
 notify(null, err?.message || 'Payroll import failed.');
    } finally {
 setBusy(false);
    }
  };

 const spells = ledger?.unauthorisedSpells ?? [];
 const reportableSpells = spells.filter((s: any) => s.reportable);

 return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">
 Compliance
        </h1>
        <p className="text-sm text-ink-2 mt-1">
 Record absence and import payroll. Both feed the sponsor duties
 reported on the Sponsorships page.
        </p>
      </div>

      {message && (
        <div className="rounded-lg bg-ok-tint px-4 py-3 text-sm text-ok">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-bad-tint px-4 py-3 text-sm text-bad">
          {error}
        </div>
      )}

      <Card>
        <label
 htmlFor="compliance-employee"
 className="mb-1 block text-sm font-medium text-ink-2"
        >
 Employee
        </label>
        <select
 id="compliance-employee"
 value={employeeId}
 onChange={(e) => setEmployeeId(e.target.value)}
 className="form-input w-full max-w-md bg-white text-ink "
        >
          <option value="">Select an employee…</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.firstName} {emp.lastName}
            </option>
          ))}
        </select>
      </Card>

      {employeeId && (
        <>
          <Card>
            <h2 className="text-lg font-semibold text-ink mb-1">
 Absence
            </h2>
            <p className="text-sm text-ink-2 mb-4">
 Ten consecutive unauthorised working days must be reported to the
 Home Office within ten working days.
            </p>

            {reportableSpells.length > 0 && (
              <div className="mb-4 rounded-lg bg-bad-tint px-4 py-3 text-sm text-bad">
                <strong>Reportable:</strong>{' '}
                {reportableSpells
                  .map(
                    (s: any) =>
 `${s.workingDays} working days from ${s.start} to ${s.end}`,
                  )
                  .join('; ')}
                .
              </div>
            )}

            <form
 onSubmit={markAbsence}
 className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6"
            >
              <div>
                <label
 htmlFor="absence-date"
 className="mb-1 block text-sm font-medium text-ink-2"
                >
 Date
                </label>
                <input
 id="absence-date"
 type="date"
 value={absenceDate}
 onChange={(e) => setAbsenceDate(e.target.value)}
 required
 className="form-input w-full bg-white text-ink "
                />
              </div>
              <div>
                <label
 htmlFor="absence-status"
 className="mb-1 block text-sm font-medium text-ink-2"
                >
 Status
                </label>
                <select
 id="absence-status"
 value={absenceStatus}
 onChange={(e) => setAbsenceStatus(e.target.value)}
 className="form-input w-full bg-white text-ink "
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
 htmlFor="absence-notes"
 className="mb-1 block text-sm font-medium text-ink-2"
                >
 Notes
                </label>
                <input
 id="absence-notes"
 value={absenceNotes}
 onChange={(e) => setAbsenceNotes(e.target.value)}
 placeholder="Optional"
 className="form-input w-full bg-white text-ink "
                />
              </div>
              <div className="flex items-end">
                <button
 type="submit"
 disabled={busy}
 className="btn-primary w-full disabled:opacity-50"
                >
 Record
                </button>
              </div>
            </form>

            {ledger?.days?.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-ink-3">
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Source</th>
                      <th className="px-3 py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.days.map((day: any) => (
                      <tr
 key={day.date}
 className="border-t border-line"
                      >
                        <td className="px-3 py-2 text-ink-2">
                          {day.date}
                        </td>
                        <td className="px-3 py-2">
                          <span
 className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[day.status] ?? ''}`}
                          >
                            {STATUS_LABELS[day.status] ?? day.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-ink-2">
                          {day.source}
                        </td>
                        <td className="px-3 py-2 text-ink-2">
                          {day.notes || 'None'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-ink-3">
 No absence recorded in the last 90 days.
              </p>
            )}
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-ink mb-1">
 Payroll
            </h2>
            <p className="text-sm text-ink-2 mb-4">
 Each pay period is checked against the CoS salary. Import a CSV
 with Email, Period Start, Period End and Gross Pay.
            </p>

            <div className="flex flex-wrap items-center gap-3 mb-4">
              <a
 href="/api/pay/import/template"
 className="text-sm underline underline-offset-2 text-ink-2"
              >
 Download template
              </a>
              <input
 type="file"
 accept=".csv,.xlsx,.xls"
 onChange={(e) => {
 setPayFile(e.target.files?.[0] ?? null);
 setPayPreview(null);
                }}
 className="text-sm text-ink-2"
              />
              <button
 type="button"
 onClick={() => uploadPay(true)}
 disabled={!payFile || busy}
 className="btn-secondary disabled:opacity-50"
              >
 Preview
              </button>
              <button
 type="button"
 onClick={() => uploadPay(false)}
 disabled={!payFile || busy || !payPreview}
 className="btn-primary disabled:opacity-50"
              >
 Import
              </button>
            </div>

            {payPreview?.rows?.some((r: any) => r.errors.length > 0) && (
              <ul className="mb-4 space-y-1 text-sm text-bad">
                {payPreview.rows
                  .filter((r: any) => r.errors.length > 0)
                  .map((r: any) => (
                    <li key={r.row}>
 Row {r.row}: {r.errors.join('; ')}
                    </li>
                  ))}
              </ul>
            )}

            {pay && !pay.thresholdKnown && (
              <div className="mb-4 rounded-lg bg-warn-tint px-4 py-3 text-sm text-warn">
 No CoS salary recorded for this worker, so pay cannot be
 checked. Add it on the Sponsorships page.
              </div>
            )}

            {pay?.assessments?.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-ink-3">
                      <th className="px-3 py-2">Period</th>
                      <th className="px-3 py-2">Annualised</th>
                      <th className="px-3 py-2">Required</th>
                      <th className="px-3 py-2">Shortfall</th>
                      <th className="px-3 py-2">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pay.assessments.map((a: any) => (
                      <tr
 key={a.periodStart}
 className="border-t border-line"
                      >
                        <td className="px-3 py-2 text-ink-2">
                          {a.periodStart} → {a.periodEnd}
                        </td>
                        <td className="px-3 py-2 text-ink-2">
                          £{a.annualisedPay.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-ink-2">
                          £{a.requiredAnnualSalary.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-ink-2">
                          {a.shortfall
                            ? `£${a.shortfall.toLocaleString()}`
                            : 'Not set'}
                        </td>
                        <td className="px-3 py-2">
                          <span
 className={`rounded-full px-2 py-0.5 text-xs font-medium ${ a.compliant
                                ? STATUS_STYLES.AUTHORISED
                                : STATUS_STYLES.UNAUTHORISED
                            }`}
                          >
                            {a.compliant ? 'Compliant' : 'Below CoS'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-ink-3">
 No pay records imported for this employee.
              </p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
