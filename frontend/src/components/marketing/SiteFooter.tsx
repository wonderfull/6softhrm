import React from 'react';
import { Link } from 'react-router-dom';
import { DEMO_HREF } from './SiteHeader';

const COLUMNS: Array<{
  heading: string;
  links: Array<{ label: string; to: string; external?: boolean }>;
}> = [
  {
    heading: 'Product',
    links: [
      { label: 'Everything HR', to: '/#product' },
      { label: 'For teams', to: '/#teams' },
      { label: 'Security', to: '/#security' },
      { label: 'Pricing', to: '/#pricing' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy policy', to: '/privacy' },
      { label: 'Terms of service', to: '/terms' },
      { label: 'Data processing agreement', to: '/dpa' },
      { label: 'UK GDPR', to: '/gdpr' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'Book a demo', to: DEMO_HREF, external: true },
      {
        label: 'hello@onsidehr.co.uk',
        to: 'mailto:hello@onsidehr.co.uk',
        external: true,
      },
      { label: 'Sign in', to: '/login' },
    ],
  },
];

export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 grid grid-cols-1 md:grid-cols-5 gap-10">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 font-semibold tracking-tight text-slate-900 dark:text-white">
            <span
              aria-hidden="true"
              className="inline-block h-6 w-6 rounded-md bg-[#5e6ad2]"
            />
            OnsideHR
          </div>
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-400 max-w-sm leading-relaxed">
            The HR portal for UK companies. Built and hosted in the United
            Kingdom by 6soft Ltd.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.heading}>
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
              {col.heading}
            </h3>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((link) => (
                <li key={link.label}>
                  {link.external || link.to.startsWith('/#') ? (
                    <a
                      href={link.to}
                      className="text-sm text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      to={link.to}
                      className="text-sm text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <p>
            © {year} 6soft Ltd. OnsideHR is operated by 6soft Ltd, United
            Kingdom.
          </p>
          <p>Registered in England and Wales.</p>
        </div>
      </div>
    </footer>
  );
}
