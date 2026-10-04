import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  candidateBinding,
  candidateCoverageGaps,
  candidateModel,
  FIGURE_CANDIDATE_ASSETS,
  FIGURE_CANDIDATE_PACKET,
  figureCandidateAsset,
  stripCaptionLeadIn,
  type FigureCandidateAsset,
} from '../figure-candidates';
import { diagramDescription, type DiagramModel } from '../figures';
import GOLDEN_CANDIDATE_MODELS from './figure-candidates-golden.json';

/*
 * Matrix MC content candidates (2026-09-24 packet). Every fence's sha256 is
 * verified against the module constant here, and independently by
 * .tmp/run-mo-paper-figures-20260924/verify_candidate_blocks.ts against the
 * packet file itself.
 */

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

// Every digit token actually present across all six fences, derived from the fences themselves (never hand-typed),
// so a candidate can be checked for introducing a digit the packet does not contain.
const DIGIT_ALLOWLIST = new Set(
  FIGURE_CANDIDATE_ASSETS.flatMap((asset) => asset.fenceText.match(/\S*\d\S*/g) ?? []),
);

function digitTokensIn(text: string): string[] {
  return text.match(/\S*\d\S*/g) ?? [];
}

describe('Matrix MC figure content candidates (packet 2026-09-24)', () => {
  it('carries the exact packet and review identity from the brief', () => {
    expect(FIGURE_CANDIDATE_PACKET.packetFile).toBe('MATRIX_FOUNDATIONAL_FIGURE_CONTENT_CANDIDATES_20260924.md');
    expect(FIGURE_CANDIDATE_PACKET.packetSha256).toBe('ffe4281c6ccd6e8e46c9d6b10b46aacfdf85b35e32fc3b8212a7ef8627fb24cc');
    expect(FIGURE_CANDIDATE_PACKET.reviewFile).toBe('MATRIX_FOUNDATIONAL_FIGURE_CONTENT_CANDIDATES_REVIEW_20260924.md');
    expect(FIGURE_CANDIDATE_PACKET.reviewSha256).toBe('24db02f4b780d1de9567f3962148908ab18f83c6bd14047405d92c0c031d05b7');
    expect(FIGURE_CANDIDATE_PACKET.verdict).toBe('YELLOW_DRAFT_SAFE_FOR_L2_PROTOTYPING_NOT_FOR_FINAL_BINDING');
  });

  it('has exactly six assets, matching the packet sections 3-8 one for one', () => {
    expect(FIGURE_CANDIDATE_ASSETS.map((asset) => asset.assetId)).toEqual([
      'mx-asset-receptor-pathways-4',
      'mx-asset-bioaccumulation-pathways',
      'mx-asset-parameter-evidence-modules',
      'mx-asset-future-pathway-testing',
      'mx-asset-parameter-evidence-governance',
      'mx-asset-database-vv-workflow',
    ]);
  });

  // Fence and caption sha256 literals, copied programmatically (via
  // .tmp/run-mo-paper-figures-20260924/hash_candidates.ts, independently of the
  // figure-candidates.ts module under test) so a coordinated edit to fenceText, fenceSha256 and
  // captionCandidate together cannot pass silently (P2-2 fix: the prior test compared the module
  // against itself, so a reworded bullet plus a recomputed hash would still pass).
  const EXPECTED_FENCE_SHA256: Readonly<Record<string, string>> = {
    'mx-asset-receptor-pathways-4': 'a79a8fc81061926a326ef2b2ba4793a22e39dde0fe60d1242feb72fdc4933e2f',
    'mx-asset-bioaccumulation-pathways': '3b07e16484e5cb6be2071af7f61d9fb3914c59a9551d25386071ea8a8c09c073',
    'mx-asset-parameter-evidence-modules': '89725bfb4d60d26f65e6bfe6d609063e998e3c9fc893da75ab57e00a1b253929',
    'mx-asset-future-pathway-testing': 'd339da0f4a5db590035c3605a5eeff3bb57de942f48f7cfa4623f558a8caad3b',
    'mx-asset-parameter-evidence-governance': '58661fd9c8789441b5a7b510a01ce700d668bc3bddabb0345cd022169d83074e',
    'mx-asset-database-vv-workflow': '5c32fd54ed4aeab9d62d02301be34cfd3a129421da4974e506f727f63e4bb872',
  };
  const EXPECTED_CAPTION_SHA256: Readonly<Record<string, string>> = {
    'mx-asset-receptor-pathways-4': '2e9a0427dcfbd95802b2588ae49a13ea64fd0eb80563176c73a950b710ca7a7f',
    'mx-asset-bioaccumulation-pathways': '23305c8f3e316a283936277c59b8bb9c8670b80b1bbb66c5721ef1c5b3d91df2',
    'mx-asset-parameter-evidence-modules': '316b343c0ecc4f2778266ebe9b6ba2a38cc23509906268984dc5d7909bc1e7f1',
    'mx-asset-future-pathway-testing': 'fc50a6d40d3dbfe561e7fb49d440f9f08f8bb905a8cf9dae533248ddde864cd7',
    'mx-asset-parameter-evidence-governance': '8e9b5b6210dbb2f372648de9921356c89373763c7c8303bcca3a8435783d3ace',
    'mx-asset-database-vv-workflow': '60a6b81fac4b05d45f3fa68377109c766bf03b16364deb8e9ba91404ad588ded',
  };

  it.each(FIGURE_CANDIDATE_ASSETS.map((asset) => [asset.assetId, asset] as const))(
    "%s's fenceText, stored fenceSha256 and captionCandidate all match sha256 literals pinned independently of the module",
    (_id, asset: FigureCandidateAsset) => {
      expect(sha256(asset.fenceText)).toBe(EXPECTED_FENCE_SHA256[asset.assetId]);
      expect(asset.fenceSha256).toBe(EXPECTED_FENCE_SHA256[asset.assetId]);
      expect(sha256(asset.captionCandidate)).toBe(EXPECTED_CAPTION_SHA256[asset.assetId]);
    },
  );

  it.each(FIGURE_CANDIDATE_ASSETS.map((asset) => [asset.assetId, asset] as const))(
    '%s: every non-blank fence line is represented exactly once (coverage invariant)',
    (_id, asset: FigureCandidateAsset) => {
      const model = candidateModel(asset);
      expect(candidateCoverageGaps(asset, model)).toEqual([]);
    },
  );

  it('mutation proof: dropping one bullet from the parser output re-opens a coverage gap', () => {
    const asset = figureCandidateAsset('mx-asset-receptor-pathways-4')!;
    const model = candidateModel(asset);
    const mutated = {
      ...model,
      nodes: model.nodes.map((node, index) => (index === 1 ? { ...node, bullets: node.bullets.slice(1) } : node)),
    };
    const droppedLine = `- ${model.nodes[1].bullets[0]}`;
    expect(candidateCoverageGaps(asset, model)).toEqual([]);
    const gaps = candidateCoverageGaps(asset, mutated);
    expect(gaps).toContain(droppedLine);
  });

  describe('P2-1 coverage invariant: the four review mutations on mx-asset-bioaccumulation-pathways (7-1/B-1), each now reported', () => {
    const asset = figureCandidateAsset('mx-asset-bioaccumulation-pathways')!;
    const byId = (model: ReturnType<typeof candidateModel>, id: string) => model.nodes.find((node) => node.id === id)!;

    it('is clean before any mutation', () => {
      expect(candidateCoverageGaps(asset, candidateModel(asset))).toEqual([]);
    });

    it('(a) dropping the duplicated "Empirical transfer..." line from Pathway 4, while Pathway 2 keeps its copy, is reported', () => {
      const model = candidateModel(asset);
      const duplicate = 'Empirical transfer, tissue-residue, mechanistic, and tiered methods remain options';
      expect(byId(model, 'p2').bullets).toContain(duplicate);
      expect(byId(model, 'p4').bullets).toContain(duplicate);
      const mutated = {
        ...model,
        nodes: model.nodes.map((node) => (node.id === 'p4' ? { ...node, bullets: node.bullets.filter((bullet) => bullet !== duplicate) } : node)),
      };
      expect(candidateCoverageGaps(asset, mutated).length).toBeGreaterThan(0);
    });

    it('(b) moving "No BSAF..." from Pathway 2 (human food) to Pathway 4 (wildlife) is reported, though the Set of lines is unchanged', () => {
      const model = candidateModel(asset);
      const moved = 'No BSAF, intake rate, or toxicological-reference value is activated by this figure';
      expect(byId(model, 'p2').bullets).toContain(moved);
      const mutated = {
        ...model,
        nodes: model.nodes.map((node) => {
          if (node.id === 'p2') return { ...node, bullets: node.bullets.filter((bullet) => bullet !== moved) };
          if (node.id === 'p4') return { ...node, bullets: [...node.bullets, moved] };
          return node;
        }),
      };
      // A flat Set of lines is identical before and after (same line, different node) -- the old
      // presence-only check would report no gap; the node-aware ordered round trip must.
      const flatBefore = new Set(model.nodes.flatMap((node) => node.bullets));
      const flatAfter = new Set(mutated.nodes.flatMap((node) => node.bullets));
      expect(flatAfter).toEqual(flatBefore);
      expect(candidateCoverageGaps(asset, mutated).length).toBeGreaterThan(0);
    });

    it('(c) appending an invented bullet to Pathway 2 is reported', () => {
      const model = candidateModel(asset);
      const invented = 'BSAF default 1.0 adopted';
      const mutated = {
        ...model,
        nodes: model.nodes.map((node) => (node.id === 'p2' ? { ...node, bullets: [...node.bullets, invented] } : node)),
      };
      expect(candidateCoverageGaps(asset, mutated).length).toBeGreaterThan(0);
    });

    it('(d) copying a Pathway 2 bullet into the Shared evidence gate node is reported', () => {
      const model = candidateModel(asset);
      const copied = byId(model, 'p2').bullets[0];
      const mutated = {
        ...model,
        nodes: model.nodes.map((node) => (node.id === 'shared-evidence-gate' ? { ...node, bullets: [...node.bullets, copied] } : node)),
      };
      expect(candidateCoverageGaps(asset, mutated).length).toBeGreaterThan(0);
    });
  });

  /*
   * Round-2 P2 fix: the ordered round trip alone is blind to node BOUNDARIES -- a head promoted to
   * its own node, or bullets moved from one array to another on the same node, preserves line
   * order and so is invisible to candidateCoverageGaps. GOLDEN_CANDIDATE_MODELS pins the exact
   * node id / label / heads / bullets / notes structure for all six assets, generated
   * programmatically (never hand-typed) by
   * .tmp/run-mo-paper-figures-20260924/dump_candidate_models.ts, which imports the real
   * candidateModel and JSON.stringifies its output -- the same output the round-1 reviewer
   * independently verified line-by-line as faithful to the packet. Copied verbatim into
   * figure-candidates-golden.json (cp, not retyped).
   */
  function candidateModelStructure(model: DiagramModel) {
    return {
      nodes: model.nodes.map((node) => ({ id: node.id, label: node.label, heads: [...node.heads], bullets: [...node.bullets] })),
      notes: [...model.notes],
    };
  }

  it.each(FIGURE_CANDIDATE_ASSETS.map((asset) => [asset.assetId, asset] as const))(
    '%s matches its golden per-asset node structure exactly (round-2 P2 fix)',
    (_id, asset: FigureCandidateAsset) => {
      const golden = GOLDEN_CANDIDATE_MODELS.find((entry) => entry.assetId === asset.assetId)!;
      expect(golden).toBeDefined();
      expect(candidateModelStructure(candidateModel(asset))).toEqual({ nodes: golden.nodes, notes: golden.notes });
    },
  );

  describe('mutations (e)(f)(g) (round-2 review): node-boundary regressions the ordered round trip alone missed, each caught by the golden pin', () => {
    it('(e) 6-1: promoting "Human direct contact" to its own node carrying Pathway 1\'s bullets, leaving Pathway 1 empty -- line order unchanged, so the round trip stays clean, but the golden pin catches it', () => {
      const asset = figureCandidateAsset('mx-asset-receptor-pathways-4')!;
      const model = candidateModel(asset);
      const golden = GOLDEN_CANDIDATE_MODELS.find((entry) => entry.assetId === asset.assetId)!;
      const p1Index = model.nodes.findIndex((node) => node.id === 'p1');
      const p1 = model.nodes[p1Index];
      const mutated: DiagramModel = {
        ...model,
        nodes: [
          ...model.nodes.slice(0, p1Index),
          { ...p1, heads: [], bullets: [] },
          { id: 'human-direct-contact', label: p1.heads[0], heads: [], bullets: [...p1.bullets] },
          ...model.nodes.slice(p1Index + 1),
        ],
      };
      expect(candidateCoverageGaps(asset, mutated)).toEqual([]);
      expect(candidateModelStructure(mutated)).not.toEqual({ nodes: golden.nodes, notes: golden.notes });
    });

    it('(f) 6-1: promoting "Status: SETTLED_STRUCTURE" from the root\'s head to its own unconnected node -- line order unchanged, round trip stays clean, golden pin catches it', () => {
      const asset = figureCandidateAsset('mx-asset-receptor-pathways-4')!;
      const model = candidateModel(asset);
      const golden = GOLDEN_CANDIDATE_MODELS.find((entry) => entry.assetId === asset.assetId)!;
      const root = model.nodes[0];
      const statusHead = root.heads[0];
      const mutated: DiagramModel = {
        ...model,
        nodes: [
          { ...root, heads: [] },
          { id: 'settled-structure-status', label: statusHead, heads: [], bullets: [] },
          ...model.nodes.slice(1),
        ],
      };
      expect(candidateCoverageGaps(asset, mutated)).toEqual([]);
      expect(candidateModelStructure(mutated)).not.toEqual({ nodes: golden.nodes, notes: golden.notes });
    });

    it('(g) H-1: moving the six evidence-status tokens from step-4\'s bullets to step-4\'s heads -- both arrays serialise without a prefix, so the round trip stays clean, but the golden pin catches the role swap', () => {
      const asset = figureCandidateAsset('mx-asset-parameter-evidence-governance')!;
      const model = candidateModel(asset);
      const golden = GOLDEN_CANDIDATE_MODELS.find((entry) => entry.assetId === asset.assetId)!;
      const mutated: DiagramModel = {
        ...model,
        nodes: model.nodes.map((node) => (node.id === 'step-4' ? { ...node, heads: [...node.bullets], bullets: [] } : node)),
      };
      expect(candidateCoverageGaps(asset, mutated)).toEqual([]);
      expect(candidateModelStructure(mutated)).not.toEqual({ nodes: golden.nodes, notes: golden.notes });
    });
  });

  it('never adds a digit the fence does not contain (beyond the allow-listed Pathway/Module/Stage/section tokens actually present)', () => {
    for (const asset of FIGURE_CANDIDATE_ASSETS) {
      const model = candidateModel(asset);
      const texts = [
        ...model.nodes.flatMap((node) => [node.label, ...node.heads, ...node.bullets]),
        ...model.notes,
      ];
      for (const text of texts) {
        for (const token of digitTokensIn(text)) {
          expect(DIGIT_ALLOWLIST.has(token), `${asset.assetId}: "${token}" in "${text}"`).toBe(true);
        }
      }
    }
  });

  it('every candidate binding carries status candidate-nonfinal, a non-empty not-final statusNote, and a contentAuthority naming the packet sha256 (no labelOverrides, so overrideAuthority stays null)', () => {
    for (const asset of FIGURE_CANDIDATE_ASSETS) {
      for (const placement of asset.placements) {
        const binding = candidateBinding(asset, placement);
        expect(binding.status, placement).toBe('candidate-nonfinal');
        expect(binding.statusNote, placement).not.toBeNull();
        expect(binding.statusNote, placement).toContain('not final');
        expect(binding.overrideAuthority, placement).toBeNull();
        expect(binding.contentAuthority, placement).toContain(FIGURE_CANDIDATE_PACKET.packetSha256);
        expect(binding.sourceSha256, placement).toBe(asset.fenceSha256);
        expect(binding.notation, placement).toBe('plain');
        expect(binding.labelOverrides, placement).toBeNull();
        expect(binding.assetId, placement).toBe(asset.assetId);
        expect(binding.kind, placement).toBe('prototype');
        expect(binding.id, placement).toBe(placement);
      }
    }
  });

  it('the 7-1 and B-1 bindings share one semantic asset: same assetId and sourceSha256, distinct captions', () => {
    const asset = figureCandidateAsset('mx-asset-bioaccumulation-pathways')!;
    expect(asset.placements).toEqual(['7-1', 'B-1']);
    const seven1 = candidateBinding(asset, '7-1');
    const bOne = candidateBinding(asset, 'B-1');
    expect(seven1.assetId).toBe(bOne.assetId);
    expect(seven1.sourceSha256).toBe(bOne.sourceSha256);
    expect(seven1.label).toBe('Figure 7-1');
    expect(bOne.label).toBe('Figure B-1');
    expect(seven1.caption).toBe(bOne.caption);
  });

  it('binds the proposed G-2 workflow to its accepted canonical semantic asset while keeping packet bytes distinct', () => {
    const asset = figureCandidateAsset('mx-asset-database-vv-workflow')!;
    expect(asset.placements).toEqual(['G-2']);
    expect(asset.canonicalSemanticSource).toEqual({
      semanticAssetId: 'FIGG2',
      marker: 'APPENDIX_G_BC_AQUATIC_DATABASE_SUMMARY.md#FIGG2',
      stableLocalMarker: '<!-- FIGURE_SOURCE: FIGG2 -->',
      semanticSha256: 'C2874D16FBF916B4BB55CF122C763CA95EF689413F4252F6B350A2335C063211',
      authoritySourceSha256: {
        ownerDispositionReceipt: '5DEF8223DB7B0F94DE50FDEB5BFE63CBD897A942CEF0264530DF9EB82D5CC3F2',
        sourceRegister: '358436DF6FBB05A9A219A5D5184D18C8731287004913450F03ECA9367D89DAAF',
        completionAcceptance: 'A91E45815A4DFB3489E2284A34490D6293A408653018D668CE87348C6C99598C',
      },
    });
    const binding = candidateBinding(asset, 'G-2');
    expect(binding.label).toBe('Figure G-2');
    expect(binding.status).toBe('candidate-nonfinal');
    expect(binding.statusNote).toContain('PROPOSED; NO COMPLETE RESOURCE PASSED');
    expect(binding.statusNote).toMatch(/final binding pending/i);
    expect(asset.fenceSha256).not.toBe('C2874D16FBF916B4BB55CF122C763CA95EF689413F4252F6B350A2335C063211');
    for (const placement of ['6-1', '7-1', 'B-1', '7-7', 'G-3', 'H-1', 'G-2']) {
      const asset = FIGURE_CANDIDATE_ASSETS.find((candidate) => candidate.placements.includes(placement));
      expect(asset).toBeDefined();
      expect(candidateBinding(asset!, placement).label?.endsWith('.')).toBe(false);
    }
  });

  it('binds H-1 to its accepted canonical evidence-governance asset and fail-closed status', () => {
    const asset = figureCandidateAsset('mx-asset-parameter-evidence-governance')!;
    expect(asset.placements).toEqual(['H-1']);
    expect(asset.canonicalSemanticSource).toEqual({
      semanticAssetId: 'FIGH1',
      marker: 'APPENDIX_H_POLICY_READY_INPUT_PARAMETER_COMPENDIUM.md#FIGH1',
      stableLocalMarker: '<!-- FIGURE_SOURCE: FIGH1 -->',
      semanticSha256: '78865C89BFD1A1F89784C6787F05C6D0DA05EEF5F5F4780DCC095D31FAC236A0',
      authoritySourceSha256: {
        ownerDispositionReceipt: '5DEF8223DB7B0F94DE50FDEB5BFE63CBD897A942CEF0264530DF9EB82D5CC3F2',
        sourceRegister: '358436DF6FBB05A9A219A5D5184D18C8731287004913450F03ECA9367D89DAAF',
        completionAcceptance: 'A91E45815A4DFB3489E2284A34490D6293A408653018D668CE87348C6C99598C',
      },
    });
    const binding = candidateBinding(asset, 'H-1');
    expect(binding.status).toBe('candidate-nonfinal');
    expect(binding.statusNote).toContain('PROPOSED; FAIL-CLOSED');
    expect(binding.statusNote).toMatch(/final binding pending/i);
    expect(binding.statusNote).not.toContain('REAUTHOR_AS_EVIDENCE_GOVERNANCE_FLOW');
    expect(binding.statusNote).not.toContain('identity remains');
    expect(asset.fenceSha256).not.toBe('78865C89BFD1A1F89784C6787F05C6D0DA05EEF5F5F4780DCC095D31FAC236A0');
  });

  it('strips only the caption lead-in that the figure label already renders', () => {
    expect(stripCaptionLeadIn('Figure 6-1. Proposed Part 1 framework: four receptor-pathways.')).toBe('Proposed Part 1 framework: four receptor-pathways.');
    expect(stripCaptionLeadIn('Proposed figure. Four-stage verification and validation process.')).toBe('Four-stage verification and validation process.');
    expect(stripCaptionLeadIn('No period here')).toBe('No period here');
  });

  it('matches the packet edge table exactly, with the correct basis for each group', () => {
    const byId = (assetId: string) => figureCandidateAsset(assetId)!;
    expect(byId('mx-asset-receptor-pathways-4').edges).toEqual([
      { from: 'root', to: 'p1', basis: 'packet-explicit' },
      { from: 'root', to: 'p2', basis: 'packet-explicit' },
      { from: 'root', to: 'p3', basis: 'packet-explicit' },
      { from: 'root', to: 'p4', basis: 'packet-explicit' },
    ]);
    expect(byId('mx-asset-bioaccumulation-pathways').edges).toEqual([
      { from: 'root', to: 'p2', basis: 'packet-root-hierarchy' },
      { from: 'root', to: 'p4', basis: 'packet-root-hierarchy' },
    ]);
    // The shared evidence gate node gets no edges.
    const bioModel = candidateModel(byId('mx-asset-bioaccumulation-pathways'));
    expect(bioModel.edges.some((edge) => edge.from === 'shared-evidence-gate' || edge.to === 'shared-evidence-gate')).toBe(false);
    expect(bioModel.nodes.some((node) => node.id === 'shared-evidence-gate')).toBe(true);
    // Full from/to lists (round-2 P3 fix): 7-7 and G-3 were pinned by `to` side only; H-1 and G-2
    // were pinned by basis only (probe (h) reordered G-2's edges and this test still passed).
    expect(byId('mx-asset-parameter-evidence-modules').edges).toEqual([
      { from: 'root', to: 'm1', basis: 'packet-root-hierarchy' },
      { from: 'root', to: 'm2', basis: 'packet-root-hierarchy' },
      { from: 'root', to: 'm3', basis: 'packet-root-hierarchy' },
      { from: 'root', to: 'm4', basis: 'packet-root-hierarchy' },
      { from: 'root', to: 'm5', basis: 'packet-root-hierarchy' },
    ]);
    expect(byId('mx-asset-future-pathway-testing').edges).toEqual([
      { from: 'root', to: 'p1', basis: 'packet-root-hierarchy' },
      { from: 'root', to: 'p2', basis: 'packet-root-hierarchy' },
      { from: 'root', to: 'p3', basis: 'packet-root-hierarchy' },
      { from: 'root', to: 'p4', basis: 'packet-root-hierarchy' },
    ]);
    expect(byId('mx-asset-parameter-evidence-governance').edges).toEqual([
      { from: 'candidate-record', to: 'step-1', basis: 'packet-sequence' },
      { from: 'step-1', to: 'step-2', basis: 'packet-sequence' },
      { from: 'step-2', to: 'step-3', basis: 'packet-sequence' },
      { from: 'step-3', to: 'step-4', basis: 'packet-sequence' },
      { from: 'step-4', to: 'step-5', basis: 'packet-sequence' },
      { from: 'step-5', to: 'step-6', basis: 'packet-sequence' },
    ]);
    expect(byId('mx-asset-database-vv-workflow').edges).toEqual([
      { from: 'input', to: 'stage1', basis: 'packet-sequence' },
      { from: 'stage1', to: 'stage2', basis: 'packet-sequence' },
      { from: 'stage2', to: 'stage3', basis: 'packet-sequence' },
      { from: 'stage3', to: 'stage4', basis: 'packet-sequence' },
      { from: 'stage4', to: 'output', basis: 'packet-sequence' },
    ]);
  });

  it('(h) the full from/to pin fails on a reordered CLONE of G-2\'s real edges, and passes on the unmutated clone (mutation-tested, leg1a-r3 P3 fix)', () => {
    // Leg1a-r3 review: the prior version of this test compared a hand-written literal to
    // asset.edges, so it could only fail if that literal were retyped to match a reordering --
    // it could never catch a REAL reordering bug. This version clones the production edges array
    // and runs the SAME toEqual assertion the pin at line ~361 uses, both unmutated (must pass)
    // and with two adjacent edges swapped (must fail), so the check can actually fail.
    const asset = figureCandidateAsset('mx-asset-database-vv-workflow')!;
    const clone = asset.edges.map((edge) => ({ ...edge }));
    expect(clone).toEqual(asset.edges);
    expect(clone.every((edge) => edge.basis === 'packet-sequence')).toBe(true);
    const [first, second, ...rest] = clone;
    const reordered = [second, first, ...rest];
    expect(reordered).not.toEqual(asset.edges);
  });

  it("6-1's Edges line is consumed as the edge list, not as visible node text", () => {
    const asset = figureCandidateAsset('mx-asset-receptor-pathways-4')!;
    const model = candidateModel(asset);
    const texts = model.nodes.flatMap((node) => [node.label, ...node.heads, ...node.bullets]);
    expect(texts.some((text) => text.includes('Edges:'))).toBe(false);
    expect(model.notes.some((note) => note.includes('Edges:'))).toBe(false);
  });

  it('H-1 reads as a chain: Candidate record through the fail-closed rule, with the six evidence-status tokens as bullets of one step', () => {
    const asset = figureCandidateAsset('mx-asset-parameter-evidence-governance')!;
    const model = candidateModel(asset);
    expect(model.nodes.map((node) => node.id)).toEqual(['candidate-record', 'step-1', 'step-2', 'step-3', 'step-4', 'step-5', 'step-6']);
    expect(model.nodes[0].label).toBe('Candidate record');
    const assignStep = model.nodes.find((node) => node.label === 'Assign one evidence status:')!;
    expect(assignStep.bullets).toEqual(['VERIFIED_PRIMARY', 'VERIFIED_SECONDARY', 'WORKING_CONVENTION', 'OPTION_OPEN', 'SOURCE_GAP', 'WITHDRAW']);
    expect(model.notes).toEqual(['Fail-closed rule: No calculation may consume an unverified record.']);
    expect(model.layout).toBe('flow');
  });

  it('the G-2 replacement workflow reads Input -> four stages -> Output, keeping the BLOCKED DESIGN DETAIL bullet verbatim', () => {
    const asset = figureCandidateAsset('mx-asset-database-vv-workflow')!;
    const model = candidateModel(asset);
    expect(model.nodes.map((node) => node.id)).toEqual(['input', 'stage1', 'stage2', 'stage3', 'stage4', 'output']);
    expect(model.nodes[0].label).toBe('Input: candidate environmental record');
    expect(model.nodes.at(-1)!.label).toBe('Output: QA/QC-screened candidate record for analytical use');
    const stage3 = model.nodes.find((node) => node.id === 'stage3')!;
    expect(stage3.bullets).toContain('BLOCKED DESIGN DETAIL: identifier attributes are not yet settled; no scheme is built');
    expect(model.notes).toEqual(['Global status: PROPOSED_SYSTEM - no data have yet passed this process.']);
  });

  it('sets edgeRelation to contains for packet-root-hierarchy assets, and omits it for explicit/sequence assets (P3-1)', () => {
    const hierarchyAssetIds = ['mx-asset-bioaccumulation-pathways', 'mx-asset-parameter-evidence-modules', 'mx-asset-future-pathway-testing'];
    const nonHierarchyAssetIds = ['mx-asset-receptor-pathways-4', 'mx-asset-parameter-evidence-governance', 'mx-asset-database-vv-workflow'];
    for (const assetId of hierarchyAssetIds) {
      const asset = figureCandidateAsset(assetId)!;
      for (const placement of asset.placements) expect(candidateBinding(asset, placement).edgeRelation, placement).toBe('contains');
    }
    for (const assetId of nonHierarchyAssetIds) {
      const asset = figureCandidateAsset(assetId)!;
      for (const placement of asset.placements) expect(candidateBinding(asset, placement).edgeRelation, placement).toBeUndefined();
    }
  });

  it('the shared evidence gate (7-1/B-1) has no edges, so its candidate text equivalent names it as not connected, using "contains" for the hierarchy edges', () => {
    const asset = figureCandidateAsset('mx-asset-bioaccumulation-pathways')!;
    const binding = candidateBinding(asset, '7-1');
    const model = candidateModel(asset);
    const description = diagramDescription(model, 'plain', { relation: binding.edgeRelation });
    expect(description).toContain('contains');
    expect(description).not.toContain('leads to');
    expect(description).toContain('Shown without a drawn connection: Shared evidence gate.');
  });

  it('never restores the historical HH-DIR/HH-FOOD/ECO-DIR/ECO-FOOD labels or a numeric default/equation', () => {
    for (const asset of FIGURE_CANDIDATE_ASSETS) {
      expect(asset.fenceText).not.toMatch(/HH-DIR|HH-FOOD|ECO-DIR|ECO-FOOD/);
      expect(asset.fenceText).not.toMatch(/BSAF\s*=|TMF\s*=/);
    }
  });
});
