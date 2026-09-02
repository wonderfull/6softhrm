import React from 'react';
import { Link } from 'react-router-dom';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

const NAV = [
  { label: 'Product', href: '/#product' },
  { label: 'For teams', href: '/#teams' },
  { label: 'Security', href: '/#security' },
  { label: 'Pricing', href: '/#pricing' },
  { label: 'FAQ', href: '/#faq' },
];

export const DEMO_HREF =
  'mailto:hello@onsidehr.co.uk?subject=OnsideHR%20demo%20request';

export default function SiteHeader() {
  const [open, setOpen] = React.useState(false);
  const signedIn = !!localStorage.getItem('token');

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
        <Link
          to="/"
          className="flex items-center gap-2 font-semibold tracking-tight text-slate-900 dark:text-white"
        >
          <span
            aria-hidden="true"
            className="inline-block h-6 w-6 rounded-md bg-[#5e6ad2]"
          />
          OnsideHR
        </Link>

        <nav
          aria-label="Primary"
          className="hidden md:flex items-center gap-8 text-sm text-slate-600 dark:text-slate-300"
        >
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {signedIn ? (
            <Link
              to="/dashboard"
              className="text-sm font-medium px-4 py-2 rounded-lg bg-[#5e6ad2] hover:bg-[#828fff] text-white transition-colors"
            >
              Open app
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm font-medium px-4 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Sign in
              </Link>
              <a
                href={DEMO_HREF}
                className="text-sm font-medium px-4 py-2 rounded-lg bg-[#5e6ad2] hover:bg-[#828fff] text-white transition-colors"
              >
                Book a demo
              </a>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="md:hidden p-2 -mr-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <span className="sr-only">Toggle navigation</span>
          {open ? (
            <XMarkIcon className="h-6 w-6" />
          ) : (
            <Bars3Icon className="h-6 w-6" />
          )}
        </button>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          aria-label="Mobile"
          className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-4 flex flex-col gap-1"
        >
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="px-2 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {item.label}
            </a>
          ))}
          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
            {signedIn ? (
              <Link
                to="/dashboard"
                className="text-center font-medium px-4 py-2 rounded-lg bg-[#5e6ad2] text-white"
              >
                Open app
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-center font-medium px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                >
                  Sign in
                </Link>
                <a
                  href={DEMO_HREF}
                  className="text-center font-medium px-4 py-2 rounded-lg bg-[#5e6ad2] text-white"
                >
                  Book a demo
                </a>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
