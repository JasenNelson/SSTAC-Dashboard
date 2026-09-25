/*
 * Matrix MC figure content candidates (2026-09-24 packet). Six semantic assets,
 * each the verbatim ```text fence body from
 * MATRIX_FOUNDATIONAL_FIGURE_CONTENT_CANDIDATES_20260924.md (FIGURE_CANDIDATE_PACKET),
 * reviewed YELLOW_DRAFT_SAFE_FOR_L2_PROTOTYPING_NOT_FOR_FINAL_BINDING by
 * MATRIX_FOUNDATIONAL_FIGURE_CONTENT_CANDIDATES_REVIEW_20260924.md.
 *
 * The fence text below is copied verbatim (extracted programmatically from the
 * packet, never retyped) and must never be reworded, shortened, merged, or
 * extended with additional scientific words. Every constant's sha256 is
 * verified against the packet in figure-candidates.test.ts and independently by
 * .tmp/run-mo-paper-figures-20260924/verify_candidate_blocks.ts.
 *
 * This packet is a content CANDIDATE, not accepted scientific content: every
 * binding built from it carries status `candidate-nonfinal` and a visible
 * statusNote naming the packet hash and verdict (see candidateBinding).
 */

import type { DiagramModel, FigureBinding } from './figures';

export const FIGURE_CANDIDATE_PACKET = {
  packetFile: 'MATRIX_FOUNDATIONAL_FIGURE_CONTENT_CANDIDATES_20260924.md',
  packetSha256: 'ffe4281c6ccd6e8e46c9d6b10b46aacfdf85b35e32fc3b8212a7ef8627fb24cc',
  reviewFile: 'MATRIX_FOUNDATIONAL_FIGURE_CONTENT_CANDIDATES_REVIEW_20260924.md',
  reviewSha256: '24db02f4b780d1de9567f3962148908ab18f83c6bd14047405d92c0c031d05b7',
  verdict: 'YELLOW_DRAFT_SAFE_FOR_L2_PROTOTYPING_NOT_FOR_FINAL_BINDING',
} as const;

/** How an asset's edge list was derived from the packet (never inferred generically). */
export type CandidateEdgeBasis = 'packet-explicit' | 'packet-root-hierarchy' | 'packet-sequence';

export interface CandidateEdge {
  readonly from: string;
  readonly to: string;
  readonly basis: CandidateEdgeBasis;
}

/**
 * One semantic asset (one fence) and the register placement(s) that draw it.
 * A placement id is a figure-register number: '6-1', '7-1', 'B-1', '7-7', 'G-3',
 * 'H-1', or the two G-2 replacement treatments 'G-2A' (workflow replaces G-2)
 * and 'G-2B' (G-2 stays historical; workflow gets a new number).
 */
export interface FigureCandidateAsset {
  readonly assetId: string;
  /** Packet section number and figure label, e.g. "4 (7-1/B-1)". */
  readonly packetSection: string;
  /** Verbatim text between the ```text fence lines, lines joined by "\n", no trailing newline. */
  readonly fenceText: string;
  /** sha256 (hex) of fenceText, utf8. */
  readonly fenceSha256: string;
  /** Verbatim backticked caption candidate from the packet, including its lead-in words. */
  readonly captionCandidate: string;
  /** The fence's own "Edges: ..." line (6-1 only); consumed by the parser as the edge list, not as text. */
  readonly edgesSourceLine: string | null;
  /** The fence's Status / Global status text, or (H-1, which has neither) the packet's section disposition. Feeds candidateBinding's statusNote. */
  readonly contentStatusText: string;
  readonly edges: readonly CandidateEdge[];
  /** Figure-register numbers this one semantic asset is placed at. */
  readonly placements: readonly string[];
}

const FIGURE_CANDIDATE_ASSET_DATA: readonly FigureCandidateAsset[] = [
  {
    assetId: 'mx-asset-receptor-pathways-4',
    packetSection: '3 (6-1)',
    fenceText: 'Root: SEDIMENT CONTAMINATION\nStatus: SETTLED_STRUCTURE\n\nPathway 1 - SedS-contactHH\nHuman direct contact\n- Relevant shoreline, harvesting, recreational, occupational, or other contact scenarios\n- Incidental ingestion and dermal exposure\n- Exposure factors and toxicological reference values require verified records\n\nPathway 2 - SedS-foodHH\nHuman food pathway\n- Sediment-associated contaminants in fish, shellfish, or other aquatic foods\n- Future seafood ingestion rate assigned per exposure scenario only after primary verification\n- Transfer-method and toxicological-reference selections remain open\n- Species-resolved diet, preparation, and harvest-area apportionment belong to site-specific assessment\n\nPathway 3 - SedS-contactECO\nEcological direct contact\n- Benthic and sediment-associated ecological receptors\n- Candidate methods include equilibrium partitioning and AVS-SEM where applicable\n- Chronic toxicity benchmark, waterbody applicability, and supporting parameters require verification\n\nPathway 4 - SedS-foodECO\nEcological food-web pathway\n- Sediment-to-prey-to-wildlife transfer\n- Candidate receptor classes include piscivorous birds and semi-aquatic or marine mammals\n- Receptor set, transfer method, food-web position, and wildlife toxicity references remain open or source-gapped\n\nEdges: Root -> Pathways 1, 2, 3, and 4',
    fenceSha256: 'a79a8fc81061926a326ef2b2ba4793a22e39dde0fe60d1242feb72fdc4933e2f',
    captionCandidate: "Figure 6-1. Proposed Part 1 framework: four receptor-pathways, using the Phase 1 SedS-contact and SedS-food nomenclature with the paper's pathway numbers.",
    edgesSourceLine: 'Edges: Root -> Pathways 1, 2, 3, and 4',
    contentStatusText: 'SETTLED_STRUCTURE',
    edges: [
      { from: 'root', to: 'p1', basis: 'packet-explicit' },
      { from: 'root', to: 'p2', basis: 'packet-explicit' },
      { from: 'root', to: 'p3', basis: 'packet-explicit' },
      { from: 'root', to: 'p4', basis: 'packet-explicit' },
    ],
    placements: ['6-1'],
  },
  {
    assetId: 'mx-asset-bioaccumulation-pathways',
    packetSection: '4 (7-1/B-1)',
    fenceText: 'Root: BIOACCUMULATION EVIDENCE FOR SEDIMENT\nStatus: OPTION_OPEN / SOURCE_GAP\n\nPathway 2 - SedS-foodHH\nSediment -> edible aquatic biota -> people\n- Required evidence: paired sediment and tissue observations, species and tissue identity, normalization basis, exposure duration, and site linkage\n- Future scenario-specific seafood ingestion rate requires exact primary-source verification\n- Empirical transfer, tissue-residue, mechanistic, and tiered methods remain options\n- No BSAF, intake rate, or toxicological-reference value is activated by this figure\n\nPathway 4 - SedS-foodECO\nSediment -> prey -> wildlife\n- Required evidence: prey and receptor identity, diet, food-web position, body size, ingestion, toxicological reference, and site linkage\n- Candidate receptor examples require source-level and applicability review\n- Empirical transfer, tissue-residue, mechanistic, and tiered methods remain options\n- No TMF, FCM, SUF, trophic level, receptor value, or wildlife TRV is activated by this figure\n\nShared evidence gate\n- Hold exact study or database record\n- Verify source location, units, medium, receptor, basis, applicability, and uncertainty\n- Independently review method and dimensional consistency\n- Only then may a future registry record be considered for use',
    fenceSha256: '3b07e16484e5cb6be2071af7f61d9fb3914c59a9551d25386071ea8a8c09c073',
    captionCandidate: 'Figures 7-1 and B-1. Bioaccumulation evidence pathways and the decisions still required before parameter use.',
    edgesSourceLine: null,
    contentStatusText: 'OPTION_OPEN / SOURCE_GAP',
    edges: [
      { from: 'root', to: 'p2', basis: 'packet-root-hierarchy' },
      { from: 'root', to: 'p4', basis: 'packet-root-hierarchy' },
    ],
    placements: ['7-1', 'B-1'],
  },
  {
    assetId: 'mx-asset-parameter-evidence-modules',
    packetSection: '5 (7-7)',
    fenceText: 'Root: FUTURE PARAMETER REGISTRY\nStatus: PROPOSED_SYSTEM / SOURCE_GAP\n\nModule 1 - Human exposure and contact\n- Body size\n- Sediment contact and ingestion\n- Exposure frequency and duration\n- Seafood or other aquatic-food intake\n- Tissue, preparation, and site linkage where applicable\n\nModule 2 - Human toxicological references and risk treatment\n- Toxicological reference identity and exact source\n- Exposure route and averaging basis\n- Non-cancer and cancer treatment\n- Applicability and uncertainty\n\nModule 3 - Ecological receptors, exposure, and toxicological references\n- Receptor identity and life stage\n- Body size, ingestion, diet, and food-web position\n- Toxicity or tissue-residue benchmark\n- Habitat, waterbody, and site linkage\n\nModule 4 - Sediment properties, direct-exposure methods, and analytical context\n- Organic carbon, lipid or protein basis, grain size, redox, pH, and related modifiers\n- Partitioning or AVS-SEM method where applicable\n- Waterbody-specific chronic benchmark\n- Analytical feasibility and method limitations\n\nModule 5 - Paired sediment, tissue, and transfer evidence\n- Co-located sediment and tissue observations\n- Species, tissue, normalization basis, and exposure duration\n- Empirical transfer or alternative method candidate\n- Provenance, uncertainty, and independent test\n\nEvery module passes through the shared evidence gate:\nsource + exact location + units + medium + receptor + applicability + uncertainty + independent review.',
    fenceSha256: '89725bfb4d60d26f65e6bfe6d609063e998e3c9fc893da75ab57e00a1b253929',
    captionCandidate: 'Figure 7-7. Five evidence modules for future matrix-standards parameter selection; categories are shown without activating values.',
    edgesSourceLine: null,
    contentStatusText: 'PROPOSED_SYSTEM / SOURCE_GAP',
    edges: [
      { from: 'root', to: 'm1', basis: 'packet-root-hierarchy' },
      { from: 'root', to: 'm2', basis: 'packet-root-hierarchy' },
      { from: 'root', to: 'm3', basis: 'packet-root-hierarchy' },
      { from: 'root', to: 'm4', basis: 'packet-root-hierarchy' },
      { from: 'root', to: 'm5', basis: 'packet-root-hierarchy' },
    ],
    placements: ['7-7'],
  },
  {
    assetId: 'mx-asset-future-pathway-testing',
    packetSection: '6 (G-3)',
    fenceText: 'Root: FUTURE QA/QC-SCREENED BC AQUATIC DATABASE\nStatus: PROPOSED_SYSTEM - no data compiled, screened, or verified\n\nPathway 1 - SedS-contactHH\n- Use shoreline sediment properties and contact evidence to test human direct-contact assumptions\n\nPathway 2 - SedS-foodHH\n- Use co-located sediment and edible-biota tissue records to evaluate empirical transfer\n- Evaluate seafood-exposure models only against a future, source-verified scenario-specific ingestion record\n\nPathway 3 - SedS-contactECO\n- Compare sediment chemistry and modifiers with benthic bioassay and community evidence\n- Test candidate equilibrium-partitioning and AVS-SEM methods where applicable\n\nPathway 4 - SedS-foodECO\n- Compare sediment-to-prey monitoring evidence with candidate wildlife food-web methods\n- Evaluate receptor and transfer assumptions only after source and applicability review\n\nFooter: No candidate equation has been tested, calibrated, or validated against a dataset; no Part 1 algorithm has been established.',
    fenceSha256: 'd339da0f4a5db590035c3605a5eeff3bb57de942f48f7cfa4623f558a8caad3b',
    captionCandidate: 'Figure G-3. Intended future use of a QA/QC-screened BC Aquatic Database to test candidate pathway methods.',
    edgesSourceLine: null,
    contentStatusText: 'PROPOSED_SYSTEM - no data compiled, screened, or verified',
    edges: [
      { from: 'root', to: 'p1', basis: 'packet-root-hierarchy' },
      { from: 'root', to: 'p2', basis: 'packet-root-hierarchy' },
      { from: 'root', to: 'p3', basis: 'packet-root-hierarchy' },
      { from: 'root', to: 'p4', basis: 'packet-root-hierarchy' },
    ],
    placements: ['G-3'],
  },
  {
    assetId: 'mx-asset-parameter-evidence-governance',
    packetSection: '7 (H-1)',
    fenceText: 'Candidate record\n  -> Record the source and exact location\n  -> Check units, medium, receptor, normalization basis, and applicability\n  -> Record uncertainty and the independent test required\n  -> Assign one evidence status:\n       VERIFIED_PRIMARY\n       VERIFIED_SECONDARY\n       WORKING_CONVENTION\n       OPTION_OPEN\n       SOURCE_GAP\n       WITHDRAW\n  -> Independent scientific review\n  -> Eligible for a future active registry only if the governing method permits its status\n\nFail-closed rule:\nNo calculation may consume an unverified record.',
    fenceSha256: '58661fd9c8789441b5a7b510a01ce700d668bc3bddabb0345cd022169d83074e',
    captionCandidate: 'Figure H-1. Proposed evidence-governance flow for future input-parameter records.',
    edgesSourceLine: null,
    contentStatusText: 'packet disposition REAUTHOR_AS_EVIDENCE_GOVERNANCE_FLOW (the fence carries a fail-closed rule, not a Status line)',
    edges: [
      { from: 'candidate-record', to: 'step-1', basis: 'packet-sequence' },
      { from: 'step-1', to: 'step-2', basis: 'packet-sequence' },
      { from: 'step-2', to: 'step-3', basis: 'packet-sequence' },
      { from: 'step-3', to: 'step-4', basis: 'packet-sequence' },
      { from: 'step-4', to: 'step-5', basis: 'packet-sequence' },
      { from: 'step-5', to: 'step-6', basis: 'packet-sequence' },
    ],
    placements: ['H-1'],
  },
  {
    assetId: 'mx-asset-database-vv-workflow',
    packetSection: '8 (G-2 repl.)',
    fenceText: 'Input: candidate environmental record\n\nStage 1 - Structural conformance and referential integrity\n- Validate site, station, event, and measurement relationships\n- Check physical parameter boundaries\n\nStage 2 - Chemical nomenclature and unit harmonization\n- Resolve synonyms to canonical substance identity\n- Standardize concentration units and basis\n\nStage 3 - Sample identity and co-location verification\n- Detect duplicate reporting and recognize co-located records\n- BLOCKED DESIGN DETAIL: identifier attributes are not yet settled; no scheme is built\n\nStage 4 - Censored-data standardization\n- Apply an accepted treatment for non-detects and distribution modelling\n- Method selection and applicability remain subject to scientific review\n\nOutput: QA/QC-screened candidate record for analytical use\n\nGlobal status: PROPOSED_SYSTEM - no data have yet passed this process.',
    fenceSha256: '5c32fd54ed4aeab9d62d02301be34cfd3a129421da4974e506f727f63e4bb872',
    captionCandidate: 'Proposed figure. Four-stage verification and validation process for future BC Aquatic Database records.',
    edgesSourceLine: null,
    contentStatusText: 'PROPOSED_SYSTEM - no data have yet passed this process',
    edges: [
      { from: 'input', to: 'stage1', basis: 'packet-sequence' },
      { from: 'stage1', to: 'stage2', basis: 'packet-sequence' },
      { from: 'stage2', to: 'stage3', basis: 'packet-sequence' },
      { from: 'stage3', to: 'stage4', basis: 'packet-sequence' },
      { from: 'stage4', to: 'output', basis: 'packet-sequence' },
    ],
    placements: ['G-2A', 'G-2B'],
  },
];

export const FIGURE_CANDIDATE_ASSETS: readonly FigureCandidateAsset[] = FIGURE_CANDIDATE_ASSET_DATA;

export function figureCandidateAsset(assetId: string): FigureCandidateAsset | undefined {
  return FIGURE_CANDIDATE_ASSETS.find((asset) => asset.assetId === assetId);
}

/** The candidate asset that places at a given figure-register number, or undefined. */
export function figureCandidateForPlacement(registerNumber: string): FigureCandidateAsset | undefined {
  return FIGURE_CANDIDATE_ASSETS.find((asset) => asset.placements.includes(registerNumber));
}

interface MutableCandidateNode {
  id: string;
  label: string;
  heads: string[];
  bullets: string[];
  /** A node built from a "Pathway N -" / "Module N -" / "Stage N -" / root-style header may take one head line before its bullets. */
  acceptsHead: boolean;
  /** A node built from a "-> ..." arrow line (H-1): further plain lines are its bullets (the indented evidence-status tokens), never a head. */
  chainStep: boolean;
}

const HEADER_ID_PATTERNS: readonly (readonly [RegExp, (match: RegExpExecArray) => string])[] = [
  [/^Pathway (\d+) -/, (match) => `p${match[1]}`],
  [/^Module (\d+) -/, (match) => `m${match[1]}`],
  [/^Stage (\d+) -/, (match) => `stage${match[1]}`],
];

function kebabCase(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function headerNodeId(label: string): string {
  for (const [pattern, toId] of HEADER_ID_PATTERNS) {
    const match = pattern.exec(label);
    if (match) return toId(match);
  }
  return kebabCase(label);
}

/**
 * Parse one candidate fence into a DiagramModel, per the packet's block grammar:
 * `Root: X` (node `root`, an immediately following `Status: Y` becomes its head);
 * `Input: X` / `Output: X` (nodes `input` / `output`, the word kept in the label);
 * a non-indented, non-bullet line followed (directly, or after one further
 * non-bullet "head" line) by bullets starts a node, label = that line
 * ("Pathway N - ...", "Module N - ...", "Stage N - ...", "Shared evidence gate");
 * `- x` is a bullet of the current node, verbatim; H-1's arrow chain
 * (`Candidate record`, then each `-> ...` line) is a run of chain steps whose
 * further plain lines (the indented evidence-status tokens) are bullets, never
 * heads. `Footer:`, `Global status:`, `Fail-closed rule:` + its next line, and
 * 7-7's closing two lines become model notes, verbatim. The edge list is never
 * inferred here: it comes from the asset's own `edges` (see FIGURE_CANDIDATE_ASSETS).
 */
export function candidateModel(asset: FigureCandidateAsset): DiagramModel {
  const content = asset.fenceText
    .split('\n')
    .map((text) => text.trim())
    .filter((text) => text !== '');
  const nodes: MutableCandidateNode[] = [];
  const notes: string[] = [];
  let current: MutableCandidateNode | null = null;
  let stepCounter = 1;
  let cursor = 0;

  const pushNode = (node: MutableCandidateNode): MutableCandidateNode => {
    nodes.push(node);
    return node;
  };

  while (cursor < content.length) {
    const text = content[cursor];
    let match: RegExpExecArray | null;

    if ((match = /^Root: (.+)$/.exec(text))) {
      current = pushNode({ id: 'root', label: match[1], heads: [], bullets: [], acceptsHead: true, chainStep: false });
      cursor += 1;
      if (cursor < content.length && /^Status: /.test(content[cursor])) {
        current!.heads.push(content[cursor]);
        cursor += 1;
      }
      continue;
    }
    if (/^Input: /.test(text)) {
      current = pushNode({ id: 'input', label: text, heads: [], bullets: [], acceptsHead: false, chainStep: false });
      cursor += 1;
      continue;
    }
    if (/^Output: /.test(text)) {
      current = pushNode({ id: 'output', label: text, heads: [], bullets: [], acceptsHead: false, chainStep: false });
      cursor += 1;
      continue;
    }
    if (asset.edgesSourceLine && text === asset.edgesSourceLine) {
      cursor += 1;
      continue;
    }
    if (/^Footer: /.test(text)) {
      notes.push(text);
      cursor += 1;
      continue;
    }
    if (/^Global status: /.test(text)) {
      notes.push(text);
      cursor += 1;
      continue;
    }
    if (text === 'Fail-closed rule:' || text === 'Every module passes through the shared evidence gate:') {
      const next = content[cursor + 1] ?? '';
      notes.push(`${text} ${next}`);
      cursor += 2;
      continue;
    }
    if ((match = /^-> (.+)$/.exec(text))) {
      const id = `step-${stepCounter}`;
      stepCounter += 1;
      current = pushNode({ id, label: match[1], heads: [], bullets: [], acceptsHead: false, chainStep: true });
      cursor += 1;
      continue;
    }
    if ((match = /^- (.+)$/.exec(text))) {
      if (!current) throw new Error(`figure-candidates: bullet with no current node in ${asset.assetId}: "${text}"`);
      current.bullets.push(match[1]);
      cursor += 1;
      continue;
    }
    if (current && current.chainStep) {
      current.bullets.push(text);
      cursor += 1;
      continue;
    }
    if (current && current.acceptsHead && current.heads.length === 0 && current.bullets.length === 0) {
      current.heads.push(text);
      cursor += 1;
      continue;
    }
    // A new header node: label = this line; it accepts a head only if it is not itself a chain start.
    const next = content[cursor + 1] ?? '';
    current = pushNode({ id: headerNodeId(text), label: text, heads: [], bullets: [], acceptsHead: !/^-> /.test(next), chainStep: false });
    cursor += 1;
  }

  if (nodes.length === 0) throw new Error(`figure-candidates: no nodes parsed for ${asset.assetId}`);
  return {
    summaryNumber: 0,
    layout: asset.edges.some((edge) => edge.basis === 'packet-sequence') ? 'flow' : 'grid',
    title: null,
    nodes: nodes.map(({ id, label, heads, bullets }) => ({ id, label, heads, bullets })),
    edges: asset.edges.map((edge) => ({ from: edge.from, to: edge.to, label: null })),
    notes,
    items: [],
  };
}

/** The fence's raw line reconstructed from a node's stored label, for the coverage check below. */
function reconstructedNodeLine(node: DiagramModel['nodes'][number]): string {
  if (node.id === 'root') return `Root: ${node.label}`;
  if (/^step-\d+$/.test(node.id)) return `-> ${node.label}`;
  return node.label;
}

/**
 * A model note is either one raw fence line verbatim (Footer:, Global status:), or one of the
 * two sanctioned two-line joins candidateModel makes ("Fail-closed rule:" / "Every module passes
 * through the shared evidence gate:" + the line that follows it) -- split back into exactly those
 * two raw lines. No other join or reformatting is sanctioned.
 */
const TWO_LINE_NOTE_PREFIXES: readonly string[] = ['Fail-closed rule:', 'Every module passes through the shared evidence gate:'];

function noteToRawLines(note: string): readonly string[] {
  for (const prefix of TWO_LINE_NOTE_PREFIXES) {
    if (note.startsWith(`${prefix} `)) return [prefix, note.slice(prefix.length + 1)];
  }
  return [note];
}

/**
 * The fence lines `model` would produce, in source order, if serialised back out: each node's
 * line, then its heads and bullets verbatim, then every note split back to its raw line(s). A
 * chain-step node's bullets (id `step-N`, H-1's arrow chain only) are its indented evidence-status
 * tokens and carry no "- " prefix in the fence; every other node's bullets do.
 */
function reconstructedFenceLines(model: DiagramModel): string[] {
  const lines: string[] = [];
  for (const node of model.nodes) {
    lines.push(reconstructedNodeLine(node));
    for (const head of node.heads) lines.push(head);
    const isChainStep = /^step-\d+$/.test(node.id);
    for (const bullet of node.bullets) lines.push(isChainStep ? bullet : `- ${bullet}`);
  }
  for (const note of model.notes) lines.push(...noteToRawLines(note));
  return lines;
}

/**
 * An ordered, node-aware round trip: every non-blank fence line (minus the asset's own
 * edges-source line, which the parser consumes as the edge list, never as text) must appear, in
 * the same order, in the sequence `model` would serialise back out to. Returns the raw lines at
 * every position where the two sequences first and subsequently diverge; [] means the round trip
 * is exact. Unlike a presence-only Set check, this also catches a bullet silently moved between
 * nodes (same text, wrong node -- a change of scientific meaning that a Set cannot see), a
 * duplicated line silently dropped, and an invented line silently appended, because any of those
 * shifts the sequence out of alignment with the fence from that point on.
 */
export function candidateCoverageGaps(asset: FigureCandidateAsset, model: DiagramModel): string[] {
  const raw = asset.fenceText
    .split('\n')
    .map((text) => text.trim())
    .filter((text) => text !== '' && text !== asset.edgesSourceLine);
  const reconstructed = reconstructedFenceLines(model);
  const length = Math.max(raw.length, reconstructed.length);
  const gaps: string[] = [];
  for (let index = 0; index < length; index += 1) {
    if (raw[index] !== reconstructed[index]) gaps.push(raw[index] ?? `(no fence line here; model has "${reconstructed[index]}")`);
  }
  return gaps;
}

/** The caption candidate with its lead-in ("Figure N. ", "Figures 7-1 and B-1. ", "Proposed figure. ") removed, for use beside a label that already renders it. */
export function stripCaptionLeadIn(captionCandidate: string): string {
  const splitAt = captionCandidate.indexOf('. ');
  return splitAt === -1 ? captionCandidate : captionCandidate.slice(splitAt + 2);
}

/** Treatment-B's own label, from the packet's caption head (no figure number has been assigned to it). */
export const G2_TREATMENT_B_LABEL = 'Proposed figure';

/**
 * The prototype binding for one placement of a candidate asset. `registerNumber`
 * is one of asset.placements. Status is the new `candidate-nonfinal` value;
 * G-2's treatment B is null-safe (labelled from the packet's own caption head,
 * since no figure number has been assigned to that treatment).
 */
export function candidateBinding(asset: FigureCandidateAsset, registerNumber: string): FigureBinding {
  // Treatment A is the workflow drawn AS Figure G-2 (no "G-2A" number exists); treatment B has no number yet.
  // PaperFigure appends the period after the label, so neither label carries one.
  const label = registerNumber === 'G-2B' ? G2_TREATMENT_B_LABEL : registerNumber === 'G-2A' ? 'Figure G-2' : `Figure ${registerNumber}`;
  return {
    kind: 'prototype',
    id: registerNumber,
    label,
    caption: stripCaptionLeadIn(asset.captionCandidate),
    sourceSha256: asset.fenceSha256,
    status: 'candidate-nonfinal',
    statusNote: `Matrix MC content candidate - not final and not scientifically accepted (packet sha256 ${FIGURE_CANDIDATE_PACKET.packetSha256}, YELLOW draft for prototyping). Content status: ${asset.contentStatusText}.`,
    notation: 'plain',
    labelOverrides: null,
    // Candidates carry no labelOverrides, so overrideAuthority (which documents labelOverrides only) stays
    // null; contentAuthority documents the whole candidate content asset instead (P3-3 fix).
    overrideAuthority: null,
    contentAuthority: `${FIGURE_CANDIDATE_PACKET.packetFile} sha256 ${FIGURE_CANDIDATE_PACKET.packetSha256}`,
    assetId: asset.assetId,
    // A root-hierarchy edge is a root heading its child sections, not a causal/sequential
    // connection; say so as "contains" rather than the default "leads to" (P3-1 fix).
    edgeRelation: asset.edges.length > 0 && asset.edges.every((edge) => edge.basis === 'packet-root-hierarchy') ? 'contains' : undefined,
  };
}
