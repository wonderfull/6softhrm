/**
 * Returns the path only when it stays inside this app, otherwise null.
 *
 * React Router 6 carries a known open redirect through `<Link>` and
 * `useNavigate` when the target comes from outside the app. Nothing here
 * passes an outside target today, so the advisory is unreachable; this keeps
 * it unreachable if a `?next=` style parameter is ever added.
 *
 * The rules are deliberately strict: one leading slash, no second slash or
 * backslash after it (protocol-relative and Windows-style escapes), and no
 * scheme.
 */
export function safeInternalPath(
  target: string | null | undefined,
): string | null {
  if (!target) return null;
  const path = target.trim();
  if (!path.startsWith('/')) return null;
  if (path.startsWith('//') || path.startsWith('/\\')) return null;
  if (path.includes('\\')) return null;
  // A scheme cannot appear in a path that starts with a slash, but a caller
  // may have trimmed something odd; refuse rather than reason about it.
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return null;
  return path;
}
