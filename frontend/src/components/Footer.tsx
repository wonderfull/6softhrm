import React from 'react';
import { Link } from 'react-router-dom';
import { getCurrentUser, hasRole } from '../lib/api';

const CONTACT_EMAIL = 'hello@onsidehr.co.uk';
const CONTACT_PHONE = '07990 501431';
const CONTACT_PHONE_HREF = 'tel:+447990501431';

// One hairline row at the foot of the app. The product itself carries the
// navigation, so this is only the legal trail and how to reach a human.
export default function Footer() {
  const user = getCurrentUser();
  const isAdmin = hasRole(user, 'ADMIN');
  // Data consent only applies to users with their own employee record.
  const hasEmployeeProfile = !!user?.employeeId;

  const links = [
    { to: '/privacy', label: 'Privacy' },
    { to: '/terms', label: 'Terms' },
    { to: '/dpa', label: 'Data processing' },
    { to: '/gdpr', label: 'GDPR' },
    ...(hasEmployeeProfile ? [{ to: '/consent', label: 'Your consent' }] : []),
    ...(isAdmin ? [{ to: '/audit-logs', label: 'Audit logs' }] : []),
  ];

  return (
    <footer className="mt-auto border-t border-line">
      <div className="max-w-[1200px] mx-auto px-6 py-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-ink-3">
        <p>
          © {new Date().getFullYear()} 6soft Ltd. OnsideHR is operated by 6soft
          Ltd, United Kingdom.
        </p>
        <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="hover:text-ink transition-colors duration-hover"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <span className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2 font-mono">
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="hover:text-ink transition-colors duration-hover"
          >
            {CONTACT_EMAIL}
          </a>
          <a
            href={CONTACT_PHONE_HREF}
            className="hover:text-ink transition-colors duration-hover"
          >
            {CONTACT_PHONE}
          </a>
        </span>
      </div>
    </footer>
  );
}
