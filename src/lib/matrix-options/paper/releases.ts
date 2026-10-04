/*
 * The Matrix Options Paper releases this application can address.
 *
 * Two bound releases, as literals. The predecessor stays the DEFAULT: the
 * landing route, the review route and every caller that names no version
 * resolve to it. The current review draft is addressable and selectable, never
 * substituted for the default (interface overlay
 * MATRIX_RUN106_R5_L2_INTERFACE_OVERLAY_001, version_contract:
 * SELECTABLE_NON_DEFAULT_UNTIL_OWNER_ACTIVATION_DECISION).
 *
 * Isomorphic: no fs, no crypto, no server-only import, and NOTHING that locates
 * private bytes (no bucket, no object name, no file path of a private release).
 * This module only names what must be true of a release's bytes and how the
 * release is presented. Where the bytes come from is the server's business:
 * ../revised-paper.ts for a repository release, ./private-release-assets.ts for
 * a private-storage release.
 */

export const DEFAULT_PAPER_VERSION = '1.0.11-remediated-7-8-successor-20260918-D' as const;
/**
 * The current review draft. Its release artifact is the PRESENTATION of the
 * Matrix MC R4 candidate: the exact bytes shown to readers, which end before
 * Appendix L. The artifact has its own identity; the R4 source it was derived
 * from is named only in `provenance`, by hash. (The constant keeps its code name.)
 */
export const R5_PAPER_VERSION = 'v0.9.88-r4-presentation-001' as const;
export const V0991_PAPER_VERSION = 'v0.9.91' as const;

export type PaperReleaseVersion = typeof DEFAULT_PAPER_VERSION | typeof R5_PAPER_VERSION | typeof V0991_PAPER_VERSION;

export type PaperReleaseActivation = 'DEFAULT' | 'SELECTABLE_NON_DEFAULT';

/**
 * How a release's bytes reach the server.
 * - `repository`: the Markdown is a tracked file under candidate/paper/.
 * - `private-storage`: the Markdown and figures are NOT in the repository. They
 *   are read from private storage with the signed-in reader's own session and
 *   verified against this entry before use (./private-release-assets.ts).
 */
export type PaperReleaseDelivery = 'repository' | 'private-storage';

/**
 * A section of the source that the release artifact does not contain. Nothing of
 * that section is in the artifact, so there is nothing to cut at run time: this
 * entry only says which stable id opens nothing here and what readers are told.
 *
 * Once a version is bound, its `withheld` value never changes: a release that
 * contains the section is a NEW release entry with `withheld: null`.
 */
export interface PaperReleaseWithheld {
  /** Stable section id of the section the artifact does not contain (`app-<letter>`). */
  readonly stableSectionId: string;
  /** The one reader-facing sentence that says what is not included. */
  readonly notice: string;
}

/**
 * Where a derived release artifact came from. Hashes and identifiers only: no
 * text of the source is stored here or anywhere else in the code.
 */
export interface PaperReleaseProvenance {
  /** Version name of the source candidate the artifact was derived from. */
  readonly sourceVersion: string;
  /** Lowercase SHA-256 and byte length of the whole source file. */
  readonly sourceSha256: string;
  readonly sourceBytes: number;
  /** Lowercase SHA-256 of the source candidate's own manifest. */
  readonly sourceManifestSha256: string;
  /** The artifact is bytes [0, bytes) of the source. */
  readonly derivation: 'source-prefix';
}

export interface PaperRelease {
  readonly documentVersion: PaperReleaseVersion;
  /** Lowercase SHA-256 of the exact Markdown bytes of the release artifact. */
  readonly sha256: string;
  readonly bytes: number;
  readonly delivery: PaperReleaseDelivery;
  /** File name under candidate/paper/ for a `repository` release; null for `private-storage`. */
  readonly filename: string | null;
  /** Set for an artifact derived from a larger source; null when the artifact is the source. */
  readonly provenance: PaperReleaseProvenance | null;
  readonly activation: PaperReleaseActivation;
  /** Reader-facing name, as the version control lists it. */
  readonly label: string;
  /** The same name, short enough for the header button. */
  readonly shortLabel: string;
  /** One reader-facing sentence that says what this draft is. */
  readonly summary: string;
  /**
   * Heading levels the source sits below a depth-1 top level. The predecessor
   * authors its top-level sections as `#`; R5 has no `#` heading at all (its
   * title is YAML front matter), so its `##` sections are the top level.
   */
  readonly headingDepthShift: 0 | 1;
  /** Whether the source opens with a YAML front-matter block. */
  readonly frontMatter: boolean;
  /** Whether figures are accepted PNG placements bound by accepted-figures.ts. */
  readonly acceptedFigures: boolean;
  /** The release this one succeeds, for read-only review lineage. */
  readonly predecessorVersion: PaperReleaseVersion | null;
  /**
   * Stable section ids of the predecessor that no longer exist here, and the
   * stable id a link to them lands on. Navigation only: no claim that the
   * content survived unchanged (overlay section_anchor_lineage.predecessor_only).
   */
  readonly retiredSectionAnchors: Readonly<Record<string, string>>;
  /** The section this release's artifact does not contain, or null when nothing is left out. */
  readonly withheld: PaperReleaseWithheld | null;
  /**
   * What the exact source heading "Master Table of Contents" is SHOWN as in this
   * release, or null to keep the region labels of contents-heading.ts ("Paper
   * contents" / "Appendix contents"). Display only: node labels, anchors and the
   * source bytes are unchanged.
   */
  readonly contentsHeadingDisplay: string | null;
}

const DEFAULT_RELEASE: PaperRelease = Object.freeze({
  documentVersion: DEFAULT_PAPER_VERSION,
  sha256: 'feb62bd63c46f9b799a705da9ccb6db41974512ca4c73d9582111eeb3ae47337',
  bytes: 541959,
  delivery: 'repository',
  filename: 'BC_Matrix_Options_Paper_v1.0.11-remediated-7-8-successor-20260918-D.md',
  provenance: null,
  activation: 'DEFAULT',
  label: 'Earlier draft (default)',
  shortLabel: 'Earlier draft',
  summary: 'The earlier draft of the paper. It is still the default draft. Responses to it are separate from responses to the current review draft.',
  headingDepthShift: 0,
  frontMatter: false,
  acceptedFigures: false,
  predecessorVersion: null,
  retiredSectionAnchors: Object.freeze({}),
  withheld: null,
  contentsHeadingDisplay: null,
});

const R5_RELEASE: PaperRelease = Object.freeze({
  documentVersion: R5_PAPER_VERSION,
  sha256: 'c215b125757bbc0294f6ea904f7e4236a39d8912c137f226bb6148cced804c84',
  bytes: 562836,
  delivery: 'private-storage',
  filename: null,
  provenance: Object.freeze({
    sourceVersion: 'v0.9.88-run106-r4-c1-c3-001',
    sourceSha256: '561eef1aee9806c257936299bf9f7d4ccb89bcaa5de756c6f0ca77517805e020',
    sourceBytes: 588609,
    sourceManifestSha256: '8846254f358cd322bf9509f8dd8976dd690004d4bd6d558bf4511df77138eeff',
    derivation: 'source-prefix',
  }),
  activation: 'SELECTABLE_NON_DEFAULT',
  label: 'Current review draft',
  shortLabel: 'Current draft',
  summary: 'The current review draft of the paper, shown as a preview. It is not the default draft. Responses to it are separate from responses to the earlier draft.',
  headingDepthShift: 1,
  frontMatter: true,
  acceptedFigures: true,
  predecessorVersion: DEFAULT_PAPER_VERSION,
  retiredSectionAnchors: Object.freeze({ 'sec-7-8-1': 'sec-7-8', 'sec-7-8-2': 'sec-7-8' }),
  // Appendix L is under revision (owner direction, interim release) and is not part of this
  // artifact. A link to it lands on the notice that says so.
  withheld: Object.freeze({
    stableSectionId: 'app-l',
    notice: 'Appendix L is under revision and is not included in this presentation.',
  }),
  contentsHeadingDisplay: 'Table of Contents',
});

const V0991_RELEASE: PaperRelease = Object.freeze({
  documentVersion: V0991_PAPER_VERSION,
  sha256: 'a5b1d81d11af23d3437bba4cadcf0a0fa555001be27e9227c6015ff0bad6599e',
  bytes: 607464,
  delivery: 'private-storage',
  filename: null,
  provenance: null,
  activation: 'SELECTABLE_NON_DEFAULT',
  label: 'v0.9.91 review draft',
  shortLabel: 'v0.9.91 draft',
  summary: 'The v0.9.91 collaborative expert-review working draft. Responses to it are separate from other paper versions.',
  headingDepthShift: 1,
  frontMatter: true,
  acceptedFigures: true,
  predecessorVersion: R5_PAPER_VERSION,
  retiredSectionAnchors: Object.freeze({
    'sec-scope-note': 'sec-status-notice',
    'sec-audience': 'sec-status-notice',
    'sec-10-0-1': 'sec-10-3',
    'sec-11-6': 'sec-18-7',
    'sec-16-1': 'sec-16-0',
    'sec-16-2': 'sec-16-0',
    'sec-16-3': 'sec-16-0',
  }),
  // Appendix L is included for this private review release; no withheld-section notice applies.
  withheld: null,
  contentsHeadingDisplay: null,
});

/** Default first: the order the version control lists them in. */
export const PAPER_RELEASES: readonly PaperRelease[] = Object.freeze([DEFAULT_RELEASE, R5_RELEASE, V0991_RELEASE]);

export function isPaperReleaseVersion(value: unknown): value is PaperReleaseVersion {
  return typeof value === 'string' && PAPER_RELEASES.some((release) => release.documentVersion === value);
}

/** The bound release for a version, or null for anything else (no fallback to the default). */
export function getPaperRelease(documentVersion: string | undefined | null): PaperRelease | null {
  return PAPER_RELEASES.find((release) => release.documentVersion === documentVersion) ?? null;
}

export function getDefaultPaperRelease(): PaperRelease {
  return DEFAULT_RELEASE;
}

/** `matrix-options-paper:<version>:<sha256>`, the identity structure ids are hashed with. */
export function paperReleaseIdentity(release: Pick<PaperRelease, 'documentVersion' | 'sha256'>): string {
  return `matrix-options-paper:${release.documentVersion}:${release.sha256}`;
}

/** The id of the one notice element a withheld release shows; an old link to the withheld section lands on it. */
export const PAPER_WITHHELD_NOTICE_ID = 'paper-withheld-notice';

/**
 * The label a release's source is named by in contracts and manifests. It says
 * WHICH artifact, never where its bytes are stored: the repository path of a
 * tracked file, or `presentation:<version>` for a private-storage release.
 */
export function paperReleaseSourceLabel(release: Pick<PaperRelease, 'delivery' | 'filename' | 'documentVersion'>): string {
  return release.delivery === 'repository' ? `candidate/paper/${release.filename}` : `presentation:${release.documentVersion}`;
}

/** Repository path of a `repository` release's Markdown; null for any other delivery. */
export function paperReleaseRelativePath(release: Pick<PaperRelease, 'delivery' | 'filename'>): string | null {
  return release.delivery === 'repository' && release.filename ? `candidate/paper/${release.filename}` : null;
}

/** Repository path of a `repository` release's hash sidecar; null for any other delivery. */
export function paperReleaseSidecarRelativePath(release: Pick<PaperRelease, 'delivery' | 'filename'>): string | null {
  return release.delivery === 'repository' && release.filename ? `candidate/paper/${release.filename}.sha256` : null;
}
