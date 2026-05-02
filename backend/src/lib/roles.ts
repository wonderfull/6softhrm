export const ROLES = {
  ADMIN: 'ADMIN',
  DIRECTOR: 'DIRECTOR',
  OFFICE_ASSISTANT: 'OFFICE_ASSISTANT',
  EMPLOYEE: 'EMPLOYEE',
} as const

export type AppRole = (typeof ROLES)[keyof typeof ROLES]

const LEGACY_ROLE_MAP: Record<string, AppRole> = {
  MANAGER: ROLES.DIRECTOR,
  USER: ROLES.EMPLOYEE,
}

export function normalizeRole(role: unknown): AppRole {
  if (typeof role !== 'string' || role.trim() === '') return ROLES.EMPLOYEE

  const upperRole = role.trim().toUpperCase()
  if (upperRole in LEGACY_ROLE_MAP) return LEGACY_ROLE_MAP[upperRole]
  if (Object.values(ROLES).includes(upperRole as AppRole)) return upperRole as AppRole

  return ROLES.EMPLOYEE
}

export function isOwnerRole(role: unknown) {
  return normalizeRole(role) === ROLES.ADMIN
}

export function isHrAdminRole(role: unknown) {
  const normalizedRole = normalizeRole(role)
  return normalizedRole === ROLES.ADMIN || normalizedRole === ROLES.DIRECTOR
}

export function canManageEmployeeRecords(role: unknown) {
  return isHrAdminRole(role)
}

export function canManageUserAccounts(role: unknown) {
  return isHrAdminRole(role)
}

export function canAssignRole(actorRole: unknown, targetRole: unknown) {
  const actor = normalizeRole(actorRole)
  const target = normalizeRole(targetRole)

  if (actor === ROLES.ADMIN) return true
  if (actor === ROLES.DIRECTOR) return target !== ROLES.ADMIN

  return false
}

export function canOperateDocuments(role: unknown) {
  const normalizedRole = normalizeRole(role)
  return (
    normalizedRole === ROLES.ADMIN ||
    normalizedRole === ROLES.DIRECTOR ||
    normalizedRole === ROLES.OFFICE_ASSISTANT
  )
}

export function canDeleteDocuments(role: unknown) {
  return isHrAdminRole(role)
}

export function canReviewLeaveAndTime(role: unknown) {
  const normalizedRole = normalizeRole(role)
  return (
    normalizedRole === ROLES.ADMIN ||
    normalizedRole === ROLES.DIRECTOR ||
    normalizedRole === ROLES.OFFICE_ASSISTANT
  )
}

export function canViewSensitiveEmployeeFields(role: unknown) {
  return isHrAdminRole(role)
}

export function canAccessOwnerSettings(role: unknown) {
  return isOwnerRole(role)
}

export function requireAssignableRole(actorRole: unknown, targetRole: unknown) {
  if (!canAssignRole(actorRole, targetRole)) {
    throw new Error('You do not have permission to assign that role')
  }

  return normalizeRole(targetRole)
}
