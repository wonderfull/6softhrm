import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  CheckIcon,
  ClockIcon,
  DocumentTextIcon,
  LockClosedIcon,
  ShieldCheckIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import PublicLayout from '../components/marketing/PublicLayout';
import { DEMO_HREF } from '../components/marketing/SiteHeader';

// Public landing page. Every claim below maps to something the product does
// today (see backend/src/lib/*); keep it that way when editing copy.

const PRIMARY_BTN =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap px-5 py-3 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2 dark:focus:ring-offset-slate-950 active:translate-y-px';
const GHOST_BTN =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap px-5 py-3 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2 dark:focus:ring-offset-slate-950 active:translate-y-px';

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary-600 dark:text-primary-300">
      {children}
    </p>
  );
}

function SectionHeading({
  eyebrow,
  title,
  lede,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
}) {
  return (
    <div className="max-w-2xl">
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight leading-[1.1] text-slate-900 dark:text-white">
        {title}
      </h2>
      {lede && (
        <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
          {lede}
        </p>
      )}
    </div>
  );
}

// The hero used to carry these as a strip under the CTAs. They are real
// claims, so they moved here rather than being dropped.
const STATS = [
  { value: 'Live in an afternoon', label: 'import your people from a CSV and go' },
  { value: 'UK hosted', label: 'data held in Manchester, England' },
  {
    value: 'AES-256-GCM',
    label: 'field-level encryption for NI, passport and bank details',
  },
  {
    value: 'Processor agreement',
    label: 'UK GDPR terms included, with every sensitive action logged',
  },
];

const STAKES = [
  {
    title: 'Leave lives in inboxes',
    body: 'Requests arrive by email, approvals happen in chat, and the allowance is a spreadsheet only one person understands. Nobody can say who is off next Tuesday.',
  },
  {
    title: 'Documents live in drives',
    body: 'Contracts, right-to-work checks and ID sit in shared folders with no expiry dates and no record of who has looked at them. The audit is a scramble.',
  },
  {
    title: 'Compliance lives in one head',
    body: 'GDPR consent, retention and, if you sponsor workers, Home Office reporting all depend on one person remembering. When they are away, the company is exposed.',
  },
];

const PILLARS = [
  {
    icon: UsersIcon,
    title: 'People records',
    items: [
      'One profile per employee, imported from CSV',
      'Job, contract, pay and emergency details',
      'Roles: admin, director, office assistant, employee',
      'Self-service for every member of staff',
    ],
  },
  {
    icon: CalendarDaysIcon,
    title: 'Leave & absence',
    items: [
      'Requests and approvals with email notifications',
      'Annual leave balance on every employee dashboard',
      'gov.uk bank holidays for England & Wales, Scotland and Northern Ireland',
      'Sickness and unauthorised absence ledger',
    ],
  },
  {
    icon: ClockIcon,
    title: 'Time & projects',
    items: [
      'Weekly timesheets with approval',
      'Projects and hours by client',
      'Working-day calendar built in',
      'Export for payroll and billing',
    ],
  },
  {
    icon: DocumentTextIcon,
    title: 'Documents',
    items: [
      'Contracts, right-to-work, visas and ID per employee',
      'PDF, Word and image uploads',
      'Who uploaded and who viewed, recorded',
      'Employee-visible or HR-only',
    ],
  },
  {
    icon: ShieldCheckIcon,
    title: 'Compliance',
    items: [
      'UK GDPR consent and data-subject export',
      'Retention and audit logs',
      'Sponsor licence toolkit for employers of Skilled Workers',
      'Compliance pack export for an inspection',
    ],
  },
  {
    icon: LockClosedIcon,
    title: 'Security',
    items: [
      'Two-factor authentication',
      'Encrypted NI, passport and bank fields',
      'Each company isolated at the data layer',
      'Nightly backups, hosted in the UK',
    ],
  },
];

const TEAMS = [
  {
    title: 'Employees',
    ref: 'Self-service',
    body: 'Book leave, submit timesheets, upload documents and see their own record, and nothing else. Consent and data-export requests are a button, not an email to HR.',
  },
  {
    title: 'Managers and directors',
    ref: 'Approvals and visibility',
    body: 'Approve leave and time from one queue, see who is off across the team, and open any report without asking HR to run it.',
  },
  {
    title: 'HR and office administrators',
    ref: 'Control',
    body: 'Own the employee records, documents, roles and settings. Import from CSV, export for payroll, and answer an audit or a subject-access request from the audit log.',
  },
  {
    title: 'Sponsor licence holders',
    ref: 'Included in Core + Compliance',
    body: 'If you employ Skilled Workers, the same records feed an audit readiness score, automatic absence and salary checks against the Certificate of Sponsorship, and an Appendix D evidence checklist. It is a feature, not a separate product.',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Import your people',
    body: 'Upload a CSV or add employees by hand. Sensitive fields are encrypted before they reach the database.',
  },
  {
    n: '02',
    title: 'Invite the company',
    body: 'Everyone gets a login with the right role. Employees see themselves, managers see their team, admins see the lot.',
  },
  {
    n: '03',
    title: 'Run HR from one place',
    body: 'Leave, time, documents and compliance happen in the portal from day one, with an audit trail from the first click.',
  },
];

const SECURITY = [
  {
    title: 'Two-factor authentication',
    body: 'Time-based one-time codes for admin accounts, single-use password reset links, and per-account login throttling.',
  },
  {
    title: 'Field-level encryption',
    body: 'National Insurance numbers, passport numbers, sort codes and account numbers are encrypted with AES-256-GCM.',
  },
  {
    title: 'Company isolation',
    body: 'Every customer is separated at the data-access layer, not just the login screen. Cross-company queries are refused by design.',
  },
  {
    title: 'Complete audit log',
    body: 'Who viewed, changed or exported what, and when. Retained for your GDPR accountability record.',
  },
  {
    title: 'Backups with rehearsed restores',
    body: 'Nightly backups, and a restore procedure that has actually been run, not just written down.',
  },
  {
    title: 'Hosted in the United Kingdom',
    body: 'Data stays in England. 6soft Ltd acts as your processor under a UK GDPR data processing agreement.',
  },
];

const PLANS = [
  {
    name: 'Core',
    tagline: 'The HR portal for any UK company.',
    features: [
      'Employee records and CSV import',
      'Leave, timesheets and projects',
      'Document storage',
      'Roles and employee self-service',
      'Audit log and data export',
      'Two-factor authentication',
    ],
    highlight: true,
  },
  {
    name: 'Core + Compliance',
    tagline: 'Everything in Core, plus the sponsor licence toolkit.',
    features: [
      'Audit readiness score',
      'Unauthorised absence detection',
      'Salary reconciliation against CoS',
      'Appendix D evidence checklist',
      'Reportable event register',
      'Compliance pack export',
    ],
    highlight: false,
  },
];

const FAQ = [
  {
    q: 'Who controls the data?',
    a: 'Your company is the data controller. 6soft Ltd is the processor and acts only on your instructions under the data processing agreement you sign at onboarding.',
  },
  {
    q: 'Where is our data hosted?',
    a: 'On servers in Manchester, England. It does not leave the United Kingdom.',
  },
  {
    q: 'Can we bring data from our current system?',
    a: 'Yes. Employees and payroll periods import from CSV, and we will help map your export on the onboarding call.',
  },
  {
    q: 'Do employees get their own login?',
    a: 'Yes. Employees see and manage only their own leave, time, documents and consent. Directors and office assistants see the wider team; admins see everything.',
  },
  {
    q: 'We sponsor workers. Does OnsideHR cover that?',
    a: 'Yes, on the Core + Compliance plan. The same employee, absence and pay records feed an audit readiness score, automatic checks against the published sponsor guidance, and an Appendix D evidence checklist. It supports your reporting decisions; it is not legal or immigration advice.',
  },
  {
    q: 'How is the product kept up to date?',
    a: 'Bank-holiday calendars, compliance rules and legal templates carry the version they implement and are reviewed monthly. Updates ship to every customer at once; there is nothing to install.',
  },
];

function ProductShot() {
  return (
    <figure className="relative">
      <img
        src="/marketing/reports.png"
        alt="The OnsideHR reports screen: active headcount, leave pending, hours this month and audit readiness, with headcount broken down by department."
        width={1440}
        height={900}
        loading="eager"
        decoding="async"
        className="w-full rounded-xl border border-slate-200 shadow-2xl shadow-slate-900/10 dark:border-slate-700 dark:shadow-black/40"
      />
    </figure>
  );
}

export default function Home() {
  const signedIn = !!localStorage.getItem('token');

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-20 lg:pt-24 lg:pb-28 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-6">
          <Eyebrow>HR software for UK companies</Eyebrow>
          <h1 className="mt-4 text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05] text-slate-900 dark:text-white">
            One HR portal for the whole company.
          </h1>
          <p className="mt-6 text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-[60ch]">
            Employee records, leave, timesheets, documents and compliance in one
            UK-hosted portal, with a login for the people team, for managers,
            and for every employee.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <a href={DEMO_HREF} className={PRIMARY_BTN}>
              Book a demo
            </a>
            <a href="#how" className={GHOST_BTN}>
              See how it works
              <ArrowRightIcon className="h-4 w-4" />
            </a>
          </div>
        </div>
        <div className="lg:col-span-6">
          <ProductShot />
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
        <dl className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-6">
          {STATS.map((s) => (
            <div key={s.value}>
              <dt className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
                {s.value}
              </dt>
              <dd className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {s.label}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Stakes */}
      <section
        id="why"
        className="scroll-mt-20 max-w-7xl mx-auto px-4 sm:px-6 py-20 lg:py-24"
      >
        <SectionHeading
                    title="HR without a system is a set of habits. Habits do not survive an audit."
          lede="Most UK companies under two hundred people run HR on email, spreadsheets and a shared drive. It works until the day it is checked."
        />
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
          {STAKES.map((s) => (
            <div
              key={s.title}
              className="border-t border-slate-900 dark:border-white pt-5"
            >
              <h3 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
                {s.title}
              </h3>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Product pillars */}
      <section
        id="product"
        className="scroll-mt-20 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 lg:py-24">
          <SectionHeading
                        title="Everything HR, in one place."
            lede="Six areas, one employee record underneath them all. What you enter once is what every report, calendar and audit trail reads from."
          />
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-slate-200 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
            {PILLARS.map((p) => (
              <div
                key={p.title}
                className="bg-white dark:bg-slate-950 p-6 lg:p-7"
              >
                <p.icon className="h-6 w-6 text-primary-600 dark:text-primary-300" strokeWidth={1.5} />
                <h3 className="mt-4 text-base font-semibold tracking-tight text-slate-900 dark:text-white">
                  {p.title}
                </h3>
                <ul className="mt-4 space-y-2.5">
                  {p.items.map((item) => (
                    <li
                      key={item}
                      className="flex gap-2 text-sm text-slate-600 dark:text-slate-400 leading-snug"
                    >
                      <CheckIcon
                        className="h-4 w-4 mt-0.5 flex-shrink-0 text-slate-400"
                        strokeWidth={2}
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For every role */}
      <section
        id="teams"
        className="scroll-mt-20 max-w-7xl mx-auto px-4 sm:px-6 py-20 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12"
      >
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-24">
            <SectionHeading
              eyebrow="For every role"
              title="One portal, four views of it."
              lede="Everyone in the company uses the same system and sees exactly what their role allows. No second tool for managers, no PDF forms for staff."
            />
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <a href={DEMO_HREF} className={PRIMARY_BTN}>
                Book a demo
              </a>
            </div>
          </div>
        </div>
        <ul className="lg:col-span-7 divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
          {TEAMS.map((c) => (
            <li
              key={c.title}
              className="py-7 grid grid-cols-1 sm:grid-cols-12 gap-3"
            >
              <div className="sm:col-span-4">
                <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">
                  {c.title}
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {c.ref}
                </p>
              </div>
              <p className="sm:col-span-8 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {c.body}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* How it works */}
      <section
        id="how"
        className="scroll-mt-20 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 lg:py-24">
          <SectionHeading
                        title="Live in an afternoon, not a quarter."
          />
          <ol className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((s) => (
              <li
                key={s.n}
                className="border-t border-slate-900 dark:border-white pt-5"
              >
                <p className="text-xs font-semibold tracking-[0.08em] text-primary-600 dark:text-primary-300">
                  {s.n}
                </p>
                <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
                  {s.title}
                </h3>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {s.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Security */}
      <section
        id="security"
        className="scroll-mt-20 max-w-7xl mx-auto px-4 sm:px-6 py-20 lg:py-24"
      >
        <SectionHeading
                    title="Answers your procurement questionnaire will accept."
          lede="Employment records are among the most sensitive data a business holds. These are the controls in place today, described plainly."
        />
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-10">
          {SECURITY.map((s) => (
            <div key={s.title}>
              <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">
                {s.title}
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {s.body}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-sm text-slate-500 dark:text-slate-400">
          Full detail in the{' '}
          <Link
            to="/dpa"
            className="underline underline-offset-4 decoration-slate-300 hover:decoration-primary-600 text-slate-700 dark:text-slate-300"
          >
            data processing agreement
          </Link>{' '}
          and{' '}
          <Link
            to="/gdpr"
            className="underline underline-offset-4 decoration-slate-300 hover:decoration-primary-600 text-slate-700 dark:text-slate-300"
          >
            UK GDPR statement
          </Link>
          .
        </p>
      </section>

      {/* Pricing */}
      <section
        id="pricing"
        className="scroll-mt-20 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 lg:py-24">
          <SectionHeading
            eyebrow="Pricing"
            title="Two plans. Priced per seat."
            lede="Tell us your headcount and we will send a quote and a data processing agreement together. Add Compliance only if you hold a sponsor licence."
          />
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={`rounded-xl border bg-white dark:bg-slate-950 p-7 flex flex-col ${
                  p.highlight
                    ? 'border-primary-600'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
                    {p.name}
                  </h3>
                  {p.highlight && (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary-600/10 text-primary-600 dark:text-primary-300">
                      Most companies
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  {p.tagline}
                </p>
                <ul className="mt-6 space-y-2.5 flex-1">
                  {p.features.map((f) => (
                    <li
                      key={f}
                      className="flex gap-2 text-sm text-slate-700 dark:text-slate-300"
                    >
                      <CheckIcon
                        className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary-600 dark:text-primary-300"
                        strokeWidth={2}
                      />
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href={DEMO_HREF}
                  className={`mt-8 ${p.highlight ? PRIMARY_BTN : GHOST_BTN}`}
                >
                  Talk to us
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section
        id="faq"
        className="scroll-mt-20 max-w-7xl mx-auto px-4 sm:px-6 py-20 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12"
      >
        <div className="lg:col-span-4">
          <SectionHeading title="Straight answers." />
        </div>
        <div className="lg:col-span-8 divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
          {FAQ.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="cursor-pointer list-none flex items-start justify-between gap-4 text-base font-medium text-slate-900 dark:text-white">
                {f.q}
                <span
                  aria-hidden="true"
                  className="mt-1 text-slate-400 group-open:rotate-45 transition-transform text-xl leading-none"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-[70ch]">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 lg:py-24 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="max-w-2xl">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-[1.1] text-slate-900 dark:text-white">
              See OnsideHR running on your own data.
            </h2>
            <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-400">
              A 30-minute call and your employee CSV. We set the portal up with
              your people in it, so the demo is your company, not ours.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <a href={DEMO_HREF} className={PRIMARY_BTN}>
              Book a demo
            </a>
            <Link to={signedIn ? '/dashboard' : '/login'} className={GHOST_BTN}>
              {signedIn ? 'Open app' : 'Sign in'}
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
