import React from 'react';
import { Badge } from '../ui';
import { normalizeRole } from '../../lib/roles';
import {
  CONSENT_GAP_BELOW,
  CONSENT_TOTAL,
  type Employee,
  type UserAccount,
} from './model';

/** The row and panel show the login's role, or "NO LOGIN" when there is none. */
export function accessRoleOf(account?: UserAccount) {
  return account ? normalizeRole(account.role) : 'NO LOGIN';
}

export function ConsentBadge({ employee }: { employee: Employee }) {
  if (employee.consentCount === undefined) return <Badge>Not tracked</Badge>;
  const complete = employee.consentCount >= CONSENT_GAP_BELOW;
  return (
    <Badge tone={complete ? 'ok' : 'warn'}>
      {employee.consentCount}/{CONSENT_TOTAL} consents
    </Badge>
  );
}

/** One row of a definition list: caption label above the value, hairline below. */
export function DetailRow({
  label,
  value,
  mono,
  muted,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="border-b border-line py-2.5 last:border-b-0">
      <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-3">
        {label}
      </dt>
      <dd
        className={`mt-0.5 text-sm [overflow-wrap:anywhere] ${mono ? 'font-mono' : ''} ${
          muted ? 'text-ink-3' : 'text-ink'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * Square 32px icon button. Written out rather than reusing `.btn-*`, whose
 * height and padding are declared after the utilities and would win.
 */
export function IconButton({
  label,
  onClick,
  bordered,
  className = '',
  children,
}: {
  label: string;
  onClick: () => void;
  bordered?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-2 transition-colors duration-hover ease-out hover:bg-surface-2 hover:text-ink focus:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-tint ${
        bordered ? 'border border-line-2 bg-surface' : ''
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-3">
      {children}
    </div>
  );
}

export function ErrorNote({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="mb-3 rounded-md bg-bad-tint px-3 py-2 text-[13px] text-bad"
    >
      {message}
    </div>
  );
}
