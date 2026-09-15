import { describe, expect, it } from 'vitest';

import cohortContract from '../paper/contracts/cohorts-v1.json';
import { getCohortManifest, validateCohortManifest } from '../cohort-contract';

describe('cohort contract', () => {
  it('binds exactly five cohorts to all twelve source questions', () => {
    const manifest = getCohortManifest();
    expect(manifest.cohorts.map((cohort) => cohort.id)).toEqual([
      'categories', 'pathway-grid', 'exposure-assumptions', 'inputs-evidence', 'methods-water-type',
    ]);
    expect(manifest.cohorts.flatMap((cohort) => cohort.questionNumbers).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 12 }, (_, index) => index + 1),
    );
    expect(manifest.status).toBe('PROPOSED_PENDING_OWNER_QP_APPROVAL');
    expect(manifest.cohorts.map((cohort) => cohort.guideEvidenceRanges)).toEqual([
      [[181, 190]], [[191, 197]], [[198, 204]], [[205, 226]], [[212, 222]],
    ]);
  });

  it('fails closed for repeated or synthetic cohort identities', () => {
    const duplicate = { ...cohortContract, cohorts: [...cohortContract.cohorts, cohortContract.cohorts[0]] };
    expect(() => validateCohortManifest(duplicate)).toThrow(/cohort count/);
    expect(() => validateCohortManifest({ ...cohortContract, releaseIdentity: 'slice-1a-fixture-v1' })).toThrow(/release or status/);
  });
});
