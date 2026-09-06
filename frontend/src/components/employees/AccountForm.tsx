import React from 'react';
import { Button, Input, Select } from '../ui';
import {
  assignableRoles,
  normalizeRole,
  roleLabel,
  type AppRole,
} from '../../lib/roles';
import type { AccountFormData } from './model';

// Create or edit the login that sits behind an employee record. Shown inside
// the full record, under Account.

export default function AccountForm({
  form,
  currentRole,
  onChange,
  onSubmit,
  onCancel,
}: {
  form: AccountFormData;
  currentRole: AppRole;
  onChange: (next: AccountFormData) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-lg border border-line bg-bg p-4">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-ink">
          {form.id ? 'Edit account' : 'New account'}
        </h3>
      </div>
      <p className="mb-4 text-[13px] text-ink-2">
        {form.id
          ? 'Use this to update login access, role, employee self-service, or reset the password.'
          : 'Create the login account for this employee. The temporary password is used for their first login and can be reset later.'}
      </p>
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <Input
          label={
            <>
              Email <span className="text-bad">*</span>
            </>
          }
          type="email"
          required
          value={form.email}
          onChange={(event) => onChange({ ...form, email: event.target.value })}
        />
        <Input
          label="Name"
          value={form.name}
          onChange={(event) => onChange({ ...form, name: event.target.value })}
        />
        <Input
          label={
            form.id ? (
              'New password'
            ) : (
              <>
                Temporary password <span className="text-bad">*</span>
              </>
            )
          }
          type="password"
          required={!form.id}
          value={form.password}
          placeholder={
            form.id
              ? 'Leave blank to keep current password'
              : 'Temporary password for first login'
          }
          help={
            form.id
              ? 'Leave blank unless you need to reset it.'
              : 'Give this to the employee securely. They can use forgot password later.'
          }
          onChange={(event) =>
            onChange({ ...form, password: event.target.value })
          }
        />
        <Select
          id="account-role"
          label="Access role"
          required
          value={form.role}
          onChange={(event) =>
            onChange({ ...form, role: normalizeRole(event.target.value) })
          }
        >
          {assignableRoles(currentRole).map((role) => (
            <option key={role} value={role}>
              {form.employeeId && role !== 'EMPLOYEE'
                ? `${roleLabel(role)} + Employee`
                : roleLabel(role)}
            </option>
          ))}
        </Select>
        <div className="rounded-md border border-line bg-surface p-3 sm:col-span-2">
          <label
            htmlFor="account-employee-link"
            className="flex items-start gap-3 text-[13px] font-medium text-ink"
          >
            <input
              id="account-employee-link"
              type="checkbox"
              checked={!!form.employeeId}
              onChange={(event) =>
                onChange({
                  ...form,
                  employeeId: event.target.checked
                    ? form.linkedEmployeeId
                    : null,
                })
              }
              className="mt-0.5 h-4 w-4 rounded-sm border-line-2 text-accent focus:ring-accent-tint"
            />
            <span>
              Employee self-service
              <span className="mt-1 block text-xs font-normal leading-5 text-ink-3">
                Check this to make the account both {roleLabel(form.role)} and
                employee-linked. Leave unchecked for {roleLabel(form.role)}{' '}
                access only.
              </span>
            </span>
          </label>
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="submit">
            {form.id ? 'Update account' : 'Add account'}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
