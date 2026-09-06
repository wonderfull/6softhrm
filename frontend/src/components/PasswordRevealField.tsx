import React from 'react';
import { Button } from './ui';

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
          className="form-input flex-1 font-mono"
          autoComplete="off"
          spellCheck={false}
          aria-label="Temporary password"
        />
        <Button
          variant="secondary"
          onClick={() => setShow((s) => !s)}
          aria-pressed={show}
        >
          {show ? 'Hide' : 'Show'}
        </Button>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button variant="ghost" size="sm" onClick={onRegenerate}>
          Regenerate
        </Button>
      </div>
    </div>
  );
}
