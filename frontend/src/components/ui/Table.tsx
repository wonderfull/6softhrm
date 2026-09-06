import React from 'react';

// Rows 48 to 52 high, padding 0 16, no vertical rules, border-top hairline.
// Header caption 11/500 uppercase +6% text-3. Hover surface-2 120ms.
// Selected: accent-tint with a 2px inset accent edge. The whole row is the
// click target; there is no icon action column.
export function Table({ className = '', ...rest }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-sm border-collapse ${className}`} {...rest} />
    </div>
  );
}

export function Th({ className = '', ...rest }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={`text-left font-medium text-[11px] uppercase tracking-[0.06em] text-ink-3 px-4 h-10 whitespace-nowrap ${className}`}
      {...rest}
    />
  );
}

export interface TrProps extends React.HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean;
  clickable?: boolean;
}

export function Tr({ selected, clickable, className = '', ...rest }: TrProps) {
  return (
    <tr
      aria-selected={selected || undefined}
      className={`border-t border-line transition-colors duration-hover ${
        selected ? 'bg-accent-tint shadow-[inset_2px_0_0_var(--accent)]' : clickable ? 'hover:bg-surface-2' : ''
      } ${clickable ? 'cursor-pointer' : ''} ${className}`}
      {...rest}
    />
  );
}

export function Td({ className = '', ...rest }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`px-4 h-12 align-middle ${className}`} {...rest} />;
}

export default Table;
