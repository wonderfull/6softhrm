import { describe, it, expect, afterEach, jest } from '@jest/globals';
import {
  getCronStatus,
  runAbsenceSweep,
  runSalarySweep,
} from '../lib/cronJobs';
import * as absenceDetection from '../lib/absenceDetection';
import * as salarySweep from '../lib/salarySweep';

// The sweep wrappers used to catch failures into console.error and nothing
// else, so the cron-status badge read healthy while both compliance sweeps
// failed forever. These pin that every outcome — success, per-tenant errors
// the sweep survived, and total failure — lands in getCronStatus().

describe('cron sweep status', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('records a successful absence sweep', async () => {
    jest
      .spyOn(absenceDetection, 'detectUnauthorisedAbsence')
      .mockResolvedValue({
        tenantsScanned: 2,
        sponsorshipsScanned: 3,
        eventsCreated: 1,
        errors: [],
      });

    await runAbsenceSweep();

    const status = getCronStatus().absenceSweep;
    expect(status.lastFinishedAt).not.toBeNull();
    expect(status.lastEventsCreated).toBe(1);
    expect(status.lastError).toBeNull();
  });

  it('surfaces per-tenant errors the sweep survived', async () => {
    jest
      .spyOn(absenceDetection, 'detectUnauthorisedAbsence')
      .mockResolvedValue({
        tenantsScanned: 2,
        sponsorshipsScanned: 1,
        eventsCreated: 1,
        errors: ['tenant 7: corrupted tenant settings'],
      });

    await runAbsenceSweep();

    expect(getCronStatus().absenceSweep.lastError).toContain('tenant 7');
  });

  it('records a total failure instead of staying silent', async () => {
    jest
      .spyOn(salarySweep, 'reconcileSalaries')
      .mockRejectedValue(new Error('database unreachable'));

    await runSalarySweep();

    const status = getCronStatus().salarySweep;
    expect(status.lastError).toBe('database unreachable');
    expect(status.lastEventsCreated).toBe(0);
  });

  it('returns copies, not live state', async () => {
    const first = getCronStatus();
    first.absenceSweep.lastError = 'mutated by caller';
    expect(getCronStatus().absenceSweep.lastError).not.toBe(
      'mutated by caller',
    );
  });
});
