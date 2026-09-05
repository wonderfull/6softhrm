import React from 'react';

export type BadgeTone = 'ok' | 'warn' | 'bad' | 'neutral';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

// Status is text + tint with a dot; neutral is mono uppercase (roles,
// document types). Three tones only, no icons, no large variant.
export function Badge({ tone = 'neutral', className = '', children, ...rest }: BadgeProps) {
  return (
    <span className={`badge-${tone} ${className}`} {...rest}>
      {children}
    </span>
  );
}

export default Badge;
