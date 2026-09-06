import React from 'react';

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  dense?: boolean;
  /** Remove body padding, for tables that run edge to edge. */
  flush?: boolean;
}

// Surface, hairline, radius 10, shadow sm. Header 14/20 with a hairline
// below; body padding 20 (16 dense). No nested cards, no coloured header,
// no left border (README "Card").
export function Card({ title, description, action, dense, flush, className = '', children, ...rest }: CardProps) {
  const pad = flush ? '' : dense ? 'p-4' : 'p-5';
  return (
    <div className={`bg-surface border border-line rounded-lg shadow-sm ${className}`} {...rest}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-4 px-5 py-3.5 border-b border-line">
          <div className="min-w-0">
            {title && <h3 className="text-base font-semibold leading-snug text-ink">{title}</h3>}
            {description && <p className="text-[13px] text-ink-2 mt-0.5">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={pad}>{children}</div>
    </div>
  );
}

export default Card;
