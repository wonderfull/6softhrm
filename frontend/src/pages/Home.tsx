import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  CheckIcon,
  LockClosedIcon,
  ShieldCheckIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import PublicLayout from '../components/marketing/PublicLayout';
import { DEMO_HREF } from '../components/marketing/SiteHeader';

// Public landing page. Every claim below maps to something the product does
// today (see backend/src/lib/*); keep it that way when editing copy.

const PRIMARY_BTN =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap px-5 py-3 rounded-lg bg-[#5e6ad2] hover:bg-[#828fff] text-white font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#5e69d1] focus:ring-offset-2 dark:focus:ring-offset-slate-950 active:translate-y-px';
const GHOST_BTN =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap px-5 py-3 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-[#5e69d1] focus:ring-offset-2 dark:focus:ring-offset-slate-950 active:translate-y-px';

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5e6ad2]">
      {children}
    </p>
  );
}

function SectionHeading({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
}) {
  return (
    <div className="max-w-2xl">
      <Eyebrow>{eyebrow}</Eyebrow>
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

const STATS = [
  { value: '10 working days', label: 'reporting deadline tracked on every event' },
  { value: '12 items', label: 'of Appendix D evidence checked per sponsored worker' },
  { value: 'AES-256-GCM', label: 'field-level encryption for NI, passport and bank details' },
  { value: 'UK hosted', label: 'data held in Manchester, England' },
];

const STAKES = [
  {
    title: 'The ten-day absence',
    body: 'Ten consecutive working days of unauthorised absence is a reportable event, and the clock for reporting it is ten working days. Spreadsheets miss it because nobody counts bank holidays.',
  },
  {
    title: 'Salary below the CoS',
    body: 'From 8 April 2026 a sponsored worker must be paid at least the Certificate of Sponsorship salary in every pay period, not on average across the year. One short month is a report.',
  },
  {
    title: 'Evidence gaps at audit',
    body: 'A compliance visit asks for the Appendix D file on each worker. If the right-to-work check or twelve months of payslips are not to hand, it is recorded as a finding against you.',
  },
];

const PILLARS = [
  {
    icon: ShieldCheckIcon,
    title: 'Sponsor compliance',
    items: [
      'Audit readiness score for the whole licence',
      'Automatic absence and salary sweeps every morning',
      'Reportable event register with deadlines',
      'One-click compliance pack (ZIP) for a visit',
    ],
  },
  {
    icon: UsersIcon,
    title: 'People & documents',
    items: [
      'Employee records with CSV import',
      'Right-to-work, visa and contract documents',
      'Roles: admin, director, office assistant, employee',
      'Data-subject export in a click',
    ],
  },
  {
    icon: CalendarDaysIcon,
    title: 'Leave & time',
    items: [
      'Leave requests and approvals',
      'Timesheets and projects',
      'gov.uk bank-holiday calendars for England & Wales, Scotland and Northern Ireland',
      'Absence ledger derived from leave and time',
    ],
  },
  {
    icon: LockClosedIcon,
    title: 'Audit trail & privacy',
    items: [
      'Every sensitive action written to the audit log',
      'Employee consent records',
      'UK GDPR processor agreement included',
      'Two-factor authentication on any account',
    ],
  },
];

const COMPLIANCE = [
  {
    title: 'Unauthorised absence detection',
    ref: 'Sponsor guidance Part 3, C1.15',
    body: 'Leave, timesheets and manual records are combined into one absence ledger per worker. When ten consecutive working days of unauthorised absence appear — counted against the correct regional bank-holiday calendar — a reportable event is raised with its deadline.',
  },
  {
    title: 'Salary reconciliation',
    ref: 'Per-pay-period rule from 8 April 2026',
    body: 'Import your payroll export. Each pay period is annualised and checked against the higher of the CoS salary and the going rate for the role. A shortfall becomes a reportable event at the next morning\'s sweep.',
  },
  {
    title: 'Appendix D evidence',
    ref: 'Appendix D, version 08/26',
    body: 'A twelve-item evidence checklist on every sponsored worker — right-to-work check, CoS record, contract, payslips, bank transfer evidence and the rest — with the retention date calculated for you.',
  },
  {
    title: 'Versioned rules',
    ref: 'Reviewed monthly',
    body: 'Every rule carries the version of the guidance it implements and shows it in the product. When the Home Office changes the rules, you can see when we caught up.',
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
    title: 'Add sponsorship and pay',
    body: 'Record each Certificate of Sponsorship, its salary and going rate, then import payroll periods as you run them.',
  },
  {
    n: '03',
    title: 'Watch the score',
    body: 'The dashboard shows a readiness band — Ready, At risk, Not ready — and what to fix. Export the compliance pack when the Home Office calls.',
  },
];

const SECURITY = [
  {
    title: 'Two-factor authentication',
    body: 'Time-based one-time codes for any user, single-use password reset links, and per-account login throttling.',
  },
  {
    title: 'Field-level encryption',
    body: 'National Insurance numbers, passport numbers, sort codes and account numbers are encrypted with AES-256-GCM.',
  },
  {
    title: 'Tenant isolation',
    body: 'Every customer is separated at the data-access layer, not just the login screen. Cross-tenant queries are refused by design.',
  },
  {
    title: 'Complete audit log',
    body: 'Who viewed, changed or exported what, and when — retained for your GDPR accountability record.',
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
    tagline: 'People, leave, time and documents for any UK employer.',
    features: [
      'Employee records and CSV import',
      'Leave, timesheets and projects',
      'Document storage',
      'Roles and self-service',
      'Audit log and data export',
      'Two-factor authentication',
    ],
    highlight: false,
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
    highlight: true,
  },
];

const FAQ = [
  {
    q: 'Is OnsideHR legal or immigration advice?',
    a: 'No. OnsideHR applies the published sponsor guidance to your records and tells you what it finds. Decisions about reporting, and anything unusual, should go to your immigration adviser. We make that easier by giving them the evidence in one place.',
  },
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
    q: 'How do you keep up with guidance changes?',
    a: 'Each compliance rule is pinned to the version of the guidance it implements and reviewed monthly. The version is shown in the product so you always know which rules are running.',
  },
];

function ReadinessPanel() {
  return (
    <div
      aria-hidden="true"
      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_1px_0_rgba(15,23,42,0.04)] overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Sponsor audit readiness
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Guidance 05/26 · Appendix D 08/26
          </p>
        </div>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          At risk
        </span>
      </div>
      <div className="px-5 py-5 grid grid-cols-3 gap-4 border-b border-slate-200 dark:border-slate-800">
        <div className="col-span-1">
          <p className="text-5xl font-semibold tracking-tight text-slate-900 dark:text-white">
            74
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            out of 100
          </p>
        </div>
        <div className="col-span-2 grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-slate-500 dark:text-slate-400">Sponsored</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">
              18
            </p>
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400">Open events</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">
              2
            </p>
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400">Evidence</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">
              91%
            </p>
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400">Overdue</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">
              0
            </p>
          </div>
        </div>
      </div>
      <ul className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
        <li className="px-5 py-3 flex items-start justify-between gap-4">
          <div>
            <p className="font-medium text-slate-900 dark:text-white">
              Salary below CoS — A. Okafor
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              July pay period annualises to £29,120 vs £30,960 CoS
            </p>
          </div>
          <span className="whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
            Due in 6 working days
          </span>
        </li>
        <li className="px-5 py-3 flex items-start justify-between gap-4">
          <div>
            <p className="font-medium text-slate-900 dark:text-white">
              Missing evidence — M. Kowalski
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Payslips (12 months) not on file
            </p>
          </div>
          <span className="whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
            Appendix D
          </span>
        </li>
        <li className="px-5 py-3 flex items-start justify-between gap-4">
          <div>
            <p className="font-medium text-slate-900 dark:text-white">
              Absence sweep
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              18 workers checked · no ten-day spells
            </p>
          </div>
          <span className="whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
            Today 09:30
          </span>
        </li>
      </ul>
    </div>
  );
}

export default function Home() {
  const signedIn = !!localStorage.getItem('token');

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-20 lg:pt-24 lg:pb-28 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-6">
          <Eyebrow>For UK sponsor licence holders</Eyebrow>
          <h1 className="mt-4 text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05] text-slate-900 dark:text-white">
            HR software that keeps your sponsor licence safe.
          </h1>
          <p className="mt-6 text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-[60ch]">
            OnsideHR runs the people admin every employer needs — leave, time,
            documents — and watches the two things that get licences revoked:
            unauthorised absence and salary slipping below the Certificate of
            Sponsorship.
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
          <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
            Built and hosted in the UK · UK GDPR processor agreement included ·
            Existing data imports from CSV
          </p>
        </div>
        <div className="lg:col-span-6">
          <ReadinessPanel />
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
      <section id="why" className="scroll-mt-20 max-w-7xl mx-auto px-4 sm:px-6 py-20 lg:py-24">
        <SectionHeading
          eyebrow="Why it matters"
          title="Licences are not lost to bad intent. They are lost to missed dates."
          lede="The failures below are not exotic. They are arithmetic — and all three are checkable every morning, if something is counting."
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
            eyebrow="Product"
            title="One system for the people work, with compliance built in."
            lede="Most HR tools bolt sponsorship on as a custom field. In OnsideHR the sponsorship record, the absence ledger and the payroll periods are the same data the compliance engine reads."
          />
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
            {PILLARS.map((p) => (
              <div
                key={p.title}
                className="bg-white dark:bg-slate-950 p-6 lg:p-7"
              >
                <p.icon
                  className="h-6 w-6 text-[#5e6ad2]"
                  strokeWidth={1.5}
                />
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

      {/* Compliance deep-dive */}
      <section
        id="compliance"
        className="scroll-mt-20 max-w-7xl mx-auto px-4 sm:px-6 py-20 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12"
      >
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-24">
            <SectionHeading
              eyebrow="Sponsor compliance"
              title="The rules, applied to your records, every morning."
              lede="Two sweeps run every morning — one for absence, one for salary. Anything they find lands in the reportable event register with its deadline already counted in working days."
            />
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <a href={DEMO_HREF} className={PRIMARY_BTN}>
                Book a demo
              </a>
            </div>
          </div>
        </div>
        <ul className="lg:col-span-7 divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
          {COMPLIANCE.map((c) => (
            <li key={c.title} className="py-7 grid grid-cols-1 sm:grid-cols-12 gap-3">
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
            eyebrow="How it works"
            title="Live in an afternoon, not a quarter."
          />
          <ol className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((s) => (
              <li
                key={s.n}
                className="border-t border-slate-900 dark:border-white pt-5"
              >
                <p className="text-xs font-semibold tracking-[0.08em] text-[#5e6ad2]">
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
      <section id="security" className="scroll-mt-20 max-w-7xl mx-auto px-4 sm:px-6 py-20 lg:py-24">
        <SectionHeading
          eyebrow="Security"
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
            className="underline underline-offset-4 decoration-slate-300 hover:decoration-[#5e6ad2] text-slate-700 dark:text-slate-300"
          >
            data processing agreement
          </Link>{' '}
          and{' '}
          <Link
            to="/gdpr"
            className="underline underline-offset-4 decoration-slate-300 hover:decoration-[#5e6ad2] text-slate-700 dark:text-slate-300"
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
            lede="Tell us your headcount and how many workers you sponsor, and we will send a quote and a data processing agreement together."
          />
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={`rounded-xl border bg-white dark:bg-slate-950 p-7 flex flex-col ${
                  p.highlight
                    ? 'border-[#5e6ad2]'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
                    {p.name}
                  </h3>
                  {p.highlight && (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[#5e6ad2]/10 text-[#5e6ad2]">
                      For sponsors
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
                        className="h-4 w-4 mt-0.5 flex-shrink-0 text-[#5e6ad2]"
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
      <section id="faq" className="scroll-mt-20 max-w-7xl mx-auto px-4 sm:px-6 py-20 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-4">
          <SectionHeading eyebrow="FAQ" title="Straight answers." />
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
              See your readiness score on your own data.
            </h2>
            <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-400">
              A 30-minute call, your employee CSV, and you will know where you
              stand before the Home Office does.
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
