import React from 'react';
import { API_BASE_URL } from '../../lib/api';
import { normalizeRole, type AppRole } from '../../lib/roles';

export type Employee = {
  id: number;
  firstName: string;
  middleName?: string;
  lastName: string;
  title?: string;
  gender?: string;
  ethnicity?: string;
  dateOfBirth?: string;
  email: string;
  phoneNumber?: string;
  workPhone?: string;
  jobTitle?: string;
  employeeType?: string;
  department?: string;
  niNumber?: string;
  startDate?: string;
  endDate?: string | null;
  bankName?: string;
  probationEndDate?: string;
  address1?: string;
  address2?: string;
  address3?: string;
  townCity?: string;
  county?: string;
  postcode?: string;
  accountName?: string;
  bankBranch?: string;
  accountNumber?: string;
  sortCode?: string;
  salary?: number | string;
  salaryRate?: string;
  paymentFrequency?: string;
  salaryEffectiveFrom?: string;
  salaryReason?: string;
  payrollNumber?: string;
  taxCode?: string;
  passportNumber?: string;
  passportCountryOfIssue?: string;
  passportExpiryDate?: string;
  licenceNumber?: string;
  licenceCountryOfIssue?: string;
  licenceClass?: string;
  licenceExpiryDate?: string;
  visaNumber?: string;
  visaExpiryDate?: string;
  dbsLevel?: string | null;
  dbsCertificateNumber?: string | null;
  dbsIssueDate?: string | null;
  dbsRecheckDate?: string | null;
  retainUntil?: string | null;
  anonymisedAt?: string | null;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  emergencyContactAddress?: string;
  consentCount?: number;
  managerId?: number | null;
  leaveAllowanceDays?: number | null;
  leaveCarriedOverDays?: number | null;
  photoPath?: string | null;
  user?: UserAccount | null;
};

export type UserAccount = {
  id: number;
  email: string;
  name?: string;
  role: string;
  employeeId?: number | null;
  employee?: Partial<Employee>;
};

export type EmployeeFormData = {
  firstName: string;
  middleName: string;
  lastName: string;
  title: string;
  gender: string;
  ethnicity: string;
  dateOfBirth: string;
  email: string;
  phoneNumber: string;
  workPhone: string;
  jobTitle: string;
  employeeType: string;
  department: string;
  niNumber: string;
  startDate: string;
  endDate: string;
  probationEndDate: string;
  address1: string;
  address2: string;
  address3: string;
  townCity: string;
  county: string;
  postcode: string;
  accountName: string;
  bankName: string;
  bankBranch: string;
  accountNumber: string;
  sortCode: string;
  salary: string;
  salaryRate: string;
  paymentFrequency: string;
  salaryEffectiveFrom: string;
  salaryReason: string;
  payrollNumber: string;
  taxCode: string;
  passportNumber: string;
  passportCountryOfIssue: string;
  passportExpiryDate: string;
  licenceNumber: string;
  licenceCountryOfIssue: string;
  licenceClass: string;
  licenceExpiryDate: string;
  visaNumber: string;
  visaExpiryDate: string;
  dbsLevel: string;
  dbsCertificateNumber: string;
  dbsIssueDate: string;
  dbsRecheckDate: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  emergencyContactAddress: string;
  managerId: string;
  leaveAllowanceDays: string;
  leaveCarriedOverDays: string;
};

export type AccountFormData = {
  id: number | null;
  employeeId: number | null;
  linkedEmployeeId: number | null;
  email: string;
  name: string;
  role: AppRole;
  password: string;
};

export const emptyEmployeeForm: EmployeeFormData = {
  firstName: '',
  middleName: '',
  lastName: '',
  title: '',
  gender: '',
  ethnicity: '',
  dateOfBirth: '',
  email: '',
  phoneNumber: '',
  workPhone: '',
  jobTitle: '',
  employeeType: 'EMPLOYEE',
  department: '',
  niNumber: '',
  startDate: '',
  endDate: '',
  probationEndDate: '',
  address1: '',
  address2: '',
  address3: '',
  townCity: '',
  county: '',
  postcode: '',
  accountName: '',
  bankName: '',
  bankBranch: '',
  accountNumber: '',
  sortCode: '',
  salary: '',
  salaryRate: '',
  paymentFrequency: '',
  salaryEffectiveFrom: '',
  salaryReason: '',
  payrollNumber: '',
  taxCode: '',
  passportNumber: '',
  passportCountryOfIssue: '',
  passportExpiryDate: '',
  licenceNumber: '',
  licenceCountryOfIssue: '',
  licenceClass: '',
  licenceExpiryDate: '',
  visaNumber: '',
  visaExpiryDate: '',
  dbsLevel: '',
  dbsCertificateNumber: '',
  dbsIssueDate: '',
  dbsRecheckDate: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelation: '',
  emergencyContactAddress: '',
  managerId: '',
  leaveAllowanceDays: '',
  leaveCarriedOverDays: '',
};

export const emptyAccountForm: AccountFormData = {
  id: null,
  employeeId: null,
  linkedEmployeeId: null,
  email: '',
  name: '',
  role: 'EMPLOYEE',
  password: '',
};

export function generateTemporaryPassword() {
  return `Temp-${Math.random().toString(36).slice(2, 8)}!${Math.floor(100 + Math.random() * 900)}`;
}

export function fullName(employee: Employee) {
  return `${employee.firstName} ${employee.lastName}`.trim();
}

/** "1 Feb 2024" (README "Detail panel"); empty stays empty so callers pick the placeholder. */
export function formatDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function dateInputValue(value?: string | null) {
  return value ? value.split('T')[0] : '';
}

export function numberInputValue(value?: number | null) {
  return value === undefined || value === null ? '' : String(value);
}

export function maskAccountNumber(value?: string) {
  if (!value) return '';
  return `****${value.slice(-4)}`;
}

export function accountForEmployee(employee: Employee, users: UserAccount[]) {
  const match = users.find(
    (user) =>
      user.employeeId === employee.id ||
      user.email.toLowerCase() === employee.email.toLowerCase(),
  );
  if (match) return match;
  // An employee can't list /auth/users, so their own record carries the
  // account inline; without this their profile claims "No login".
  return employee.user
    ? { ...employee.user, role: normalizeRole(employee.user.role) }
    : undefined;
}

/** Fewer than three of the seven consents counts as a gap (KPI "Consent gaps"). */
export const CONSENT_TOTAL = 7;
export const CONSENT_GAP_BELOW = 3;

export function hasConsentGap(employee: Employee) {
  return (employee.consentCount ?? CONSENT_TOTAL) < CONSENT_GAP_BELOW;
}

// Photos live in a private bucket and the endpoint wants a bearer token, so
// an <img src> cannot fetch one by itself. Pull the bytes once per employee
// and hand the tag an object URL; the cache survives re-renders and list
// filtering, which is why the URLs are deliberately never revoked.
const photoCache = new Map<number, string>();

export function useEmployeePhoto(employee: Employee) {
  const [url, setUrl] = React.useState<string | null>(
    () => photoCache.get(employee.id) ?? null,
  );

  React.useEffect(() => {
    if (!employee.photoPath) {
      setUrl(null);
      return;
    }
    const cached = photoCache.get(employee.id);
    if (cached) {
      setUrl(cached);
      return;
    }

    let cancelled = false;
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    fetch(`${API_BASE_URL}/employees/${employee.id}/photo/raw`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => (res.ok ? res.blob() : Promise.reject(res.status)))
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        photoCache.set(employee.id, objectUrl);
        if (!cancelled) setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [employee.id, employee.photoPath]);

  return url;
}
