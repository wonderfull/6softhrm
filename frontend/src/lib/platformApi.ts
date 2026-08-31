import { API_BASE_URL } from './api';

// Platform console API client — a separate token world from the tenant app.
const TOKEN_KEY = 'platformToken';

export function getPlatformToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setPlatformToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearPlatformToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function platformApi(path: string, init?: RequestInit) {
  const token = getPlatformToken();
  const headers: Record<string, string> = {
    ...((init?.headers as Record<string, string>) || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE_URL}/platform${path}`, { ...(init || {}), headers });
  if (res.status === 401) {
    clearPlatformToken();
    window.location.href = '/platform/login';
    throw new Error('Session expired');
  }
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `API error ${res.status}`);
  }
  return res.json();
}

export const platformGet = (p: string) => platformApi(p, { method: 'GET' });
export const platformPost = (p: string, body?: any) =>
  platformApi(p, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'Content-Type': 'application/json' },
  });
export const platformPut = (p: string, body?: any) =>
  platformApi(p, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'Content-Type': 'application/json' },
  });
