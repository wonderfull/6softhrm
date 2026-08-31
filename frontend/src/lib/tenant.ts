// Tenant context on the client: stored at login, read by the shell for
// branding and feature gating.

export type TenantInfo = {
  id: number;
  slug: string;
  name: string;
  plan: string;
  features?: Record<string, boolean> | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
};

const KEY = 'tenant';

export function storeTenant(tenant: TenantInfo | undefined | null) {
  if (tenant) localStorage.setItem(KEY, JSON.stringify(tenant));
}

export function clearTenant() {
  localStorage.removeItem(KEY);
}

export function getTenant(): TenantInfo | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as TenantInfo) : null;
  } catch {
    return null;
  }
}

// True unless the tenant record explicitly switches the feature off — a
// missing tenant record (pre-tenancy session) must not hide navigation.
export function hasFeature(name: string): boolean {
  const tenant = getTenant();
  if (!tenant || !tenant.features) return true;
  return tenant.features[name] !== false;
}
