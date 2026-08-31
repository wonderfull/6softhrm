import { describe, it, expect } from '@jest/globals';
import { assertNoEncryptedFieldInQuery } from '../lib/fieldEncryption';

// The guard originally covered `where` only. `where` at least fails visibly by
// matching nothing; orderBy, distinct and cursor are worse — they return rows,
// just in an order or shape that has no relation to the plaintext. Silently
// wrong beats loudly empty, so all four clauses have to be refused.

const check = (args: any) =>
  assertNoEncryptedFieldInQuery('Employee', 'findMany', args);

describe('encrypted-field query guard', () => {
  it('allows a query that does not touch an encrypted column', () => {
    expect(() =>
      check({
        where: { tenantId: 1, lastName: 'Smith' },
        orderBy: { lastName: 'asc' },
        distinct: ['email'],
      }),
    ).not.toThrow();
  });

  it('refuses filtering on an encrypted column', () => {
    expect(() => check({ where: { niNumber: 'QQ123456C' } })).toThrow(
      /ENCRYPTED_FIELD_NOT_FILTERABLE/,
    );
  });

  it('refuses a nested filter, e.g. inside AND/OR', () => {
    expect(() =>
      check({ where: { AND: [{ tenantId: 1 }, { passportNumber: '123' }] } }),
    ).toThrow(/passportNumber/);
  });

  it('refuses ordering by an encrypted column', () => {
    // Sorting by ciphertext returns rows in an arbitrary order with no error —
    // the caller would believe the list was sorted.
    expect(() => check({ orderBy: { sortCode: 'asc' } })).toThrow(/orders by/);
  });

  it('refuses ordering when given as an array', () => {
    expect(() =>
      check({ orderBy: [{ lastName: 'asc' }, { accountNumber: 'desc' }] }),
    ).toThrow(/accountNumber/);
  });

  it('refuses distinct on an encrypted column', () => {
    // Every row carries its own IV, so no two ciphertexts are ever equal and
    // distinct would de-duplicate nothing at all.
    expect(() => check({ distinct: ['niNumber'] })).toThrow(
      /de-duplicated|ENCRYPTED_FIELD_NOT_FILTERABLE/,
    );
  });

  it('refuses distinct given as a bare string', () => {
    expect(() => check({ distinct: 'niNumber' })).toThrow(
      /ENCRYPTED_FIELD_NOT_FILTERABLE/,
    );
  });

  it('refuses a cursor on an encrypted column', () => {
    expect(() => check({ cursor: { passportNumber: 'x' } })).toThrow(
      /paginates by/,
    );
  });

  it('tolerates undefined and empty args', () => {
    expect(() => check(undefined)).not.toThrow();
    expect(() => check({})).not.toThrow();
    expect(() => check({ where: undefined })).not.toThrow();
  });

  it('does not walk into a Date and mistake it for a filter object', () => {
    expect(() =>
      check({ where: { startDate: { gte: new Date('2026-01-01') } } }),
    ).not.toThrow();
  });
});
