import 'server-only';

import { createHash } from 'node:crypto';

import {
  acceptedFigureBlockText,
  findAcceptedFigureBlocks,
  getAcceptedFiguresContract,
  resolveAcceptedFigure,
  type AcceptedFiguresContract,
} from './accepted-figures';
import { V0991_PAPER_VERSION } from './releases';

/*
 * Server-side authentication of a release's accepted figures against its
 * Markdown.
 *
 * authenticateAcceptedFigures runs at release load and fails closed. The bound
 * Markdown must carry exactly the contract's placements, in order, on the
 * contract's lines, each inside the section the contract binds it to, each
 * resolving to its accepted asset, and each with caption, status and alternative
 * text whose joined SHA-256 is the placement's `textSha256`. Any difference
 * makes the whole release unavailable.
 *
 * It reads no file. The contract holds no text of the release, so the text a
 * figure is shown with is the Markdown block's own, proven here by hash. The
 * figure BYTES are proven where they are read (private-release-assets.ts).
 */

export const ACCEPTED_FIGURES_FAILURE_PREFIX = 'accepted figures: ';

const SECTION_ANCHOR_LINE = /^<div id="([^"\r\n]+)" class="section-anchor"><\/div>[ \t]*$/;
const PANDOC_SECTION_LINE = /^#{1,6} .+ \{#([A-Za-z][A-Za-z0-9_-]*)(?: \.[A-Za-z][A-Za-z0-9_-]*)*\}[ \t]*$/;

function fail(reason: string): never {
  throw new Error(`${ACCEPTED_FIGURES_FAILURE_PREFIX}${reason}`);
}

function pandocSectionAncestors(lines: readonly string[], beforeLine: number): readonly string[] {
  const stack: { level: number; id: string }[] = [];
  for (let index = 0; index < beforeLine; index += 1) {
    const match = PANDOC_SECTION_LINE.exec(lines[index]);
    if (!match) continue;
    const level = /^(#{1,6})/.exec(lines[index])?.[1].length ?? 0;
    const id = match[1];
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
    stack.push({ level, id });
  }
  return stack.map(({ id }) => id);
}

interface AuthenticatedSource {
  readonly content: string;
  readonly manifest: { readonly source: { readonly version: string; readonly sha256: string } };
}

/**
 * Proves the release's Markdown is exactly what the figures contract binds.
 * Throws an Error prefixed with ACCEPTED_FIGURES_FAILURE_PREFIX.
 */
export function authenticateAcceptedFigures(structure: AuthenticatedSource): AcceptedFiguresContract {
  const version = structure.manifest.source.version;
  const contract = getAcceptedFiguresContract(version);
  if (!contract) fail(`no contract for ${version}`);
  if (contract.paperSha256 !== structure.manifest.source.sha256) fail('contract is bound to another paper');

  const lines = structure.content.split('\n');
  const blocks = findAcceptedFigureBlocks(lines);
  if (blocks.length !== contract.placements.length) fail(`placement count ${blocks.length}`);
  // findAcceptedFigureBlocks sees only a marker in its exact spelling. A marker spelled any
  // other way, and an asset image with no marker above it, would be invisible to it and stay
  // in the prose as raw Markdown (a broken relative image). Neither may exist: every line
  // that mentions the marker word is one counted block, and every line that references the
  // asset folder is one block's own image line.
  const markerMentions = lines.filter((line) => /MATRIX_FIGURE_PLACEMENT/i.test(line)).length;
  if (markerMentions !== blocks.length) fail(`placement marker spelling ${markerMentions}`);
  const assetReferences = lines.filter((line) => /\]\(assets(?:_v0991)?\//.test(line)).length;
  if (assetReferences !== blocks.length) fail(`asset image outside a placement ${assetReferences}`);

  blocks.forEach((block, index) => {
    const placement = contract.placements[index];
    if (block.figureId !== placement.figureId) fail(`placement order ${block.figureId}`);
    if (block.startLine + 1 !== placement.markerLine) fail(`placement line ${block.figureId}`);
    // The block must resolve to this placement: shaped as a block, drawing the placement's
    // asset, under a caption that carries its own figure number.
    const binding = resolveAcceptedFigure(block, contract.releaseIdentity);
    if (!block.content || !binding || binding.releaseIdentity !== contract.releaseIdentity || binding.placement !== placement) fail(`placement content ${block.figureId}`);
    // The caption, status and alternative text are bound as one joined value.
    if (createHash('sha256').update(acceptedFigureBlockText(block.content), 'utf8').digest('hex') !== placement.textSha256) fail(`placement text ${block.figureId}`);
    // The section a placement sits in is the nearest stable section anchor above it.
    let owner: string | null = null;
    for (let line = block.startLine - 1; line >= 0 && owner === null; line -= 1) {
      owner = SECTION_ANCHOR_LINE.exec(lines[line])?.[1] ?? PANDOC_SECTION_LINE.exec(lines[line])?.[1] ?? null;
    }
    if (version === V0991_PAPER_VERSION) {
      const ancestors = pandocSectionAncestors(lines, block.startLine);
      if (!ancestors.includes(placement.sectionAnchor)) fail(`placement section ${block.figureId}`);
    } else if (owner !== placement.sectionAnchor) {
      fail(`placement section ${block.figureId}`);
    }
  });

  return contract;
}
