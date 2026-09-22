import {
  canonicalJson,
  sha256Object,
  sha256Text,
  withComputedReceiptHash,
  type PaperFigureAsset,
  type PaperFragment,
  type PaperManifest,
  type PaperParityReceipt,
  type PaperReleaseDescriptor,
  type PaperStatusCoverageReceipt,
} from './contracts';

export const SYNTHETIC_PAPER_DOCUMENT_ID = 'synthetic.matrix-options-paper';
export const SYNTHETIC_PAPER_VERSION = 'slice-1a-fixture-v1';
export const SYNTHETIC_BUNDLE_GENERATION_ID = 'synthetic.slice-1a.generation-001';

const generatedAt = '2026-09-02T00:00:00.000Z';
const identity = {
  documentId: SYNTHETIC_PAPER_DOCUMENT_ID,
  documentVersion: SYNTHETIC_PAPER_VERSION,
  bundleGenerationId: SYNTHETIC_BUNDLE_GENERATION_ID,
};

const syntheticRepresentations = [
  ['PDF', 'SYNTHETIC_FIXTURE_ONLY.pdf', 'Synthetic PDF identity; no PDF bytes are published by Slice 1A.'],
  ['MARKDOWN', 'SYNTHETIC_FIXTURE_ONLY.md', '# Synthetic fixture\nNo external paper content.'],
  ['HTML', 'SYNTHETIC_FIXTURE_ONLY.html', '<main><h1>Synthetic fixture</h1><p>No external paper content.</p></main>'],
] as const;

const representations = syntheticRepresentations.map(([kind, sourceFilename, content]) => ({
  ...identity,
  kind,
  sourceFilename,
  byteLength: Buffer.byteLength(content, 'utf8'),
  sha256: sha256Text(content),
}));

const fragments: PaperFragment[] = [
  {
    schemaVersion: 'matrix-options-paper-fragment-v1',
    ...identity,
    stableSectionId: 'synthetic.orientation',
    contentFormat: 'SAFE_STRUCTURED_BLOCKS_V1',
    blocks: [
      {
        kind: 'callout',
        blockId: 'synthetic.orientation.status',
        label: 'Fixture boundary',
        text: 'This clearly synthetic rough draft exists only to prove the reader architecture. It is not policy, scientific advice, publication approval, or a production paper.',
      },
      {
        kind: 'paragraph',
        blockId: 'synthetic.orientation.purpose',
        text: 'Use this workspace to test stable routes, hierarchy, server rendering, integrity failures, and accessible navigation without importing any external Options Paper.',
      },
      {
        kind: 'list',
        blockId: 'synthetic.orientation.focus',
        items: [
          'Confirm the document version before reading.',
          'Use the contents to open a stable section route.',
          'Treat every value and diagram as invented test data.',
        ],
      },
    ],
  },
  {
    schemaVersion: 'matrix-options-paper-fragment-v1',
    ...identity,
    stableSectionId: 'synthetic.framework',
    contentFormat: 'SAFE_STRUCTURED_BLOCKS_V1',
    blocks: [
      {
        kind: 'paragraph',
        blockId: 'synthetic.framework.context',
        text: 'The example framework has three invented stages: observe, compare, and document. These labels demonstrate layout only.',
      },
      {
        kind: 'figure',
        blockId: 'synthetic.framework.figure',
        figureId: 'synthetic.framework.flow',
      },
    ],
  },
  {
    schemaVersion: 'matrix-options-paper-fragment-v1',
    ...identity,
    stableSectionId: 'synthetic.framework.example',
    contentFormat: 'SAFE_STRUCTURED_BLOCKS_V1',
    blocks: [
      {
        kind: 'heading',
        blockId: 'synthetic.framework.example.heading',
        level: 2,
        text: 'Invented worked example',
      },
      {
        kind: 'paragraph',
        blockId: 'synthetic.framework.example.value',
        text: 'An invented input of 12 example units produces 24 example units under a deliberately trivial multiplier. It is not a standard or Calculator default.',
      },
      {
        kind: 'equation',
        blockId: 'synthetic.framework.example.equation',
        equationId: 'synthetic.equation.double',
        label: 'Synthetic equation 1',
        expression: 'invented_output = invented_input x 2 + context_a + context_b + context_c + context_d',
      },
      {
        kind: 'table',
        blockId: 'synthetic.framework.example.table',
        tableId: 'synthetic.table.layout',
        caption: 'Synthetic table 1. Invented values used only to verify horizontal overflow.',
        columns: ['Invented scenario', 'Invented input', 'Invented multiplier', 'Invented output', 'Authority boundary'],
        rows: [
          ['Layout test alpha with deliberately long context', '12 example units', '2', '24 example units', 'None - synthetic fixture only'],
          ['Layout test beta with deliberately long context', '20 example units', '2', '40 example units', 'None - synthetic fixture only'],
        ],
      },
    ],
  },
  {
    schemaVersion: 'matrix-options-paper-fragment-v1',
    ...identity,
    stableSectionId: 'synthetic.appendix',
    contentFormat: 'SAFE_STRUCTURED_BLOCKS_V1',
    blocks: [
      {
        kind: 'paragraph',
        blockId: 'synthetic.appendix.boundary',
        text: 'This appendix records that search, comments, guided review, source processing, entity mapping, and canonical PDF delivery remain outside Slice 1A.',
      },
    ],
  },
];

const figures: PaperFigureAsset[] = [
  {
    schemaVersion: 'matrix-options-paper-figure-v1',
    ...identity,
    figureId: 'synthetic.framework.flow',
    viewBox: '0 0 640 180',
    paths: [
      { d: 'M40 40 L200 40 L200 140 L40 140 Z', className: 'primary' },
      { d: 'M240 40 L400 40 L400 140 L240 140 Z', className: 'secondary' },
      { d: 'M440 40 L600 40 L600 140 L440 140 Z', className: 'accent' },
      { d: 'M200 90 L240 90 M400 90 L440 90', className: 'primary' },
    ],
  },
];

const entityLinks = [
  {
    entityId: 'synthetic.calculator.demo',
    stableSectionId: 'synthetic.framework.example',
    kind: 'CALCULATOR' as const,
    target: { routeKind: 'MATRIX_OPTIONS_VIEW' as const, viewId: 'Calculator' as const },
  },
];

const reviewQuestions = [
  {
    questionId: 'synthetic.question.boundary',
    stableSectionIds: ['synthetic.appendix'],
    prompt: 'Synthetic review question: does the fixture preserve the stated Slice 1A boundary?',
  },
];

const annotationDefaults = {
  documentId: SYNTHETIC_PAPER_DOCUMENT_ID,
  documentVersion: SYNTHETIC_PAPER_VERSION,
  bundleGenerationId: SYNTHETIC_BUNDLE_GENERATION_ID,
  validatedBy: 'SYNTHETIC_FIXTURE_VALIDATOR' as const,
  validatedAt: generatedAt,
  validationState: 'VALIDATED' as const,
};

const annotations: PaperManifest['statusAnnotations'] = [
  {
    ...annotationDefaults,
    annotationId: 'synthetic.annotation.in-force-statute',
    stableSectionId: 'synthetic.orientation',
    target: { kind: 'BLOCK', blockId: 'synthetic.orientation.status' },
    statusCode: 'IN_FORCE_LEGAL_OR_POLICY',
    authorityKind: 'STATUTE',
    decisionAuthority: 'ENV_LEGAL_DECISION_MAKER',
    reviewerRole: 'CONTENT_STEWARDSHIP',
    rationale: 'A clearly synthetic annotation exercises the in-force statute rendering subtype without making a real legal claim.',
    sourceLocator: 'fixture://sources/synthetic-statute.json',
  },
  {
    ...annotationDefaults,
    annotationId: 'synthetic.annotation.in-force-policy',
    stableSectionId: 'synthetic.framework',
    target: { kind: 'BLOCK', blockId: 'synthetic.framework.context' },
    statusCode: 'IN_FORCE_LEGAL_OR_POLICY',
    authorityKind: 'ENV_POLICY',
    decisionAuthority: 'ENV_LEGAL_DECISION_MAKER',
    reviewerRole: 'CONTENT_STEWARDSHIP',
    rationale: 'A clearly synthetic annotation exercises the in-force policy rendering subtype without making a real policy claim.',
    sourceLocator: 'fixture://sources/synthetic-policy.json',
  },
  ...[
    ['synthetic.annotation.illustrative-value', 'synthetic.framework.example.value', 'The numeric example is invented solely to exercise the illustrative-value treatment.'],
    ['synthetic.annotation.illustrative-value-context', 'synthetic.framework.example.value', 'A second validated annotation on the same target proves that distinct review context is preserved.'],
    ['synthetic.annotation.illustrative-equation', 'synthetic.framework.example.equation', 'The equation is invented solely to exercise safe equation overflow.'],
    ['synthetic.annotation.illustrative-table', 'synthetic.framework.example.table', 'The table is invented solely to exercise safe responsive overflow.'],
  ].map(([annotationId, blockId, rationale]) => ({
    ...annotationDefaults,
    annotationId,
    stableSectionId: 'synthetic.framework.example',
    target: { kind: 'BLOCK' as const, blockId },
    statusCode: 'ILLUSTRATIVE_VALUE_OR_CALCULATION' as const,
    authorityKind: 'DRAFT_ANALYSIS' as const,
    decisionAuthority: 'CONTENT_VALIDATOR_ONLY' as const,
    reviewerRole: 'TECHNICAL_VALIDATION' as const,
    rationale,
    sourceLocator: 'fixture://sources/synthetic-example.json',
  })),
  {
    ...annotationDefaults,
    annotationId: 'synthetic.annotation.entity-plan',
    stableSectionId: 'synthetic.framework.example',
    target: { kind: 'ENTITY', entityId: 'synthetic.calculator.demo' },
    statusCode: 'PROJECT_PLAN_DIRECTION',
    authorityKind: 'PROJECT_PLAN',
    decisionAuthority: 'PHASE2_PROJECT_GOVERNANCE',
    reviewerRole: 'CONTENT_STEWARDSHIP',
    rationale: 'A clearly synthetic entity annotation proves entity coverage and rendering without selecting a real project direction.',
    sourceLocator: 'fixture://sources/synthetic-entity.json',
  },
  {
    ...annotationDefaults,
    annotationId: 'synthetic.annotation.review-question',
    stableSectionId: 'synthetic.appendix',
    target: { kind: 'BLOCK', blockId: 'synthetic.appendix.boundary' },
    statusCode: 'REVIEW_QUESTION',
    authorityKind: 'NOT_APPLICABLE',
    decisionAuthority: 'PHASE2_PROJECT_GOVERNANCE',
    reviewerRole: 'ADVISORY_ERROR_GAP_SOURCE_INPUT',
    rationale: 'A clearly synthetic review question exercises the decision-authority label without recording a reviewer decision.',
  },
];

const blockTargets = fragments.flatMap((fragment) => fragment.blocks.map((block) => ({
  stableSectionId: fragment.stableSectionId,
  target: { kind: 'BLOCK' as const, blockId: block.blockId },
})));
const entityTargets = entityLinks.map((entity) => ({
  stableSectionId: entity.stableSectionId,
  target: { kind: 'ENTITY' as const, entityId: entity.entityId },
}));
const illustrativeBlockIds = new Set([
  'synthetic.framework.example.value',
  'synthetic.framework.example.equation',
  'synthetic.framework.example.table',
]);
const targetKey = (target: (typeof blockTargets)[number]['target'] | (typeof entityTargets)[number]['target']) => (
  target.kind === 'BLOCK' ? `BLOCK:${target.blockId}` : `ENTITY:${target.entityId}`
);
const inventory = [...blockTargets, ...entityTargets].map(({ stableSectionId, target }) => {
  const isIllustrativeValue = target.kind === 'BLOCK' && illustrativeBlockIds.has(target.blockId);
  const annotationIds = annotations
    .filter((annotation) => targetKey(annotation.target) === targetKey(target))
    .map((annotation) => annotation.annotationId);
  const common = {
    stableSectionId,
    target,
    designatedHighRisk: isIllustrativeValue,
    reviewer: 'SYNTHETIC_FIXTURE_VALIDATOR' as const,
    reviewerRole: isIllustrativeValue ? 'TECHNICAL_VALIDATION' as const : 'CONTENT_STEWARDSHIP' as const,
    validatedAt: generatedAt,
  };
  return annotationIds.length > 0
    ? {
      ...common,
      disposition: 'VALIDATED_STATUS' as const,
      annotationIds,
      rationale: 'Synthetic target has explicit validated status annotations for contract testing.',
    }
    : {
      ...common,
      disposition: 'NO_STATUS_REQUIRED' as const,
      rationale: 'Synthetic layout prose contains no legal, policy, scientific, or production claim.',
    };
});

const parityReceipt = withComputedReceiptHash<PaperParityReceipt>({
  schemaVersion: 'matrix-paper-parity-v1',
  ...identity,
  algorithmVersion: 'synthetic-parity-v1',
  representations,
  differences: [
    {
      code: 'SYNTHETIC_REPRESENTATION_DETAIL',
      disposition: 'ALLOWLISTED',
      detail: 'The three tiny representations intentionally differ in markup while sharing fixture identity.',
    },
  ],
  result: 'VERIFIED',
  reviewedBy: 'SYNTHETIC_FIXTURE_VALIDATOR',
  receiptSha256: '0'.repeat(64),
});

const coverageReceipt = withComputedReceiptHash<PaperStatusCoverageReceipt>({
  schemaVersion: 'matrix-paper-status-coverage-v1',
  ...identity,
  inventory,
  totalTargets: inventory.length,
  designatedHighRiskCount: illustrativeBlockIds.size,
  validatedStatusCount: inventory.filter((item) => item.disposition === 'VALIDATED_STATUS').length,
  noStatusRequiredCount: inventory.filter((item) => item.disposition === 'NO_STATUS_REQUIRED').length,
  rejectedPendingResolutionCount: 0,
  validatorRoles: ['TECHNICAL_VALIDATION', 'CONTENT_STEWARDSHIP'],
  inventorySha256: sha256Object(inventory),
  annotationSetSha256: sha256Object(annotations),
  completeness: 'COMPLETE',
  receiptSha256: '0'.repeat(64),
});

const manifest: PaperManifest = {
  schemaVersion: 'matrix-options-paper-manifest-v1',
  ...identity,
  publicationState: 'SYNTHETIC_ROUGH_DRAFT',
  title: 'Synthetic Matrix Options Paper Reader Fixture',
  authorityBannerText: 'Synthetic rough draft - not policy, scientific advice, publication approval, or a production document.',
  representations,
  parityReceiptLocator: 'fixture://receipts/parity.json',
  parityReceiptSha256: parityReceipt.receiptSha256,
  statusCoverageReceiptLocator: 'fixture://receipts/status-coverage.json',
  statusCoverageReceiptSha256: coverageReceipt.receiptSha256,
  sections: [
    {
      stableSectionId: 'synthetic.orientation',
      parentStableSectionId: null,
      number: '0',
      title: 'Reader orientation',
      order: 0,
      depth: 1,
      sourceRange: { startLine: 1, endLine: 12 },
      pdfPage: null,
      fragmentLocator: 'fixture://fragments/synthetic.orientation.json',
      fragmentSha256: sha256Object(fragments[0]),
      blockIds: fragments[0].blocks.map((block) => block.blockId),
      statusAnnotationIds: annotations.filter((annotation) => annotation.stableSectionId === 'synthetic.orientation').map((annotation) => annotation.annotationId),
      reviewQuestionIds: [],
      entityIds: [],
    },
    {
      stableSectionId: 'synthetic.framework',
      parentStableSectionId: null,
      number: '1',
      title: 'Synthetic framework',
      order: 1,
      depth: 1,
      sourceRange: { startLine: 13, endLine: 24 },
      pdfPage: null,
      fragmentLocator: 'fixture://fragments/synthetic.framework.json',
      fragmentSha256: sha256Object(fragments[1]),
      blockIds: fragments[1].blocks.map((block) => block.blockId),
      statusAnnotationIds: annotations.filter((annotation) => annotation.stableSectionId === 'synthetic.framework').map((annotation) => annotation.annotationId),
      reviewQuestionIds: [],
      entityIds: [],
    },
    {
      stableSectionId: 'synthetic.framework.example',
      parentStableSectionId: 'synthetic.framework',
      number: '1.1',
      title: 'Invented worked example',
      order: 2,
      depth: 2,
      sourceRange: { startLine: 25, endLine: 34 },
      pdfPage: null,
      fragmentLocator: 'fixture://fragments/synthetic.framework.example.json',
      fragmentSha256: sha256Object(fragments[2]),
      blockIds: fragments[2].blocks.map((block) => block.blockId),
      statusAnnotationIds: annotations.filter((annotation) => annotation.stableSectionId === 'synthetic.framework.example').map((annotation) => annotation.annotationId),
      reviewQuestionIds: [],
      entityIds: entityLinks.filter((entity) => entity.stableSectionId === 'synthetic.framework.example').map((entity) => entity.entityId),
    },
    {
      stableSectionId: 'synthetic.appendix',
      parentStableSectionId: null,
      number: 'A',
      title: 'Slice boundary appendix',
      order: 3,
      depth: 1,
      sourceRange: { startLine: 35, endLine: 40 },
      pdfPage: null,
      fragmentLocator: 'fixture://fragments/synthetic.appendix.json',
      fragmentSha256: sha256Object(fragments[3]),
      blockIds: fragments[3].blocks.map((block) => block.blockId),
      statusAnnotationIds: annotations.filter((annotation) => annotation.stableSectionId === 'synthetic.appendix').map((annotation) => annotation.annotationId),
      reviewQuestionIds: reviewQuestions.filter((question) => question.stableSectionIds.includes('synthetic.appendix')).map((question) => question.questionId),
      entityIds: [],
    },
  ],
  statusAnnotations: annotations,
  figures: [
    {
      figureId: 'synthetic.framework.flow',
      stableSectionId: 'synthetic.framework',
      caption: 'Figure 1. Invented three-stage flow used only to verify figure delivery.',
      alternativeDescription: 'Three outlined boxes connected from left to right.',
      assetLocator: 'fixture://figures/synthetic.framework.flow.json',
      assetSha256: sha256Object(figures[0]),
    },
  ],
  tables: [{ tableId: 'synthetic.table.layout', stableSectionId: 'synthetic.framework.example', title: 'Synthetic table 1' }],
  equations: [{ equationId: 'synthetic.equation.double', stableSectionId: 'synthetic.framework.example', label: 'Synthetic equation 1' }],
  bibliography: [],
  reviewQuestions,
  entityLinks,
  searchIndex: {
    locator: 'fixture://search/contract-only.json',
    sha256: sha256Text(canonicalJson({ state: 'CONTRACT_ONLY', documentVersion: SYNTHETIC_PAPER_VERSION })),
    state: 'CONTRACT_ONLY',
  },
  canonicalPdf: {
    availability: 'UNAVAILABLE_SYNTHETIC_FIXTURE',
    locator: null,
    sha256: null,
    byteLength: 0,
    label: 'Canonical PDF unavailable for this synthetic fixture',
  },
  priorVersionMapping: {
    state: 'NOT_APPLICABLE_FIRST_VERSION',
  },
  generatedAt,
  publisherVersion: 'slice1a-synthetic-publisher-v1',
  candidateIdentity: 'SYNTHETIC_FIXTURE_ONLY',
  approver: null,
  promotionState: 'NOT_PROMOTABLE',
};

const descriptor: PaperReleaseDescriptor = {
  schemaVersion: 'matrix-options-paper-release-descriptor-v1',
  environment: 'TEST_ONLY',
  ...identity,
  manifestSha256: sha256Object(manifest),
  parityReceiptSha256: parityReceipt.receiptSha256,
  statusCoverageReceiptSha256: coverageReceipt.receiptSha256,
  transportProviderIdentity: 'IN_PROCESS_SYNTHETIC_PROVIDER',
  candidateState: 'SYNTHETIC_FIXTURE',
  approvalState: 'NOT_APPROVED',
  promotionState: 'NOT_PROMOTABLE',
  trustedConfiguration: 'SLICE_1A_TEST_FIXTURE',
  priorReleaseIdentity: null,
};

export interface SyntheticPaperFixtureBundle {
  descriptor: PaperReleaseDescriptor;
  manifest: PaperManifest;
  parityReceipt: PaperParityReceipt;
  coverageReceipt: PaperStatusCoverageReceipt;
  fragments: PaperFragment[];
  figures: PaperFigureAsset[];
}

export function createSyntheticPaperFixture(): SyntheticPaperFixtureBundle {
  return structuredClone({ descriptor, manifest, parityReceipt, coverageReceipt, fragments, figures });
}
