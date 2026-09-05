import React from 'react';

// Shapes match the final layout at the same radii; sizing comes from the
// caller (h-4 w-24 and so on). Shimmer lives in tailwind.css.
export function Skeleton({ className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={`skeleton ${className}`} {...rest} />;
}

export default Skeleton;
