import { afterEach, describe, expect, it } from '@jest/globals';
import {
  assertNotFilteringEncryptedFields,
  decryptField,
  decryptReadResult,
  encryptField,
  encryptWriteData,
  getFieldEncryptionKey,
  isEncrypted,
} from '../lib/fieldEncryption';

const TEST_KEY = process.env.FIELD_ENCRYPTION_KEY as string;
const OTHER_KEY = 'f'.repeat(64);

describe('field encryption primitives', () => {
  afterEach(() => {
    process.env.FIELD_ENCRYPTION_KEY = TEST_KEY;
  });

  it('round-trips a value', () => {
    const stored = encryptField('QQ123456C');
    expect(decryptField(stored)).toBe('QQ123456C');
  });

  it('stores ciphertext that does not contain the plaintext', () => {
    const stored = encryptField('QQ123456C');
    expect(isEncrypted(stored)).toBe(true);
    expect(stored.startsWith('enc:v1:')).toBe(true);
    expect(stored).not.toContain('QQ123456C');
  });

  it('produces a different ciphertext each time (random IV)', () => {
    const a = encryptField('12345678');
    const b = encryptField('12345678');
    expect(a).not.toBe(b);
    expect(decryptField(a)).toBe('12345678');
    expect(decryptField(b)).toBe('12345678');
  });

  it('round-trips empty and unicode values', () => {
    expect(decryptField(encryptField(''))).toBe('');
    expect(decryptField(encryptField('NI — Ünïcode ✓'))).toBe('NI — Ünïcode ✓');
  });

  it('returns pre-backfill plaintext unchanged', () => {
    expect(decryptField('QQ123456C')).toBe('QQ123456C');
  });

  it('rejects a tampered ciphertext (GCM auth tag)', () => {
    const stored = encryptField('QQ123456C');
    const body = Buffer.from(stored.slice('enc:v1:'.length), 'base64');
    body[body.length - 1] ^= 0xff; // flip a bit in the ciphertext
    const tampered = 'enc:v1:' + body.toString('base64');
    expect(() => decryptField(tampered)).toThrow('FIELD_DECRYPTION_FAILED');
  });

  it('rejects a ciphertext whose auth tag was swapped', () => {
    const stored = encryptField('QQ123456C');
    const body = Buffer.from(stored.slice('enc:v1:'.length), 'base64');
    body[12] ^= 0xff; // first byte of the auth tag
    expect(() => decryptField('enc:v1:' + body.toString('base64'))).toThrow(
      'FIELD_DECRYPTION_FAILED',
    );
  });

  it('rejects a truncated ciphertext', () => {
    expect(() => decryptField('enc:v1:AAAA')).toThrow(
      'FIELD_DECRYPTION_FAILED',
    );
  });

  it('rejects a value encrypted under a different key', () => {
    const stored = encryptField('QQ123456C');
    process.env.FIELD_ENCRYPTION_KEY = OTHER_KEY;
    expect(() => decryptField(stored)).toThrow('FIELD_DECRYPTION_FAILED');
  });

  it('fails loudly when the key is missing or malformed', () => {
    delete process.env.FIELD_ENCRYPTION_KEY;
    expect(() => getFieldEncryptionKey()).toThrow(
      'FIELD_ENCRYPTION_KEY is not configured',
    );
    process.env.FIELD_ENCRYPTION_KEY = 'not-hex';
    expect(() => getFieldEncryptionKey()).toThrow('32 bytes of hex');
  });
});

describe('write payload walker', () => {
  it('encrypts the sensitive fields and leaves the rest alone', () => {
    const start = new Date('2024-01-01');
    const out: any = encryptWriteData({
      firstName: 'Ada',
      startDate: start,
      niNumber: 'QQ123456C',
      passportNumber: '123456789',
      accountNumber: '12345678',
      sortCode: '11-22-33',
    });
    expect(out.firstName).toBe('Ada');
    expect(out.startDate).toBe(start);
    expect(decryptField(out.niNumber)).toBe('QQ123456C');
    expect(decryptField(out.passportNumber)).toBe('123456789');
    expect(decryptField(out.accountNumber)).toBe('12345678');
    expect(decryptField(out.sortCode)).toBe('11-22-33');
  });

  it('does not mutate the caller payload', () => {
    const data = { niNumber: 'QQ123456C' };
    encryptWriteData(data);
    expect(data.niNumber).toBe('QQ123456C');
  });

  it('handles arrays, nested writes and { set: … } update syntax', () => {
    const out: any = encryptWriteData([
      { niNumber: 'AA111111A' },
      { employee: { create: { sortCode: '11-22-33' } } },
      { accountNumber: { set: '87654321' } },
    ]);
    expect(decryptField(out[0].niNumber)).toBe('AA111111A');
    expect(decryptField(out[1].employee.create.sortCode)).toBe('11-22-33');
    expect(decryptField(out[2].accountNumber.set)).toBe('87654321');
  });

  it('passes nulls through and never double-encrypts', () => {
    const once: any = encryptWriteData({
      niNumber: 'QQ123456C',
      sortCode: null,
    });
    const twice: any = encryptWriteData(once);
    expect(twice.niNumber).toBe(once.niNumber);
    expect(twice.sortCode).toBeNull();
    expect(decryptField(twice.niNumber)).toBe('QQ123456C');
  });

  it('encrypts a caller-supplied string that only looks like ciphertext', () => {
    const out: any = encryptWriteData({
      niNumber: 'enc:v1:not-really-ciphertext',
    });
    expect(decryptField(out.niNumber)).toBe('enc:v1:not-really-ciphertext');
  });
});

describe('read result walker', () => {
  it('decrypts nested and repeated occurrences', () => {
    const result = decryptReadResult({
      id: 1,
      employee: { niNumber: encryptField('QQ123456C') },
      rows: [{ employee: { sortCode: encryptField('11-22-33') } }],
    }) as any;
    expect(result.employee.niNumber).toBe('QQ123456C');
    expect(result.rows[0].employee.sortCode).toBe('11-22-33');
  });

  it('leaves plaintext, nulls and dates alone', () => {
    const when = new Date('2024-01-01');
    const result = decryptReadResult({
      niNumber: 'QQ123456C',
      sortCode: null,
      startDate: when,
    }) as any;
    expect(result.niNumber).toBe('QQ123456C');
    expect(result.sortCode).toBeNull();
    expect(result.startDate).toBe(when);
  });
});

describe('encrypted field filter guard', () => {
  it('rejects a where clause that filters on an encrypted column', () => {
    expect(() =>
      assertNotFilteringEncryptedFields('Employee', 'findFirst', {
        niNumber: 'QQ123456C',
      }),
    ).toThrow('ENCRYPTED_FIELD_NOT_FILTERABLE');
    expect(() =>
      assertNotFilteringEncryptedFields('Timesheet', 'findMany', {
        employee: { sortCode: { contains: '11' } },
      }),
    ).toThrow('ENCRYPTED_FIELD_NOT_FILTERABLE');
  });

  it('allows ordinary filters', () => {
    expect(() =>
      assertNotFilteringEncryptedFields('Employee', 'findMany', {
        tenantId: 1,
        email: { contains: '@example.com' },
      }),
    ).not.toThrow();
  });
});
