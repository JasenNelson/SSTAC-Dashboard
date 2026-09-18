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
      [[181, 190]], [[191, 197]], [[198, 204]], [[205, 211], [222, 226]], [[212, 220]],
    ]);
  });

  it('fails closed for repeated or synthetic cohort identities', () => {
    const appended = { ...cohortContract, cohorts: [...cohortContract.cohorts, cohortContract.cohorts[0]] };
    expect(() => validateCohortManifest(appended)).toThrow(/cohort count/);
    // Same count (5), so validation reaches the duplicate-identity check.
    const duplicate = { ...cohortContract, cohorts: cohortContract.cohorts.map((cohort, index) => (index === 1 ? cohortContract.cohorts[0] : cohort)) };
    expect(() => validateCohortManifest(duplicate)).toThrow(/duplicate cohort categories/);
    expect(() => validateCohortManifest({ ...cohortContract, releaseIdentity: 'slice-1a-fixture-v1' })).toThrow(/release or status/);
  });

  const withCohort = (index: number, patch: Record<string, unknown>) => ({
    ...cohortContract,
    cohorts: cohortContract.cohorts.map((cohort, position) => (position === index ? { ...cohort, ...patch } : cohort)),
  });

  it('rejects blank, untrimmed, or non-string cohort names', () => {
    expect(() => validateCohortManifest(withCohort(0, { name: '' }))).toThrow(/name categories/);
    expect(() => validateCohortManifest(withCohort(0, { name: '   ' }))).toThrow(/name categories/);
    expect(() => validateCohortManifest(withCohort(0, { name: ' Categories' }))).toThrow(/name categories/);
    expect(() => validateCohortManifest(withCohort(0, { name: 7 }))).toThrow(/name categories/);
    expect(() => validateCohortManifest(withCohort(0, { name: undefined }))).toThrow(/name categories/);
  });

  it('rejects whitespace-only text fields and list entries', () => {
    expect(() => validateCohortManifest(withCohort(1, { purpose: '  \t ' }))).toThrow(/incomplete pathway-grid/);
    expect(() => validateCohortManifest(withCohort(1, { limitations: ' ' }))).toThrow(/incomplete pathway-grid/);
    expect(() => validateCohortManifest(withCohort(1, { packageContents: ['structural excerpt', '   '] }))).toThrow(/incomplete pathway-grid/);
    expect(() => validateCohortManifest(withCohort(1, { sourceLocators: ['Section 18.1', ''] }))).toThrow(/incomplete pathway-grid/);
    expect(() => validateCohortManifest(withCohort(1, { sourceLocators: [] }))).toThrow(/incomplete pathway-grid/);
  });

  it('rejects overlapping or inverted guide evidence ranges within a cohort', () => {
    expect(() => validateCohortManifest(withCohort(3, { guideEvidenceRanges: [[205, 215], [210, 226]] }))).toThrow(/overlapping guide evidence ranges inputs-evidence/);
    expect(() => validateCohortManifest(withCohort(3, { guideEvidenceRanges: [[205, 226], [205, 226]] }))).toThrow(/overlapping guide evidence ranges inputs-evidence/);
    expect(() => validateCohortManifest(withCohort(3, { guideEvidenceRanges: [[226, 205]] }))).toThrow(/guide evidence ranges inputs-evidence/);
    expect(() => validateCohortManifest(withCohort(3, { guideEvidenceRanges: [] }))).toThrow(/guide evidence ranges inputs-evidence/);
  });

  it("F-05: binds every Reviewer's Guide locator to exactly one guide evidence range", () => {
    expect(() => validateCohortManifest(withCohort(0, { sourceLocators: ['Section 4.1', "Reviewer's Guide lines 181-191"] }))).toThrow(/guide locator ranges categories/);
    expect(() => validateCohortManifest(withCohort(0, { sourceLocators: ['Section 4.1', 'Section 9.9'] }))).toThrow(/guide locator ranges categories/);
    expect(() => validateCohortManifest(withCohort(0, { sourceLocators: ['Section 4.1', "Reviewer's Guide lines 181-190", "Reviewer's Guide lines 181-190"] }))).toThrow(/guide locator ranges categories/);
    expect(() => validateCohortManifest(withCohort(0, { sourceLocators: ['Section 4.1', "Reviewer's Guide line 181"] }))).toThrow(/guide locator categories/);
    expect(() => validateCohortManifest(withCohort(0, { sourceLocators: ['Section 4.1', 'Reviewers Guide lines 181-190'] }))).toThrow(/guide locator categories/);
    expect(() => validateCohortManifest(withCohort(0, { sourceLocators: ["Reviewer's Guide lines 181-190", 'Section 9.9', 'Section 4.1'] }))).not.toThrow();
    expect(() => validateCohortManifest(withCohort(0, { sourceLocators: ['Section 4.1', "Reviewer's Guide lines 0181-190"] }))).not.toThrow();
  });

  it('still allows distinct cohorts to overlap each other (inputs-evidence and methods-water-type)', () => {
    expect(() => validateCohortManifest(cohortContract)).not.toThrow();
  });
});
