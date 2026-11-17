import { PHASE2_R2_PAPER_VERSION } from './releases';

/* Preview-only review domain. These IDs describe the interaction demo, not a
 * production review manifest or a persisted response contract. */
export type PreviewFocusAreaId =
  | 'approach-structure'
  | 'uses-waterbodies'
  | 'substances-evidence'
  | 'human-health'
  | 'ecological-health'
  | 'common-rules-sequencing';

export interface PreviewFocusArea {
  readonly id: PreviewFocusAreaId;
  readonly label: string;
  readonly anchor: string;
  readonly sectionAnchors: readonly string[];
  readonly orientation: string;
  readonly promptIds: readonly string[];
}

export interface PreviewChoicePrompt {
  readonly kind: 'choice';
  readonly id: string;
  readonly areaId: PreviewFocusAreaId;
  readonly label: string;
  readonly sourceSection: string;
  readonly options: readonly { readonly id: string; readonly label: string }[];
  readonly rationaleLabel: string;
  readonly optional: true;
}

export interface PreviewTextPrompt {
  readonly kind: 'open-text';
  readonly id: string;
  readonly areaId: PreviewFocusAreaId;
  readonly label: string;
  readonly sourceSection: string;
  readonly optional: true;
}

export type PreviewPrompt = PreviewChoicePrompt | PreviewTextPrompt;

export interface PreviewEarlierFeedback {
  readonly ownerIdentity: string;
  readonly sessionIdentity: string;
  readonly areaId: PreviewFocusAreaId;
  readonly sectionAnchor: string;
  readonly sourceReleaseIdentity: string;
  readonly sourcePaperSha256: string;
  readonly sourceGuideSha256: string;
  readonly sourceManifestSha256: string;
  readonly originalQuestionId: string;
  readonly relationType: 'exact-continuation' | 'related-context';
  readonly responseStatus: 'submitted' | 'saved-draft';
  readonly timestamp: string;
  readonly displayLabel: string;
  readonly text: string;
  readonly synthetic: true;
}

export interface PreviewFeedbackContract {
  readonly viewerIdentity: string;
  readonly sessionIdentity: string;
  readonly sources: Readonly<Record<string, {
    readonly areaId: PreviewFocusAreaId;
    readonly sectionAnchor: string;
    readonly releaseIdentity: string;
    readonly paperSha256: string;
    readonly guideSha256: string;
    readonly manifestSha256: string;
    readonly relationType: PreviewEarlierFeedback['relationType'];
  }>>;
}

export function validPreviewFeedback(item: PreviewEarlierFeedback, contract: PreviewFeedbackContract): boolean {
  const source = contract.sources[item.originalQuestionId];
  return Boolean(source && item.synthetic === true
    && contract.viewerIdentity && contract.sessionIdentity
    && item.ownerIdentity === contract.viewerIdentity
    && item.sessionIdentity === contract.sessionIdentity
    && item.areaId === source.areaId
    && item.sectionAnchor === source.sectionAnchor
    && item.sourceReleaseIdentity === source.releaseIdentity
    && item.sourcePaperSha256 === source.paperSha256
    && item.sourceGuideSha256 === source.guideSha256
    && item.sourceManifestSha256 === source.manifestSha256
    && item.relationType === source.relationType);
}

export interface PreviewAnswer {
  readonly choiceId?: string;
  readonly rationale?: string;
  readonly text?: string;
}

export interface PreviewReviewState {
  readonly visitedAreaIds: readonly PreviewFocusAreaId[];
  readonly reviewedAreaIds: readonly PreviewFocusAreaId[];
  readonly answers: Readonly<Record<string, PreviewAnswer>>;
  readonly sectionComments: Readonly<Record<string, string>>;
  readonly wholePaperComment: string;
  readonly completed: boolean;
}

export const PREVIEW_FOCUS_AREAS: readonly PreviewFocusArea[] = Object.freeze([
  { id: 'approach-structure', label: 'Overall approach and paper structure', anchor: 'sec-phase2-3', sectionAnchors: ['sec-phase2-1', 'sec-phase2-2', 'sec-phase2-3'], orientation: 'Start with the proposed three-part schedule, four pathways, and placement rule.', promptIds: ['structure-approach'] },
  { id: 'uses-waterbodies', label: 'Where standards apply - sediment uses and waterbodies', anchor: 'sec-phase2-5', sectionAnchors: ['sec-phase2-5'], orientation: 'Consider whether sites can be assigned to the proposed categories and waterbody groups.', promptIds: ['site-assignment'] },
  { id: 'substances-evidence', label: 'Substances and supporting evidence', anchor: 'sec-phase2-4', sectionAnchors: ['sec-phase2-4'], orientation: 'Read the substance routing and evidence priorities. Comment on any passage that needs attention.', promptIds: [] },
  { id: 'human-health', label: 'Human-health protection', anchor: 'sec-phase2-6-1', sectionAnchors: ['sec-phase2-6-1', 'sec-phase2-6-2'], orientation: 'Review direct contact and the two-step aquatic-food approach.', promptIds: ['human-approach'] },
  { id: 'ecological-health', label: 'Ecological-health protection', anchor: 'sec-phase2-6-3', sectionAnchors: ['sec-phase2-6-3', 'sec-phase2-6-4'], orientation: 'Review benthic methods, the PAH mixture check, and food-web values.', promptIds: ['ecological-approach'] },
  { id: 'common-rules-sequencing', label: 'Common rules, implementation and sequencing', anchor: 'sec-phase2-7', sectionAnchors: ['sec-phase2-7', 'sec-phase2-8'], orientation: 'Review common rules, site adjustment, evidence needs, and the proposed order of work.', promptIds: ['common-rules', 'work-sequence'] },
]);

export const PREVIEW_PROMPTS: readonly PreviewPrompt[] = Object.freeze([
  { kind: 'choice', id: 'structure-approach', areaId: 'approach-structure', label: 'How well does the proposed overall structure work?', sourceSection: 'Sections 3 and 9', options: [{ id: 'sound', label: 'Sound as proposed' }, { id: 'refine', label: 'Needs refinement' }, { id: 'unsure', label: 'Unsure' }], rationaleLabel: 'What would you change or keep?', optional: true },
  { kind: 'open-text', id: 'site-assignment', areaId: 'uses-waterbodies', label: 'Where might assigning a real site to a sediment use or waterbody group be ambiguous?', sourceSection: 'Sections 5 and 9', optional: true },
  { kind: 'choice', id: 'human-approach', areaId: 'human-health', label: 'How well does the proposed human-health approach address the key pathways?', sourceSection: 'Sections 6.1, 6.2 and 9', options: [{ id: 'sound', label: 'Sound as proposed' }, { id: 'refine', label: 'Needs refinement' }, { id: 'unsure', label: 'Unsure' }], rationaleLabel: 'Which pathway or assumption needs attention?', optional: true },
  { kind: 'open-text', id: 'ecological-approach', areaId: 'ecological-health', label: 'What improvement or evidence would most strengthen the ecological-health approach?', sourceSection: 'Sections 6.3, 6.4 and 9', optional: true },
  { kind: 'choice', id: 'common-rules', areaId: 'common-rules-sequencing', label: 'Are the proposed common rules ready to guide the next development stage?', sourceSection: 'Sections 7 and 9', options: [{ id: 'yes', label: 'Broadly yes' }, { id: 'refine', label: 'Refine first' }, { id: 'unsure', label: 'Unsure' }], rationaleLabel: 'Which rule needs the most attention?', optional: true },
  { kind: 'open-text', id: 'work-sequence', areaId: 'common-rules-sequencing', label: 'What evidence or step should move earlier in the proposed order of work?', sourceSection: 'Sections 8 and 9', optional: true },
]);

export const PREVIEW_RELEASE_IDENTITY = PHASE2_R2_PAPER_VERSION;
export const PREVIEW_WHOLE_PAPER_TARGET = 'whole-paper' as const;

export function previewAreaForAnchor(anchor: string): PreviewFocusAreaId | null {
  if (anchor === 'sec-phase2-9') return null;
  for (const area of PREVIEW_FOCUS_AREAS) {
    if (area.sectionAnchors.some((section) => anchor === section || anchor.startsWith(`${section}-`))) return area.id;
  }
  return null;
}

export function previewAreaState(state: PreviewReviewState, area: PreviewFocusArea): 'not-visited' | 'visited' | 'has-input' | 'reviewed' {
  if (state.reviewedAreaIds.includes(area.id)) return 'reviewed';
  if (area.promptIds.some((id) => {
    const answer = state.answers[id];
    return Boolean(answer?.choiceId || answer?.rationale?.trim() || answer?.text?.trim());
  }) || Object.entries(state.sectionComments).some(([anchor, text]) => previewAreaForAnchor(anchor) === area.id && Boolean(text.trim()))) return 'has-input';
  return state.visitedAreaIds.includes(area.id) ? 'visited' : 'not-visited';
}

export function previewInitialState(): PreviewReviewState {
  return { visitedAreaIds: [], reviewedAreaIds: [], answers: {}, sectionComments: {}, wholePaperComment: '', completed: false };
}
