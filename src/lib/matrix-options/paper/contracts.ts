import { createHash } from 'node:crypto';
import { z } from 'zod';

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const stableIdSchema = z.string().regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/);
const fragmentLocatorSchema = z.string().regex(/^fixture:\/\/fragments\/[a-z0-9]+(?:[._-][a-z0-9]+)*\.json$/);
const receiptLocatorSchema = z.string().regex(/^fixture:\/\/receipts\/[a-z0-9]+(?:[._-][a-z0-9]+)*\.json$/);
const figureAssetLocatorSchema = z.string().regex(/^fixture:\/\/figures\/[a-z0-9]+(?:[._-][a-z0-9]+)*\.json$/);
const searchIndexLocatorSchema = z.string().regex(/^fixture:\/\/search\/[a-z0-9]+(?:[._-][a-z0-9]+)*\.json$/);
const statusSourceLocatorSchema = z.string().regex(/^fixture:\/\/sources\/[a-z0-9]+(?:[._-][a-z0-9]+)*\.json$/);
const bibliographyFixtureLocatorSchema = z.string().regex(/^fixture:\/\/bibliography\/[a-z0-9]+(?:[._-][a-z0-9]+)*\.json$/);
const canonicalPdfLocatorSchema = z.string().regex(/^fixture:\/\/pdf\/[a-z0-9]+(?:[._-][a-z0-9]+)*\.pdf$/);
const priorVersionMappingLocatorSchema = z.string().regex(/^fixture:\/\/prior-version-mappings\/[a-z0-9]+(?:[._-][a-z0-9]+)*\.json$/);
const sourceFilenameSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/).refine(
  (name) => name !== '.' && name !== '..' && !name.includes('..'),
  'Source filename must be a leaf filename without traversal.',
);
const safeHttpsUrlSchema = z.string().url().superRefine((value, context) => {
  const url = new URL(value);
  const rawPath = value.split(/[?#]/, 1)[0];
  if (url.protocol !== 'https:' || url.username || url.password || rawPath.split('/').includes('..')) {
    context.addIssue({ code: 'custom', message: 'Only credential-free HTTPS bibliography URLs without traversal are allowed.' });
  }
});

export const representationKindSchema = z.enum(['PDF', 'MARKDOWN', 'HTML']);
export const statusCodeSchema = z.enum([
  'IN_FORCE_LEGAL_OR_POLICY',
  'PROJECT_PLAN_DIRECTION',
  'OPEN_OPTION',
  'EMERGING_DRAFT_DIRECTION',
  'ILLUSTRATIVE_VALUE_OR_CALCULATION',
  'KNOWN_GAP_OR_UNVERIFIED',
  'FUTURE_TASK',
  'OUT_OF_PHASE2_SCOPE',
  'REVIEW_QUESTION',
]);
export const authorityKindSchema = z.enum([
  'STATUTE',
  'REGULATION',
  'ENV_PROTOCOL',
  'ENV_POLICY',
  'PROJECT_PLAN',
  'DRAFT_ANALYSIS',
  'NOT_APPLICABLE',
]);
export const decisionAuthoritySchema = z.enum([
  'ENV_LEGAL_DECISION_MAKER',
  'PHASE2_PROJECT_GOVERNANCE',
  'CONTENT_VALIDATOR_ONLY',
  'NOT_APPLICABLE',
]);
export const reviewerRoleSchema = z.enum([
  'ADVISORY_ERROR_GAP_SOURCE_INPUT',
  'TECHNICAL_VALIDATION',
  'CONTENT_STEWARDSHIP',
  'NOT_APPLICABLE',
]);

export const statusTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('BLOCK'), blockId: stableIdSchema }).strict(),
  z.object({ kind: z.literal('ENTITY'), entityId: stableIdSchema }).strict(),
]);

export const representationIdentitySchema = z.object({
  kind: representationKindSchema,
  documentId: stableIdSchema,
  documentVersion: z.string().min(1),
  bundleGenerationId: stableIdSchema,
  sourceFilename: sourceFilenameSchema,
  byteLength: z.number().int().nonnegative(),
  sha256: sha256Schema,
}).strict().superRefine((representation, context) => {
  const expectedExtension = {
    PDF: '.pdf',
    MARKDOWN: '.md',
    HTML: '.html',
  }[representation.kind];
  if (!representation.sourceFilename.toLowerCase().endsWith(expectedExtension)) {
    context.addIssue({ code: 'custom', message: `${representation.kind} source filename has the wrong extension.` });
  }
});

export const parityDifferenceSchema = z.object({
  code: z.string().min(1),
  disposition: z.enum(['ALLOWLISTED', 'REJECTED', 'RESOLVED']),
  detail: z.string().min(1),
}).strict();

export const parityReceiptSchema = z.object({
  schemaVersion: z.literal('matrix-paper-parity-v1'),
  documentId: stableIdSchema,
  documentVersion: z.string().min(1),
  bundleGenerationId: stableIdSchema,
  algorithmVersion: z.literal('synthetic-parity-v1'),
  representations: z.array(representationIdentitySchema).length(3),
  differences: z.array(parityDifferenceSchema),
  result: z.literal('VERIFIED'),
  reviewedBy: z.literal('SYNTHETIC_FIXTURE_VALIDATOR'),
  receiptSha256: sha256Schema,
}).strict();

export const statusAnnotationSchema = z.object({
  annotationId: stableIdSchema,
  documentId: stableIdSchema,
  documentVersion: z.string().min(1),
  bundleGenerationId: stableIdSchema,
  stableSectionId: stableIdSchema,
  target: statusTargetSchema,
  statusCode: statusCodeSchema,
  authorityKind: authorityKindSchema,
  decisionAuthority: decisionAuthoritySchema,
  reviewerRole: reviewerRoleSchema,
  rationale: z.string().min(1),
  sourceLocator: statusSourceLocatorSchema.optional(),
  validatedBy: z.literal('SYNTHETIC_FIXTURE_VALIDATOR'),
  validatedAt: z.string().datetime(),
  validationState: z.literal('VALIDATED'),
}).strict().superRefine((annotation, context) => {
  if (
    annotation.statusCode === 'IN_FORCE_LEGAL_OR_POLICY' &&
    (!annotation.sourceLocator || !['STATUTE', 'REGULATION', 'ENV_PROTOCOL', 'ENV_POLICY'].includes(annotation.authorityKind))
  ) {
    context.addIssue({
      code: 'custom',
      message: 'In-force annotations require a source locator and legal or policy authority subtype.',
    });
  }
  if (
    annotation.statusCode === 'REVIEW_QUESTION' &&
    annotation.decisionAuthority === 'NOT_APPLICABLE'
  ) {
    context.addIssue({
      code: 'custom',
      message: 'Review questions require an explicit decision authority.',
    });
  }
});

const coverageItemBase = {
  stableSectionId: stableIdSchema,
  target: statusTargetSchema,
  designatedHighRisk: z.boolean(),
  reviewer: z.literal('SYNTHETIC_FIXTURE_VALIDATOR'),
  reviewerRole: reviewerRoleSchema,
  rationale: z.string().min(1),
  validatedAt: z.string().datetime(),
};

export const coverageItemSchema = z.discriminatedUnion('disposition', [
  z.object({
    ...coverageItemBase,
    disposition: z.literal('VALIDATED_STATUS'),
    annotationIds: z.array(stableIdSchema).min(1),
  }).strict().superRefine((item, context) => {
    if (new Set(item.annotationIds).size !== item.annotationIds.length) {
      context.addIssue({ code: 'custom', message: 'Validated status coverage annotation IDs must be unique.' });
    }
  }),
  z.object({
    ...coverageItemBase,
    disposition: z.literal('NO_STATUS_REQUIRED'),
  }).strict(),
  z.object({
    ...coverageItemBase,
    disposition: z.literal('REJECTED_PENDING_RESOLUTION'),
  }).strict(),
]);

export const statusCoverageReceiptSchema = z.object({
  schemaVersion: z.literal('matrix-paper-status-coverage-v1'),
  documentId: stableIdSchema,
  documentVersion: z.string().min(1),
  bundleGenerationId: stableIdSchema,
  inventory: z.array(coverageItemSchema).min(1),
  totalTargets: z.number().int().positive(),
  designatedHighRiskCount: z.number().int().nonnegative(),
  validatedStatusCount: z.number().int().nonnegative(),
  noStatusRequiredCount: z.number().int().nonnegative(),
  rejectedPendingResolutionCount: z.number().int().nonnegative(),
  validatorRoles: z.array(reviewerRoleSchema).min(1),
  inventorySha256: sha256Schema,
  annotationSetSha256: sha256Schema,
  completeness: z.literal('COMPLETE'),
  receiptSha256: sha256Schema,
}).strict();

const sectionBaseSchema = z.object({
  stableSectionId: stableIdSchema,
  parentStableSectionId: stableIdSchema.nullable(),
  number: z.string().min(1),
  title: z.string().min(1),
  order: z.number().int().nonnegative(),
  depth: z.number().int().min(1).max(5),
  sourceRange: z.object({ startLine: z.number().int().positive(), endLine: z.number().int().positive() }).strict(),
  pdfPage: z.number().int().positive().nullable(),
  fragmentLocator: fragmentLocatorSchema,
  fragmentSha256: sha256Schema,
  blockIds: z.array(stableIdSchema).min(1),
  statusAnnotationIds: z.array(stableIdSchema),
  reviewQuestionIds: z.array(stableIdSchema),
  entityIds: z.array(stableIdSchema),
}).strict();

export const canonicalPdfInterfaceSchema = z.discriminatedUnion('availability', [
  z.object({
    availability: z.literal('AVAILABLE'),
    locator: z.union([canonicalPdfLocatorSchema, safeHttpsUrlSchema]),
    sha256: sha256Schema,
    byteLength: z.number().int().positive(),
    label: z.string().min(1),
  }).strict(),
  z.object({
    availability: z.literal('UNAVAILABLE_SYNTHETIC_FIXTURE'),
    locator: z.null(),
    sha256: z.null(),
    byteLength: z.literal(0),
    label: z.string().min(1),
  }).strict(),
]);

export const figureIndexEntrySchema = z.object({
  figureId: stableIdSchema,
  stableSectionId: stableIdSchema,
  caption: z.string().min(1),
  alternativeDescription: z.string().min(1),
  assetLocator: figureAssetLocatorSchema,
  assetSha256: sha256Schema,
}).strict();

export const priorVersionMappingSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('NOT_APPLICABLE_FIRST_VERSION') }).strict(),
  z.object({
    state: z.literal('AVAILABLE'),
    documentId: stableIdSchema,
    priorDocumentVersion: stableIdSchema,
    locator: priorVersionMappingLocatorSchema,
    sha256: sha256Schema,
  }).strict(),
]);

export const paperManifestSchema = z.object({
  schemaVersion: z.literal('matrix-options-paper-manifest-v1'),
  documentId: stableIdSchema,
  documentVersion: z.string().min(1),
  bundleGenerationId: stableIdSchema,
  publicationState: z.literal('SYNTHETIC_ROUGH_DRAFT'),
  title: z.string().min(1),
  authorityBannerText: z.string().min(1),
  representations: z.array(representationIdentitySchema).length(3),
  parityReceiptLocator: receiptLocatorSchema,
  parityReceiptSha256: sha256Schema,
  statusCoverageReceiptLocator: receiptLocatorSchema,
  statusCoverageReceiptSha256: sha256Schema,
  sections: z.array(sectionBaseSchema).min(1),
  statusAnnotations: z.array(statusAnnotationSchema),
  figures: z.array(figureIndexEntrySchema),
  tables: z.array(z.object({ tableId: stableIdSchema, stableSectionId: stableIdSchema, title: z.string() }).strict()),
  equations: z.array(z.object({ equationId: stableIdSchema, stableSectionId: stableIdSchema, label: z.string() }).strict()),
  bibliography: z.array(z.object({
    citationId: stableIdSchema,
    label: z.string().min(1),
    locator: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('FIXTURE'), value: bibliographyFixtureLocatorSchema }).strict(),
      z.object({ kind: z.literal('HTTPS'), value: safeHttpsUrlSchema }).strict(),
    ]),
  }).strict()),
  reviewQuestions: z.array(z.object({ questionId: stableIdSchema, stableSectionIds: z.array(stableIdSchema).min(1), prompt: z.string() }).strict()),
  entityLinks: z.array(z.discriminatedUnion('kind', [
    z.object({
      entityId: stableIdSchema,
      stableSectionId: stableIdSchema,
      kind: z.literal('CALCULATOR'),
      target: z.object({ routeKind: z.literal('MATRIX_OPTIONS_VIEW'), viewId: z.literal('Calculator') }).strict(),
    }).strict(),
    z.object({
      entityId: stableIdSchema,
      stableSectionId: stableIdSchema,
      kind: z.literal('CATALOGUE'),
      target: z.object({ routeKind: z.literal('MATRIX_OPTIONS_VIEW'), viewId: z.literal('References & Values') }).strict(),
    }).strict(),
  ])),
  searchIndex: z.object({ locator: searchIndexLocatorSchema, sha256: sha256Schema, state: z.literal('CONTRACT_ONLY') }).strict(),
  canonicalPdf: canonicalPdfInterfaceSchema,
  priorVersionMapping: priorVersionMappingSchema,
  generatedAt: z.string().datetime(),
  publisherVersion: z.literal('slice1a-synthetic-publisher-v1'),
  candidateIdentity: z.literal('SYNTHETIC_FIXTURE_ONLY'),
  approver: z.null(),
  promotionState: z.literal('NOT_PROMOTABLE'),
}).strict();

export const releaseDescriptorSchema = z.object({
  schemaVersion: z.literal('matrix-options-paper-release-descriptor-v1'),
  environment: z.literal('TEST_ONLY'),
  documentId: stableIdSchema,
  documentVersion: z.string().min(1),
  bundleGenerationId: stableIdSchema,
  manifestSha256: sha256Schema,
  parityReceiptSha256: sha256Schema,
  statusCoverageReceiptSha256: sha256Schema,
  transportProviderIdentity: z.literal('IN_PROCESS_SYNTHETIC_PROVIDER'),
  candidateState: z.literal('SYNTHETIC_FIXTURE'),
  approvalState: z.literal('NOT_APPROVED'),
  promotionState: z.literal('NOT_PROMOTABLE'),
  trustedConfiguration: z.literal('SLICE_1A_TEST_FIXTURE'),
  priorReleaseIdentity: z.union([
    z.null(),
    z.object({
      documentId: stableIdSchema,
      documentVersion: stableIdSchema,
      priorVersionMappingSha256: sha256Schema,
    }).strict(),
  ]),
}).strict();

const textBlockSchema = z.object({
  kind: z.literal('paragraph'),
  blockId: stableIdSchema,
  text: z.string().min(1),
}).strict();
const headingBlockSchema = z.object({
  kind: z.literal('heading'),
  blockId: stableIdSchema,
  level: z.number().int().min(2).max(5),
  text: z.string().min(1),
}).strict();
const listBlockSchema = z.object({
  kind: z.literal('list'),
  blockId: stableIdSchema,
  items: z.array(z.string().min(1)).min(1),
}).strict();
const calloutBlockSchema = z.object({
  kind: z.literal('callout'),
  blockId: stableIdSchema,
  label: z.string().min(1),
  text: z.string().min(1),
}).strict();
const figureBlockSchema = z.object({
  kind: z.literal('figure'),
  blockId: stableIdSchema,
  figureId: stableIdSchema,
}).strict();
const equationBlockSchema = z.object({
  kind: z.literal('equation'),
  blockId: stableIdSchema,
  equationId: stableIdSchema,
  label: z.string().min(1),
  expression: z.string().min(1),
}).strict();
const tableBlockSchema = z.object({
  kind: z.literal('table'),
  blockId: stableIdSchema,
  tableId: stableIdSchema,
  caption: z.string().min(1),
  columns: z.array(z.string().min(1)).min(1),
  rows: z.array(z.array(z.string())).min(1),
}).strict().superRefine((table, context) => {
  if (table.rows.some((row) => row.length !== table.columns.length)) {
    context.addIssue({ code: 'custom', message: 'Every table row must match the column count.' });
  }
});

export const paperBlockSchema = z.discriminatedUnion('kind', [
  textBlockSchema,
  headingBlockSchema,
  listBlockSchema,
  calloutBlockSchema,
  figureBlockSchema,
  equationBlockSchema,
  tableBlockSchema,
]);

export const paperFragmentSchema = z.object({
  schemaVersion: z.literal('matrix-options-paper-fragment-v1'),
  documentId: stableIdSchema,
  documentVersion: z.string().min(1),
  bundleGenerationId: stableIdSchema,
  stableSectionId: stableIdSchema,
  contentFormat: z.literal('SAFE_STRUCTURED_BLOCKS_V1'),
  blocks: z.array(paperBlockSchema).min(1),
}).strict();

export const paperFigureAssetSchema = z.object({
  schemaVersion: z.literal('matrix-options-paper-figure-v1'),
  documentId: stableIdSchema,
  documentVersion: z.string().min(1),
  bundleGenerationId: stableIdSchema,
  figureId: stableIdSchema,
  viewBox: z.string().regex(/^\d+(?:\.\d+)? \d+(?:\.\d+)? \d+(?:\.\d+)? \d+(?:\.\d+)?$/),
  paths: z.array(z.object({ d: z.string().regex(/^[MmLlHhVvCcSsQqTtAaZz0-9., +\-]+$/), className: z.enum(['primary', 'secondary', 'accent']) }).strict()).min(1),
}).strict();

export type PaperManifest = z.infer<typeof paperManifestSchema>;
export type PaperSection = z.infer<typeof sectionBaseSchema>;
export type PaperFragment = z.infer<typeof paperFragmentSchema>;
export type PaperFigureAsset = z.infer<typeof paperFigureAssetSchema>;
export type PaperParityReceipt = z.infer<typeof parityReceiptSchema>;
export type PaperStatusCoverageReceipt = z.infer<typeof statusCoverageReceiptSchema>;
export type PaperReleaseDescriptor = z.infer<typeof releaseDescriptorSchema>;
export type PaperStatusAnnotation = z.infer<typeof statusAnnotationSchema>;

export interface VerifiedPaperRelease {
  descriptor: PaperReleaseDescriptor;
  manifest: PaperManifest;
}

export interface PaperContentProvider {
  getVerifiedRelease(documentVersion: string): Promise<VerifiedPaperRelease>;
  getFragment(documentVersion: string, stableSectionId: string): Promise<PaperFragment>;
  getFigure(documentVersion: string, figureId: string): Promise<PaperFigureAsset>;
}

export class PaperContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaperContractError';
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function sha256Text(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function sha256Object(value: unknown): string {
  return sha256Text(canonicalJson(value));
}

export function withComputedReceiptHash<T extends { receiptSha256: string }>(receipt: T): T {
  const { receiptSha256: _ignored, ...withoutHash } = receipt;
  return { ...receipt, receiptSha256: sha256Object(withoutHash) } as T;
}

function assertUnique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw new PaperContractError(`Duplicate ${label}.`);
  }
}

function assertExactSet(actual: readonly string[], expected: readonly string[], label: string): void {
  assertUnique(actual, `${label} reference`);
  const actualSorted = [...actual].sort();
  const expectedSorted = [...expected].sort();
  if (canonicalJson(actualSorted) !== canonicalJson(expectedSorted)) {
    throw new PaperContractError(`${label} reference set mismatch.`);
  }
}

type StatusTarget = z.infer<typeof statusTargetSchema>;

function statusTargetKey(target: StatusTarget): string {
  return target.kind === 'BLOCK' ? `BLOCK:${target.blockId}` : `ENTITY:${target.entityId}`;
}

function assertIdentity(
  item: { documentId: string; documentVersion: string; bundleGenerationId: string },
  expected: { documentId: string; documentVersion: string; bundleGenerationId: string },
  label: string,
): void {
  if (
    item.documentId !== expected.documentId ||
    item.documentVersion !== expected.documentVersion ||
    item.bundleGenerationId !== expected.bundleGenerationId
  ) {
    throw new PaperContractError(`Mixed bundle identity in ${label}.`);
  }
}

export interface PaperBundleCandidate {
  descriptor: unknown;
  manifest: unknown;
  parityReceipt: unknown;
  coverageReceipt: unknown;
  fragments: readonly unknown[];
  figures: readonly unknown[];
}

export function validatePaperBundleCandidate(input: PaperBundleCandidate): VerifiedPaperRelease {
  const descriptor = releaseDescriptorSchema.parse(input.descriptor);
  const manifest = paperManifestSchema.parse(input.manifest);
  const parityReceipt = parityReceiptSchema.parse(input.parityReceipt);
  const coverageReceipt = statusCoverageReceiptSchema.parse(input.coverageReceipt);
  const fragments = input.fragments.map((fragment) => paperFragmentSchema.parse(fragment));
  const figures = input.figures.map((figure) => paperFigureAssetSchema.parse(figure));
  const identity = descriptor;

  assertIdentity(manifest, identity, 'manifest');
  assertIdentity(parityReceipt, identity, 'parity receipt');
  assertIdentity(coverageReceipt, identity, 'coverage receipt');
  manifest.representations.forEach((representation) => assertIdentity(representation, identity, 'manifest representation'));
  parityReceipt.representations.forEach((representation) => assertIdentity(representation, identity, 'parity representation'));
  fragments.forEach((fragment) => assertIdentity(fragment, identity, 'fragment'));
  figures.forEach((figure) => assertIdentity(figure, identity, 'figure'));

  const kinds = manifest.representations.map((representation) => representation.kind);
  assertUnique(kinds, 'representation kind');
  if (!['PDF', 'MARKDOWN', 'HTML'].every((kind) => kinds.includes(kind as typeof kinds[number]))) {
    throw new PaperContractError('All three representation identities are required.');
  }
  if (canonicalJson(manifest.representations) !== canonicalJson(parityReceipt.representations)) {
    throw new PaperContractError('Parity identities do not match the manifest.');
  }
  if (parityReceipt.differences.some((difference) => difference.disposition === 'REJECTED')) {
    throw new PaperContractError('Parity receipt contains a rejected difference.');
  }

  const expectedParityHash = sha256Object({ ...parityReceipt, receiptSha256: undefined });
  const expectedCoverageHash = sha256Object({ ...coverageReceipt, receiptSha256: undefined });
  if (parityReceipt.receiptSha256 !== expectedParityHash) throw new PaperContractError('Parity receipt hash mismatch.');
  if (coverageReceipt.receiptSha256 !== expectedCoverageHash) throw new PaperContractError('Coverage receipt hash mismatch.');
  if (manifest.parityReceiptSha256 !== parityReceipt.receiptSha256 || descriptor.parityReceiptSha256 !== parityReceipt.receiptSha256) {
    throw new PaperContractError('Parity receipt binding mismatch.');
  }
  if (manifest.statusCoverageReceiptSha256 !== coverageReceipt.receiptSha256 || descriptor.statusCoverageReceiptSha256 !== coverageReceipt.receiptSha256) {
    throw new PaperContractError('Coverage receipt binding mismatch.');
  }
  if (
    manifest.parityReceiptLocator !== 'fixture://receipts/parity.json' ||
    manifest.statusCoverageReceiptLocator !== 'fixture://receipts/status-coverage.json'
  ) {
    throw new PaperContractError('Receipt locator binding mismatch.');
  }

  const manifestHash = sha256Object(manifest);
  if (descriptor.manifestSha256 !== manifestHash) throw new PaperContractError('Manifest hash mismatch.');

  if (manifest.priorVersionMapping.state === 'NOT_APPLICABLE_FIRST_VERSION') {
    if (descriptor.priorReleaseIdentity !== null) {
      throw new PaperContractError('First-version mapping contradicts the release descriptor lineage.');
    }
  } else {
    const prior = descriptor.priorReleaseIdentity;
    if (
      !prior ||
      manifest.priorVersionMapping.documentId !== manifest.documentId ||
      prior.documentId !== manifest.documentId ||
      prior.documentVersion !== manifest.priorVersionMapping.priorDocumentVersion ||
      prior.priorVersionMappingSha256 !== manifest.priorVersionMapping.sha256
    ) {
      throw new PaperContractError('Prior-version mapping does not match the release descriptor lineage.');
    }
    if (manifest.priorVersionMapping.priorDocumentVersion === manifest.documentVersion) {
      throw new PaperContractError('Prior-version mapping cannot point to the current version.');
    }
    if (
      manifest.priorVersionMapping.locator !==
      `fixture://prior-version-mappings/${manifest.priorVersionMapping.priorDocumentVersion}.json`
    ) {
      throw new PaperContractError('Prior-version mapping locator/version binding mismatch.');
    }
  }

  assertUnique(parityReceipt.differences.map((difference) => difference.code), 'parity difference code');
  assertUnique(manifest.sections.map((section) => section.stableSectionId), 'stable section ID');
  assertUnique(manifest.sections.flatMap((section) => section.blockIds), 'block ID');
  assertUnique(manifest.statusAnnotations.map((annotation) => annotation.annotationId), 'annotation ID');
  assertUnique(manifest.figures.map((figure) => figure.figureId), 'figure ID');
  assertUnique(manifest.tables.map((table) => table.tableId), 'table ID');
  assertUnique(manifest.equations.map((equation) => equation.equationId), 'equation ID');
  assertUnique(manifest.bibliography.map((citation) => citation.citationId), 'citation ID');
  assertUnique(manifest.reviewQuestions.map((question) => question.questionId), 'review question ID');
  assertUnique(manifest.entityLinks.map((entity) => entity.entityId), 'entity ID');
  assertUnique(fragments.map((fragment) => fragment.stableSectionId), 'fragment section ID');
  assertUnique(figures.map((figure) => figure.figureId), 'figure asset ID');

  const sectionById = new Map(manifest.sections.map((section) => [section.stableSectionId, section]));
  manifest.sections.forEach((section, index) => {
    if (section.order !== index) {
      throw new PaperContractError('Manifest sections must be in canonical contiguous order.');
    }
    if (section.sourceRange.endLine < section.sourceRange.startLine) throw new PaperContractError('Invalid section source range.');
    assertUnique(section.blockIds, `block ID in section ${section.stableSectionId}`);
    assertUnique(section.statusAnnotationIds, `annotation ID in section ${section.stableSectionId}`);
    assertUnique(section.reviewQuestionIds, `review question ID in section ${section.stableSectionId}`);
    assertUnique(section.entityIds, `entity ID in section ${section.stableSectionId}`);
    if (section.parentStableSectionId === null) {
      if (section.depth !== 1) throw new PaperContractError('Root sections must have depth 1.');
      return;
    }
    const parent = sectionById.get(section.parentStableSectionId);
    if (!parent || parent.order >= section.order || section.depth !== parent.depth + 1) {
      throw new PaperContractError('Invalid section hierarchy.');
    }
  });

  if (fragments.length !== manifest.sections.length) throw new PaperContractError('Every section needs exactly one fragment.');
  const fragmentBySection = new Map(fragments.map((fragment) => [fragment.stableSectionId, fragment]));
  manifest.sections.forEach((section) => {
    const fragment = fragmentBySection.get(section.stableSectionId);
    if (!fragment) throw new PaperContractError(`Missing fragment for ${section.stableSectionId}.`);
    if (section.fragmentLocator !== `fixture://fragments/${section.stableSectionId}.json`) {
      throw new PaperContractError(`Fragment locator binding mismatch for ${section.stableSectionId}.`);
    }
    if (sha256Object(fragment) !== section.fragmentSha256) throw new PaperContractError(`Fragment hash mismatch for ${section.stableSectionId}.`);
    const fragmentBlockIds = fragment.blocks.map((block) => block.blockId);
    if (canonicalJson(fragmentBlockIds) !== canonicalJson(section.blockIds)) {
      throw new PaperContractError(`Fragment block inventory mismatch for ${section.stableSectionId}.`);
    }
  });

  const allBlockIds = manifest.sections.flatMap((section) => section.blockIds);
  const blockSectionById = new Map(
    manifest.sections.flatMap((section) => section.blockIds.map((blockId) => [blockId, section.stableSectionId] as const)),
  );
  const entitySectionById = new Map(
    manifest.entityLinks.map((entity) => [entity.entityId, entity.stableSectionId] as const),
  );
  const targetSectionId = (target: StatusTarget): string | undefined => (
    target.kind === 'BLOCK' ? blockSectionById.get(target.blockId) : entitySectionById.get(target.entityId)
  );

  manifest.sections.forEach((section) => {
    assertExactSet(
      section.statusAnnotationIds,
      manifest.statusAnnotations
        .filter((annotation) => annotation.stableSectionId === section.stableSectionId)
        .map((annotation) => annotation.annotationId),
      `Section ${section.stableSectionId} annotation`,
    );
    assertExactSet(
      section.reviewQuestionIds,
      manifest.reviewQuestions
        .filter((question) => question.stableSectionIds.includes(section.stableSectionId))
        .map((question) => question.questionId),
      `Section ${section.stableSectionId} review question`,
    );
    assertExactSet(
      section.entityIds,
      manifest.entityLinks
        .filter((entity) => entity.stableSectionId === section.stableSectionId)
        .map((entity) => entity.entityId),
      `Section ${section.stableSectionId} entity`,
    );
  });

  manifest.reviewQuestions.forEach((question) => {
    assertUnique(question.stableSectionIds, `section ID for review question ${question.questionId}`);
    question.stableSectionIds.forEach((stableSectionId) => {
      if (!sectionById.has(stableSectionId)) {
        throw new PaperContractError(`Unknown section reference in review question ${question.questionId}.`);
      }
    });
  });
  manifest.entityLinks.forEach((entity) => {
    if (!sectionById.has(entity.stableSectionId)) {
      throw new PaperContractError(`Unknown section reference in entity ${entity.entityId}.`);
    }
  });

  manifest.statusAnnotations.forEach((annotation) => {
    assertIdentity(annotation, identity, 'status annotation');
    if (targetSectionId(annotation.target) !== annotation.stableSectionId) {
      throw new PaperContractError('Status annotation target is not present in its section.');
    }
  });

  const requiredTargetKeys = [
    ...allBlockIds.map((blockId) => `BLOCK:${blockId}`),
    ...manifest.entityLinks.map((entity) => `ENTITY:${entity.entityId}`),
  ];
  const coverageTargetKeys = coverageReceipt.inventory.map((item) => statusTargetKey(item.target));
  assertExactSet(coverageTargetKeys, requiredTargetKeys, 'Coverage target');
  if (coverageReceipt.totalTargets !== requiredTargetKeys.length || coverageReceipt.inventory.length !== requiredTargetKeys.length) {
    throw new PaperContractError('Coverage receipt count is incomplete.');
  }
  const highRiskCount = coverageReceipt.inventory.filter((item) => item.designatedHighRisk).length;
  const validatedCount = coverageReceipt.inventory.filter((item) => item.disposition === 'VALIDATED_STATUS').length;
  const noStatusCount = coverageReceipt.inventory.filter((item) => item.disposition === 'NO_STATUS_REQUIRED').length;
  const rejectedCount = coverageReceipt.inventory.filter((item) => item.disposition === 'REJECTED_PENDING_RESOLUTION').length;
  if (
    coverageReceipt.designatedHighRiskCount !== highRiskCount ||
    coverageReceipt.validatedStatusCount !== validatedCount ||
    coverageReceipt.noStatusRequiredCount !== noStatusCount ||
    coverageReceipt.rejectedPendingResolutionCount !== rejectedCount ||
    validatedCount + noStatusCount + rejectedCount !== requiredTargetKeys.length
  ) {
    throw new PaperContractError('Coverage receipt totals do not reconcile.');
  }
  const annotationById = new Map(
    manifest.statusAnnotations.map((annotation) => [annotation.annotationId, annotation] as const),
  );
  coverageReceipt.inventory.forEach((item) => {
    if (targetSectionId(item.target) !== item.stableSectionId) {
      throw new PaperContractError('Coverage target is not present in its section.');
    }
    if (item.disposition === 'VALIDATED_STATUS') {
      item.annotationIds.forEach((annotationId) => {
        const annotation = annotationById.get(annotationId);
        if (!annotation) throw new PaperContractError('Coverage receipt references an unknown annotation.');
        if (
          annotation.stableSectionId !== item.stableSectionId ||
          statusTargetKey(annotation.target) !== statusTargetKey(item.target)
        ) {
          throw new PaperContractError('Coverage target does not match its status annotation target.');
        }
      });
    }
  });
  assertExactSet(
    coverageReceipt.inventory.flatMap((item) => item.disposition === 'VALIDATED_STATUS' ? item.annotationIds : []),
    manifest.statusAnnotations.map((annotation) => annotation.annotationId),
    'Coverage annotation',
  );
  if (coverageReceipt.inventorySha256 !== sha256Object(coverageReceipt.inventory)) {
    throw new PaperContractError('Coverage inventory hash mismatch.');
  }
  if (coverageReceipt.annotationSetSha256 !== sha256Object(manifest.statusAnnotations)) {
    throw new PaperContractError('Annotation set hash mismatch.');
  }

  const indexedBlocks = fragments.flatMap((fragment) => fragment.blocks.map((block) => ({
    block,
    stableSectionId: fragment.stableSectionId,
  })));
  const figureBlocks = indexedBlocks.filter((entry) => entry.block.kind === 'figure');
  const tableBlocks = indexedBlocks.filter((entry) => entry.block.kind === 'table');
  const equationBlocks = indexedBlocks.filter((entry) => entry.block.kind === 'equation');
  assertUnique(figureBlocks.map((entry) => entry.block.kind === 'figure' ? entry.block.figureId : ''), 'figure block reference');
  assertUnique(tableBlocks.map((entry) => entry.block.kind === 'table' ? entry.block.tableId : ''), 'table block reference');
  assertUnique(equationBlocks.map((entry) => entry.block.kind === 'equation' ? entry.block.equationId : ''), 'equation block reference');

  assertExactSet(
    figureBlocks.map((entry) => entry.block.kind === 'figure' ? entry.block.figureId : ''),
    manifest.figures.map((figure) => figure.figureId),
    'Figure index',
  );
  assertExactSet(figures.map((figure) => figure.figureId), manifest.figures.map((figure) => figure.figureId), 'Figure asset');
  assertExactSet(
    tableBlocks.map((entry) => entry.block.kind === 'table' ? entry.block.tableId : ''),
    manifest.tables.map((table) => table.tableId),
    'Table index',
  );
  assertExactSet(
    equationBlocks.map((entry) => entry.block.kind === 'equation' ? entry.block.equationId : ''),
    manifest.equations.map((equation) => equation.equationId),
    'Equation index',
  );

  const figureById = new Map(figures.map((figure) => [figure.figureId, figure]));
  manifest.figures.forEach((entry) => {
    const figure = figureById.get(entry.figureId);
    if (entry.assetLocator !== `fixture://figures/${entry.figureId}.json`) {
      throw new PaperContractError(`Figure locator binding mismatch for ${entry.figureId}.`);
    }
    if (!figure || sha256Object(figure) !== entry.assetSha256) {
      throw new PaperContractError(`Figure integrity failure for ${entry.figureId}.`);
    }
    const block = figureBlocks.find((candidate) => candidate.block.kind === 'figure' && candidate.block.figureId === entry.figureId);
    if (!block || block.stableSectionId !== entry.stableSectionId) {
      throw new PaperContractError(`Figure section ownership mismatch for ${entry.figureId}.`);
    }
  });
  manifest.tables.forEach((entry) => {
    const block = tableBlocks.find((candidate) => candidate.block.kind === 'table' && candidate.block.tableId === entry.tableId);
    if (!block || block.stableSectionId !== entry.stableSectionId) {
      throw new PaperContractError(`Table section ownership mismatch for ${entry.tableId}.`);
    }
  });
  manifest.equations.forEach((entry) => {
    const block = equationBlocks.find((candidate) => candidate.block.kind === 'equation' && candidate.block.equationId === entry.equationId);
    if (!block || block.stableSectionId !== entry.stableSectionId) {
      throw new PaperContractError(`Equation section ownership mismatch for ${entry.equationId}.`);
    }
  });

  return { descriptor, manifest };
}

export function validatePaperBundle(input: PaperBundleCandidate): VerifiedPaperRelease {
  const release = validatePaperBundleCandidate(input);
  const coverageReceipt = statusCoverageReceiptSchema.parse(input.coverageReceipt);
  if (coverageReceipt.rejectedPendingResolutionCount > 0) {
    throw new PaperContractError('Paper bundle has rejected coverage pending resolution and cannot be served.');
  }
  return release;
}
