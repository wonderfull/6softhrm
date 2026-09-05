import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

// Heights 32/36/40, padding 12/14/16, font 13/14/14 (README "Button").
const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-9 px-3.5 text-sm',
  lg: 'h-10 px-4 text-sm',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, disabled, className = '', children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`btn-${variant} ${SIZE[size]} ${className}`}
      {...rest}
    >
      {loading && (
        <span aria-hidden="true" className="inline-block h-3.5 w-3.5 rounded-full border-2 border-current border-r-transparent animate-spin motion-reduce:animate-none" />
      )}
      {children}
    </button>
  );
});

export default Button;
