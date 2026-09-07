import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import SessionGuard from '../components/SessionGuard';

// A token whose payload carries an id and an email, like the real one.
function tokenFor(id: number, email: string) {
  const payload = btoa(JSON.stringify({ id, email, role: 'ADMIN' }));
  return `header.${payload}.signature`;
}

const ADMIN = tokenFor(1, 'ops.admin@6soft.local');
const EMPLOYEE = tokenFor(4, 'john.smith@company.com');

// setup.ts stubs localStorage; drive it through a small in-memory map so the
// guard sees real reads.
let store: Record<string, string> = {};

beforeEach(() => {
  store = { token: ADMIN };
  ;(localStorage.getItem as any).mockImplementation((k: string) => store[k] ?? null);
  vi.useFakeTimers();
});

function fireStorage() {
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key: 'token' }));
  });
}

describe('SessionGuard', () => {
  it('stays out of the way while the signed-in user does not change', () => {
    render(
      <SessionGuard>
        <p>App content</p>
      </SessionGuard>,
    );
    expect(screen.getByText('App content')).toBeInTheDocument();
    fireStorage();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('blocks the tab when another tab signs in as someone else', () => {
    render(
      <SessionGuard>
        <p>App content</p>
      </SessionGuard>,
    );
    store.token = EMPLOYEE;
    fireStorage();

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('john.smith@company.com');
    expect(
      screen.getByRole('button', { name: /reload/i }),
    ).toBeInTheDocument();
  });

  it('blocks the tab when another tab signs out', () => {
    render(
      <SessionGuard>
        <p>App content</p>
      </SessionGuard>,
    );
    delete store.token;
    fireStorage();
    expect(screen.getByRole('alertdialog')).toHaveTextContent(/signed out/i);
  });

  it('notices a swap even when no storage event arrives', () => {
    render(
      <SessionGuard>
        <p>App content</p>
      </SessionGuard>,
    );
    store.token = EMPLOYEE;
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('does nothing at all when the tab was never signed in', () => {
    store = {};
    render(
      <SessionGuard>
        <p>App content</p>
      </SessionGuard>,
    );
    store.token = ADMIN;
    fireStorage();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
