import React from 'react';

export interface PageHeaderProps {
  title: React.ReactNode;
  subline?: React.ReactNode;
  /** Right-aligned actions: secondary 32px buttons, at most one primary. */
  actions?: React.ReactNode;
  className?: string;
}

// Page title (title step) with a 14px text-2 subline and actions on the right.
export function PageHeader({ title, subline, actions, className = '' }: PageHeaderProps) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-x-6 gap-y-3 ${className}`}>
      <div className="min-w-0">
        <h1 className="font-display text-[26px] sm:text-[28px] leading-[1.2] tracking-[-0.015em] font-semibold text-ink">{title}</h1>
        {subline && <p className="mt-1 text-sm text-ink-2">{subline}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export default PageHeader;
