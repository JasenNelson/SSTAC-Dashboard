import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import {
  PaperContractError,
  paperFigureAssetSchema,
  paperFragmentSchema,
  paperManifestSchema,
  releaseDescriptorSchema,
  sha256Object,
  validatePaperBundle,
  validatePaperBundleCandidate,
  withComputedReceiptHash,
} from '../contracts';
import { createSyntheticPaperFixture } from '../synthetic-fixture';

function rebindManifest(bundle: ReturnType<typeof createSyntheticPaperFixture>) {
  bundle.descriptor.manifestSha256 = sha256Object(bundle.manifest);
}

function rebindCoverage(bundle: ReturnType<typeof createSyntheticPaperFixture>) {
  bundle.coverageReceipt.inventorySha256 = sha256Object(bundle.coverageReceipt.inventory);
  bundle.coverageReceipt.annotationSetSha256 = sha256Object(bundle.manifest.statusAnnotations);
  bundle.coverageReceipt.receiptSha256 = withComputedReceiptHash(bundle.coverageReceipt).receiptSha256;
  bundle.manifest.statusCoverageReceiptSha256 = bundle.coverageReceipt.receiptSha256;
  bundle.descriptor.statusCoverageReceiptSha256 = bundle.coverageReceipt.receiptSha256;
  rebindManifest(bundle);
}

describe('Matrix Options Paper contracts', () => {
  it('accepts the complete, hash-bound synthetic fixture', () => {
    const bundle = createSyntheticPaperFixture();
    const result = validatePaperBundle(bundle);
    expect(result.descriptor.promotionState).toBe('NOT_PROMOTABLE');
    expect(result.manifest.sections).toHaveLength(4);
    expect(bundle.coverageReceipt.inventory).toContainEqual(expect.objectContaining({
      stableSectionId: 'synthetic.framework.example',
      target: { kind: 'ENTITY', entityId: 'synthetic.calculator.demo' },
      disposition: 'VALIDATED_STATUS',
    }));
    const multiAnnotationRow = bundle.coverageReceipt.inventory.find(
      (item) => item.target.kind === 'BLOCK' && item.target.blockId === 'synthetic.framework.example.value',
    );
    expect(multiAnnotationRow).toMatchObject({
      disposition: 'VALIDATED_STATUS',
      annotationIds: [
        'synthetic.annotation.illustrative-value',
        'synthetic.annotation.illustrative-value-context',
      ],
    });
  });

  it('rejects a representation substituted from another version', () => {
    const bundle = createSyntheticPaperFixture();
    bundle.parityReceipt.representations[1].documentVersion = 'other-version';
    expect(() => validatePaperBundle(bundle)).toThrow('Mixed bundle identity');
  });

  it('rejects duplicate stable section IDs', () => {
    const bundle = createSyntheticPaperFixture();
    bundle.manifest.sections[1].stableSectionId = bundle.manifest.sections[0].stableSectionId;
    rebindManifest(bundle);
    expect(() => validatePaperBundle(bundle)).toThrow('Duplicate stable section ID');
  });

  it('rejects broken hierarchy', () => {
    const bundle = createSyntheticPaperFixture();
    bundle.manifest.sections[2].parentStableSectionId = 'missing.parent';
    rebindManifest(bundle);
    expect(() => validatePaperBundle(bundle)).toThrow('Invalid section hierarchy');
  });

  it('rejects a permuted sections array even when order values remain contiguous', () => {
    const bundle = createSyntheticPaperFixture();
    [bundle.manifest.sections[0], bundle.manifest.sections[1]] = [
      bundle.manifest.sections[1],
      bundle.manifest.sections[0],
    ];
    rebindManifest(bundle);
    expect(() => validatePaperBundle(bundle)).toThrow('canonical contiguous order');
  });

  it('rejects incomplete status coverage', () => {
    const bundle = createSyntheticPaperFixture();
    bundle.coverageReceipt.inventory.pop();
    bundle.coverageReceipt.totalTargets -= 1;
    bundle.coverageReceipt.validatedStatusCount -= 1;
    rebindCoverage(bundle);
    expect(() => validatePaperBundle(bundle)).toThrow('Coverage target reference set mismatch');
  });

  it('rejects missing and extra block-or-entity coverage targets', () => {
    const missing = createSyntheticPaperFixture();
    missing.coverageReceipt.inventory = missing.coverageReceipt.inventory.filter(
      (item) => item.target.kind !== 'ENTITY',
    );
    missing.coverageReceipt.totalTargets -= 1;
    missing.coverageReceipt.validatedStatusCount -= 1;
    rebindCoverage(missing);
    expect(() => validatePaperBundle(missing)).toThrow('Coverage target reference set mismatch');

    const extra = createSyntheticPaperFixture();
    const baseCoverage = extra.coverageReceipt.inventory.find((item) => item.disposition === 'NO_STATUS_REQUIRED')!;
    extra.coverageReceipt.inventory.push({
      ...baseCoverage,
      stableSectionId: 'synthetic.orientation',
      target: { kind: 'ENTITY', entityId: 'synthetic.unknown.entity' },
      disposition: 'NO_STATUS_REQUIRED',
    });
    extra.coverageReceipt.totalTargets += 1;
    extra.coverageReceipt.noStatusRequiredCount += 1;
    rebindCoverage(extra);
    expect(() => validatePaperBundle(extra)).toThrow('Coverage target reference set mismatch');
  });

  it('requires annotation arrays to match each coverage disposition', () => {
    const noStatusWithAnnotation = createSyntheticPaperFixture();
    const noStatus = noStatusWithAnnotation.coverageReceipt.inventory.find(
      (item) => item.disposition === 'NO_STATUS_REQUIRED',
    )!;
    (noStatus as unknown as { annotationIds: string[] }).annotationIds = [noStatusWithAnnotation.manifest.statusAnnotations[0].annotationId];
    expect(() => validatePaperBundle(noStatusWithAnnotation)).toThrow(ZodError);

    const validatedWithoutAnnotation = createSyntheticPaperFixture();
    const validated = validatedWithoutAnnotation.coverageReceipt.inventory.find(
      (item) => item.disposition === 'VALIDATED_STATUS',
    )!;
    if (validated.disposition !== 'VALIDATED_STATUS') throw new Error('Fixture changed unexpectedly');
    validated.annotationIds = [];
    expect(() => validatePaperBundle(validatedWithoutAnnotation)).toThrow(ZodError);
  });

  it('rejects duplicate, unknown, and cross-target annotation references', () => {
    const duplicate = createSyntheticPaperFixture();
    const duplicateRow = duplicate.coverageReceipt.inventory.find((item) => item.disposition === 'VALIDATED_STATUS')!;
    if (duplicateRow.disposition !== 'VALIDATED_STATUS') throw new Error('Fixture changed unexpectedly');
    duplicateRow.annotationIds.push(duplicateRow.annotationIds[0]);
    expect(() => validatePaperBundle(duplicate)).toThrow('must be unique');

    const unknown = createSyntheticPaperFixture();
    const unknownRow = unknown.coverageReceipt.inventory.find((item) => item.disposition === 'VALIDATED_STATUS')!;
    if (unknownRow.disposition !== 'VALIDATED_STATUS') throw new Error('Fixture changed unexpectedly');
    unknownRow.annotationIds[0] = 'synthetic.annotation.unknown';
    rebindCoverage(unknown);
    expect(() => validatePaperBundle(unknown)).toThrow('unknown annotation');

    const crossTarget = createSyntheticPaperFixture();
    const rows = crossTarget.coverageReceipt.inventory.filter((item) => item.disposition === 'VALIDATED_STATUS');
    if (rows[0].disposition !== 'VALIDATED_STATUS' || rows[1].disposition !== 'VALIDATED_STATUS') throw new Error('Fixture changed unexpectedly');
    rows[1].annotationIds.push(rows[0].annotationIds[0]);
    rebindCoverage(crossTarget);
    expect(() => validatePaperBundle(crossTarget)).toThrow('does not match its status annotation target');
  });

  it('structurally represents reconciled rejected coverage but blocks serving', async () => {
    const bundle = createSyntheticPaperFixture();
    const index = bundle.coverageReceipt.inventory.findIndex((item) => item.disposition === 'NO_STATUS_REQUIRED');
    const original = bundle.coverageReceipt.inventory[index];
    bundle.coverageReceipt.inventory[index] = {
      stableSectionId: original.stableSectionId,
      target: original.target,
      designatedHighRisk: original.designatedHighRisk,
      disposition: 'REJECTED_PENDING_RESOLUTION',
      reviewer: original.reviewer,
      reviewerRole: original.reviewerRole,
      rationale: 'Synthetic unresolved candidate used only to prove the fail-closed gate.',
      validatedAt: original.validatedAt,
    };
    bundle.coverageReceipt.noStatusRequiredCount -= 1;
    bundle.coverageReceipt.rejectedPendingResolutionCount = 1;
    rebindCoverage(bundle);
    expect(validatePaperBundleCandidate(bundle).manifest.documentId).toBe(bundle.manifest.documentId);
    expect(() => validatePaperBundle(bundle)).toThrow('cannot be served');

    bundle.coverageReceipt.rejectedPendingResolutionCount = 0;
    rebindCoverage(bundle);
    expect(() => validatePaperBundleCandidate(bundle)).toThrow('totals do not reconcile');
  });

  it('rejects rejected-coverage hash and total mismatches', () => {
    const hashMismatch = createSyntheticPaperFixture();
    hashMismatch.coverageReceipt.inventory[0].rationale = 'Changed without rebinding the inventory hash.';
    hashMismatch.coverageReceipt.receiptSha256 = withComputedReceiptHash(hashMismatch.coverageReceipt).receiptSha256;
    hashMismatch.manifest.statusCoverageReceiptSha256 = hashMismatch.coverageReceipt.receiptSha256;
    hashMismatch.descriptor.statusCoverageReceiptSha256 = hashMismatch.coverageReceipt.receiptSha256;
    rebindManifest(hashMismatch);
    expect(() => validatePaperBundleCandidate(hashMismatch)).toThrow('Coverage inventory hash mismatch');

    const totalMismatch = createSyntheticPaperFixture();
    totalMismatch.coverageReceipt.totalTargets += 1;
    rebindCoverage(totalMismatch);
    expect(() => validatePaperBundleCandidate(totalMismatch)).toThrow('Coverage receipt count is incomplete');
  });

  it('rejects cross-section annotation targets and missing reciprocal references', () => {
    const crossSection = createSyntheticPaperFixture();
    const annotationId = crossSection.manifest.statusAnnotations[0].annotationId;
    crossSection.manifest.statusAnnotations[0].stableSectionId = 'synthetic.framework';
    crossSection.manifest.sections[0].statusAnnotationIds = [];
    crossSection.manifest.sections[1].statusAnnotationIds.push(annotationId);
    rebindManifest(crossSection);
    expect(() => validatePaperBundle(crossSection)).toThrow('target is not present in its section');

    const missingReverse = createSyntheticPaperFixture();
    missingReverse.manifest.sections[0].statusAnnotationIds = [];
    rebindManifest(missingReverse);
    expect(() => validatePaperBundle(missingReverse)).toThrow('annotation reference set mismatch');
  });

  it('binds annotations to the bundle and legal-or-policy authority subtype', () => {
    const mixedBundle = createSyntheticPaperFixture();
    mixedBundle.manifest.statusAnnotations[0].bundleGenerationId = 'synthetic.other-generation';
    rebindManifest(mixedBundle);
    expect(() => validatePaperBundle(mixedBundle)).toThrow('Mixed bundle identity in status annotation');

    const wrongSubtype = createSyntheticPaperFixture();
    wrongSubtype.manifest.statusAnnotations[0].authorityKind = 'DRAFT_ANALYSIS';
    expect(() => validatePaperBundle(wrongSubtype)).toThrow('legal or policy authority subtype');
  });

  it('rejects dead, duplicate, and cross-section indexed references', () => {
    const deadFigure = createSyntheticPaperFixture();
    deadFigure.manifest.figures = [];
    rebindManifest(deadFigure);
    expect(() => validatePaperBundle(deadFigure)).toThrow('Figure index reference set mismatch');

    const crossSectionTable = createSyntheticPaperFixture();
    crossSectionTable.manifest.tables[0].stableSectionId = 'synthetic.orientation';
    rebindManifest(crossSectionTable);
    expect(() => validatePaperBundle(crossSectionTable)).toThrow('Table section ownership mismatch');

    const duplicateEquation = createSyntheticPaperFixture();
    duplicateEquation.manifest.equations.push({ ...duplicateEquation.manifest.equations[0] });
    rebindManifest(duplicateEquation);
    expect(() => validatePaperBundle(duplicateEquation)).toThrow('Duplicate equation ID');
  });

  it('rejects dead review-question and entity section references', () => {
    const question = createSyntheticPaperFixture();
    question.manifest.reviewQuestions[0].stableSectionIds = ['missing.section'];
    rebindManifest(question);
    expect(() => validatePaperBundle(question)).toThrow('review question reference set mismatch');

    const entity = createSyntheticPaperFixture();
    entity.manifest.entityLinks[0].stableSectionId = 'synthetic.orientation';
    rebindManifest(entity);
    expect(() => validatePaperBundle(entity)).toThrow('entity reference set mismatch');
  });

  it('rejects fragment hash drift', () => {
    const bundle = createSyntheticPaperFixture();
    const block = bundle.fragments[0].blocks[1];
    if (block.kind !== 'paragraph') throw new Error('Fixture changed unexpectedly');
    block.text = 'Mutated after publication.';
    expect(() => validatePaperBundle(bundle)).toThrow('Fragment hash mismatch');
  });

  it('rejects safe-shaped locators that point at the wrong indexed object', () => {
    const fragment = createSyntheticPaperFixture();
    fragment.manifest.sections[0].fragmentLocator = 'fixture://fragments/synthetic.framework.json';
    rebindManifest(fragment);
    expect(() => validatePaperBundle(fragment)).toThrow('Fragment locator binding mismatch');

    const figure = createSyntheticPaperFixture();
    figure.manifest.figures[0].assetLocator = 'fixture://figures/synthetic.other.json';
    rebindManifest(figure);
    expect(() => validatePaperBundle(figure)).toThrow('Figure locator binding mismatch');
  });

  it.each([
    'C:\\external\\paper\\receipt.json',
    '/absolute/paper/receipt.json',
    'fixture://receipts/../secret.json',
    'file:///external/paper/receipt.json',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
  ])('rejects unsafe or role-invalid locator %s', (locator) => {
    const bundle = createSyntheticPaperFixture();
    const badManifest = {
      ...bundle.manifest,
      parityReceiptLocator: locator,
    };
    expect(() => paperManifestSchema.parse(badManifest)).toThrow(ZodError);
  });

  it('rejects unknown status dimensions and mismatched entity target shapes', () => {
    const bundle = createSyntheticPaperFixture();
    const badStatus = structuredClone(bundle.manifest);
    badStatus.statusAnnotations[0].statusCode = 'APPROVED' as never;
    expect(() => paperManifestSchema.parse(badStatus)).toThrow(ZodError);

    const unsafeEntity = structuredClone(bundle.manifest) as unknown as Record<string, unknown>;
    (unsafeEntity.entityLinks as Array<Record<string, unknown>>)[0].target = {
      routeKind: 'URL',
      value: 'javascript:alert(1)',
    };
    expect(() => paperManifestSchema.parse(unsafeEntity)).toThrow(ZodError);
  });

  it.each(['C:paper.pdf', '..paper.pdf', 'folder/paper.pdf'])('rejects unsafe source filename %s', (sourceFilename) => {
    const bundle = createSyntheticPaperFixture();
    bundle.manifest.representations[0].sourceFilename = sourceFilename;
    expect(() => paperManifestSchema.parse(bundle.manifest)).toThrow(ZodError);
  });

  it('rejects raw markup fields and unsafe SVG path commands', () => {
    const bundle = createSyntheticPaperFixture();
    expect(() => paperFragmentSchema.parse({
      ...bundle.fragments[0],
      html: '<script>alert(1)</script>',
    })).toThrow(ZodError);

    expect(() => paperFigureAssetSchema.parse({
      ...bundle.figures[0],
      paths: [{ d: '<script>', className: 'primary' }],
    })).toThrow(ZodError);
  });

  it('accepts both strict prior-version mapping discriminants when lineage is coherent', () => {
    const first = createSyntheticPaperFixture();
    expect(validatePaperBundle(first).manifest.priorVersionMapping).toEqual({ state: 'NOT_APPLICABLE_FIRST_VERSION' });

    const available = createSyntheticPaperFixture();
    const mappingHash = 'a'.repeat(64);
    available.manifest.priorVersionMapping = {
      state: 'AVAILABLE',
      documentId: available.manifest.documentId,
      priorDocumentVersion: 'slice-1a-fixture-v0',
      locator: 'fixture://prior-version-mappings/slice-1a-fixture-v0.json',
      sha256: mappingHash,
    };
    available.descriptor.priorReleaseIdentity = {
      documentId: available.manifest.documentId,
      documentVersion: 'slice-1a-fixture-v0',
      priorVersionMappingSha256: mappingHash,
    };
    rebindManifest(available);
    expect(validatePaperBundleCandidate(available).manifest.priorVersionMapping.state).toBe('AVAILABLE');
  });

  it.each([
    '/absolute/mapping.json',
    'fixture://prior-version-mappings/../mapping.json',
    'file:///mapping.json',
    'javascript:alert(1)',
    'data:application/json,{}',
    'fixture://receipts/slice-1a-fixture-v0.json',
  ])('rejects unsafe or role-invalid prior-version locator %s', (locator) => {
    const bundle = createSyntheticPaperFixture();
    expect(() => paperManifestSchema.parse({
      ...bundle.manifest,
      priorVersionMapping: {
        state: 'AVAILABLE',
        documentId: bundle.manifest.documentId,
        priorDocumentVersion: 'slice-1a-fixture-v0',
        locator,
        sha256: 'a'.repeat(64),
      },
    })).toThrow(ZodError);
  });

  it('rejects strict, malformed, self, mismatched, and contradictory prior-version states', () => {
    const bundle = createSyntheticPaperFixture();
    expect(() => paperManifestSchema.parse({
      ...bundle.manifest,
      priorVersionMapping: { state: 'NOT_APPLICABLE_FIRST_VERSION', priorDocumentVersion: 'v0' },
    })).toThrow(ZodError);
    expect(() => paperManifestSchema.parse({
      ...bundle.manifest,
      priorVersionMapping: {
        state: 'AVAILABLE',
        documentId: bundle.manifest.documentId,
        priorDocumentVersion: 'slice-1a-fixture-v0',
        locator: 'fixture://prior-version-mappings/slice-1a-fixture-v0.json',
      },
    })).toThrow(ZodError);
    expect(() => paperManifestSchema.parse({
      ...bundle.manifest,
      priorVersionMapping: {
        state: 'AVAILABLE',
        documentId: bundle.manifest.documentId,
        priorDocumentVersion: 'slice-1a-fixture-v0',
        locator: 'fixture://prior-version-mappings/slice-1a-fixture-v0.json',
        sha256: 'short',
      },
    })).toThrow(ZodError);

    bundle.descriptor.priorReleaseIdentity = {
      documentId: bundle.manifest.documentId,
      documentVersion: 'slice-1a-fixture-v0',
      priorVersionMappingSha256: 'a'.repeat(64),
    };
    expect(() => validatePaperBundleCandidate(bundle)).toThrow('contradicts');

    const self = createSyntheticPaperFixture();
    self.manifest.priorVersionMapping = {
      state: 'AVAILABLE',
      documentId: self.manifest.documentId,
      priorDocumentVersion: self.manifest.documentVersion,
      locator: `fixture://prior-version-mappings/${self.manifest.documentVersion}.json`,
      sha256: 'b'.repeat(64),
    };
    self.descriptor.priorReleaseIdentity = {
      documentId: self.manifest.documentId,
      documentVersion: self.manifest.documentVersion,
      priorVersionMappingSha256: 'b'.repeat(64),
    };
    rebindManifest(self);
    expect(() => validatePaperBundleCandidate(self)).toThrow('current version');

    const mismatch = createSyntheticPaperFixture();
    mismatch.manifest.priorVersionMapping = {
      state: 'AVAILABLE',
      documentId: 'synthetic.other-document',
      priorDocumentVersion: 'slice-1a-fixture-v0',
      locator: 'fixture://prior-version-mappings/other-version.json',
      sha256: 'c'.repeat(64),
    };
    mismatch.descriptor.priorReleaseIdentity = {
      documentId: mismatch.manifest.documentId,
      documentVersion: 'slice-1a-fixture-v0',
      priorVersionMappingSha256: 'c'.repeat(64),
    };
    rebindManifest(mismatch);
    expect(() => validatePaperBundleCandidate(mismatch)).toThrow('does not match');

    const locatorMismatch = createSyntheticPaperFixture();
    locatorMismatch.manifest.priorVersionMapping = {
      state: 'AVAILABLE',
      documentId: locatorMismatch.manifest.documentId,
      priorDocumentVersion: 'slice-1a-fixture-v0',
      locator: 'fixture://prior-version-mappings/other-version.json',
      sha256: 'd'.repeat(64),
    };
    locatorMismatch.descriptor.priorReleaseIdentity = {
      documentId: locatorMismatch.manifest.documentId,
      documentVersion: 'slice-1a-fixture-v0',
      priorVersionMappingSha256: 'd'.repeat(64),
    };
    rebindManifest(locatorMismatch);
    expect(() => validatePaperBundleCandidate(locatorMismatch)).toThrow('locator/version binding mismatch');
  });

  it('cannot represent a synthetic fixture as approved or promotable', () => {
    const bundle = createSyntheticPaperFixture();
    expect(() => releaseDescriptorSchema.parse({
      ...bundle.descriptor,
      approvalState: 'APPROVED',
      promotionState: 'PROMOTED',
    })).toThrow(ZodError);
  });

  it('uses contract errors for semantic integrity failures', () => {
    const bundle = createSyntheticPaperFixture();
    bundle.descriptor.manifestSha256 = 'f'.repeat(64);
    expect(() => validatePaperBundle(bundle)).toThrow(PaperContractError);
  });
});
