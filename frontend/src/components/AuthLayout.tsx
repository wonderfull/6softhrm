import React from 'react';
import { Link } from 'react-router-dom';
import { LogoMark } from './Logo';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Text under the card (13 text-2). */
  below?: React.ReactNode;
}

// Sign-in family: centred column max 400, page padding 48 20, logo lockup,
// title, card, footer (README "Sign-in").
export default function AuthLayout({
  title,
  subtitle,
  children,
  below,
}: AuthLayoutProps) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-bg text-ink">
      <main className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-[400px] flex flex-col gap-7">
          <div className="flex flex-col gap-5">
            <Link to="/" className="inline-flex w-fit items-center gap-2.5">
              <LogoMark className="h-7 w-7" />
              <span className="font-display text-[19px] font-semibold tracking-[-0.01em] text-ink">
                Onside
                <span className="font-medium text-ink-2">HR</span>
              </span>
            </Link>
            <div>
              <h1 className="font-display text-[26px] leading-[1.2] tracking-[-0.015em] font-semibold text-ink">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1.5 text-sm text-ink-2">{subtitle}</p>
              )}
            </div>
          </div>

          <div className="bg-surface border border-line rounded-lg shadow-sm p-6">
            {children}
          </div>

          {below}
        </div>
      </main>
      <footer className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 p-5 text-xs text-ink-3">
        <span>© {new Date().getFullYear()} OnsideHR. All rights reserved.</span>
        <span className="font-mono">UK hosted · AES-256-GCM</span>
      </footer>
    </div>
  );
}
