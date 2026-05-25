import React from 'react';

interface Props {
  value: string;
  onChange: (next: string) => void;
  onRegenerate: () => void;
}

/**
 * Password field with show/hide, copy-to-clipboard, and regenerate.
 * Used by the Temporary Password dialog to keep the password out of the page
 * history and visible only on demand.
 */
export default function PasswordRevealField({
  value,
  onChange,
  onRegenerate,
}: Props) {
  const [show, setShow] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    if (!navigator.clipboard?.writeText || !value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="form-input flex-1 font-mono text-sm"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="btn-ghost px-3 text-sm"
          aria-pressed={show}
        >
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={copy} className="btn-ghost text-sm">
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
        <button
          type="button"
          onClick={onRegenerate}
          className="btn-ghost text-sm"
        >
          Regenerate
        </button>
      </div>
    </div>
  );
}
