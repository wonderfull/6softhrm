import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Button, Card, Input, Select } from '../ui';
import { IconButton } from './Bits';
import type { EmployeeFormData } from './model';

// The employment record, written once and edited in the same sections. It
// replaces the list while it is open, so its Save is the view's one primary.

type Option = { value: string; label: string };

type FieldProps = {
  id: keyof EmployeeFormData;
  label: string;
  value: string;
  onChange: (id: keyof EmployeeFormData, value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  helper?: string;
  options?: Option[];
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  maxLength?: number;
  className?: string;
};

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  required,
  placeholder,
  helper,
  options,
  inputMode,
  maxLength,
  className,
}: FieldProps) {
  const fieldId = `employee-${String(id)}`;
  const labelNode = required ? (
    <>
      {label} <span className="text-bad">*</span>
    </>
  ) : (
    label
  );

  if (options) {
    return (
      <Select
        id={fieldId}
        label={labelNode}
        help={helper}
        required={required}
        value={value}
        wrapperClassName={className}
        onChange={(event) => onChange(id, event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    );
  }

  return (
    <Input
      id={fieldId}
      label={labelNode}
      help={helper}
      type={type}
      required={required}
      placeholder={placeholder}
      inputMode={inputMode}
      maxLength={maxLength}
      value={value}
      wrapperClassName={className}
      onChange={(event) => onChange(id, event.target.value)}
    />
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[13px] font-semibold text-ink md:col-span-2">
      {children}
    </h4>
  );
}

export default function EmployeeForm({
  form,
  errors,
  editing,
  isSelfProfileEdit,
  managerOptions,
  onChange,
  onSubmit,
  onCancel,
}: {
  form: EmployeeFormData;
  errors: string[];
  editing: boolean;
  isSelfProfileEdit: boolean;
  managerOptions: Option[];
  onChange: (id: keyof EmployeeFormData, value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
}) {
  const title = isSelfProfileEdit
    ? 'Update profile'
    : editing
      ? 'Edit employee record'
      : 'Add employee';
  const submitLabel = isSelfProfileEdit
    ? 'Save profile'
    : editing
      ? 'Update employee'
      : 'Add employee';

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold leading-[1.3] tracking-[-0.01em] text-ink">
            {title}
          </h3>
          <p className="mt-1 text-sm text-ink-2">
            {isSelfProfileEdit
              ? 'Update your contact, address, emergency contact, and bank details.'
              : 'Complete the employment record once. Required fields are marked and the same sections are used for future edits.'}
          </p>
        </div>
        <IconButton label="Close employee form" onClick={onCancel}>
          <XMarkIcon className="h-4 w-4" />
        </IconButton>
      </div>

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {errors.length > 0 && (
          <div
            role="alert"
            className="rounded-md bg-bad-tint px-4 py-3 text-[13px] text-bad"
          >
            <div className="mb-1 font-medium">
              Please complete the required fields:
            </div>
            <ul className="list-inside list-disc">
              {errors.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
          </div>
        )}

        <Card
          title="Basic details"
          description="Personal details, contact information, and employment dates."
        >
          <Group>
            <Field
              id="title"
              label="Title"
              value={form.title}
              onChange={onChange}
              options={[
                { value: '', label: 'Select title' },
                { value: 'Mr', label: 'Mr' },
                { value: 'Mrs', label: 'Mrs' },
                { value: 'Miss', label: 'Miss' },
                { value: 'Ms', label: 'Ms' },
                { value: 'Dr', label: 'Dr' },
                { value: 'Mx', label: 'Mx' },
              ]}
            />
            <Field
              id="firstName"
              label="First name"
              value={form.firstName}
              onChange={onChange}
              required
              placeholder="First name"
            />
            <Field
              id="middleName"
              label="Middle name"
              value={form.middleName}
              onChange={onChange}
              placeholder="Middle name"
            />
            <Field
              id="lastName"
              label="Last name"
              value={form.lastName}
              onChange={onChange}
              required
              placeholder="Last name"
            />
            <Field
              id="gender"
              label="Gender"
              value={form.gender}
              onChange={onChange}
              options={[
                { value: '', label: 'Unspecified' },
                { value: 'Female', label: 'Female' },
                { value: 'Male', label: 'Male' },
                { value: 'Non-binary', label: 'Non-binary' },
                { value: 'Prefer not to say', label: 'Prefer not to say' },
              ]}
            />
            <Field
              id="ethnicity"
              label="Ethnicity"
              value={form.ethnicity}
              onChange={onChange}
              options={[
                { value: '', label: 'Unspecified' },
                {
                  value: 'Asian or Asian British',
                  label: 'Asian or Asian British',
                },
                {
                  value: 'Black, Black British, Caribbean or African',
                  label: 'Black, Black British, Caribbean or African',
                },
                {
                  value: 'Mixed or multiple ethnic groups',
                  label: 'Mixed or multiple ethnic groups',
                },
                { value: 'White', label: 'White' },
                { value: 'Other ethnic group', label: 'Other ethnic group' },
                { value: 'Prefer not to say', label: 'Prefer not to say' },
              ]}
            />
            <Field
              id="dateOfBirth"
              label="Date of birth"
              value={form.dateOfBirth}
              onChange={onChange}
              type="date"
            />
            {!isSelfProfileEdit && (
              <Field
                id="email"
                label="Email address"
                value={form.email}
                onChange={onChange}
                type="email"
                required
                placeholder="name@example.com"
              />
            )}
            <Field
              id="phoneNumber"
              label="Mobile number"
              value={form.phoneNumber}
              onChange={onChange}
              type="tel"
              inputMode="tel"
              placeholder="Mobile number"
            />
            <Field
              id="workPhone"
              label="Work phone"
              value={form.workPhone}
              onChange={onChange}
              type="tel"
              inputMode="tel"
              placeholder="Work phone"
            />
            {!isSelfProfileEdit && (
              <>
                <Field
                  id="jobTitle"
                  label="Job title"
                  value={form.jobTitle}
                  onChange={onChange}
                  required
                  placeholder="Job title"
                />
                <Field
                  id="employeeType"
                  label="Employee type"
                  value={form.employeeType}
                  onChange={onChange}
                  options={[
                    { value: 'EMPLOYEE', label: 'Employee' },
                    { value: 'DIRECTOR', label: 'Director' },
                  ]}
                />
                <Field
                  id="department"
                  label="Department"
                  value={form.department}
                  onChange={onChange}
                  placeholder="Department"
                />
                <Field
                  id="startDate"
                  label="Employment start date"
                  value={form.startDate}
                  onChange={onChange}
                  type="date"
                  required
                />
                <Field
                  id="probationEndDate"
                  label="Probation end date"
                  value={form.probationEndDate}
                  onChange={onChange}
                  type="date"
                />
                <Field
                  id="endDate"
                  label="Employment end date"
                  value={form.endDate}
                  onChange={onChange}
                  type="date"
                  helper="Setting this starts the data-retention clock."
                />
                <Field
                  id="managerId"
                  label="Reports to"
                  value={form.managerId}
                  onChange={onChange}
                  options={managerOptions}
                  helper="Their manager approves their leave and sees it on the calendar."
                />
                <Field
                  id="leaveAllowanceDays"
                  label="Leave allowance (days)"
                  value={form.leaveAllowanceDays}
                  onChange={onChange}
                  type="number"
                  placeholder="Company default"
                />
                <Field
                  id="leaveCarriedOverDays"
                  label="Carried over (days)"
                  value={form.leaveCarriedOverDays}
                  onChange={onChange}
                  type="number"
                  placeholder="0"
                />
              </>
            )}
          </Group>
        </Card>

        <Card title="Address details">
          <Group>
            <Field
              id="address1"
              label="Address 1"
              value={form.address1}
              onChange={onChange}
              placeholder="Address 1"
            />
            <Field
              id="address2"
              label="Address 2"
              value={form.address2}
              onChange={onChange}
              placeholder="Address 2"
            />
            <Field
              id="address3"
              label="Address 3"
              value={form.address3}
              onChange={onChange}
              placeholder="Address 3"
            />
            <Field
              id="townCity"
              label="Town/City"
              value={form.townCity}
              onChange={onChange}
              placeholder="Town or city"
            />
            <Field
              id="county"
              label="County"
              value={form.county}
              onChange={onChange}
              placeholder="County"
            />
            <Field
              id="postcode"
              label="Postcode"
              value={form.postcode}
              onChange={onChange}
              placeholder="Postcode"
            />
          </Group>
        </Card>

        <Card
          title="Emergency contact"
          description="Used only if HR needs to contact someone in an emergency."
        >
          <Group>
            <Field
              id="emergencyContactName"
              label="Contact name"
              value={form.emergencyContactName}
              onChange={onChange}
              placeholder="Full name"
            />
            <Field
              id="emergencyContactPhone"
              label="Contact phone"
              value={form.emergencyContactPhone}
              onChange={onChange}
              type="tel"
              inputMode="tel"
              placeholder="Phone number"
            />
            <Field
              id="emergencyContactRelation"
              label="Relationship"
              value={form.emergencyContactRelation}
              onChange={onChange}
              placeholder="Relationship"
            />
            <Field
              id="emergencyContactAddress"
              label="Contact address"
              value={form.emergencyContactAddress}
              onChange={onChange}
              placeholder="Address"
            />
          </Group>
        </Card>

        <Card title="Bank details">
          <Group>
            <Field
              id="accountName"
              label="Name on account"
              value={form.accountName}
              onChange={onChange}
              placeholder="Account name"
              helper="Maximum 60 characters."
              maxLength={60}
            />
            <Field
              id="bankName"
              label="Name of bank"
              value={form.bankName}
              onChange={onChange}
              placeholder="Bank name"
              helper="Maximum 60 characters."
              maxLength={60}
            />
            <Field
              id="bankBranch"
              label="Bank branch"
              value={form.bankBranch}
              onChange={onChange}
              placeholder="Bank branch"
              helper="Bank branch location."
            />
            <Field
              id="accountNumber"
              label="Account number"
              value={form.accountNumber}
              onChange={onChange}
              placeholder="8 digit number"
              helper="8 digit number."
              inputMode="numeric"
              maxLength={8}
            />
            <Field
              id="sortCode"
              label="Sort code"
              value={form.sortCode}
              onChange={onChange}
              placeholder="00-00-00"
              helper="Example: 00-00-00."
              maxLength={8}
            />
          </Group>
        </Card>

        {!isSelfProfileEdit && (
          <Card title="Salary details">
            <Group>
              <Field
                id="salary"
                label="Salary"
                value={form.salary}
                onChange={onChange}
                type="number"
                inputMode="decimal"
                placeholder="0"
              />
              <Field
                id="salaryRate"
                label="Rate"
                value={form.salaryRate}
                onChange={onChange}
                options={[
                  { value: '', label: 'Select rate' },
                  { value: 'Annual', label: 'Annual' },
                  { value: 'Monthly', label: 'Monthly' },
                  { value: 'Daily', label: 'Daily' },
                  { value: 'Hourly', label: 'Hourly' },
                ]}
              />
              <Field
                id="paymentFrequency"
                label="Payment frequency"
                value={form.paymentFrequency}
                onChange={onChange}
                options={[
                  { value: '', label: 'Select frequency' },
                  { value: 'Weekly', label: 'Weekly' },
                  { value: 'Fortnightly', label: 'Fortnightly' },
                  { value: 'Monthly', label: 'Monthly' },
                ]}
              />
              <Field
                id="salaryEffectiveFrom"
                label="Effective from"
                value={form.salaryEffectiveFrom}
                onChange={onChange}
                type="date"
              />
              <Field
                id="salaryReason"
                label="Reason"
                value={form.salaryReason}
                onChange={onChange}
                options={[
                  { value: '', label: 'Select reason' },
                  { value: 'New starter', label: 'New starter' },
                  { value: 'Promotion', label: 'Promotion' },
                  { value: 'Annual review', label: 'Annual review' },
                  { value: 'Contract change', label: 'Contract change' },
                ]}
              />
              <Field
                id="payrollNumber"
                label="Payroll number"
                value={form.payrollNumber}
                onChange={onChange}
                placeholder="ABC123"
              />
            </Group>
          </Card>
        )}

        {!isSelfProfileEdit && (
          <Card
            title="Sensitive details"
            description="Tax, identity, licence, and right-to-work information. Access is restricted."
          >
            <Group>
              <SubHeading>Tax, NI and eligibility information</SubHeading>
              <Field
                id="taxCode"
                label="Tax code"
                value={form.taxCode}
                onChange={onChange}
                placeholder="Tax code"
              />
              <Field
                id="niNumber"
                label="NI number"
                value={form.niNumber}
                onChange={onChange}
                placeholder="NI number"
              />
              <SubHeading>Passport</SubHeading>
              <Field
                id="passportNumber"
                label="Passport number"
                value={form.passportNumber}
                onChange={onChange}
                placeholder="Passport number"
              />
              <Field
                id="passportCountryOfIssue"
                label="Country of issue"
                value={form.passportCountryOfIssue}
                onChange={onChange}
                placeholder="Country of issue"
              />
              <Field
                id="passportExpiryDate"
                label="Passport expiry date"
                value={form.passportExpiryDate}
                onChange={onChange}
                type="date"
              />
              <SubHeading>Driving licence</SubHeading>
              <Field
                id="licenceNumber"
                label="Licence number"
                value={form.licenceNumber}
                onChange={onChange}
                placeholder="Licence number"
              />
              <Field
                id="licenceCountryOfIssue"
                label="Country of issue"
                value={form.licenceCountryOfIssue}
                onChange={onChange}
                placeholder="Country of issue"
              />
              <Field
                id="licenceClass"
                label="Licence class"
                value={form.licenceClass}
                onChange={onChange}
                placeholder="Licence class"
              />
              <Field
                id="licenceExpiryDate"
                label="Date of expiry"
                value={form.licenceExpiryDate}
                onChange={onChange}
                type="date"
              />
              <SubHeading>Visa</SubHeading>
              <Field
                id="visaNumber"
                label="Visa number"
                value={form.visaNumber}
                onChange={onChange}
                placeholder="Visa number"
              />
              <Field
                id="visaExpiryDate"
                label="Visa expiry date"
                value={form.visaExpiryDate}
                onChange={onChange}
                type="date"
              />
              <SubHeading>DBS check</SubHeading>
              <Field
                id="dbsLevel"
                label="Level"
                value={form.dbsLevel}
                onChange={onChange}
                options={[
                  { value: '', label: 'Not required' },
                  { value: 'BASIC', label: 'Basic' },
                  { value: 'STANDARD', label: 'Standard' },
                  { value: 'ENHANCED', label: 'Enhanced' },
                  {
                    value: 'ENHANCED_BARRED',
                    label: 'Enhanced with barred lists',
                  },
                ]}
              />
              <Field
                id="dbsCertificateNumber"
                label="Certificate number"
                value={form.dbsCertificateNumber}
                onChange={onChange}
                placeholder="Certificate number"
              />
              <Field
                id="dbsIssueDate"
                label="Issue date"
                value={form.dbsIssueDate}
                onChange={onChange}
                type="date"
              />
              <Field
                id="dbsRecheckDate"
                label="Recheck due"
                value={form.dbsRecheckDate}
                onChange={onChange}
                type="date"
                helper="Reminders go out 90 days before."
              />
            </Group>
          </Card>
        )}

        <div className="sticky bottom-0 z-10 flex flex-wrap gap-2 border-t border-line bg-bg/95 py-3 backdrop-blur">
          <Button type="submit">{submitLabel}</Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </section>
  );
}
