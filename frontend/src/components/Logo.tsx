import React from 'react';

// The mark is a check inside a rounded tile. Two more distinctive ideas were
// tried and rejected: an abstract "behind the line" mark that turned to mush
// below 32px, and a check whose arm broke out of the tile, which just read as
// a rendering error. A compliance product is better served by a mark that is
// unmistakable at 16px than by one that is clever at 64px.

export function LogoMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="OnsideHR">
      <rect width="64" height="64" rx="15" fill="#206fd6" />
      <path
        d="M18 33.5 26.5 42 46 22"
        fill="none"
        stroke="#fff"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Mark plus wordmark. The wordmark is real text rather than SVG paths so it
 * renders in the product's own typeface and inherits the theme colour, which
 * an <img> logo cannot do.
 */
export default function Logo({
  className = '',
  markClassName = 'h-8 w-8',
  textClassName = 'text-xl',
}: {
  className?: string;
  markClassName?: string;
  textClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className={markClassName} />
      <span className={`font-semibold tracking-tight ${textClassName}`}>
        Onside
        <span className="font-medium text-ink-2">
          HR
        </span>
      </span>
    </span>
  );
}
