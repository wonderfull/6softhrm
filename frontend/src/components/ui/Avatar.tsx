import React from 'react';

export interface AvatarProps {
  name: string;
  src?: string | null;
  /** 22 top bar, 28 rows and sidebar footer, 40 detail panel. */
  size?: 22 | 28 | 40;
  /** accent-tint + link initials (people); muted = surface-3 + text-2 (signed-in user). */
  tone?: 'accent' | 'muted';
  className?: string;
}

export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

const SIZE: Record<NonNullable<AvatarProps['size']>, string> = {
  22: 'h-[22px] w-[22px] text-[9px]',
  28: 'h-7 w-7 text-[11px]',
  40: 'h-10 w-10 text-[14px]',
};

export function Avatar({ name, src, size = 28, tone = 'accent', className = '' }: AvatarProps) {
  const base = `inline-flex shrink-0 items-center justify-center rounded-full font-semibold overflow-hidden ${SIZE[size]} ${
    tone === 'accent' ? 'bg-accent-tint text-link' : 'bg-surface-3 text-ink-2'
  } ${className}`;
  return (
    <span className={base} aria-hidden="true">
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : initialsOf(name)}
    </span>
  );
}

export default Avatar;
