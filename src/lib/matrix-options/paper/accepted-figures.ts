import r5FiguresContract from './contracts/accepted-figures-v0.9.88-r4-presentation-001.json';
import v0991FiguresContract from './contracts/accepted-figures-v0.9.91-run109-001.json';
import type { PaperMarkdownSegment } from './figures';
import { R5_PAPER_VERSION, V0991_PAPER_VERSION } from './releases';

/*
 * Accepted figures: the exact PNG placements of a release.
 *
 * The R5 working draft carries its 20 figure placements as authored blocks:
 *
 *   <!-- MATRIX_FIGURE_PLACEMENT: 6-1 -->
 *
 *   []{#fig-6-1}Figure 6-1. <caption>
 *
 *   **Status: <status>**
 *
 *   ![<alternative text>](assets/FIG6-1.png)
 *
 * The contract beside this module binds each placement to its accepted asset
 * (17 PNGs; three are shared by two placements each), its section, its line and
 * the SHA-256 of its text. It holds NO text of the release: caption, status and
 * alternative text are bound by one hash per placement (acceptedFigureBlockText)
 * and exist only in the release's own Markdown. The contract was generated from
 * the candidate manifest, the figure placement registry and the L2 interface
 * overlay, whose hashes it records; the three placements the registry leaves as
 * "secondary" (B-1, E-1, 7-5) take the overlay's authoritative section anchors.
 *
 * A block is drawn as a figure ONLY when its figure id and asset file are the
 * contract's and its caption carries its own figure number. The caption, status
 * and alternative text shown are the block's own. They are trustworthy because
 * the server proved the whole Markdown by hash and, at release load, each
 * block's joined text against the placement's `textSha256`
 * (accepted-figures-server.ts); a release that fails either is never served. A
 * block that does not resolve is drawn as a visible "figure unavailable" note:
 * never as a broken image. The image is always the accepted PNG. Semantic
 * redraws and the derived PX-1..PX-4 figures stay in the figure lab (figures.ts,
 * derived-figures.ts).
 *
 * Pure and isomorphic: no fs, no crypto. Asset BYTES are authenticated where
 * they are read (private-release-assets.ts).
 */

export const ACCEPTED_FIGURES_SCHEMA_VERSION = 'matrix-paper-accepted-figures-v1' as const;

export interface AcceptedFigureAsset {
  /** Semantic asset id, for example "FIG7-1B1". */
  readonly id: string;
  /** File name of the asset within the release's figures. */
  readonly file: string;
  /** Lowercase SHA-256 of the exact PNG bytes. */
  readonly sha256: string;
  readonly bytes: number;
  /** Intrinsic pixel size, read from the PNG header (reserves layout before the image loads). */
  readonly width: number;
  readonly height: number;
  readonly placementIds: readonly string[];
}

export interface AcceptedFigurePlacement {
  /** Figure number as authored, for example "6-1" or "B-1". */
  readonly figureId: string;
  readonly assetId: string;
  /** Lowercase SHA-256 of the placement's caption, status and alternative text (acceptedFigureBlockText). */
  readonly textSha256: string;
  /** Stable section id (`sec-...` / `app-...`) the placement sits in. */
  readonly sectionAnchor: string;
  /** Whether the section came from the registry or from the overlay's correction. */
  readonly anchorSource: 'registry' | 'overlay-correction';
  readonly role: 'primary' | 'secondary';
  /** 1-based line of the placement marker in the bound Markdown. */
  readonly markerLine: number;
}

export interface AcceptedFiguresContract {
  readonly schemaVersion: typeof ACCEPTED_FIGURES_SCHEMA_VERSION;
  readonly releaseIdentity: string;
  /** Lowercase SHA-256 of the Markdown the placements are bound to. */
  readonly paperSha256: string;
  readonly sources: {
    readonly candidateManifestSha256: string;
    readonly placementRegistrySha256: string;
    readonly interfaceOverlaySha256: string;
  };
  readonly assets: readonly AcceptedFigureAsset[];
  readonly placements: readonly AcceptedFigurePlacement[];
}

/** A placement together with the asset it draws and the text of its Markdown block. */
export interface AcceptedFigureBinding {
  readonly releaseIdentity: string;
  readonly placement: AcceptedFigurePlacement;
  readonly asset: AcceptedFigureAsset;
  /** Full caption including its "Figure N." label, as the block carries it. */
  readonly caption: string;
  /** The content status, as the block carries it. */
  readonly status: string;
  /** The accessible alternative description, as the block carries it. */
  readonly alt: string;
}

const SHA256_HEX = /^[0-9a-f]{64}$/;
const FIGURE_ID = /^[0-9A-Z]+-[0-9]+$/;
const ASSET_FILE = /^[A-Za-z0-9-]+\.png$/;
const SECTION_ANCHOR = /^(?:sec|app)-[a-z0-9-]+$/;
const CONTRACT_KEYS = ['schemaVersion', 'releaseIdentity', 'paperSha256', 'sources', 'assets', 'placements'] as const;
const SOURCE_KEYS = ['candidateManifestSha256', 'placementRegistrySha256', 'interfaceOverlaySha256'] as const;
const ASSET_KEYS = ['id', 'file', 'sha256', 'bytes', 'width', 'height', 'placementIds'] as const;
const PLACEMENT_KEYS = ['figureId', 'assetId', 'textSha256', 'sectionAnchor', 'anchorSource', 'role', 'markerLine'] as const;

function fail(message: string): never {
  throw new Error(`Invalid accepted figures contract: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isNonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value === value.trim();
}

/**
 * Shape and internal consistency of a contract: unique ids, every placement
 * drawn from a listed asset, every asset used by exactly the placements it
 * lists. The contract is CLOSED: it has exactly the members checked here, so it
 * has no member that could carry text of its release.
 */
export function validateAcceptedFiguresContract(candidate: unknown, expectedReleaseIdentity: string): AcceptedFiguresContract {
  if (!isRecord(candidate)) fail('object');
  if (candidate.schemaVersion !== ACCEPTED_FIGURES_SCHEMA_VERSION) fail('schema version');
  if (candidate.releaseIdentity !== expectedReleaseIdentity) fail('release identity');
  if (!hasExactlyKeys(candidate, CONTRACT_KEYS)) fail('unverified field');
  if (typeof candidate.paperSha256 !== 'string' || !SHA256_HEX.test(candidate.paperSha256)) fail('paper SHA-256');
  const sources = candidate.sources;
  if (!isRecord(sources) || !hasExactlyKeys(sources, SOURCE_KEYS) || SOURCE_KEYS.some((key) => typeof sources[key] !== 'string' || !SHA256_HEX.test(sources[key] as string))) fail('source hashes');
  if (!Array.isArray(candidate.assets) || candidate.assets.length === 0) fail('assets');
  if (!Array.isArray(candidate.placements) || candidate.placements.length === 0) fail('placements');

  const assets = new Map<string, AcceptedFigureAsset>();
  const files = new Set<string>();
  for (const raw of candidate.assets as readonly unknown[]) {
    if (!isRecord(raw)) fail('asset shape');
    const asset = raw as unknown as AcceptedFigureAsset;
    if (!isNonBlank(asset.id) || assets.has(asset.id)) fail(`asset id ${String(asset.id)}`);
    if (!hasExactlyKeys(raw, ASSET_KEYS)) fail(`unverified asset field ${asset.id}`);
    if (typeof asset.file !== 'string' || !ASSET_FILE.test(asset.file) || asset.file !== `${asset.id}.png` || files.has(asset.file)) fail(`asset file ${asset.id}`);
    if (typeof asset.sha256 !== 'string' || !SHA256_HEX.test(asset.sha256)) fail(`asset SHA-256 ${asset.id}`);
    if (!isPositiveInteger(asset.bytes) || !isPositiveInteger(asset.width) || !isPositiveInteger(asset.height)) fail(`asset size ${asset.id}`);
    // Each entry is one figure id, listed once: a joined or repeated entry can never stand in for two placements.
    if (!Array.isArray(asset.placementIds) || asset.placementIds.length === 0
      || asset.placementIds.some((id: unknown) => typeof id !== 'string' || !FIGURE_ID.test(id))
      || new Set(asset.placementIds).size !== asset.placementIds.length) fail(`asset placements ${asset.id}`);
    assets.set(asset.id, asset);
    files.add(asset.file);
  }

  const placementIds = new Set<string>();
  const usedBy = new Map<string, string[]>();
  let previousLine = 0;
  for (const raw of candidate.placements as readonly unknown[]) {
    if (!isRecord(raw)) fail('placement shape');
    const placement = raw as unknown as AcceptedFigurePlacement;
    if (typeof placement.figureId !== 'string' || !FIGURE_ID.test(placement.figureId) || placementIds.has(placement.figureId)) fail(`placement id ${String(placement.figureId)}`);
    placementIds.add(placement.figureId);
    if (!hasExactlyKeys(raw, PLACEMENT_KEYS)) fail(`unverified placement field ${placement.figureId}`);
    if (!assets.has(placement.assetId)) fail(`placement asset ${placement.figureId}`);
    if (typeof placement.textSha256 !== 'string' || !SHA256_HEX.test(placement.textSha256)) fail(`placement text SHA-256 ${placement.figureId}`);
    if (typeof placement.sectionAnchor !== 'string' || !SECTION_ANCHOR.test(placement.sectionAnchor)) fail(`placement section ${placement.figureId}`);
    if (placement.anchorSource !== 'registry' && placement.anchorSource !== 'overlay-correction') fail(`placement anchor source ${placement.figureId}`);
    if (placement.role !== 'primary' && placement.role !== 'secondary') fail(`placement role ${placement.figureId}`);
    // Placements are listed in document order.
    if (!isPositiveInteger(placement.markerLine) || placement.markerLine <= previousLine) fail(`placement order ${placement.figureId}`);
    previousLine = placement.markerLine;
    usedBy.set(placement.assetId, [...(usedBy.get(placement.assetId) ?? []), placement.figureId]);
  }
  for (const asset of assets.values()) {
    const used = [...(usedBy.get(asset.id) ?? [])].sort();
    const listed = [...asset.placementIds].sort();
    if (used.length === 0 || used.length !== listed.length || used.some((id, index) => id !== listed[index])) fail(`asset placement list ${asset.id}`);
  }
  return candidate as unknown as AcceptedFiguresContract;
}

let cachedR5Contract: AcceptedFiguresContract | undefined;
let cachedV0991Contract: AcceptedFiguresContract | undefined;

/** The accepted figures of a release, or null for a release that has none (the predecessor). */
export function getAcceptedFiguresContract(documentVersion: string): AcceptedFiguresContract | null {
  if (documentVersion === R5_PAPER_VERSION) {
    cachedR5Contract ??= validateAcceptedFiguresContract(r5FiguresContract, R5_PAPER_VERSION);
    return cachedR5Contract;
  }
  if (documentVersion === V0991_PAPER_VERSION) {
    cachedV0991Contract ??= validateAcceptedFiguresContract(v0991FiguresContract, V0991_PAPER_VERSION);
    return cachedV0991Contract;
  }
  return null;
}

/** One authored placement block, exactly as the source carries it. */
export interface AcceptedFigureBlock {
  readonly figureId: string;
  /** Line index of the marker and of the last line of the block (inclusive). */
  readonly startLine: number;
  readonly endLine: number;
  /** Present only for the authenticated Run109 Pandoc placement shape. */
  readonly sourceFormat?: 'pandoc-v0.9.91';
  /** Null when the lines after the marker are not caption / status / image. */
  readonly content: { readonly caption: string; readonly status: string; readonly alt: string; readonly file: string } | null;
}

const MARKER_LINE = /^<!-- MATRIX_FIGURE_PLACEMENT: ([0-9A-Z]+-[0-9]+) -->[ \t]*$/;
const CAPTION_SPAN = /^\[\]\{#fig-[a-z0-9-]+\}/;
const STATUS_LINE = /^\*\*Status: (.+)\*\*[ \t]*$/;
const IMAGE_LINE = /^!\[(.*)\]\(assets\/([A-Za-z0-9-]+\.png)\)[ \t]*$/;
const PANDOC_IMAGE_LINE = /^!\[(Figure [0-9A-Z-]+\. [^\]\r\n]+)\]\(assets_v0991\/([A-Za-z0-9-]+\.png)\)\{#fig-[A-Za-z0-9-]+(?: width=[0-9.]+in)? alt="([^"\r\n]+)"\}[ \t]*$/;

/**
 * Every placement block in the given lines. A marker in its exact spelling is
 * always reported, so a well-formed marker whose following lines do not form a
 * block is never left in the prose. A marker spelled any other way, and an asset
 * image with no marker, are NOT seen here: a release that has either fails
 * authentication (accepted-figures-server.ts) and is never served.
 * The caption's own `[]{#fig-...}` anchor span is optional (the reader removes
 * those spans before it segments a chunk).
 */
export function findAcceptedFigureBlocks(lines: readonly string[]): readonly AcceptedFigureBlock[] {
  const blocks: AcceptedFigureBlock[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const marker = MARKER_LINE.exec(lines[index]);
    if (!marker) continue;
    // marker, blank, caption, blank, status, blank, image
    const caption = lines[index + 2];
    const status = STATUS_LINE.exec(lines[index + 4] ?? '');
    const image = IMAGE_LINE.exec(lines[index + 6] ?? '');
    const pandocImage = PANDOC_IMAGE_LINE.exec(lines[index + 2] ?? '');
    if (lines[index + 1] === '' && pandocImage) {
      blocks.push({ figureId: marker[1], startLine: index, endLine: index + 2, sourceFormat: 'pandoc-v0.9.91', content: { caption: pandocImage[1], status: '', alt: pandocImage[3], file: pandocImage[2] } });
      index += 2;
      continue;
    }
    const shaped = lines[index + 1] === '' && lines[index + 3] === '' && lines[index + 5] === '' && typeof caption === 'string' && caption.trim() !== '' && status !== null && image !== null;
    if (!shaped) {
      // Not the bound shape. The block still ends at its own image line when one
      // follows closely, so an unverified `assets/...` image is never left in the
      // prose to be requested as a broken relative URL.
      let endLine = index;
      for (let ahead = index + 1; ahead <= index + 8 && ahead < lines.length; ahead += 1) {
        if (MARKER_LINE.test(lines[ahead])) break;
        if (IMAGE_LINE.test(lines[ahead])) { endLine = ahead; break; }
      }
      blocks.push({ figureId: marker[1], startLine: index, endLine, content: null });
      index = endLine;
      continue;
    }
    blocks.push({ figureId: marker[1], startLine: index, endLine: index + 6, content: { caption: caption.replace(CAPTION_SPAN, ''), status: status[1], alt: image[1], file: image[2] } });
    index += 6;
  }
  return blocks;
}

/**
 * The ONE joined value a placement binds: caption, status and alternative text
 * exactly as findAcceptedFigureBlocks reads them, each followed by a line feed
 * except the last. `textSha256` is its SHA-256 (UTF-8, lowercase hex).
 */
export function acceptedFigureBlockText(content: { readonly caption: string; readonly status: string; readonly alt: string }): string {
  return `${content.caption}\n${content.status}\n${content.alt}`;
}

/**
 * The bound figure for a block: a contract has a placement with the block's
 * figure id, that placement's asset file is the block's, and the caption carries
 * its own figure number. The binding carries the block's own caption, status and
 * alternative text (proven against `textSha256` on the server at release load).
 */
export function resolveAcceptedFigure(block: AcceptedFigureBlock, expectedReleaseIdentity?: string): AcceptedFigureBinding | null {
  const content = block.content;
  if (!content || !content.caption.startsWith(`Figure ${block.figureId}. `)) return null;
  const releaseIdentity = expectedReleaseIdentity ?? (block.sourceFormat === 'pandoc-v0.9.91' ? V0991_PAPER_VERSION : R5_PAPER_VERSION);
  const contract = getAcceptedFiguresContract(releaseIdentity);
  if (!contract) return null;
  const placement = contract.placements.find((candidate) => candidate.figureId === block.figureId);
  const asset = placement ? contract.assets.find((candidate) => candidate.id === placement.assetId) : undefined;
  if (!placement || !asset || content.file !== asset.file) return null;
  return { releaseIdentity: contract.releaseIdentity, placement, asset, caption: content.caption, status: content.status, alt: content.alt };
}

/** DOM id of a figure: the id its own anchor span carries, so `#fig-6-1` names it. */
export function acceptedFigureDomId(figureId: string): string {
  return `fig-${figureId.toLowerCase()}`;
}

export const ACCEPTED_FIGURE_API_PREFIX = '/api/matrix-options/paper/v/';

/**
 * Where the accepted PNG is served: an authenticated route that sends only
 * verified bytes. The asset hash is part of the URL, so a response can be cached
 * for as long as the URL lives without ever going stale.
 */
export function acceptedFigureAssetHref(binding: Pick<AcceptedFigureBinding, 'releaseIdentity' | 'asset'>): string {
  return `${ACCEPTED_FIGURE_API_PREFIX}${encodeURIComponent(binding.releaseIdentity)}/figures/${encodeURIComponent(binding.asset.file)}?sha256=${binding.asset.sha256}`;
}

/** The caption without its "Figure N." label, and the label itself. */
export function splitAcceptedFigureCaption(figure: { readonly figureId: string; readonly caption: string }): { readonly label: string; readonly text: string } {
  const label = `Figure ${figure.figureId}.`;
  return { label, text: figure.caption.startsWith(`${label} `) ? figure.caption.slice(label.length + 1) : figure.caption };
}

/**
 * Splits each prose segment at its placement blocks. Prose without a marker is
 * returned as the same segment object, so a release with no accepted figures
 * (the predecessor) is segmented exactly as before.
 */
export function splitAcceptedFigureSegments(segments: readonly PaperMarkdownSegment[]): PaperMarkdownSegment[] {
  const result: PaperMarkdownSegment[] = [];
  for (const segment of segments) {
    if (segment.kind !== 'markdown' || !segment.markdown.includes('MATRIX_FIGURE_PLACEMENT')) { result.push(segment); continue; }
    const lines = segment.markdown.split('\n');
    const blocks = findAcceptedFigureBlocks(lines);
    if (blocks.length === 0) { result.push(segment); continue; }
    let cursor = 0;
    const pushProse = (end: number) => {
      const prose = lines.slice(cursor, end);
      if (prose.some((line) => line.trim() !== '')) result.push({ kind: 'markdown', markdown: prose.join('\n') });
    };
    for (const block of blocks) {
      pushProse(block.startLine);
      const figure = resolveAcceptedFigure(block);
      result.push(figure ? { kind: 'accepted-figure', figure } : { kind: 'accepted-figure-unavailable', figureId: block.figureId });
      cursor = block.endLine + 1;
    }
    pushProse(lines.length);
  }
  return result;
}
