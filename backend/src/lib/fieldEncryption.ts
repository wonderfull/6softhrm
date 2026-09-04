import crypto from 'crypto';

// Application-level column encryption (AES-256-GCM) for the Employee columns
// that hold personal identifiers. A stored value looks like
//
//   enc:v1:<base64( iv[12] || authTag[16] || ciphertext )>
//
// so it is self-describing: a value that does not carry the prefix is a
// plaintext row that predates the backfill (scripts/encrypt-existing-fields.ts)
// and is returned as-is on read. Nothing here ever logs a key or a plaintext.

const PREFIX = 'enc:v1:';
const IV_BYTES = 12;
const TAG_BYTES = 16;

export const ENCRYPTED_FIELDS = [
  'niNumber',
  'passportNumber',
  'accountNumber',
  'sortCode',
  'shareCode',
  'dbsCertificateNumber',
] as const;

const FIELD_SET: ReadonlySet<string> = new Set(ENCRYPTED_FIELDS);

let cachedKey: { source: string; key: Buffer } | null = null;

export function getFieldEncryptionKey(): Buffer {
  const source = process.env.FIELD_ENCRYPTION_KEY?.trim();
  if (!source) {
    throw new Error(
      'FIELD_ENCRYPTION_KEY is not configured. Generate one with `openssl rand -hex 32` and set it ' +
        'in backend/.env — sensitive employee fields are never stored in plaintext.',
    );
  }
  if (cachedKey && cachedKey.source === source) return cachedKey.key;
  if (!/^[0-9a-fA-F]{64}$/.test(source)) {
    throw new Error(
      'FIELD_ENCRYPTION_KEY must be 32 bytes of hex (64 hex characters).',
    );
  }
  const key = Buffer.from(source, 'hex');
  cachedKey = { source, key };
  return key;
}

// Called at boot so a missing key stops the process instead of silently
// letting the first write store plaintext.
export function assertFieldEncryptionKey(): void {
  getFieldEncryptionKey();
}

export function isEncrypted(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

/**
 * Whether a value is genuinely our ciphertext, rather than plaintext that
 * merely starts with the prefix. Callers deciding whether a value still needs
 * encrypting must use this, not the prefix test: treating an undecryptable
 * lookalike as "already encrypted" leaves it plaintext forever AND makes every
 * later read throw, because the read path will try to decrypt it.
 */
export function isGenuineCiphertext(value: unknown): value is string {
  if (!isEncrypted(value)) return false;
  try {
    decryptField(value);
    return true;
  } catch {
    return false;
  }
}

export function encryptField(plaintext: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    getFieldEncryptionKey(),
    iv,
  );
  const body = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  return (
    PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64')
  );
}

export function decryptField(stored: string): string {
  if (!isEncrypted(stored)) return stored;
  const raw = Buffer.from(stored.slice(PREFIX.length), 'base64');
  if (raw.length < IV_BYTES + TAG_BYTES) {
    throw new Error('FIELD_DECRYPTION_FAILED: stored value is truncated');
  }
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getFieldEncryptionKey(),
    raw.subarray(0, IV_BYTES),
  );
  decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
  try {
    return Buffer.concat([
      decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    // GCM auth tag mismatch: wrong key, or the column was modified in the database.
    throw new Error('FIELD_DECRYPTION_FAILED: value failed authentication');
  }
}

function isWalkable(value: any): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    !(value instanceof Date) &&
    !Buffer.isBuffer(value)
  );
}

function encryptValue(value: any): any {
  if (typeof value === 'string') {
    // Already-ciphertext passes through, which keeps the backfill and any
    // restore-from-export idempotent. A string that only looks like ciphertext
    // is encrypted as the literal string it is, so a crafted "enc:v1:…"
    // payload cannot land unencrypted.
    return isGenuineCiphertext(value) ? value : encryptField(value);
  }
  // Prisma update syntax: { niNumber: { set: 'QQ123456C' } }
  if (
    isWalkable(value) &&
    !Array.isArray(value) &&
    typeof value.set === 'string'
  ) {
    return { ...value, set: encryptValue(value.set) };
  }
  return value;
}

// Copy-on-write walk of a create/update payload. Recursive because Prisma query
// extensions only see top-level args: a nested `employee: { create: … }` write
// must be encrypted too. `where` is deliberately never walked — see
// assertNotFilteringEncryptedFields.
export function encryptWriteData<T>(data: T): T {
  if (Array.isArray(data)) return data.map(encryptWriteData) as unknown as T;
  if (!isWalkable(data)) return data;
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(data as Record<string, any>)) {
    out[key] = FIELD_SET.has(key)
      ? encryptValue(value)
      : encryptWriteData(value);
  }
  return out as T;
}

// Decrypts in place. Recursive for the same reason: these columns arrive nested
// under `include: { employee: true }` on timesheets, leave, documents and more.
export function decryptReadResult<T>(result: T): T {
  if (Array.isArray(result)) {
    for (let i = 0; i < result.length; i++)
      result[i] = decryptReadResult(result[i]);
    return result;
  }
  if (!isWalkable(result)) return result;
  for (const [key, value] of Object.entries(result as Record<string, any>)) {
    if (FIELD_SET.has(key) && typeof value === 'string') {
      (result as Record<string, any>)[key] = decryptField(value);
    } else if (isWalkable(value)) {
      decryptReadResult(value);
    }
  }
  return result;
}

// Equality/contains filtering is impossible once a column holds ciphertext with
// a random IV: the filter would silently match nothing. Fail loudly instead.
export function assertNotFilteringEncryptedFields(
  model: string | undefined,
  operation: string,
  where: any,
  clause = 'filters on',
): void {
  if (!isWalkable(where)) return;
  for (const [key, value] of Object.entries(where as Record<string, any>)) {
    if (FIELD_SET.has(key)) {
      throw new Error(
        `ENCRYPTED_FIELD_NOT_FILTERABLE: ${model ?? 'query'}.${operation} ${clause} "${key}", ` +
          'which is encrypted at rest and cannot be matched by the database.',
      );
    }
    if (isWalkable(value))
      assertNotFilteringEncryptedFields(model, operation, value, clause);
  }
}

// `where` is not the only clause the database evaluates against the stored
// bytes. Sorting by ciphertext yields an order with no relation to the
// plaintext, and every row carries its own IV so `distinct` de-duplicates
// nothing — both would be silently wrong rather than empty, which is worse
// than a failed filter. `cursor` is keyset pagination and needs an equality
// match it cannot make.
export function assertNoEncryptedFieldInQuery(
  model: string | undefined,
  operation: string,
  args: any,
): void {
  if (!isWalkable(args)) return;

  if (args.where !== undefined) {
    assertNotFilteringEncryptedFields(model, operation, args.where);
  }
  if (args.orderBy !== undefined) {
    assertNotFilteringEncryptedFields(model, operation, args.orderBy, 'orders by');
  }
  if (args.cursor !== undefined) {
    assertNotFilteringEncryptedFields(model, operation, args.cursor, 'paginates by');
  }
  if (args.distinct !== undefined) {
    const fields = Array.isArray(args.distinct) ? args.distinct : [args.distinct];
    for (const field of fields) {
      if (typeof field === 'string' && FIELD_SET.has(field)) {
        throw new Error(
          `ENCRYPTED_FIELD_NOT_FILTERABLE: ${model ?? 'query'}.${operation} selects distinct on "${field}", ` +
            'which is encrypted at rest — every row has its own IV, so nothing would be de-duplicated.',
        );
      }
    }
  }
}
