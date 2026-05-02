import {
  canAssignRole,
  canManageEmployeeRecords,
  canOperateDocuments,
  canReviewLeaveAndTime,
  canViewSensitiveEmployeeFields,
  normalizeRole,
} from '../lib/roles'

describe('role helpers', () => {
  it.each([
    ['ADMIN', 'ADMIN'],
    ['DIRECTOR', 'DIRECTOR'],
    ['OFFICE_ASSISTANT', 'OFFICE_ASSISTANT'],
    ['EMPLOYEE', 'EMPLOYEE'],
    ['MANAGER', 'DIRECTOR'],
    ['USER', 'EMPLOYEE'],
    [undefined, 'EMPLOYEE'],
    ['', 'EMPLOYEE'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeRole(input)).toBe(expected)
  })

  it('keeps ADMIN as the only role that can assign ADMIN', () => {
    expect(canAssignRole('ADMIN', 'ADMIN')).toBe(true)
    expect(canAssignRole('DIRECTOR', 'ADMIN')).toBe(false)
    expect(canAssignRole('OFFICE_ASSISTANT', 'ADMIN')).toBe(false)
    expect(canAssignRole('EMPLOYEE', 'ADMIN')).toBe(false)
  })

  it('allows directors to assign non-owner roles', () => {
    expect(canAssignRole('DIRECTOR', 'DIRECTOR')).toBe(true)
    expect(canAssignRole('DIRECTOR', 'OFFICE_ASSISTANT')).toBe(true)
    expect(canAssignRole('DIRECTOR', 'EMPLOYEE')).toBe(true)
  })

  it('separates HR management from office support', () => {
    expect(canManageEmployeeRecords('ADMIN')).toBe(true)
    expect(canManageEmployeeRecords('DIRECTOR')).toBe(true)
    expect(canManageEmployeeRecords('OFFICE_ASSISTANT')).toBe(false)
    expect(canManageEmployeeRecords('EMPLOYEE')).toBe(false)
  })

  it('allows office assistants to operate documents and review leave/time', () => {
    expect(canOperateDocuments('OFFICE_ASSISTANT')).toBe(true)
    expect(canReviewLeaveAndTime('OFFICE_ASSISTANT')).toBe(true)
    expect(canViewSensitiveEmployeeFields('OFFICE_ASSISTANT')).toBe(false)
  })
})
