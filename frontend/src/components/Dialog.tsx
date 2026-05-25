import React from 'react';

interface DialogProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Lightweight modal — replaces native window.prompt() / window.alert() flows
 * (Temporary Password, Test Email recipient, etc).
 *
 * Click on the backdrop or Escape closes the dialog. The portal-free
 * implementation is intentional — we don't need React 18 createPortal here
 * because the app already root-renders into a single mount.
 */
export default function Dialog({
  open,
  title,
  description,
  onClose,
  children,
}: DialogProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white dark:bg-slate-800 shadow-2xl border border-slate-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 pt-5">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {description}
            </p>
          )}
        </header>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
