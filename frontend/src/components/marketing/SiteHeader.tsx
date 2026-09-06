import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogoMark } from '../Logo';

const NAV = [
  { label: 'Product', href: '/#product' },
  { label: 'For teams', href: '/#teams' },
  { label: 'Security', href: '/#security' },
  { label: 'Pricing', href: '/#pricing' },
  { label: 'FAQ', href: '/#faq' },
];

// Every "Book a demo" leads to the form at the foot of the landing page.
export const DEMO_HREF = '#demo';
export const CONTACT_EMAIL = 'hello@onsidehr.co.uk';
export const CONTACT_PHONE = '07990 501431';
export const CONTACT_TEL = 'tel:+447990501431';

// 60px, sticky, page background at 85% behind a 12px blur, hairline below.
// Under 760px the links and actions sit behind a 36px menu button.
export default function SiteHeader() {
  const [open, setOpen] = React.useState(false);
  const { pathname } = useLocation();
  const signedIn = !!localStorage.getItem('token');
  const demoHref = pathname === '/' ? DEMO_HREF : `/${DEMO_HREF}`;

  // Same two actions in both places, but the mobile panel gives them the
  // full width and a 40px target.
  const actions = (mobile: boolean) => {
    const size = mobile ? 'h-10 w-full text-sm' : 'btn-nav';
    const close = () => setOpen(false);
    return signedIn ? (
      <Link to="/dashboard" className={`btn-primary ${size}`} onClick={close}>
        Open app
      </Link>
    ) : (
      <>
        <Link
          to="/login"
          className={`${mobile ? 'btn-secondary' : 'btn-ghost'} ${size}`}
          onClick={close}
        >
          Sign in
        </Link>
        <a href={demoHref} className={`btn-primary ${size}`} onClick={close}>
          Book a demo
        </a>
      </>
    );
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[color:color-mix(in_srgb,var(--bg)_85%,transparent)] backdrop-blur-[12px]">
      <div className="max-w-[1200px] mx-auto px-6 h-[60px] flex items-center gap-8">
        <Link to="/" className="inline-flex items-center gap-2.5 text-ink">
          <LogoMark className="h-6 w-6" />
          <span className="font-display text-[17px] font-semibold tracking-[-0.01em]">
            Onside
            <span className="font-medium text-ink-2">HR</span>
          </span>
        </Link>

        <nav
          aria-label="Primary"
          className="hidden min-[760px]:flex items-center gap-1 flex-1"
        >
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="px-2.5 py-1.5 rounded-md text-sm text-ink-2 hover:text-ink transition-colors duration-hover"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden min-[760px]:flex items-center gap-2 ml-auto">
          <a
            href={CONTACT_TEL}
            className="inline-flex items-center h-8 px-2.5 font-mono text-[13px] text-ink-2 hover:text-ink transition-colors duration-hover"
          >
            {CONTACT_PHONE}
          </a>
          {actions(false)}
        </div>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="min-[760px]:hidden ml-auto inline-flex flex-col items-center justify-center gap-1 h-9 w-9 rounded-md border border-line-2 bg-surface text-ink"
        >
          <span className="sr-only">Menu</span>
          <span
            aria-hidden="true"
            className="block w-3.5 h-[1.5px] bg-current"
          />
          <span
            aria-hidden="true"
            className="block w-3.5 h-[1.5px] bg-current"
          />
        </button>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          aria-label="Mobile"
          className="min-[760px]:hidden border-t border-line bg-surface px-6 py-4 flex flex-col gap-1"
        >
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="px-2.5 py-2 rounded-md text-[15px] text-ink-2 hover:bg-surface-2 hover:text-ink"
            >
              {item.label}
            </a>
          ))}
          <div className="mt-3 pt-3 border-t border-line flex flex-col gap-2">
            <a
              href={CONTACT_TEL}
              className="px-2.5 py-1 font-mono text-[13px] text-ink-2"
            >
              {CONTACT_PHONE}
            </a>
            {actions(true)}
          </div>
        </nav>
      )}
    </header>
  );
}
