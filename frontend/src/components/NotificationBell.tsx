import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BellIcon } from '@heroicons/react/24/outline';
import { apiGet, apiPut } from '../lib/api';

// The signed-in user's own notification inbox: unread count in the shell,
// recent items in a popover. The count is polled once and shared between the
// top-bar bell and the sidebar row so the two never disagree.

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

type Listener = () => void;
const store = {
  unread: 0,
  listeners: new Set<Listener>(),
  timer: null as ReturnType<typeof setInterval> | null,
};

export function setUnreadCount(next: number | ((current: number) => number)) {
  store.unread = Math.max(
    0,
    typeof next === 'function' ? next(store.unread) : next,
  );
  store.listeners.forEach((listener) => listener());
}

async function loadUnread() {
  try {
    const rows = await apiGet('/notifications/inbox', { unread: 1 });
    setUnreadCount(Array.isArray(rows) ? rows.length : 0);
  } catch {
    // A failed poll leaves the previous count alone rather than flashing zero.
  }
}

function subscribe(listener: Listener) {
  store.listeners.add(listener);
  if (store.listeners.size === 1) {
    loadUnread();
    store.timer = setInterval(loadUnread, POLL_MS);
  }
  return () => {
    store.listeners.delete(listener);
    if (store.listeners.size === 0) {
      if (store.timer) clearInterval(store.timer);
      store.timer = null;
      store.unread = 0;
    }
  };
}

export function useUnreadCount() {
  return React.useSyncExternalStore(subscribe, () => store.unread);
}

export function formatUnread(count: number) {
  return count > 9 ? '9+' : String(count);
}

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
  const unread = useUnreadCount();
  const [items, setItems] = React.useState<InboxItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

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
        setUnreadCount((count) => count - 1);
      } catch {
        // Still follow the link; a failed read flag is not worth blocking on.
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
      setUnreadCount(0);
    } catch {
      // Leave the list as-is; the next poll will correct the count.
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={
          unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'
        }
        className="btn-ghost h-8 px-2.5 gap-1.5 text-[13px]"
      >
        <BellIcon className="h-4 w-4" aria-hidden="true" />
        {unread > 0 && (
          <span className="font-mono text-[11px] font-medium text-ink">
            {formatUnread(unread)}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-surface rounded-lg shadow-md border border-line z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 h-11 border-b border-line">
            <span className="text-sm font-semibold text-ink">
              Notifications
            </span>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-[13px] font-medium text-link hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loading && (
              <p className="px-4 py-6 text-center text-[13px] text-ink-3">
                Loading…
              </p>
            )}
            {!loading && items.length === 0 && (
              <p className="px-4 py-6 text-center text-[13px] text-ink-3">
                You&apos;re all caught up.
              </p>
            )}
            {!loading &&
              items.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openItem(item)}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-2 transition-colors duration-hover ${
                    index > 0 ? 'border-t border-line' : ''
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${
                      item.readAt ? 'bg-transparent' : 'bg-accent'
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-sm ${
                        item.readAt ? 'text-ink-2' : 'font-medium text-ink'
                      }`}
                    >
                      {item.title}
                    </span>
                    {item.body && (
                      <span className="mt-0.5 block text-[13px] text-ink-2">
                        {item.body}
                      </span>
                    )}
                    <span className="mt-1 block font-mono text-[11px] text-ink-3">
                      {timeAgo(item.createdAt)}
                    </span>
                  </span>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
