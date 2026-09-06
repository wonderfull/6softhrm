import React from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '../components/marketing/PublicLayout';
import DemoForm from '../components/marketing/DemoForm';
import { useReveal } from '../components/marketing/useReveal';
import {
  CONTACT_EMAIL,
  CONTACT_PHONE,
  CONTACT_TEL,
  DEMO_HREF,
} from '../components/marketing/SiteHeader';
import { Badge } from '../components/ui';
import '../styles/landing.css';

// Public landing page. Every claim below maps to something the product does
// today (see backend/src/lib/*); keep it that way when editing copy.

const CONTAINER = 'max-w-[1200px] mx-auto px-6';
const SECTION = 'py-[clamp(48px,7vw,112px)]';
const DISPLAY_L =
  'font-display text-[clamp(28px,3.6vw,40px)] leading-[1.1] tracking-[-0.02em] font-semibold text-ink text-balance';
const EYEBROW = 'text-xs font-medium uppercase tracking-[0.06em] text-link';
const ITEM_TITLE = 'text-[17px] font-semibold tracking-[-0.005em] text-ink';
const ITEM_BODY = 'text-[15px] leading-[1.55] text-ink-2 text-pretty';

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
    <div className="max-w-[640px] flex flex-col gap-3">
      {eyebrow && <p className={EYEBROW}>{eyebrow}</p>}
      <h2 className={DISPLAY_L}>{title}</h2>
      {lede && (
        <p className="text-[17px] leading-[1.55] text-ink-2 text-pretty max-w-[52ch]">
          {lede}
        </p>
      )}
    </div>
  );
}

function Photo({
  src,
  alt,
  className = '',
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-line bg-surface-2 overflow-hidden aspect-[4/3] ${className}`}
    >
      <img
        src={src}
        alt={alt}
        width={1400}
        height={1050}
        loading="lazy"
        decoding="async"
        className="block h-full w-full object-cover"
      />
    </div>
  );
}

function Dot() {
  return (
    <span
      aria-hidden="true"
      className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-ink-3"
    />
  );
}

const COVERS = [
  'People records',
  'Leave & absence',
  'Time & projects',
  'Documents',
  'Compliance',
  'Security',
];

const FACTS = [
  {
    title: 'Live in an afternoon',
    body: 'Import your people from a CSV and go.',
  },
  { title: 'UK hosted', body: 'Data held in Manchester, England.' },
  {
    title: 'AES-256-GCM',
    body: 'Field-level encryption for NI, passport and bank details.',
  },
  {
    title: 'Processor agreement',
    body: 'UK GDPR terms included, with every sensitive action logged.',
  },
];

const HABITS = [
  {
    n: '01',
    title: 'Leave lives in inboxes',
    body: 'Requests arrive by email, approvals happen in chat, and the allowance is a spreadsheet only one person understands. Nobody can say who is off next Tuesday.',
  },
  {
    n: '02',
    title: 'Documents live in drives',
    body: 'Contracts, right-to-work checks and ID sit in shared folders with no expiry dates and no record of who has looked at them. The audit is a scramble.',
  },
  {
    n: '03',
    title: 'Compliance lives in one head',
    body: 'GDPR consent, retention and, if you sponsor workers, Home Office reporting all depend on one person remembering. When they are away, the company is exposed.',
  },
];

const PILLARS = [
  {
    title: 'People records',
    items: [
      'One profile per employee, imported from CSV',
      'Job, contract, pay and emergency details',
      'Roles: admin, director, office assistant, employee',
      'Self-service for every member of staff',
    ],
  },
  {
    title: 'Leave & absence',
    items: [
      'Requests and approvals with email notifications',
      'Annual leave balance on every employee dashboard',
      'gov.uk bank holidays for England & Wales, Scotland and Northern Ireland',
      'Sickness and unauthorised absence ledger',
    ],
  },
  {
    title: 'Time & projects',
    items: [
      'Weekly timesheets with approval',
      'Projects and hours by client',
      'Working-day calendar built in',
      'Export for payroll and billing',
    ],
  },
  {
    title: 'Documents',
    items: [
      'Contracts, right-to-work, visas and ID per employee',
      'PDF, Word and image uploads',
      'Who uploaded and who viewed, recorded',
      'Employee-visible or HR-only',
    ],
  },
  {
    title: 'Compliance',
    items: [
      'UK GDPR consent and data-subject export',
      'Retention and audit logs',
      'Sponsor licence toolkit for employers of Skilled Workers',
      'Compliance pack export for an inspection',
    ],
  },
  {
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
    photo: '/marketing/photos/employee-desk.webp',
    alt: 'An employee working at a laptop with a second screen beside it.',
  },
  {
    title: 'Managers and directors',
    ref: 'Approvals and visibility',
    body: 'Approve leave and time from one queue, see who is off across the team, and open any report without asking HR to run it.',
    photo: '/marketing/photos/leadership-meeting.webp',
    alt: 'Managers around a meeting table with laptops and printed figures.',
  },
  {
    title: 'HR and office administrators',
    ref: 'Control',
    body: 'Own the employee records, documents, roles and settings. Import from CSV, export for payroll, and answer an audit or a subject-access request from the audit log.',
    photo: '/marketing/photos/admin-desk.webp',
    alt: 'An administrator at a laptop with a colleague at the next desk.',
  },
];

const SPONSOR = {
  title: 'Sponsor licence holders',
  ref: 'Included in Core + Compliance',
  body: 'If you employ Skilled Workers, the same records feed an audit readiness score, automatic absence and salary checks against the Certificate of Sponsorship, and an Appendix D evidence checklist. It is a feature, not a separate product.',
};

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

export default function Home() {
  const revealRoot = useReveal<HTMLDivElement>();

  return (
    <PublicLayout>
      <div ref={revealRoot}>
        {/* Hero */}
        <section className={`${CONTAINER} pt-[clamp(56px,9vw,112px)]`}>
          <div className="max-w-[720px] flex flex-col items-start gap-5">
            <p className={`reveal-hero ${EYEBROW}`}>
              HR software for UK companies
            </p>
            <h1
              className="reveal-hero font-display text-[clamp(38px,5.5vw,64px)] leading-[1.04] tracking-[-0.022em] font-semibold text-ink text-balance"
              style={{ animationDelay: '60ms' }}
            >
              One HR portal for the whole company.
            </h1>
            <p
              className="reveal-hero text-[clamp(16px,1.6vw,19px)] leading-normal text-ink-2 text-pretty max-w-[56ch]"
              style={{ animationDelay: '120ms' }}
            >
              Employee records, leave, timesheets, documents and compliance in
              one UK-hosted portal, with a login for the people team, for
              managers, and for every employee.
            </p>
            <div
              className="reveal-hero mt-2 flex flex-wrap gap-3"
              style={{ animationDelay: '180ms' }}
            >
              <a href={DEMO_HREF} className="btn-primary btn-hero cta-spring">
                Book a demo
              </a>
              <a href="#how" className="btn-secondary btn-hero">
                See how it works
                <span aria-hidden="true" className="font-mono text-ink-3">
                  →
                </span>
              </a>
            </div>
          </div>

          <div
            className="reveal-hero mt-[clamp(40px,6vw,72px)]"
            style={{ animationDelay: '280ms', animationDuration: '700ms' }}
          >
            <div className="relative rounded-xl border border-line bg-surface shadow-lg overflow-hidden max-h-[clamp(220px,46vw,620px)]">
              <div className="h-9 flex items-center gap-1.5 px-3.5 border-b border-line bg-surface-2">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-full bg-line-2"
                />
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-full bg-line-2"
                />
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-full bg-line-2"
                />
                <span className="ml-3 font-mono text-[11px] text-ink-3">
                  onsidehr.co.uk/reports
                </span>
              </div>
              {/* The shot follows the theme: the dark capture is the same
                  screen, so the hero never shows a light app on a dark page. */}
              <img
                src="/marketing/reports.webp"
                alt="The OnsideHR reports screen: active headcount, leave pending, hours this month and audit readiness, with headcount broken down by department."
                width={1440}
                height={900}
                loading="eager"
                decoding="async"
                className="block w-full h-auto dark:hidden"
              />
              <img
                src="/marketing/reports-dark.webp"
                alt=""
                aria-hidden="true"
                width={1440}
                height={900}
                loading="eager"
                decoding="async"
                className="hidden w-full h-auto dark:block"
              />
              <div
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-[120px] bg-gradient-to-b from-transparent to-bg"
              />
            </div>
          </div>
        </section>

        {/* Covers */}
        <section className={`${CONTAINER} pt-[clamp(40px,6vw,64px)]`}>
          <div className="reveal flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="mr-2 text-[13px] text-ink-3">Covers</span>
            {COVERS.map((c) => (
              <a
                key={c}
                href="#product"
                className="inline-flex items-center gap-2 h-8 px-3 rounded-md border border-line bg-surface text-sm font-medium text-ink"
              >
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-accent"
                />
                {c}
              </a>
            ))}
          </div>
        </section>

        {/* Facts */}
        <section
          className={`${CONTAINER} pt-[clamp(40px,6vw,64px)] pb-[clamp(48px,7vw,88px)]`}
        >
          <dl className="reveal grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-y-6 border-y border-line py-7">
            {FACTS.map((f) => (
              <div
                key={f.title}
                className="-ml-px px-6 flex flex-col gap-1.5 border-l border-line"
              >
                <dt className="text-base font-semibold tracking-[-0.005em] text-ink">
                  {f.title}
                </dt>
                <dd className="text-sm text-ink-2 text-pretty">{f.body}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Habits */}
        <section
          id="how"
          className="scroll-mt-[60px] border-t border-line bg-surface"
        >
          <div className={`${CONTAINER} py-[clamp(64px,9vw,112px)]`}>
            <div className="reveal grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-x-16 gap-y-8 items-start">
              <h2 className={DISPLAY_L}>
                HR without a system is a set of habits. Habits do not survive an
                audit.
              </h2>
              <p className="text-[17px] leading-[1.55] text-ink-2 text-pretty max-w-[52ch]">
                Most UK companies under two hundred people run HR on email,
                spreadsheets and a shared drive. It works until the day it is
                checked.
              </p>
            </div>
            <ol className="reveal mt-[clamp(40px,6vw,72px)] grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-8">
              {HABITS.map((h) => (
                <li
                  key={h.n}
                  className="flex flex-col gap-2 border-t border-line-2 pt-5"
                >
                  <span className="font-mono text-xs text-ink-3">{h.n}</span>
                  <span className={ITEM_TITLE}>{h.title}</span>
                  <span className={ITEM_BODY}>{h.body}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Product pillars */}
        <section id="product" className="scroll-mt-[60px] border-t border-line">
          <div className={`${CONTAINER} ${SECTION}`}>
            <div className="reveal">
              <SectionHeading
                title="Everything HR, in one place."
                lede="Six areas, one employee record underneath them all. What you enter once is what every report, calendar and audit trail reads from."
              />
            </div>
            <ul className="reveal mt-[clamp(32px,5vw,56px)] grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
              {PILLARS.map((p) => (
                <li
                  key={p.title}
                  className="bg-surface border border-line rounded-lg shadow-sm p-5"
                >
                  <h3 className="text-base font-semibold text-ink">
                    {p.title}
                  </h3>
                  <ul className="mt-3 flex flex-col gap-2">
                    {p.items.map((item) => (
                      <li
                        key={item}
                        className="flex gap-2.5 text-sm leading-snug text-ink-2"
                      >
                        <Dot />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* For every role */}
        <section id="teams" className="scroll-mt-[60px] border-t border-line">
          <div className={`${CONTAINER} ${SECTION}`}>
            <div className="reveal">
              <SectionHeading
                eyebrow="For every role"
                title="One portal, four views of it."
                lede="Everyone in the company uses the same system and sees exactly what their role allows. No second tool for managers, no PDF forms for staff."
              />
            </div>
            <ul className="reveal mt-[clamp(32px,5vw,56px)] grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-8">
              {TEAMS.map((t) => (
                <li key={t.title} className="flex flex-col">
                  <Photo src={t.photo} alt={t.alt} />
                  <h3 className={`mt-5 ${ITEM_TITLE}`}>{t.title}</h3>
                  <p className="mt-1 text-xs font-medium text-ink-3">{t.ref}</p>
                  <p className={`mt-3 ${ITEM_BODY}`}>{t.body}</p>
                </li>
              ))}
            </ul>
            <div className="reveal mt-10 grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-x-16 gap-y-3 border-t border-line-2 pt-5">
              <div>
                <h3 className={ITEM_TITLE}>{SPONSOR.title}</h3>
                <p className="mt-1 text-xs font-medium text-ink-3">
                  {SPONSOR.ref}
                </p>
              </div>
              <p className={ITEM_BODY}>{SPONSOR.body}</p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section
          id="setup"
          className="scroll-mt-[60px] border-t border-line bg-surface"
        >
          <div className={`${CONTAINER} ${SECTION}`}>
            <div className="reveal grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-x-16 gap-y-10 items-start">
              <div>
                <SectionHeading title="Live in an afternoon, not a quarter." />
                <ol className="mt-10 flex flex-col gap-8">
                  {STEPS.map((s) => (
                    <li
                      key={s.n}
                      className="flex flex-col gap-2 border-t border-line-2 pt-5"
                    >
                      <span className="font-mono text-xs text-ink-3">
                        {s.n}
                      </span>
                      <span className={ITEM_TITLE}>{s.title}</span>
                      <span className={ITEM_BODY}>{s.body}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <Photo
                src="/marketing/photos/office-setup.webp"
                alt="Three colleagues working at laptops in a bright office."
              />
            </div>
          </div>
        </section>

        {/* Security */}
        <section
          id="security"
          className="scroll-mt-[60px] border-t border-line"
        >
          <div className={`${CONTAINER} ${SECTION}`}>
            <div className="reveal">
              <SectionHeading
                title="Answers your procurement questionnaire will accept."
                lede="Employment records are among the most sensitive data a business holds. These are the controls in place today, described plainly."
              />
            </div>
            <ul className="reveal mt-[clamp(32px,5vw,56px)] grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-8">
              {SECURITY.map((s) => (
                <li
                  key={s.title}
                  className="flex flex-col gap-1.5 border-t border-line-2 pt-5"
                >
                  <h3 className="text-base font-semibold tracking-[-0.005em] text-ink">
                    {s.title}
                  </h3>
                  <p className="text-sm leading-[1.55] text-ink-2 text-pretty">
                    {s.body}
                  </p>
                </li>
              ))}
            </ul>
            <p className="reveal mt-10 text-sm text-ink-2">
              Full detail in the{' '}
              <Link
                to="/dpa"
                className="text-link underline underline-offset-4 decoration-line-2 hover:decoration-accent"
              >
                data processing agreement
              </Link>{' '}
              and{' '}
              <Link
                to="/gdpr"
                className="text-link underline underline-offset-4 decoration-line-2 hover:decoration-accent"
              >
                UK GDPR statement
              </Link>
              .
            </p>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-[60px] border-t border-line">
          <div className={`${CONTAINER} ${SECTION}`}>
            <div className="reveal">
              <SectionHeading
                eyebrow="Pricing"
                title="Two plans. Priced per seat."
                lede="Tell us your headcount and we will send a quote and a data processing agreement together. Add Compliance only if you hold a sponsor licence."
              />
            </div>
            <ul className="reveal mt-[clamp(32px,5vw,56px)] grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4 max-w-[880px]">
              {PLANS.map((p) => (
                <li
                  key={p.name}
                  className="bg-surface border border-line rounded-lg shadow-sm p-6 flex flex-col"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xl leading-[1.3] tracking-[-0.01em] font-semibold text-ink">
                      {p.name}
                    </h3>
                    {p.highlight && <Badge>Most companies</Badge>}
                  </div>
                  <p className="mt-1.5 text-sm text-ink-2">{p.tagline}</p>
                  <ul className="mt-5 flex flex-col gap-2 flex-1">
                    {p.features.map((f) => (
                      <li
                        key={f}
                        className="flex gap-2.5 text-sm leading-snug text-ink"
                      >
                        <Dot />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <a href={DEMO_HREF} className="btn-secondary mt-8 self-start">
                    Talk to us
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section
          id="faq"
          className="scroll-mt-[60px] border-t border-line bg-surface"
        >
          <div className={`${CONTAINER} ${SECTION}`}>
            <div className="reveal grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-x-16 gap-y-8 items-start">
              <SectionHeading title="Straight answers." />
              <div className="border-t border-line">
                {FAQ.map((f) => (
                  <details
                    key={f.q}
                    className="group border-b border-line py-4"
                  >
                    <summary className="cursor-pointer list-none flex items-start justify-between gap-4 text-[15px] font-medium text-ink">
                      {f.q}
                      <span
                        aria-hidden="true"
                        className="font-mono text-ink-3 leading-[1.5] group-open:rotate-45 transition-transform duration-hover"
                      >
                        +
                      </span>
                    </summary>
                    <p className="mt-3 text-sm leading-[1.55] text-ink-2 text-pretty max-w-[70ch]">
                      {f.a}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Demo */}
        <section id="demo" className="scroll-mt-[60px] border-t border-line">
          <div className={`${CONTAINER} py-[clamp(56px,8vw,96px)]`}>
            <div className="reveal grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-x-16 gap-y-8 items-center">
              <div className="flex flex-col gap-3">
                <h2 className="font-display text-[clamp(26px,3.2vw,36px)] leading-[1.1] tracking-[-0.02em] font-semibold text-ink text-balance">
                  See OnsideHR running on your own data.
                </h2>
                <p className="text-base leading-[1.55] text-ink-2 text-pretty max-w-[48ch]">
                  A 30-minute call and your employee CSV. We set the portal up
                  with your people in it, so the demo is your company, not ours.
                </p>
                <a
                  href={CONTACT_TEL}
                  className="mt-1 font-mono text-sm text-ink-2 hover:text-ink"
                >
                  Or call {CONTACT_PHONE}
                </a>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="font-mono text-sm text-ink-2 hover:text-ink"
                >
                  Or email {CONTACT_EMAIL}
                </a>
              </div>
              <DemoForm />
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
