/*
 * The 20-figure register: every entry of the v0.9.87 List of Figures (the
 * historical reference numbering), with how L2 draws it now and what Matrix MC
 * still has to decide. Dispositions follow MATRIX_FIGURE_LINEAGE_ADJUDICATION_20260924
 * (FIGURE_ADJUDICATION). This file holds no scientific text of its own: rendered
 * figures come from the current paper; layout prototypes carry structure only,
 * labelled with generic box names or the adjudicated pathway names.
 *
 * Seven rows (6-1, 7-1, B-1, 7-7, G-3, H-1, G-2) carry one of six Matrix MC content
 * candidates from MATRIX_FOUNDATIONAL_FIGURE_CONTENT_CANDIDATES_20260924.md
 * (figure-candidates.ts), reviewed YELLOW_DRAFT_SAFE_FOR_L2_PROTOTYPING_NOT_FOR_FINAL_BINDING
 * (MATRIX_FOUNDATIONAL_FIGURE_CONTENT_CANDIDATES_REVIEW_20260924.md). A candidate
 * is content-non-final: see FIGURE_CANDIDATE_PACKET and each row's remainingDecision.
 */

import { FIGURE_CANDIDATE_PACKET, figureCandidateAsset, type CanonicalSemanticSourceBinding } from './figure-candidates';
import { FIGURE_ADJUDICATION, type DiagramModel, type FigureBinding } from './figures';

export type FigureImplementation =
  | 'rendered-current'
  | 'rendered-current-math-notation'
  | 'prototype-nonfinal'
  | 'referenced-duplicate'
  | 'layout-prototype-awaiting-content'
  | 'historical-proposal-layout-only'
  | 'candidate-prototype-nonfinal';

export interface FigureRegisterRow {
  readonly number: string;
  readonly historicalCaption: string;
  readonly referencePdfPage: number;
  /** Where v0.9.87 placed it. */
  readonly historicalPlacement: string;
  /** Where the current paper holds it (rendered) or would hold it (candidate, Matrix MC to confirm). */
  readonly currentPlacement: string;
  readonly implementation: FigureImplementation;
  /** What the drawn content is taken from. */
  readonly contentSource: string;
  /** Matrix MC disposition code. */
  readonly disposition: string;
  /** The figure whose single scientific asset this placement reuses. */
  readonly reuseOf: string | null;
  readonly remainingDecision: string;
  /** figure-candidates.ts assetId this row draws, or null when it has no Matrix MC content candidate. */
  readonly semanticAssetId: string | null;
  /** Canonical source identity for the proposed G-2/H-1 semantic assets, distinct from packet bytes. */
  readonly canonicalSemanticSource?: CanonicalSemanticSourceBinding;
  /** The candidate packet's sha256, or null when this row has no candidate. */
  readonly candidatePacketSha256: string | null;
  /** The words a reader sees for this row's content status (never color alone). */
  readonly visibleStatus: string;
  /**
   * ROUND4_FIX_BRIEF item 5 (Leg1b P2-3): whether this figure's own historical number is drawn on
   * the default-on inline stakeholder paper as well as in the figure lab ('inline+lab', the 12
   * current PAPER_FIGURES entries incl. 6-1), exists only as a Matrix MC candidate or awaiting-
   * content placement never yet placed inline ('lab-only': 7-1, 7-2, 7-7, B-1, G-1, G-3, H-1), or
   * is a lab-only candidate. G-2 is a historical v1.0 proposal the current paper says was never
   * built; its implementation field preserves that provenance while placement remains lab-only.
   * PX-1..PX-4 (the derived, deterministically-redrawn figures) are not
   * FIGURE_REGISTER rows; they are recorded as lab-only in export_register.ts's proposed section.
   */
  readonly placement: 'inline+lab' | 'lab-only';
  /** How every node and edge meaning reaches a screen reader for this row's drawn figure(s). */
  readonly accessibleEquivalent: string;
  /** Where this row's drawn content traces to against MATRIX_SEVEN_SOURCE_DELTA_LEDGER_20260924.md (FIGURE_SOURCE_LEDGER). */
  readonly lineage: FigureLineage;
}

/** How a row's content ties back to the seven-file source ledger (source_native_parity.json, 2026-09-24). */
export type FigureLineageKind =
  | 'source-native-fence'
  | 'outside-ledger'
  | 'packet-candidate'
  | 'referenced-duplicate'
  | 'historical-only';

export interface FigureLineage {
  /** FIGURE_SOURCE_LEDGER.sha256 for every row (the ledger this lineage is checked against). */
  readonly ledgerSha256: string;
  readonly kind: FigureLineageKind;
  readonly sourceFile: string | null;
  /** sha256 of the whole live source file, when the ledger tracks one (the seven ledger files only). */
  readonly liveFileSha256: string | null;
  /** sha256 of the whole staged V16 source file, when the ledger tracks one (the seven ledger files only). */
  readonly stagedFileSha256: string | null;
  readonly fenceSha256: string | null;
  readonly fenceOrdinal: number | null;
  readonly fenceStartLine: number | null;
  /** The "Diagram summary N" this fence flattens to in the deployed paper, or null when none exists. */
  readonly diagramSummary: number | null;
  readonly parity: 'IDENTICAL' | null;
  readonly renderBinding: string;
  readonly carriedEncodingRepairs: string;
  readonly note: string;
}

/**
 * FIGURE_SOURCE_LEDGER -- the seven-file source-delta ledger every row's lineage is checked
 * against. Facts only; MATRIX_SEVEN_SOURCE_DELTA_LEDGER_REVIEW_20260924.md's verdict
 * (YELLOW_RECONCILIATION_COMPLETE_PER_HUNK_INTEGRATION_REQUIRED) means the reconciliation is
 * complete but per-hunk integration into the release contract is still required -- not a
 * green light to bind final content from this pass alone.
 */
export const FIGURE_SOURCE_LEDGER = {
  file: 'MATRIX_SEVEN_SOURCE_DELTA_LEDGER_20260924.md',
  sha256: 'b07c457f07771883b823eaf530b21fd4ee02165e57a4a19c8fc9b89243b56fdd',
  reviewFile: 'MATRIX_SEVEN_SOURCE_DELTA_LEDGER_REVIEW_20260924.md',
  reviewSha256: 'd36f4394581ff5a4b1c1df4c4f97bc3f02a2b24315d1caf5a34c888d9bf957dc',
  verdict: 'YELLOW_RECONCILIATION_COMPLETE_PER_HUNK_INTEGRATION_REQUIRED',
} as const;

export const FINAL_BINDING_REQUIREMENT =
  'Final paper and frontend assets must share one accepted semantic asset, caption, placement, provenance and hash through the frozen release contract.';

const CURRENT_SUMMARY = 'current deployed paper Diagram summary (sha256-bound)';
const REAL_TEXT_EQUIVALENT = 'Every box is a real-text list item (heads + bullets); a hidden aria-describedby paragraph states every connection in words, so no meaning depends on the drawing.';
const CANDIDATE_ACCESSIBLE_EQUIVALENT = `${REAL_TEXT_EQUIVALENT} The visible status note (not color alone) names the candidate packet hash and content status.`;
// 6-1 is the outlier: the inline stakeholder-paper figure carries only a plain draft note (no
// packet hash, no SedS labels). The Matrix MC adjudicated SedS pathway prototype and the packet
// content candidate exist only in the figure lab, and it is THEIR own status notes (not this row's
// inline note) that name the authority label and packet hash. ROUND5_FIX_BRIEF item B: the prior
// text (CANDIDATE_ACCESSIBLE_EQUIVALENT) falsely implied the inline note carries a packet hash.
const INLINE_6_1_ACCESSIBLE_EQUIVALENT = `${REAL_TEXT_EQUIVALENT} The visible status note on the inline stakeholder-paper figure is a plain-language draft note naming only that the content is being corrected -- it names no packet hash. The Matrix MC adjudicated SedS pathway prototype and the packet content candidate are lab-only; their own notes (not this one) carry the authority label and candidate packet hash.`;

// visibleStatus wording is derived from each row's own disposition code, never an acceptance claim the
// disposition does not make; "accepted" appears only in F-2's disposition-backed wording (P2-4 fix).
const FINAL_BINDING_PENDING = 'final binding pending the frozen release contract.';
const VISIBLE_STATUS_RESTORE = `Current deployed content, restored for review (CURRENT_CONTENT_RESTORE); ${FINAL_BINDING_PENDING}`;
const VISIBLE_STATUS_NOTATION_ONLY = `Current deployed content, restored for review, notation-only variant (NOTATION_ONLY_VARIANT); ${FINAL_BINDING_PENDING}`;
const visibleStatusReferencedDuplicate = (reuseOf: string) =>
  `Current deployed content, referenced duplicate of Figure ${reuseOf} (RESTORE_AS_REFERENCED_DUPLICATE_PRESENTATION); ${FINAL_BINDING_PENDING}`;
const VISIBLE_STATUS_DIRECTION_ACCEPTED = `Current deployed content; direction accepted (CURRENT_CONTENT_DIRECTION_ACCEPTED); ${FINAL_BINDING_PENDING}`;

export const FIGURE_REGISTER: readonly FigureRegisterRow[] = [
  {
    number: '6-1', historicalCaption: 'CSR Schedule 3.4 Part 1: the four receptor-pathways.', referencePdfPage: 35, historicalPlacement: 'Section 6.0', currentPlacement: 'Section 6.0 (Diagram summary 8)', implementation: 'prototype-nonfinal',
    // ROUND4_FIX_BRIEF item 5 (Leg1b P2-3): distinguish what the inline stakeholder paper actually
    // shows (its own current-paper labels, plus a draft note) from what is figure-lab only (the
    // Matrix MC adjudicated SedS pathway names and the packet content candidate). The pre-fix
    // wording described the SedS names and the candidate as part of this figure's content without
    // saying the inline figure never carries either.
    contentSource: `${CURRENT_SUMMARY}, drawn inline with the paper's OWN current receptor-pathway labels (PATHWAY 1-4: HH-DIR / HH-FOOD / ECO-DIR / ECO-FOOD) and a plain-language draft note (owner decision 2026-09-24: label overrides are never applied on the default-on inline stakeholder paper). The Matrix MC adjudicated SedS-contact/SedS-food pathway names and the mx-asset-receptor-pathways-4 content candidate (packet sha256 ${FIGURE_CANDIDATE_PACKET.packetSha256}, YELLOW draft) are figure-lab only; never shown inline.`,
    disposition: 'CONTENT_CORRECTION_REQUIRED_BEFORE_FINAL_BINDING', reuseOf: null,
    remainingDecision: 'Supply the accepted current-source block (final bullet wording) with the Phase 1 nomenclature; then freeze. Owner review focus 4 (final captions and any named receptor examples) applies once the candidate below is reconciled with this prototype. Final adoption of the SedS-contact/SedS-food nomenclature also has a document-wide ripple (packet section 3): the current Section 5 divergence text says the paper does not use it, while the owner-approved grill decision says to adopt it, so a later source editor must reconcile Section 5, Table 6-1, pathway headings, cross-references, and the appendices together with this figure, not the figure alone.',
    semanticAssetId: 'mx-asset-receptor-pathways-4', candidatePacketSha256: FIGURE_CANDIDATE_PACKET.packetSha256,
    placement: 'inline+lab',
    visibleStatus: 'Draft figure shown inline with its own current-paper labels; its content is being corrected and is not final. The Matrix MC adjudicated pathway names and content candidate are shown for comparison in the figure lab only, never on the stakeholder paper.',
    accessibleEquivalent: INLINE_6_1_ACCESSIBLE_EQUIVALENT,
    lineage: {
      ledgerSha256: FIGURE_SOURCE_LEDGER.sha256,
      kind: 'outside-ledger',
      sourceFile: 'MASTER_TEMPLATE.md',
      liveFileSha256: null,
      stagedFileSha256: null,
      fenceSha256: null,
      fenceOrdinal: null,
      fenceStartLine: null,
      diagramSummary: 8,
      parity: null,
      renderBinding: 'Render-time binding to deployed Diagram summary 8; MASTER_TEMPLATE.md is outside the seven-file ledger and its live copy has no diagram fence, so summary 8 has no source-native fence to check parity against.',
      carriedEncodingRepairs: 'Not applicable: MASTER_TEMPLATE.md carries no diagram fence for this figure, so there is no fence body to check for carried repair tokens.',
      note: 'source_native_parity.json master_template: {exists: true, fence_found: false, label: OUTSIDE_LEDGER}. The Matrix MC content candidate mx-asset-receptor-pathways-4 (figure-candidates.ts) is this row\'s only structured content source.',
    },
  },
  {
    number: '7-1', historicalCaption: 'Bioaccumulation.', referencePdfPage: 42, historicalPlacement: 'Section 7.2', currentPlacement: 'candidate: Section 7.2 Bioaccumulation draft text', implementation: 'candidate-prototype-nonfinal',
    contentSource: `Matrix MC content candidate mx-asset-bioaccumulation-pathways (packet sha256 ${FIGURE_CANDIDATE_PACKET.packetSha256}, YELLOW draft), shared with Figure B-1 as one semantic asset; see figure-candidates.ts.`,
    disposition: 'ONE_SEMANTIC_ASSET_TWO_PLACEMENTS', reuseOf: null,
    remainingDecision: "Matrix MC to accept the node wording and statuses of mx-asset-bioaccumulation-pathways and this Figure 7-1 caption, after the grill-to-V16 parameter conflict (packet section 10) is resolved; the candidate receptor examples in Pathway 4 still need source-level and applicability review (packet section 4); final adoption also depends on Figure 6-1's SedS-contact/SedS-food nomenclature ripple (packet section 3), since this asset reuses those pathway names.",
    semanticAssetId: 'mx-asset-bioaccumulation-pathways', candidatePacketSha256: FIGURE_CANDIDATE_PACKET.packetSha256,
    placement: 'lab-only',
    visibleStatus: 'Matrix MC content candidate - not final and not scientifically accepted.',
    accessibleEquivalent: CANDIDATE_ACCESSIBLE_EQUIVALENT,
    lineage: {
      ledgerSha256: FIGURE_SOURCE_LEDGER.sha256,
      kind: 'packet-candidate',
      sourceFile: null, liveFileSha256: null, stagedFileSha256: null,
      fenceSha256: null, fenceOrdinal: null, fenceStartLine: null, diagramSummary: null, parity: null,
      renderBinding: 'No live diagram-summary rendering at this placement; the figure lab draws this row from figure-candidates.ts (Matrix MC content candidate), not a deployed Diagram summary, and not from a source-native fence in the seven-file ledger.',
      carriedEncodingRepairs: 'Not applicable: this row is not a source-native fence, so the ledger carries no repair-token check for it.',
      note: `No source-native fence exists for Figure 7-1 in the current trees (source_native_parity.json). Content candidate: MATRIX_FOUNDATIONAL_FIGURE_CONTENT_CANDIDATES_20260924.md, sha256 ${FIGURE_CANDIDATE_PACKET.packetSha256}.`,
    },
  },
  { number: '7-2', historicalCaption: 'Matrix standards derivation options.', referencePdfPage: 55, historicalPlacement: 'Section 7.5', currentPlacement: 'candidate: Section 7.5 (referenced duplicate)', implementation: 'referenced-duplicate', contentSource: 'the Figure E-1 asset (single scientific asset)', disposition: 'RESTORE_AS_REFERENCED_DUPLICATE_PRESENTATION', reuseOf: 'E-1', remainingDecision: 'Bind 7-2 to the E-1 asset in the release register; confirm the Section 7.5 placement.', semanticAssetId: null, candidatePacketSha256: null, placement: 'lab-only', visibleStatus: visibleStatusReferencedDuplicate('E-1'), accessibleEquivalent: REAL_TEXT_EQUIVALENT, lineage: { ledgerSha256: FIGURE_SOURCE_LEDGER.sha256, kind: 'referenced-duplicate', sourceFile: 'APPENDIX_E_MATRIX_DERIVATION_OPTIONS_REVIEW.md', liveFileSha256: '6f46fb12b75519841f6fbb6eed5c224f4659fbbbe987100f85e05682d8758c52', stagedFileSha256: 'f3be080af4bfc69ccc81f4872d41b6bd33e4308c2b0a5e988af6b0e276a86eb0', fenceSha256: '6d5d6ed2c05a004123f4688581633418448c79223a858467a85a557baf9716ae', fenceOrdinal: 1, fenceStartLine: 79, diagramSummary: 5, parity: 'IDENTICAL', renderBinding: "Render-time binding to deployed Diagram summary 5, inherited from Figure E-1 (the single scientific asset both placements reuse); the summary is not the canonical visual definition (ledger). Semantic definition: live source-native fence.", carriedEncodingRepairs: 'None inside the figure body (repairs noted by the ledger are in surrounding prose and are not carried into this asset).', note: "Referenced duplicate: inherits Figure E-1's source-native fence fields verbatim, per FIGURE_REGISTER reuseOf. Same fence #1 at APPENDIX_E_MATRIX_DERIVATION_OPTIONS_REVIEW.md:79." } },
  { number: '7-3', historicalCaption: 'Generic standards adoption procedure.', referencePdfPage: 64, historicalPlacement: 'Section 7.6', currentPlacement: 'Section 7.6 (Diagram summary 9)', implementation: 'rendered-current', contentSource: CURRENT_SUMMARY, disposition: 'CURRENT_CONTENT_RESTORE', reuseOf: null, remainingDecision: 'Final placement and asset hash in the frozen release contract.', semanticAssetId: null, candidatePacketSha256: null, placement: 'inline+lab', visibleStatus: VISIBLE_STATUS_RESTORE, accessibleEquivalent: REAL_TEXT_EQUIVALENT, lineage: { ledgerSha256: FIGURE_SOURCE_LEDGER.sha256, kind: 'source-native-fence', sourceFile: 'SECTION_7_6_GENERIC_ADOPTION_PROCEDURE_DRAFT_TEXT.md', liveFileSha256: '49ccaba87f5e9c978b55d090e8fa56e1920f3e32752283fd2b3553b17966270a', stagedFileSha256: 'b42077b0a0ac981813e99d2a5c135f4d56ce7e1847cf791fe1e02fe889643d84', fenceSha256: 'd98aa741618ea613fbca21574bf2389d92136da890a05a291af2951e49f980b7', fenceOrdinal: 1, fenceStartLine: 20, diagramSummary: 9, parity: 'IDENTICAL', renderBinding: "Render-time binding to deployed Diagram summary 9; the summary is not the canonical visual definition (ledger). Semantic definition: live source-native fence.", carriedEncodingRepairs: 'None inside the figure body (repairs noted by the ledger are in surrounding prose and are not carried into this asset).', note: "Ledger-verified source-native fence #1 at SECTION_7_6_GENERIC_ADOPTION_PROCEDURE_DRAFT_TEXT.md:20; parity vs both deployed and staged Diagram summary 9 is IDENTICAL (source_native_parity.json)." } },
  { number: '7-4', historicalCaption: 'Four-Tier jurisdictional hierarchy of preference.', referencePdfPage: 65, historicalPlacement: 'Section 7.6.1', currentPlacement: 'Section 7.6.1 (Diagram summary 10)', implementation: 'rendered-current', contentSource: CURRENT_SUMMARY, disposition: 'CURRENT_CONTENT_RESTORE', reuseOf: null, remainingDecision: 'Final placement and asset hash in the frozen release contract.', semanticAssetId: null, candidatePacketSha256: null, placement: 'inline+lab', visibleStatus: VISIBLE_STATUS_RESTORE, accessibleEquivalent: REAL_TEXT_EQUIVALENT, lineage: { ledgerSha256: FIGURE_SOURCE_LEDGER.sha256, kind: 'source-native-fence', sourceFile: 'SECTION_7_6_GENERIC_ADOPTION_PROCEDURE_DRAFT_TEXT.md', liveFileSha256: '49ccaba87f5e9c978b55d090e8fa56e1920f3e32752283fd2b3553b17966270a', stagedFileSha256: 'b42077b0a0ac981813e99d2a5c135f4d56ce7e1847cf791fe1e02fe889643d84', fenceSha256: '0e3c64e7db3dbf36be1b57c7447c59413a54977183f3acdfa8be6886f1eb4d4e', fenceOrdinal: 2, fenceStartLine: 39, diagramSummary: 10, parity: 'IDENTICAL', renderBinding: "Render-time binding to deployed Diagram summary 10; the summary is not the canonical visual definition (ledger). Semantic definition: live source-native fence.", carriedEncodingRepairs: 'None inside the figure body (repairs noted by the ledger are in surrounding prose and are not carried into this asset).', note: "Ledger-verified source-native fence #2 at SECTION_7_6_GENERIC_ADOPTION_PROCEDURE_DRAFT_TEXT.md:39; parity vs both deployed and staged Diagram summary 10 is IDENTICAL (source_native_parity.json)." } },
  { number: '7-5', historicalCaption: 'BC aquatic database.', referencePdfPage: 70, historicalPlacement: 'Section 7.7', currentPlacement: 'Section 7.7 (Diagram summary 11)', implementation: 'rendered-current', contentSource: CURRENT_SUMMARY, disposition: 'CURRENT_CONTENT_RESTORE', reuseOf: null, remainingDecision: 'Final placement and asset hash in the frozen release contract.', semanticAssetId: null, candidatePacketSha256: null, placement: 'inline+lab', visibleStatus: VISIBLE_STATUS_RESTORE, accessibleEquivalent: REAL_TEXT_EQUIVALENT, lineage: { ledgerSha256: FIGURE_SOURCE_LEDGER.sha256, kind: 'source-native-fence', sourceFile: 'SECTION_7_7_BC_AQUATIC_DATABASE_DRAFT_TEXT.md', liveFileSha256: '37bbd1e843386969c2cfdf8a673a9ea62e73a1e331542132ff27a2dfe7e6e55c', stagedFileSha256: 'add774b7e3d446f13e00b9e72fd9b53f3f2861e772e9f8793b8ac5d7ae953e84', fenceSha256: 'cde7ce40b17eca6b25155180b446992996d59b2b20728108da2085ed6b774be1', fenceOrdinal: 1, fenceStartLine: 18, diagramSummary: 11, parity: 'IDENTICAL', renderBinding: "Render-time binding to deployed Diagram summary 11; the summary is not the canonical visual definition (ledger). Semantic definition: live source-native fence.", carriedEncodingRepairs: 'None inside the figure body (repairs noted by the ledger are in surrounding prose and are not carried into this asset).', note: "Ledger-verified source-native fence #1 at SECTION_7_7_BC_AQUATIC_DATABASE_DRAFT_TEXT.md:18; parity vs both deployed and staged Diagram summary 11 is IDENTICAL (source_native_parity.json)." } },
  { number: '7-6', historicalCaption: 'Environmental data compilation model.', referencePdfPage: 72, historicalPlacement: 'Section 7.7.2', currentPlacement: 'Section 7.7.2 (Diagram summary 12)', implementation: 'rendered-current', contentSource: CURRENT_SUMMARY, disposition: 'CURRENT_CONTENT_RESTORE', reuseOf: null, remainingDecision: 'Final placement and asset hash in the frozen release contract.', semanticAssetId: null, candidatePacketSha256: null, placement: 'inline+lab', visibleStatus: VISIBLE_STATUS_RESTORE, accessibleEquivalent: REAL_TEXT_EQUIVALENT, lineage: { ledgerSha256: FIGURE_SOURCE_LEDGER.sha256, kind: 'source-native-fence', sourceFile: 'SECTION_7_7_BC_AQUATIC_DATABASE_DRAFT_TEXT.md', liveFileSha256: '37bbd1e843386969c2cfdf8a673a9ea62e73a1e331542132ff27a2dfe7e6e55c', stagedFileSha256: 'add774b7e3d446f13e00b9e72fd9b53f3f2861e772e9f8793b8ac5d7ae953e84', fenceSha256: '4be4d5982cd42e2ff07387f0de7b70ab3f36b745433407938fb1d36b217649ff', fenceOrdinal: 2, fenceStartLine: 66, diagramSummary: 12, parity: 'IDENTICAL', renderBinding: "Render-time binding to deployed Diagram summary 12; the summary is not the canonical visual definition (ledger). Semantic definition: live source-native fence.", carriedEncodingRepairs: 'None inside the figure body (repairs noted by the ledger are in surrounding prose and are not carried into this asset).', note: "Ledger-verified source-native fence #2 at SECTION_7_7_BC_AQUATIC_DATABASE_DRAFT_TEXT.md:66; parity vs both deployed and staged Diagram summary 12 is IDENTICAL (source_native_parity.json)." } },
  {
    number: '7-7', historicalCaption: 'Input parameter inventory and selection options.', referencePdfPage: 75, historicalPlacement: 'Section 7.8', currentPlacement: 'candidate: Section 7.8 Input Parameter Inventory and Selection Options', implementation: 'candidate-prototype-nonfinal',
    contentSource: `Matrix MC content candidate mx-asset-parameter-evidence-modules (packet sha256 ${FIGURE_CANDIDATE_PACKET.packetSha256}, YELLOW draft); five-module architecture with status gates, no activated values; see figure-candidates.ts.`,
    disposition: 'REAUTHOR_FIVE_MODULE_ARCHITECTURE_WITH_STATUS_GATES', reuseOf: null,
    remainingDecision: 'Matrix MC to accept the five-module category structure and status-gate language of mx-asset-parameter-evidence-modules (packet section 5); no parameter value may be activated at this placement until a future registry record passes the shared evidence gate and independent verification.',
    semanticAssetId: 'mx-asset-parameter-evidence-modules', candidatePacketSha256: FIGURE_CANDIDATE_PACKET.packetSha256,
    placement: 'lab-only',
    visibleStatus: 'Matrix MC content candidate - not final and not scientifically accepted.',
    accessibleEquivalent: CANDIDATE_ACCESSIBLE_EQUIVALENT,
    lineage: {
      ledgerSha256: FIGURE_SOURCE_LEDGER.sha256,
      kind: 'packet-candidate',
      sourceFile: null, liveFileSha256: null, stagedFileSha256: null,
      fenceSha256: null, fenceOrdinal: null, fenceStartLine: null, diagramSummary: null, parity: null,
      renderBinding: 'No live diagram-summary rendering at this placement; the figure lab draws this row from figure-candidates.ts (Matrix MC content candidate), not a deployed Diagram summary, and not from a source-native fence in the seven-file ledger.',
      carriedEncodingRepairs: 'Not applicable: this row is not a source-native fence, so the ledger carries no repair-token check for it.',
      note: `No source-native fence exists for Figure 7-7 in the current trees (source_native_parity.json). Content candidate: MATRIX_FOUNDATIONAL_FIGURE_CONTENT_CANDIDATES_20260924.md, sha256 ${FIGURE_CANDIDATE_PACKET.packetSha256}.`,
    },
  },
  { number: 'A-1', historicalCaption: 'The two bioavailability pathways.', referencePdfPage: 173, historicalPlacement: 'Appendix A 1.1', currentPlacement: 'Appendix A 1.1 (Diagram summary 1)', implementation: 'rendered-current-math-notation', contentSource: `${CURRENT_SUMMARY}; ASCII math rendered as notation`, disposition: 'NOTATION_ONLY_VARIANT', reuseOf: null, remainingDecision: 'Bind semantic notation tokens in the final register.', semanticAssetId: null, candidatePacketSha256: null, placement: 'inline+lab', visibleStatus: VISIBLE_STATUS_NOTATION_ONLY, accessibleEquivalent: REAL_TEXT_EQUIVALENT, lineage: { ledgerSha256: FIGURE_SOURCE_LEDGER.sha256, kind: 'source-native-fence', sourceFile: 'APPENDIX_A_BIOAVAILABILITY_RESEARCH_REPORT.md', liveFileSha256: '77aa94738e89d49c204b026fd5988c1ee0d2884b43010c7c2df06b9cb08ec7f7', stagedFileSha256: '08aac3d88a2a03f85da2c9fc0a88d20607d91edd9737fdb2cef643999b28b319', fenceSha256: 'fadf5cc1dc51413fda62b771c6227e722f74fb36711ac9b3a5a5610d61f6456a', fenceOrdinal: 1, fenceStartLine: 89, diagramSummary: 1, parity: 'IDENTICAL', renderBinding: "Render-time binding to deployed Diagram summary 1; the summary is not the canonical visual definition (ledger). Semantic definition: live source-native fence.", carriedEncodingRepairs: 'None inside the figure body (repairs noted by the ledger are in surrounding prose and are not carried into this asset).', note: "Ledger-verified source-native fence #1 at APPENDIX_A_BIOAVAILABILITY_RESEARCH_REPORT.md:89; parity vs both deployed and staged Diagram summary 1 is IDENTICAL (source_native_parity.json)." } },
  { number: 'A-2', historicalCaption: 'Equilibrium partitioning (EqP) phase distribution.', referencePdfPage: 178, historicalPlacement: 'Appendix A 3.1', currentPlacement: 'Appendix A 3.1 (Diagram summary 2)', implementation: 'rendered-current', contentSource: CURRENT_SUMMARY, disposition: 'CURRENT_CONTENT_RESTORE', reuseOf: null, remainingDecision: 'Final placement and asset hash in the frozen release contract.', semanticAssetId: null, candidatePacketSha256: null, placement: 'inline+lab', visibleStatus: VISIBLE_STATUS_RESTORE, accessibleEquivalent: REAL_TEXT_EQUIVALENT, lineage: { ledgerSha256: FIGURE_SOURCE_LEDGER.sha256, kind: 'source-native-fence', sourceFile: 'APPENDIX_A_BIOAVAILABILITY_RESEARCH_REPORT.md', liveFileSha256: '77aa94738e89d49c204b026fd5988c1ee0d2884b43010c7c2df06b9cb08ec7f7', stagedFileSha256: '08aac3d88a2a03f85da2c9fc0a88d20607d91edd9737fdb2cef643999b28b319', fenceSha256: '2a29e73257ced3b7b6580cef9c2d79174a3e2a0fb14370aacfee89d0173ed4fe', fenceOrdinal: 2, fenceStartLine: 169, diagramSummary: 2, parity: 'IDENTICAL', renderBinding: "Render-time binding to deployed Diagram summary 2; the summary is not the canonical visual definition (ledger). Semantic definition: live source-native fence.", carriedEncodingRepairs: 'None inside the figure body (repairs noted by the ledger are in surrounding prose and are not carried into this asset).', note: "Ledger-verified source-native fence #2 at APPENDIX_A_BIOAVAILABILITY_RESEARCH_REPORT.md:169; parity vs both deployed and staged Diagram summary 2 is IDENTICAL (source_native_parity.json)." } },
  { number: 'A-3', historicalCaption: 'AVS-SEM metal displacement and neutralization.', referencePdfPage: 183, historicalPlacement: 'Appendix A 4.1', currentPlacement: 'Appendix A 4.1 (Diagram summary 3)', implementation: 'rendered-current-math-notation', contentSource: `${CURRENT_SUMMARY}; ASCII math rendered as notation`, disposition: 'NOTATION_ONLY_VARIANT', reuseOf: null, remainingDecision: 'Bind semantic notation tokens in the final register.', semanticAssetId: null, candidatePacketSha256: null, placement: 'inline+lab', visibleStatus: VISIBLE_STATUS_NOTATION_ONLY, accessibleEquivalent: REAL_TEXT_EQUIVALENT, lineage: { ledgerSha256: FIGURE_SOURCE_LEDGER.sha256, kind: 'source-native-fence', sourceFile: 'APPENDIX_A_BIOAVAILABILITY_RESEARCH_REPORT.md', liveFileSha256: '77aa94738e89d49c204b026fd5988c1ee0d2884b43010c7c2df06b9cb08ec7f7', stagedFileSha256: '08aac3d88a2a03f85da2c9fc0a88d20607d91edd9737fdb2cef643999b28b319', fenceSha256: 'b36e5c1967aacf782e697a9ff371618532ac27d8b880d70c4b0850bc8115f75f', fenceOrdinal: 3, fenceStartLine: 302, diagramSummary: 3, parity: 'IDENTICAL', renderBinding: "Render-time binding to deployed Diagram summary 3; the summary is not the canonical visual definition (ledger). Semantic definition: live source-native fence.", carriedEncodingRepairs: 'None inside the figure body (repairs noted by the ledger are in surrounding prose and are not carried into this asset).', note: "Ledger-verified source-native fence #3 at APPENDIX_A_BIOAVAILABILITY_RESEARCH_REPORT.md:302; parity vs both deployed and staged Diagram summary 3 is IDENTICAL (source_native_parity.json)." } },
  { number: 'A-4', historicalCaption: 'Tiered bioavailability decision tree.', referencePdfPage: 195, historicalPlacement: 'Appendix A 8.5', currentPlacement: 'Appendix A 8.5 (Diagram summary 4)', implementation: 'rendered-current-math-notation', contentSource: `${CURRENT_SUMMARY}; ASCII math rendered as notation`, disposition: 'NOTATION_ONLY_VARIANT', reuseOf: null, remainingDecision: 'Bind semantic notation tokens in the final register.', semanticAssetId: null, candidatePacketSha256: null, placement: 'inline+lab', visibleStatus: VISIBLE_STATUS_NOTATION_ONLY, accessibleEquivalent: REAL_TEXT_EQUIVALENT, lineage: { ledgerSha256: FIGURE_SOURCE_LEDGER.sha256, kind: 'source-native-fence', sourceFile: 'APPENDIX_A_BIOAVAILABILITY_RESEARCH_REPORT.md', liveFileSha256: '77aa94738e89d49c204b026fd5988c1ee0d2884b43010c7c2df06b9cb08ec7f7', stagedFileSha256: '08aac3d88a2a03f85da2c9fc0a88d20607d91edd9737fdb2cef643999b28b319', fenceSha256: '92f81dbcbdb74fe30a0d11521b53ca98f4ef60d3fae48168969fdef2d2081ec3', fenceOrdinal: 4, fenceStartLine: 568, diagramSummary: 4, parity: 'IDENTICAL', renderBinding: "Render-time binding to deployed Diagram summary 4; the summary is not the canonical visual definition (ledger). Semantic definition: live source-native fence.", carriedEncodingRepairs: 'None inside the figure body (repairs noted by the ledger are in surrounding prose and are not carried into this asset).', note: "Ledger-verified source-native fence #4 at APPENDIX_A_BIOAVAILABILITY_RESEARCH_REPORT.md:568; parity vs both deployed and staged Diagram summary 4 is IDENTICAL (source_native_parity.json)." } },
  {
    number: 'B-1', historicalCaption: 'The two bioaccumulation pathways.', referencePdfPage: 204, historicalPlacement: 'Appendix B 1.1', currentPlacement: 'candidate: Appendix B Bioaccumulation evidence inventory', implementation: 'candidate-prototype-nonfinal',
    contentSource: `Matrix MC content candidate mx-asset-bioaccumulation-pathways (packet sha256 ${FIGURE_CANDIDATE_PACKET.packetSha256}, YELLOW draft), shared with Figure 7-1 as one semantic asset; see figure-candidates.ts.`,
    disposition: 'ONE_SEMANTIC_ASSET_TWO_PLACEMENTS', reuseOf: null,
    remainingDecision: "Matrix MC to accept the node wording and statuses of mx-asset-bioaccumulation-pathways and this Figure B-1 caption, after the grill-to-V16 parameter conflict (packet section 10) is resolved; the candidate receptor examples in Pathway 4 still need source-level and applicability review (packet section 4); final adoption also depends on Figure 6-1's SedS-contact/SedS-food nomenclature ripple (packet section 3), since this asset reuses those pathway names.",
    semanticAssetId: 'mx-asset-bioaccumulation-pathways', candidatePacketSha256: FIGURE_CANDIDATE_PACKET.packetSha256,
    placement: 'lab-only',
    visibleStatus: 'Matrix MC content candidate - not final and not scientifically accepted.',
    accessibleEquivalent: CANDIDATE_ACCESSIBLE_EQUIVALENT,
    lineage: {
      ledgerSha256: FIGURE_SOURCE_LEDGER.sha256,
      kind: 'packet-candidate',
      sourceFile: null, liveFileSha256: null, stagedFileSha256: null,
      fenceSha256: null, fenceOrdinal: null, fenceStartLine: null, diagramSummary: null, parity: null,
      renderBinding: 'No live diagram-summary rendering at this placement; the figure lab draws this row from figure-candidates.ts (Matrix MC content candidate), not a deployed Diagram summary, and not from a source-native fence in the seven-file ledger.',
      carriedEncodingRepairs: 'Not applicable: this row is not a source-native fence, so the ledger carries no repair-token check for it.',
      note: `No source-native fence exists for Figure B-1 in the current trees (source_native_parity.json). Content candidate: MATRIX_FOUNDATIONAL_FIGURE_CONTENT_CANDIDATES_20260924.md, sha256 ${FIGURE_CANDIDATE_PACKET.packetSha256}.`,
    },
  },
  { number: 'E-1', historicalCaption: 'CSR Schedule 3.4 Part 1 matrix architecture.', referencePdfPage: 281, historicalPlacement: 'Appendix E E.1.1', currentPlacement: 'Appendix E E.1.1 (Diagram summary 5)', implementation: 'rendered-current', contentSource: CURRENT_SUMMARY, disposition: 'CURRENT_CONTENT_RESTORE', reuseOf: null, remainingDecision: 'Final placement and asset hash; E-1 is also the single asset for 7-2.', semanticAssetId: null, candidatePacketSha256: null, placement: 'inline+lab', visibleStatus: VISIBLE_STATUS_RESTORE, accessibleEquivalent: REAL_TEXT_EQUIVALENT, lineage: { ledgerSha256: FIGURE_SOURCE_LEDGER.sha256, kind: 'source-native-fence', sourceFile: 'APPENDIX_E_MATRIX_DERIVATION_OPTIONS_REVIEW.md', liveFileSha256: '6f46fb12b75519841f6fbb6eed5c224f4659fbbbe987100f85e05682d8758c52', stagedFileSha256: 'f3be080af4bfc69ccc81f4872d41b6bd33e4308c2b0a5e988af6b0e276a86eb0', fenceSha256: '6d5d6ed2c05a004123f4688581633418448c79223a858467a85a557baf9716ae', fenceOrdinal: 1, fenceStartLine: 79, diagramSummary: 5, parity: 'IDENTICAL', renderBinding: "Render-time binding to deployed Diagram summary 5; the summary is not the canonical visual definition (ledger). Semantic definition: live source-native fence.", carriedEncodingRepairs: 'None inside the figure body (repairs noted by the ledger are in surrounding prose and are not carried into this asset).', note: "Ledger-verified source-native fence #1 at APPENDIX_E_MATRIX_DERIVATION_OPTIONS_REVIEW.md:79; parity vs both deployed and staged Diagram summary 5 is IDENTICAL (source_native_parity.json)." } },
  { number: 'F-1', historicalCaption: 'Generic standards adoption architecture.', referencePdfPage: 305, historicalPlacement: 'Appendix F 1.1', currentPlacement: 'Appendix F 1.1 (Diagram summary 6)', implementation: 'rendered-current', contentSource: CURRENT_SUMMARY, disposition: 'CURRENT_CONTENT_RESTORE', reuseOf: null, remainingDecision: 'Final placement and asset hash in the frozen release contract.', semanticAssetId: null, candidatePacketSha256: null, placement: 'inline+lab', visibleStatus: VISIBLE_STATUS_RESTORE, accessibleEquivalent: REAL_TEXT_EQUIVALENT, lineage: { ledgerSha256: FIGURE_SOURCE_LEDGER.sha256, kind: 'source-native-fence', sourceFile: 'APPENDIX_F_GENERIC_STANDARDS_ADOPTION_PROCEDURE.md', liveFileSha256: 'b7d0c2c2a528dbe21bbe02ddf518a088fc8f6a16d45b599bda712533230558f0', stagedFileSha256: '4d10840f0ac9610ea6acb5871e048ecb997b7fc92f08466a8dbf31b0806e51d6', fenceSha256: 'c1d72bb4a16b48435fea6c52db3b64eec405d3b9136a7d1a8e16d6a56e4424c6', fenceOrdinal: 1, fenceStartLine: 55, diagramSummary: 6, parity: 'IDENTICAL', renderBinding: "Render-time binding to deployed Diagram summary 6; the summary is not the canonical visual definition (ledger). Semantic definition: live source-native fence.", carriedEncodingRepairs: 'None inside the figure body (repairs noted by the ledger are in surrounding prose and are not carried into this asset).', note: "Ledger-verified source-native fence #1 at APPENDIX_F_GENERIC_STANDARDS_ADOPTION_PROCEDURE.md:55; parity vs both deployed and staged Diagram summary 6 is IDENTICAL (source_native_parity.json)." } },
  { number: 'F-2', historicalCaption: 'Step-by-Step generic adoption & mathematical harmonization workflow.', referencePdfPage: 310, historicalPlacement: 'Appendix F 4.0', currentPlacement: 'Appendix F 4.0 (Diagram summary 7)', implementation: 'rendered-current', contentSource: `${CURRENT_SUMMARY} (Classification Category 2 entry condition)`, disposition: 'CURRENT_CONTENT_DIRECTION_ACCEPTED', reuseOf: null, remainingDecision: 'Final placement and asset hash; the obsolete Tranche 3 wording is not to be restored.', semanticAssetId: null, candidatePacketSha256: null, placement: 'inline+lab', visibleStatus: VISIBLE_STATUS_DIRECTION_ACCEPTED, accessibleEquivalent: REAL_TEXT_EQUIVALENT, lineage: { ledgerSha256: FIGURE_SOURCE_LEDGER.sha256, kind: 'source-native-fence', sourceFile: 'APPENDIX_F_GENERIC_STANDARDS_ADOPTION_PROCEDURE.md', liveFileSha256: 'b7d0c2c2a528dbe21bbe02ddf518a088fc8f6a16d45b599bda712533230558f0', stagedFileSha256: '4d10840f0ac9610ea6acb5871e048ecb997b7fc92f08466a8dbf31b0806e51d6', fenceSha256: '44e659f80b7e69bdbb9fb291b45be523d00f52168c560a32602f6d1a6a878461', fenceOrdinal: 2, fenceStartLine: 127, diagramSummary: 7, parity: 'IDENTICAL', renderBinding: "Render-time binding to deployed Diagram summary 7; the summary is not the canonical visual definition (ledger). Semantic definition: live source-native fence.", carriedEncodingRepairs: 'None inside the figure body (repairs noted by the ledger are in surrounding prose and are not carried into this asset).', note: "Ledger-verified source-native fence #2 at APPENDIX_F_GENERIC_STANDARDS_ADOPTION_PROCEDURE.md:127; parity vs both deployed and staged Diagram summary 7 is IDENTICAL (source_native_parity.json)." } },
  { number: 'G-1', historicalCaption: 'The four core pillars of the BC aquatic database.', referencePdfPage: 321, historicalPlacement: 'Appendix G 1.2', currentPlacement: 'candidate: Appendix G (referenced duplicate)', implementation: 'referenced-duplicate', contentSource: 'the Figure 7-5 asset (single scientific asset)', disposition: 'RESTORE_AS_REFERENCED_DUPLICATE_PRESENTATION', reuseOf: '7-5', remainingDecision: 'Bind G-1 to the 7-5 asset in the release register; confirm the Appendix G placement.', semanticAssetId: null, candidatePacketSha256: null, placement: 'lab-only', visibleStatus: visibleStatusReferencedDuplicate('7-5'), accessibleEquivalent: REAL_TEXT_EQUIVALENT, lineage: { ledgerSha256: FIGURE_SOURCE_LEDGER.sha256, kind: 'referenced-duplicate', sourceFile: 'SECTION_7_7_BC_AQUATIC_DATABASE_DRAFT_TEXT.md', liveFileSha256: '37bbd1e843386969c2cfdf8a673a9ea62e73a1e331542132ff27a2dfe7e6e55c', stagedFileSha256: 'add774b7e3d446f13e00b9e72fd9b53f3f2861e772e9f8793b8ac5d7ae953e84', fenceSha256: 'cde7ce40b17eca6b25155180b446992996d59b2b20728108da2085ed6b774be1', fenceOrdinal: 1, fenceStartLine: 18, diagramSummary: 11, parity: 'IDENTICAL', renderBinding: "Render-time binding to deployed Diagram summary 11, inherited from Figure 7-5 (the single scientific asset both placements reuse); the summary is not the canonical visual definition (ledger). Semantic definition: live source-native fence.", carriedEncodingRepairs: 'None inside the figure body (repairs noted by the ledger are in surrounding prose and are not carried into this asset).', note: "Referenced duplicate: inherits Figure 7-5's source-native fence fields verbatim, per FIGURE_REGISTER reuseOf. Same fence #1 at SECTION_7_7_BC_AQUATIC_DATABASE_DRAFT_TEXT.md:18." } },
  {
    number: 'G-2', historicalCaption: 'Proposed relational schema -- not implemented.', referencePdfPage: 325, historicalPlacement: 'Appendix G 4.1', currentPlacement: 'none (historical only); candidate: Section 7.7.3 four-stage V&V workflow', implementation: 'historical-proposal-layout-only',
    contentSource: `Historical relational-schema caption is retained as provenance only. The proposed Figure G-2 workflow is shown in the figure lab from candidate asset mx-asset-database-vv-workflow (packet sha256 ${FIGURE_CANDIDATE_PACKET.packetSha256}); canonical semantic source FIGG2 is APPENDIX_G_BC_AQUATIC_DATABASE_SUMMARY.md#FIGG2.`,
    disposition: 'DO_NOT_RESTORE_AS_CURRENT_SCHEMA', reuseOf: null,
    remainingDecision: 'The proposed four-stage verification and validation workflow remains lab-only and non-final; final binding pending. No complete resource has passed all stages. The historical relational-schema caption remains provenance only.',
    semanticAssetId: 'mx-asset-database-vv-workflow', candidatePacketSha256: FIGURE_CANDIDATE_PACKET.packetSha256,
    canonicalSemanticSource: figureCandidateAsset('mx-asset-database-vv-workflow')?.canonicalSemanticSource,
    placement: 'lab-only',
    visibleStatus: 'Historical relational-schema figure remains historical only. Proposed Figure G-2: PROPOSED; NO COMPLETE RESOURCE PASSED. Lab-only, non-final, final binding pending.',
    accessibleEquivalent: CANDIDATE_ACCESSIBLE_EQUIVALENT,
    lineage: {
      ledgerSha256: FIGURE_SOURCE_LEDGER.sha256,
      kind: 'historical-only',
      sourceFile: null, liveFileSha256: null, stagedFileSha256: null,
      fenceSha256: null, fenceOrdinal: null, fenceStartLine: null, diagramSummary: null, parity: null,
      renderBinding: 'No live diagram-summary rendering: the historical relational schema is layout-only (LAYOUT_SKELETONS[\'G-2\']), drawn from the v1.0 block structure, not from a source-native fence in the seven-file ledger.',
      carriedEncodingRepairs: 'Not applicable: the historical layout skeleton carries no scientific text, so there is no fence body to check for carried repair tokens.',
      note: `Historical relational schema remains historical only. The proposed G-2 candidate packet (${FIGURE_CANDIDATE_PACKET.packetFile}, sha256 ${FIGURE_CANDIDATE_PACKET.packetSha256}) is bound to canonical semantic source FIGG2 at APPENDIX_G_BC_AQUATIC_DATABASE_SUMMARY.md#FIGG2; packet fence bytes and canonical semantic digest are separate identities.`,
    },
  },
  {
    number: 'G-3', historicalCaption: 'Empirical application to Schedule 3.4 matrix standards derivation.', referencePdfPage: 329, historicalPlacement: 'Appendix G 6.0', currentPlacement: 'candidate: Appendix G BC Aquatic Database evidence architecture', implementation: 'candidate-prototype-nonfinal',
    contentSource: `Matrix MC content candidate mx-asset-future-pathway-testing (packet sha256 ${FIGURE_CANDIDATE_PACKET.packetSha256}, YELLOW draft); future-testing language only, not current empirical validation; see figure-candidates.ts.`,
    disposition: 'REAUTHOR_AS_FUTURE_TESTING', reuseOf: null,
    remainingDecision: 'Matrix MC to accept the future-tense testing language of mx-asset-future-pathway-testing (packet section 6); the FUTURE QA/QC-SCREENED BC AQUATIC DATABASE does not yet exist in the V16 candidate source, and no data have passed its proposed QA/QC process (packet section 6); the canonical source baseline is not yet selected (packet section 1).',
    semanticAssetId: 'mx-asset-future-pathway-testing', candidatePacketSha256: FIGURE_CANDIDATE_PACKET.packetSha256,
    placement: 'lab-only',
    visibleStatus: 'Matrix MC content candidate - not final and not scientifically accepted.',
    accessibleEquivalent: CANDIDATE_ACCESSIBLE_EQUIVALENT,
    lineage: {
      ledgerSha256: FIGURE_SOURCE_LEDGER.sha256,
      kind: 'packet-candidate',
      sourceFile: null, liveFileSha256: null, stagedFileSha256: null,
      fenceSha256: null, fenceOrdinal: null, fenceStartLine: null, diagramSummary: null, parity: null,
      renderBinding: 'No live diagram-summary rendering at this placement; the figure lab draws this row from figure-candidates.ts (Matrix MC content candidate), not a deployed Diagram summary, and not from a source-native fence in the seven-file ledger.',
      carriedEncodingRepairs: 'Not applicable: this row is not a source-native fence, so the ledger carries no repair-token check for it.',
      note: `No source-native fence exists for Figure G-3 in the current trees (source_native_parity.json). Content candidate: MATRIX_FOUNDATIONAL_FIGURE_CONTENT_CANDIDATES_20260924.md, sha256 ${FIGURE_CANDIDATE_PACKET.packetSha256}.`,
    },
  },
  {
    number: 'H-1', historicalCaption: 'Legislative context: the Environmental Management Act, the CSR and Schedule 3.4.', referencePdfPage: 340, historicalPlacement: 'Appendix H 1.1', currentPlacement: 'candidate: Appendix H Policy-ready input parameter compendium', implementation: 'candidate-prototype-nonfinal',
    contentSource: `Proposed evidence-governance flow for future records, not a source hierarchy. Candidate asset mx-asset-parameter-evidence-governance (packet sha256 ${FIGURE_CANDIDATE_PACKET.packetSha256}) is bound to canonical semantic source FIGH1 at APPENDIX_H_POLICY_READY_INPUT_PARAMETER_COMPENDIUM.md#FIGH1.`,
    disposition: 'OWNER_DISPOSITION_H1_A_EVIDENCE_GOVERNANCE_FLOW', reuseOf: null,
    remainingDecision: 'The proposed evidence-governance flow remains lab-only and non-final; final binding pending. It does not accept any source, parameter, method, equation, or calculation. Unverified records remain ineligible for active calculation use.',
    semanticAssetId: 'mx-asset-parameter-evidence-governance', candidatePacketSha256: FIGURE_CANDIDATE_PACKET.packetSha256,
    canonicalSemanticSource: figureCandidateAsset('mx-asset-parameter-evidence-governance')?.canonicalSemanticSource,
    placement: 'lab-only',
    visibleStatus: 'PROPOSED; FAIL-CLOSED. Lab-only, non-final, final binding pending; no unverified record is eligible for active calculation use.',
    accessibleEquivalent: CANDIDATE_ACCESSIBLE_EQUIVALENT,
    lineage: {
      ledgerSha256: FIGURE_SOURCE_LEDGER.sha256,
      kind: 'packet-candidate',
      sourceFile: null, liveFileSha256: null, stagedFileSha256: null,
      fenceSha256: null, fenceOrdinal: null, fenceStartLine: null, diagramSummary: null, parity: null,
      renderBinding: 'No live diagram-summary rendering at this placement; the figure lab draws this row from figure-candidates.ts (Matrix MC content candidate), not a deployed Diagram summary, and not from a source-native fence in the seven-file ledger.',
      carriedEncodingRepairs: 'Not applicable: this row is not a source-native fence, so the ledger carries no repair-token check for it.',
      note: `Candidate packet (${FIGURE_CANDIDATE_PACKET.packetFile}, sha256 ${FIGURE_CANDIDATE_PACKET.packetSha256}) is bound to canonical semantic source FIGH1 at APPENDIX_H_POLICY_READY_INPUT_PARAMETER_COMPENDIUM.md#FIGH1; packet fence bytes and canonical semantic digest are separate identities.`,
    },
  },
];

/** Structure-only skeletons of figures with no Matrix MC content candidate yet (from the v1.0 layouts; no text). Only G-2's remains: 7-1, B-1, 7-7, G-3 and H-1 are now drawn from their figure-candidates.ts content candidate instead (see FIGURE_REGISTER contentSource for each). */
interface Skeleton {
  readonly layout: DiagramModel['layout'];
  readonly nodes: readonly { readonly id: string; readonly label: string; readonly lines: readonly string[] }[];
  readonly edges: readonly (readonly [string, string])[];
  readonly structureSha256: string;
}

/**
 * structureSha256 = sha256 of the v1.0 diagram block the layout was taken from, as recorded in the L2 reconciliation
 * packet ledger (MATRIX_MC_RECONCILIATION_PACKET.md, sha256 1b960572...54b95). Only node ids, box counts and edges
 * were taken; no text.
 */
export const LAYOUT_SKELETONS: Readonly<Record<string, Skeleton>> = {
  'G-2': { layout: 'tree', structureSha256: 'f3a0a1526d9b1222d86e3e724bceab6e4e8d693503323731df52ca832a14d8af', edges: [['a', 'b'], ['b', 'c'], ['c', 'd'], ['c', 'e'], ['c', 'f'], ['c', 'g'], ['g', 'h']], nodes: [
    ...['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id, index) => ({ id, label: `Box ${index + 1}`, lines: ['Historical proposal only'] })),
  ] },
};

/** A layout-only model for a figure awaiting content; null for any other figure. */
export function layoutPrototypeModel(number: string): DiagramModel | null {
  const skeleton = LAYOUT_SKELETONS[number];
  if (!skeleton) return null;
  return {
    summaryNumber: 0,
    layout: skeleton.layout,
    title: null,
    nodes: skeleton.nodes.map((node) => ({ id: node.id, label: node.label, heads: [], bullets: [...node.lines] })),
    edges: skeleton.edges.map(([from, to]) => ({ from, to, label: null })),
    notes: [],
    items: [],
  };
}

export function layoutPrototypeBinding(row: FigureRegisterRow): FigureBinding {
  const historical = row.implementation === 'historical-proposal-layout-only';
  return {
    kind: 'prototype',
    id: row.number,
    label: `Figure ${row.number}`,
    caption: row.historicalCaption,
    sourceSha256: LAYOUT_SKELETONS[row.number]?.structureSha256 ?? '',
    status: historical ? 'historical-proposal' : 'layout-prototype',
    statusNote: historical
      ? 'Historical proposal - not current design. Layout only; the current paper states that no such scheme has been designed, specified or built.'
      : `Layout-only prototype. Content awaits Matrix MC reauthoring (${row.disposition}).`,
    notation: 'plain',
    labelOverrides: null,
    overrideAuthority: null,
  };
}

/** A referenced-duplicate placement reuses the named figure's binding, relabelled with its own historical number. */
export function duplicateBinding(row: FigureRegisterRow, asset: FigureBinding): FigureBinding {
  return {
    ...asset,
    id: row.number,
    label: `Figure ${row.number}`,
    caption: `${row.historicalCaption} Same scientific asset as Figure ${row.reuseOf}.`,
    status: 'current',
    statusNote: null,
  };
}

export const FIGURE_REGISTER_AUTHORITY = FIGURE_ADJUDICATION;

/** The internal figure lab route renders only when this is exactly "true" (and the paper workspace is on). */
export const MATRIX_OPTIONS_PAPER_FIGURE_LAB_FLAG = 'MATRIX_OPTIONS_PAPER_FIGURE_LAB';
