import React from 'react';
import { parseJwtPayload } from '../lib/api';

// The token lives in localStorage, which every tab of this origin shares. That
// is ordinary single-session behaviour, but it means a second sign-in silently
// re-points every open tab at the new account: the old tab keeps its chrome
// and its unsaved form, and anything it does lands in the audit log under
// whoever signed in last. This blocks the stale tab instead, and makes the
// swap something the person is told about.

function identity(token: string | null): string | null {
  if (!token) return null;
  const payload = parseJwtPayload(token) as
    | { id?: number; email?: string }
    | null;
  if (!payload) return null;
  return `${payload.id ?? ''}:${payload.email ?? ''}`;
}

function readToken(): string | null {
  try {
    return localStorage.getItem('token');
  } catch {
    return null;
  }
}

const CHECK_MS = 1000;

export default function SessionGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  // The identity this tab was rendered for. A tab that was never signed in has
  // nothing to protect, so it stays out of the way.
  const owner = React.useRef(identity(readToken()));
  const [changed, setChanged] = React.useState<{ email: string | null } | null>(
    null,
  );

  React.useEffect(() => {
    if (!owner.current) return;

    const check = () => {
      const token = readToken();
      const now = identity(token);
      if (now === owner.current) return;
      const payload = token
        ? (parseJwtPayload(token) as { email?: string } | null)
        : null;
      setChanged({ email: payload?.email ?? null });
    };

    window.addEventListener('storage', check);
    // A tab can also be re-pointed by code in this same tab, which fires no
    // storage event, so poll as well. One read a second is free.
    const timer = setInterval(check, CHECK_MS);
    return () => {
      window.removeEventListener('storage', check);
      clearInterval(timer);
    };
  }, []);

  return (
    <>
      {children}
      {changed && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label="Session changed"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6 shadow-lg">
            <h2 className="text-xl font-semibold tracking-[-0.01em] text-ink">
              This browser signed in as someone else
            </h2>
            <p className="mt-2 text-sm text-ink-2">
              {changed.email
                ? `Another tab signed in as ${changed.email}. This tab is still showing the previous account, so anything you do here would be recorded against the new one.`
                : 'Another tab signed out. This tab is still showing the previous account.'}
            </p>
            <p className="mt-2 text-sm text-ink-2">
              Reload to continue as the account this browser is now using.
              Anything unsaved on this page will be lost.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn-primary mt-5 w-full"
            >
              Reload this tab
            </button>
          </div>
        </div>
      )}
    </>
  );
}
