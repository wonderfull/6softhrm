import React from 'react';

type FieldProps = {
  label?: React.ReactNode;
  help?: React.ReactNode;
  error?: React.ReactNode;
  size?: 'md' | 'lg';
  wrapperClassName?: string;
};

// `size` is ours (36/40px control height), so the native numeric one goes.
export type InputProps = FieldProps & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>;
export type SelectProps = FieldProps & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'>;
export type TextareaProps = FieldProps & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'>;

// Label above (13/500), help or error below (12). Error turns the border bad
// and the help text bad; the label stays neutral (README "Input").
function Field({
  id,
  label,
  help,
  error,
  wrapperClassName = '',
  children,
}: FieldProps & { id: string; children: React.ReactNode }) {
  return (
    <div className={wrapperClassName}>
      {label && (
        <label htmlFor={id} className="block text-[13px] font-medium text-ink mb-1.5">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-bad">
          {error}
        </p>
      ) : help ? (
        <p id={`${id}-help`} className="mt-1.5 text-xs text-ink-3">
          {help}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, help?: React.ReactNode, error?: React.ReactNode) {
  return error ? `${id}-error` : help ? `${id}-help` : undefined;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { id, label, help, error, size = 'md', wrapperClassName, className = '', ...rest },
  ref,
) {
  const auto = React.useId();
  const fieldId = id ?? auto;
  return (
    <Field id={fieldId} label={label} help={help} error={error} wrapperClassName={wrapperClassName}>
      <input
        ref={ref}
        id={fieldId}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy(fieldId, help, error)}
        className={`form-input ${size === 'lg' ? 'h-10' : ''} ${className}`}
        {...rest}
      />
    </Field>
  );
});

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { id, label, help, error, size = 'md', wrapperClassName, className = '', children, ...rest },
  ref,
) {
  const auto = React.useId();
  const fieldId = id ?? auto;
  return (
    <Field id={fieldId} label={label} help={help} error={error} wrapperClassName={wrapperClassName}>
      <select
        ref={ref}
        id={fieldId}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy(fieldId, help, error)}
        className={`form-input ${size === 'lg' ? 'h-10' : ''} ${className}`}
        {...rest}
      >
        {children}
      </select>
    </Field>
  );
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { id, label, help, error, wrapperClassName, className = '', ...rest },
  ref,
) {
  const auto = React.useId();
  const fieldId = id ?? auto;
  return (
    <Field id={fieldId} label={label} help={help} error={error} wrapperClassName={wrapperClassName}>
      <textarea
        ref={ref}
        id={fieldId}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy(fieldId, help, error)}
        className={`form-input ${className}`}
        {...rest}
      />
    </Field>
  );
});

export default Input;
