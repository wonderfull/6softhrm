import * as XLSX from 'xlsx'

// CSV/XLSX employee import: header mapping, per-row validation and an
// idempotent-by-email plan. Parsing and validation live here so the route
// stays thin and the logic is unit-testable.

export const IMPORT_COLUMNS: Array<{ field: string; header: string; required?: boolean }> = [
  { field: 'firstName', header: 'First Name', required: true },
  { field: 'lastName', header: 'Last Name', required: true },
  { field: 'email', header: 'Email', required: true },
  { field: 'jobTitle', header: 'Job Title' },
  { field: 'department', header: 'Department' },
  { field: 'employeeType', header: 'Employee Type' },
  { field: 'startDate', header: 'Start Date' },
  { field: 'phoneNumber', header: 'Mobile Number' },
  { field: 'dateOfBirth', header: 'Date of Birth' },
  { field: 'niNumber', header: 'NI Number' },
  { field: 'address1', header: 'Address 1' },
  { field: 'address2', header: 'Address 2' },
  { field: 'townCity', header: 'Town/City' },
  { field: 'county', header: 'County' },
  { field: 'postcode', header: 'Postcode' },
  { field: 'salary', header: 'Salary' },
  { field: 'payrollNumber', header: 'Payroll Number' },
  { field: 'emergencyContactName', header: 'Emergency Contact Name' },
  { field: 'emergencyContactPhone', header: 'Emergency Contact Phone' },
  { field: 'passportNumber', header: 'Passport Number' },
  { field: 'passportExpiryDate', header: 'Passport Expiry Date' },
  { field: 'visaNumber', header: 'Visa Number' },
  { field: 'visaExpiryDate', header: 'Visa Expiry Date' },
]

const DATE_FIELDS = new Set(['startDate', 'dateOfBirth', 'passportExpiryDate', 'visaExpiryDate'])
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function canon(header: string) {
  return header.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

// header → field lookup accepting both display headers and camelCase names
const HEADER_MAP = new Map<string, string>()
for (const col of IMPORT_COLUMNS) {
  HEADER_MAP.set(canon(col.header), col.field)
  HEADER_MAP.set(canon(col.field), col.field)
}
// common aliases seen in real HR spreadsheets
for (const [alias, field] of [
  ['forename', 'firstName'],
  ['surname', 'lastName'],
  ['emailaddress', 'email'],
  ['workemail', 'email'],
  ['role', 'jobTitle'],
  ['position', 'jobTitle'],
  ['team', 'department'],
  ['phone', 'phoneNumber'],
  ['mobile', 'phoneNumber'],
  ['dob', 'dateOfBirth'],
  ['nationalinsurancenumber', 'niNumber'],
  ['city', 'townCity'],
  ['startdate', 'startDate'],
] as Array<[string, string]>) {
  HEADER_MAP.set(alias, field)
}

export function csvTemplate(): string {
  return IMPORT_COLUMNS.map((c) => c.header).join(',') + '\n'
}

// Accepts ISO (2024-01-31), UK (31/01/2024) and spreadsheet-formatted dates.
function parseDate(value: string): Date | null {
  const trimmed = value.trim()
  const uk = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  const candidate = uk ? `${uk[3]}-${uk[2].padStart(2, '0')}-${uk[1].padStart(2, '0')}` : trimmed
  const date = new Date(candidate)
  return isNaN(date.getTime()) ? null : date
}

export type ImportRow = {
  row: number // 1-based data row (excluding header)
  email: string
  data: Record<string, any>
  errors: string[]
}

export function parseImportFile(buffer: Buffer): { rows: ImportRow[]; headerErrors: string[] } {
  // raw:true stops XLSX turning CSV date strings into Excel serials;
  // cellDates:true makes real .xlsx date cells arrive as JS Dates.
  const workbook = XLSX.read(buffer, { type: 'buffer', raw: true, cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: true,
  })

  const headerErrors: string[] = []
  if (records.length === 0) {
    headerErrors.push('The file has no data rows.')
    return { rows: [], headerErrors }
  }

  const presentFields = new Set(
    Object.keys(records[0]).map((h) => HEADER_MAP.get(canon(h))).filter(Boolean),
  )
  for (const col of IMPORT_COLUMNS.filter((c) => c.required)) {
    if (!presentFields.has(col.field)) {
      headerErrors.push(`Missing required column: "${col.header}"`)
    }
  }
  if (headerErrors.length) return { rows: [], headerErrors }

  const seenEmails = new Map<string, number>()
  const rows: ImportRow[] = records.map((record, index) => {
    const data: Record<string, any> = {}
    const errors: string[] = []

    for (const [header, raw] of Object.entries(record)) {
      const field = HEADER_MAP.get(canon(header))
      if (!field) continue
      if (raw instanceof Date) {
        if (DATE_FIELDS.has(field)) data[field] = raw
        else errors.push(`${field}: unexpected date value`)
        continue
      }
      const value = String(raw ?? '').trim()
      if (value === '') continue

      if (DATE_FIELDS.has(field)) {
        const date = parseDate(value)
        if (!date) errors.push(`${field}: "${value}" is not a valid date (use YYYY-MM-DD or DD/MM/YYYY)`)
        else data[field] = date
      } else if (field === 'salary') {
        const n = Number(value.replace(/[£,\s]/g, ''))
        if (isNaN(n)) errors.push(`salary: "${value}" is not a number`)
        else data.salary = n
      } else if (field === 'employeeType') {
        const t = value.toUpperCase()
        if (t !== 'EMPLOYEE' && t !== 'DIRECTOR') {
          errors.push(`employeeType: "${value}" must be EMPLOYEE or DIRECTOR`)
        } else data.employeeType = t
      } else {
        data[field] = value
      }
    }

    for (const col of IMPORT_COLUMNS.filter((c) => c.required)) {
      if (!data[col.field]) errors.push(`${col.header} is required`)
    }
    const email = String(data.email ?? '').toLowerCase()
    if (email && !EMAIL_RE.test(email)) errors.push(`email: "${email}" is not a valid email address`)
    if (email) {
      const firstRow = seenEmails.get(email)
      if (firstRow) errors.push(`Duplicate email — already used on row ${firstRow}`)
      else seenEmails.set(email, index + 1)
      data.email = email
    }

    return { row: index + 1, email, data, errors }
  })

  return { rows, headerErrors }
}
