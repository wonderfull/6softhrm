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

export function roleBadgeClass(role?: string | null): string {
  const normalized = normalizeRole(role);
  if (normalized === 'ADMIN') return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800';
  if (normalized === 'DIRECTOR') return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-200 dark:border-purple-800';
  if (normalized === 'OFFICE_ASSISTANT') return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-800';
  return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600';
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
