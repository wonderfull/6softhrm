import React from 'react';
import { Skeleton } from './Skeleton';

export interface KpiTileProps {
  label: React.ReactNode;
  value: React.ReactNode;
  footnote?: React.ReactNode;
  badge?: React.ReactNode;
  loading?: boolean;
  className?: string;
}

// Card with dense padding, min-width 180. Label body-s text-2, numeral
// 30/600 tabular, footnote caption text-3. No colour prop, no icon slot.
export function KpiTile({ label, value, footnote, badge, loading, className = '' }: KpiTileProps) {
  return (
    <div className={`bg-surface border border-line rounded-lg shadow-sm px-[18px] py-4 min-w-[180px] ${className}`}>
      <div className="text-[13px] text-ink-2">{label}</div>
      {loading ? (
        <Skeleton className="h-[30px] w-16 mt-1.5" />
      ) : (
        <div className="mt-1 flex items-center gap-2.5">
          <span className="font-display text-[30px] leading-none font-semibold tracking-[-0.02em] tabular-nums text-ink">{value}</span>
          {badge}
        </div>
      )}
      {footnote && <div className="mt-2 text-xs text-ink-3">{loading ? <Skeleton className="h-3 w-28" /> : footnote}</div>}
    </div>
  );
}

export default KpiTile;
