import React, { useEffect, useState } from 'react';
import Card from '../components/Card';
import { apiGet, apiPost } from '../lib/api';
import { normalizeRole } from '../lib/roles';
import { PageHeader } from '../components/ui';

interface ExpiryItem {
 id: number;
 employeeId?: number;
 employeeName: string;
 email: string;
 visaType?: string;
 jobTitle?: string;
 expiryDate: string;
 daysRemaining: number;
}

// Passport, DBS, RTW recheck, licence, action plan, CoS start-by — the
// sweep's own shape, already labelled.
interface OtherItem {
 kind: string;
 label: string;
 id: number;
 employeeName?: string;
 employeeEmail?: string | null;
 detail?: string | null;
 expiryDate: string;
 daysRemaining: number;
 link: string;
}

interface ExpiryData {
 overdueVisas: ExpiryItem[];
 overdueContracts: ExpiryItem[];
 visaExpiries: ExpiryItem[];
 contractExpiries: ExpiryItem[];
 other: OtherItem[];
}

const EMPTY: ExpiryData = {
 overdueVisas: [],
 overdueContracts: [],
 visaExpiries: [],
 contractExpiries: [],
 other: [],
};

interface CronStatus {
 lastStartedAt: string | null;
 lastFinishedAt: string | null;
 lastError: string | null;
 lastVisaNotifications: number;
 lastContractNotifications: number;
 lastAuditRunAt: string | null;
}

const Notifications: React.FC = () => {
 const [expiries, setExpiries] = useState<ExpiryData>(EMPTY);
 const [loading, setLoading] = useState(true);
 const [checking, setChecking] = useState(false);
 const [testEmail, setTestEmail] = useState('');
 const [testingEmail, setTestingEmail] = useState(false);
 const [days, setDays] = useState(90);
 const [cronStatus, setCronStatus] = useState<CronStatus | null>(null);

 useEffect(() => {
 fetchExpiries();
  }, [days]);

 useEffect(() => {
 apiGet('/notifications/cron-status')
      .then(setCronStatus)
      .catch(() => setCronStatus(null));
  }, []);

 const fetchExpiries = async () => {
 try {
 setLoading(true);
 const data = await apiGet('/notifications/upcoming-expiries', { days });
 setExpiries({ ...EMPTY, ...data });
    } catch (err: any) {
 console.error('Error fetching expiries:', err);
 alert('Failed to load expiries: ' + err.message);
    } finally {
 setLoading(false);
    }
  };

 const checkAndNotify = async () => {
 if (
      !confirm(
 'This will send email notifications for all upcoming expiries (30, 60, 90 days). Continue?',
      )
    ) {
 return;
    }

 try {
 setChecking(true);
 const result = await apiPost('/notifications/check-expiries');
 alert(
 `Expiry check completed!\n\n` +
 `Visas checked: ${result.results.visasChecked}\n` +
 `Visa notifications sent: ${result.results.visaNotifications}\n\n` +
 `Contracts checked: ${result.results.contractsChecked}\n` +
 `Contract notifications sent: ${result.results.contractNotifications}\n\n` +
 `Other reminders sent: ${result.results.otherNotifications ?? 0}`,
      );
 fetchExpiries();
    } catch (err: any) {
 console.error('Error checking expiries:', err);
 alert('Failed to check expiries: ' + err.message);
    } finally {
 setChecking(false);
    }
  };

 const sendTestEmail = async () => {
 if (!testEmail || !testEmail.includes('@')) {
 alert('Please enter a valid email address');
 return;
    }

 try {
 setTestingEmail(true);
 const result = await apiPost('/notifications/test-email', {
 to: testEmail,
      });
 alert(result.message);
    } catch (err: any) {
 console.error('Error sending test email:', err);
 alert('Failed to send test email: ' + err.message);
    } finally {
 setTestingEmail(false);
    }
  };

 const getExpiryColor = (daysRemaining: number) => {
 if (daysRemaining < 0) return 'bg-bad-tint text-bad';
 if (daysRemaining <= 30) return 'bg-bad-tint text-bad';
 if (daysRemaining <= 60) return 'bg-warn-tint text-warn';
 return 'bg-warn-tint text-warn';
  };

 const renderRow = (item: ExpiryItem, kind: 'visa' | 'contract') => (
    <div
 key={`${kind}-${item.id}`}
 className="flex items-center justify-between p-4 bg-surface-2 rounded-lg border border-line hover:shadow-md transition-shadow"
    >
      <div className="flex-1">
        <div className="font-medium text-ink">{item.employeeName}</div>
        <div className="text-sm text-ink-2">
          {kind === 'visa' ? item.visaType : item.jobTitle} •{' '}
          {kind === 'visa' ? 'Expires' : 'Contract ends'}:{' '}
          {new Date(item.expiryDate).toLocaleDateString('en-GB')}
        </div>
        <div className="text-xs text-ink-3">{item.email}</div>
      </div>
      <div className="flex items-center gap-3">
        <span
 className={`px-3 py-1 rounded-full text-sm font-semibold ${getExpiryColor(item.daysRemaining)}`}
        >
          {item.daysRemaining < 0
            ? `${Math.abs(item.daysRemaining)} days overdue`
            : `${item.daysRemaining} days`}
        </span>
      </div>
    </div>
  );

 const renderOtherRow = (item: OtherItem) => (
    <a
 key={`${item.kind}-${item.id}`}
 href={item.link}
 className="flex items-center justify-between p-4 bg-surface-2 rounded-lg border border-line hover:shadow-md transition-shadow"
    >
      <div className="flex-1">
        <div className="font-medium text-ink">
          {item.employeeName || 'Sponsor licence'}
        </div>
        <div className="text-sm text-ink-2">
          {item.label}
          {item.detail ? ` (${item.detail})` : ''} •{' '}
          {item.daysRemaining < 0 ? 'Was due' : 'Due'}:{' '}
          {new Date(item.expiryDate).toLocaleDateString('en-GB')}
        </div>
        {item.employeeEmail && (
          <div className="text-xs text-ink-3">{item.employeeEmail}</div>
        )}
      </div>
      <span
 className={`px-3 py-1 rounded-full text-sm font-semibold ${getExpiryColor(item.daysRemaining)}`}
      >
        {item.daysRemaining < 0
          ? `${Math.abs(item.daysRemaining)} days overdue`
          : `${item.daysRemaining} days`}
      </span>
    </a>
  );

 const getUserRole = () => {
 const token = localStorage.getItem('token');
 if (!token) return 'EMPLOYEE';
 try {
 const payload = JSON.parse(atob(token.split('.')[1]));
 return normalizeRole(payload.role);
    } catch {
 return 'EMPLOYEE';
    }
  };

 const isAdmin = getUserRole() === 'ADMIN' || getUserRole() === 'DIRECTOR';

 if (loading) {
 return (
      <div className="p-6">
        <PageHeader className="mb-6" title="Notifications and alerts" subline="What the nightly sweep found and what it emails." />
        <Card>
          <div className="text-center py-8 text-ink-3">
 Loading notifications...
          </div>
        </Card>
      </div>
    );
  }

 const overdueCount =
 expiries.overdueVisas.length + expiries.overdueContracts.length;
 const upcomingCount =
 expiries.visaExpiries.length + expiries.contractExpiries.length;
 const otherOverdue = expiries.other.filter((i) => i.daysRemaining < 0);
 const otherUpcoming = expiries.other.filter((i) => i.daysRemaining >= 0);

 return (
    <div className="p-6">
      <PageHeader className="mb-6" title="Notifications and alerts" subline="What the nightly sweep found and what it emails." />

      {isAdmin && (
        <>
          <Card className="mb-6">
            <h2 className="text-xl font-semibold mb-4">
 Email Notification System
            </h2>
            <div className="space-y-4">
              <div className="bg-surface-2 border border-line p-4">
                <h3 className="font-medium text-ink-2 mb-2">
 Automated Notifications
                </h3>
                <ul className="text-sm text-ink-2 space-y-1 list-disc list-inside">
                  <li>
 Visa &amp; contract expiry alerts at 30, 60 and 90 days
 before expiry, and every day once an item is overdue.
                  </li>
                  <li>
 Passport, DBS recheck, right-to-work recheck, sponsor
 licence, action plan and CoS start-by reminders on the same
 schedule, with an in-app copy for admins and directors.
                  </li>
                  <li>Cron runs daily at 09:00 UK time.</li>
                  <li>
 Leave request notifications (to operational approvers)
                  </li>
                  <li>Leave approval/rejection notifications (to employees)</li>
                  <li>Document upload notifications</li>
                </ul>
                <div className="mt-3 text-xs text-ink-2">
                  {cronStatus?.lastAuditRunAt
                    ? `Last automated run: ${new Date(cronStatus.lastAuditRunAt).toLocaleString('en-GB')}`
                    : 'Last automated run: never (or before this deployment)'}
                  {cronStatus?.lastError && (
                    <span className="ml-2 text-bad">
                      · last error: {cronStatus.lastError}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
 onClick={checkAndNotify}
 disabled={checking}
 className="btn-secondary whitespace-nowrap"
                >
                  {checking ? 'Checking…' : 'Force run now'}
                </button>

                <div className="flex min-w-[240px] flex-1 items-center gap-2">
                  <input
 type="email"
 value={testEmail}
 onChange={(e) => setTestEmail(e.target.value)}
 placeholder="your-email@example.com"
 className="form-input flex-1"
                  />
                  <button
 onClick={sendTestEmail}
 disabled={testingEmail}
 className="btn-secondary whitespace-nowrap"
                  >
                    {testingEmail ? 'Sending…' : 'Send test email'}
                  </button>
                </div>
              </div>
            </div>
          </Card>

          {/* Overdue Expiries — surfaced above upcoming because these are compliance breaches */}
          {overdueCount + otherOverdue.length > 0 && (
            <Card className="mb-6 border-2 border-bad bg-bad-tint">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-bad">
                  Overdue ({overdueCount + otherOverdue.length})
                </h2>
                <span className="text-sm text-bad">
 Already expired, action required
                </span>
              </div>
              <div className="space-y-6">
                {expiries.overdueVisas.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                      Visas overdue ({expiries.overdueVisas.length})
                    </h3>
                    <div className="space-y-2">
                      {expiries.overdueVisas.map((item) =>
 renderRow(item, 'visa'),
                      )}
                    </div>
                  </div>
                )}
                {expiries.overdueContracts.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                      Contracts overdue ({expiries.overdueContracts.length})
                    </h3>
                    <div className="space-y-2">
                      {expiries.overdueContracts.map((item) =>
 renderRow(item, 'contract'),
                      )}
                    </div>
                  </div>
                )}
                {otherOverdue.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                      ⏰ Other checks overdue ({otherOverdue.length})
                    </h3>
                    <div className="space-y-2">
                      {otherOverdue.map(renderOtherRow)}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          <Card className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Upcoming expiries</h2>
              <div className="flex items-center gap-2">
                <label
 htmlFor="expiry-window"
 className="text-sm text-ink-2 "
                >
 Show next:
                </label>
                <select
 id="expiry-window"
 value={days}
 onChange={(e) => setDays(parseInt(e.target.value))}
 className="px-3 py-1 border border-line rounded-md bg-surface text-ink"
                >
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                  <option value={90}>90 days</option>
                  <option value={180}>180 days</option>
                </select>
              </div>
            </div>

            {upcomingCount === 0 ? (
              <div className="text-center py-8 text-ink-3">
                No upcoming expiries in the next {days} days
              </div>
            ) : (
              <div className="space-y-6">
                {expiries.visaExpiries.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                      Visa expiries ({expiries.visaExpiries.length})
                    </h3>
                    <div className="space-y-2">
                      {expiries.visaExpiries.map((item) =>
 renderRow(item, 'visa'),
                      )}
                    </div>
                  </div>
                )}

                {expiries.contractExpiries.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                      Contract expiries ({expiries.contractExpiries.length})
                    </h3>
                    <div className="space-y-2">
                      {expiries.contractExpiries.map((item) =>
 renderRow(item, 'contract'),
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card className="mb-6">
            <h2 className="text-xl font-semibold mb-4">
 Other checks due ({otherUpcoming.length})
            </h2>
            <p className="text-sm text-ink-2 mb-4">
 Passport and DBS rechecks, follow-up right-to-work checks, the
 sponsor licence, action-plan deadlines and CoS start-by dates in
 the next {days} days.
            </p>
            {otherUpcoming.length === 0 ? (
              <div className="text-center py-8 text-ink-3">
                Nothing else falls due in the next {days} days
              </div>
            ) : (
              <div className="space-y-2">{otherUpcoming.map(renderOtherRow)}</div>
            )}
          </Card>
        </>
      )}

      {!isAdmin && (
        <Card>
          <div className="text-center py-8 text-ink-3">
 Admin access required to view notifications
          </div>
        </Card>
      )}
    </div>
  );
};

export default Notifications;
