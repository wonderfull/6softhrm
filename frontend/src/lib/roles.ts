export type AppRole = 'ADMIN' | 'DIRECTOR' | 'OFFICE_ASSISTANT' | 'EMPLOYEE';

const roleMap: Record<string, AppRole> = {
  ADMIN: 'ADMIN',
  DIRECTOR: 'DIRECTOR',
  MANAGER: 'DIRECTOR',
  OFFICE_ASSISTANT: 'OFFICE_ASSISTANT',
  USER: 'EMPLOYEE',
  EMPLOYEE: 'EMPLOYEE',
};

export function normalizeRole(role?: string | null): AppRole {
  if (!role) return 'EMPLOYEE';
  return roleMap[role.toUpperCase()] || 'EMPLOYEE';
}

export function normalizeRoles(roles: string[] = []): AppRole[] {
  return roles.map(normalizeRole);
}

export function roleLabel(role?: string | null): string {
  const normalized = normalizeRole(role);
  if (normalized === 'OFFICE_ASSISTANT') return 'Office Assistant';
  return normalized.charAt(0) + normalized.slice(1).toLowerCase();
}

export function isElevatedRole(role?: string | null): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'ADMIN' || normalized === 'DIRECTOR';
}

export function canAssignRole(currentRole: string | null | undefined, targetRole: string): boolean {
  const current = normalizeRole(currentRole);
  const target = normalizeRole(targetRole);
  if (current === 'ADMIN') return true;
  if (current === 'DIRECTOR') return target !== 'ADMIN';
  return false;
}

export function assignableRoles(currentRole: string | null | undefined): AppRole[] {
  const current = normalizeRole(currentRole);
  if (current === 'ADMIN') return ['ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT', 'EMPLOYEE'];
  if (current === 'DIRECTOR') return ['DIRECTOR', 'OFFICE_ASSISTANT', 'EMPLOYEE'];
  return [];
}
