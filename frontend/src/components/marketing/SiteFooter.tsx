import React from 'react';
import { Link } from 'react-router-dom';
import { CONTACT_EMAIL, CONTACT_PHONE, CONTACT_TEL } from './SiteHeader';

const LEGAL = [
  { label: 'Privacy policy', to: '/privacy' },
  { label: 'Terms of service', to: '/terms' },
  { label: 'Data processing agreement', to: '/dpa' },
  { label: 'UK GDPR', to: '/gdpr' },
];

// Hairline top, 24px padding, 13px text-3. The legal documents stay linked
// from every public page; contact details sit with them in mono.
export default function SiteFooter() {
  const year = new Date().getFullYear();
  const link = 'hover:text-ink transition-colors duration-hover';
  return (
    <footer className="border-t border-line">
      <div className="max-w-[1200px] mx-auto px-6 py-6 flex flex-col gap-4 text-[13px] text-ink-3">
        <nav
          aria-label="Legal and contact"
          className="flex flex-wrap items-center gap-x-5 gap-y-2"
        >
          {LEGAL.map((l) => (
            <Link key={l.to} to={l.to} className={link}>
              {l.label}
            </Link>
          ))}
          <a href={`mailto:${CONTACT_EMAIL}`} className={`font-mono ${link}`}>
            {CONTACT_EMAIL}
          </a>
          <a href={CONTACT_TEL} className={`font-mono ${link}`}>
            {CONTACT_PHONE}
          </a>
          <Link to="/login" className={link}>
            Sign in
          </Link>
        </nav>
        <div className="flex flex-wrap justify-between gap-x-6 gap-y-2">
          <span>
            © {year} 6soft Ltd. OnsideHR is operated by 6soft Ltd, United
            Kingdom.
          </span>
          <span>Registered in England and Wales.</span>
        </div>
      </div>
    </footer>
  );
}
