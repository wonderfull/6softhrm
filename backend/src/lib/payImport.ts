import * as XLSX from 'xlsx';

// Payroll CSV/XLSX import: header mapping, per-row validation and an
// idempotent-by-(employee, period start) plan. Mirrors employeeImport.ts so a
// tenant meets the same dry-run-then-commit flow they already know.

export const PAY_IMPORT_COLUMNS: Array<{
  field: string;
  header: string;
  required?: boolean;
}> = [
  { field: 'email', header: 'Email', required: true },
  { field: 'periodStart', header: 'Period Start', required: true },
  { field: 'periodEnd', header: 'Period End', required: true },
  { field: 'grossPay', header: 'Gross Pay', required: true },
  { field: 'hoursWorked', header: 'Hours Worked' },
];

const DATE_FIELDS = new Set(['periodStart', 'periodEnd']);
const NUMBER_FIELDS = new Set(['grossPay', 'hoursWorked']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function canon(header: string) {
  return header.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

const HEADER_MAP = new Map<string, string>();
for (const col of PAY_IMPORT_COLUMNS) {
  HEADER_MAP.set(canon(col.header), col.field);
  HEADER_MAP.set(canon(col.field), col.field);
}
// aliases seen in real payroll exports
for (const [alias, field] of [
  ['emailaddress', 'email'],
  ['workemail', 'email'],
  ['payperiodstart', 'periodStart'],
  ['periodfrom', 'periodStart'],
  ['from', 'periodStart'],
  ['payperiodend', 'periodEnd'],
  ['periodto', 'periodEnd'],
  ['to', 'periodEnd'],
  ['gross', 'grossPay'],
  ['grosssalary', 'grossPay'],
  ['grosspayforperiod', 'grossPay'],
  ['hours', 'hoursWorked'],
  ['totalhours', 'hoursWorked'],
] as Array<[string, string]>) {
  HEADER_MAP.set(alias, field);
}

export function payCsvTemplate(): string {
  return PAY_IMPORT_COLUMNS.map((c) => c.header).join(',') + '\n';
}

// Strips currency decoration before parsing. Deliberately drops anything that
// is not a digit, dot or minus: a CSV saved as UTF-8 but read as latin1 turns
// "£" into "Â£", and a payroll export that spells out the currency should not
// fail import over it.
function parseAmount(value: string): number {
  const cleaned = value.replace(/[^0-9.-]/g, '');
  return cleaned === '' ? NaN : Number(cleaned);
}

// Accepts ISO (2024-01-31), UK (31/01/2024) and spreadsheet-formatted dates.
function parseDate(value: string): Date | null {
  const trimmed = value.trim();
  const uk = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const candidate = uk
    ? `${uk[3]}-${uk[2].padStart(2, '0')}-${uk[1].padStart(2, '0')}`
    : trimmed;
  const date = new Date(candidate);
  return isNaN(date.getTime()) ? null : date;
}

export type PayImportRow = {
  row: number; // 1-based data row (excluding header)
  email: string;
  data: Record<string, any>;
  errors: string[];
};

export function parsePayImportFile(buffer: Buffer): {
  rows: PayImportRow[];
  headerErrors: string[];
} {
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    raw: true,
    cellDates: true,
  });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: true,
  });

  const headerErrors: string[] = [];
  if (records.length === 0) {
    headerErrors.push('The file has no data rows.');
    return { rows: [], headerErrors };
  }

  const presentFields = new Set(
    Object.keys(records[0])
      .map((h) => HEADER_MAP.get(canon(h)))
      .filter(Boolean),
  );
  for (const col of PAY_IMPORT_COLUMNS.filter((c) => c.required)) {
    if (!presentFields.has(col.field)) {
      headerErrors.push(`Missing required column: "${col.header}"`);
    }
  }
  if (headerErrors.length) return { rows: [], headerErrors };

  // A worker can legitimately appear many times (one row per period), so the
  // duplicate key is the pair, not the email.
  const seenPeriods = new Map<string, number>();

  const rows: PayImportRow[] = records.map((record, index) => {
    const data: Record<string, any> = {};
    const errors: string[] = [];

    for (const [header, raw] of Object.entries(record)) {
      const field = HEADER_MAP.get(canon(header));
      if (!field) continue;
      if (raw instanceof Date) {
        if (DATE_FIELDS.has(field)) data[field] = raw;
        else errors.push(`${field}: unexpected date value`);
        continue;
      }
      const value = String(raw ?? '').trim();
      if (value === '') continue;

      if (DATE_FIELDS.has(field)) {
        const date = parseDate(value);
        if (!date)
          errors.push(
            `${field}: "${value}" is not a valid date (use YYYY-MM-DD or DD/MM/YYYY)`,
          );
        else data[field] = date;
      } else if (NUMBER_FIELDS.has(field)) {
        const n = parseAmount(value);
        if (isNaN(n)) errors.push(`${field}: "${value}" is not a number`);
        else if (n < 0) errors.push(`${field}: "${value}" cannot be negative`);
        else data[field] = n;
      } else {
        data[field] = value;
      }
    }

    for (const col of PAY_IMPORT_COLUMNS.filter((c) => c.required)) {
      if (data[col.field] === undefined)
        errors.push(`${col.header} is required`);
    }

    const email = String(data.email ?? '').toLowerCase();
    if (email && !EMAIL_RE.test(email))
      errors.push(`email: "${email}" is not a valid email address`);
    if (email) data.email = email;

    if (
      data.periodStart &&
      data.periodEnd &&
      data.periodEnd < data.periodStart
    ) {
      errors.push('Period End cannot be before Period Start');
    }

    if (email && data.periodStart) {
      const key = `${email}|${data.periodStart.toISOString().slice(0, 10)}`;
      const firstRow = seenPeriods.get(key);
      if (firstRow)
        errors.push(
          `Duplicate pay period for this employee — already on row ${firstRow}`,
        );
      else seenPeriods.set(key, index + 1);
    }

    return { row: index + 1, email, data, errors };
  });

  return { rows, headerErrors };
}
