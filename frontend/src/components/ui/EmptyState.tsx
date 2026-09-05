import React from 'react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  body?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

// Dashed border-2, radius 10, centred. 36px icon tile, title 15/600, one
// sentence 13 text-2 max 320px, at most one small secondary button.
export function EmptyState({ icon, title, body, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center text-center px-6 py-10 border border-dashed border-line-2 rounded-lg ${className}`}>
      {icon && (
        <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-2 border border-line text-ink-2 mb-3 [&>svg]:h-4 [&>svg]:w-4">
          {icon}
        </div>
      )}
      <div className="text-[15px] font-semibold text-ink">{title}</div>
      {body && <p className="mt-1 text-[13px] text-ink-2 max-w-[320px]">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export default EmptyState;
