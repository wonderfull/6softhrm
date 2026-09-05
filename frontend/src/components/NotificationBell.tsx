import React from 'react';
import { useNavigate } from 'react-router-dom';
import { HiOutlineBell } from 'react-icons/hi';
import { apiGet, apiPut } from '../lib/api';

// The signed-in user's own notification inbox: unread badge in the shell,
// recent items in a dropdown.

type InboxItem = {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

const POLL_MS = 60000;

function timeAgo(value: string) {
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  const [unread, setUnread] = React.useState(0);
  const [items, setItems] = React.useState<InboxItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const loadUnread = React.useCallback(async () => {
    try {
      const rows = await apiGet('/notifications/inbox', { unread: 1 });
      setUnread(Array.isArray(rows) ? rows.length : 0);
    } catch {
      // A failed poll leaves the previous badge alone rather than flashing zero.
    }
  }, []);

  React.useEffect(() => {
    loadUnread();
    const timer = setInterval(loadUnread, POLL_MS);
    return () => clearInterval(timer);
  }, [loadUnread]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setLoading(true);
    try {
      const rows = await apiGet('/notifications/inbox');
      setItems(Array.isArray(rows) ? rows : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function openItem(item: InboxItem) {
    setOpen(false);
    if (!item.readAt) {
      try {
        const updated = await apiPut(`/notifications/inbox/${item.id}/read`);
        setItems((rows) =>
          rows.map((row) =>
            row.id === item.id ? { ...row, ...updated } : row,
          ),
        );
        setUnread((count) => Math.max(0, count - 1));
      } catch {
        // Still follow the link — a failed read flag is not worth blocking on.
      }
    }
    if (item.link) navigate(item.link);
  }

  async function markAllRead() {
    try {
      await apiPut('/notifications/inbox/read-all');
      const now = new Date().toISOString();
      setItems((rows) =>
        rows.map((row) => (row.readAt ? row : { ...row, readAt: now })),
      );
      setUnread(0);
    } catch {
      // Leave the list as-is; the next poll will correct the badge.
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={toggle}
        aria-label={
          unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'
        }
        className="relative p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-200 transition-colors"
      >
        <HiOutlineBell size={20} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-50">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 dark:border-slate-700">
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              Notifications
            </span>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loading && (
              <p className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                Loading…
              </p>
            )}
            {!loading && items.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                You&apos;re all caught up.
              </p>
            )}
            {!loading &&
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openItem(item)}
                  className={`block w-full px-4 py-3 text-left hover:bg-slate-100 dark:hover:bg-slate-700 ${item.readAt ? '' : 'bg-blue-50/60 dark:bg-blue-900/20'}`}
                >
                  <span className="block text-sm font-medium text-slate-900 dark:text-white">
                    {item.title}
                  </span>
                  {item.body && (
                    <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-400">
                      {item.body}
                    </span>
                  )}
                  <span className="mt-1 block text-xs text-slate-400">
                    {timeAgo(item.createdAt)}
                  </span>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
