import { describe, expect, it } from 'vitest';

import { loadRevisedPaperStructure } from '@/lib/matrix-options/revised-paper-structure';
import { candidateBinding, candidateModel, figureCandidateAsset, FIGURE_CANDIDATE_PACKET } from '../figure-candidates';
import { paperMarkdownSegments } from '../derived-figures';
import { FIGURE_REGISTER, FIGURE_SOURCE_LEDGER, LAYOUT_SKELETONS, layoutPrototypeBinding, layoutPrototypeModel } from '../figure-register';
import { PAPER_FIGURES } from '../figures';

const V0987_LIST_OF_FIGURES = ['6-1', '7-1', '7-2', '7-3', '7-4', '7-5', '7-6', '7-7', 'A-1', 'A-2', 'A-3', 'A-4', 'B-1', 'E-1', 'F-1', 'F-2', 'G-1', 'G-2', 'G-3', 'H-1'];
const drawn = new Map(paperMarkdownSegments(loadRevisedPaperStructure().content).flatMap((segment) => (segment.kind === 'figure' && segment.binding?.kind === 'restored' ? [[segment.binding.id, segment.binding] as const] : [])));

/**
 * Expected source-native fence sha256 per figure, copied programmatically from
 * .tmp/run-mo-paper-figures-20260924/source_native_parity.json (never retyped or completed by
 * hand -- see REGISTER_LINEAGE_RECEIPT.md for the extraction command).
 */
const EXPECTED_SOURCE_NATIVE_FENCE_SHA256: Record<string, string> = {
  'A-1': 'fadf5cc1dc51413fda62b771c6227e722f74fb36711ac9b3a5a5610d61f6456a',
  'A-2': '2a29e73257ced3b7b6580cef9c2d79174a3e2a0fb14370aacfee89d0173ed4fe',
  'A-3': 'b36e5c1967aacf782e697a9ff371618532ac27d8b880d70c4b0850bc8115f75f',
  'A-4': '92f81dbcbdb74fe30a0d11521b53ca98f4ef60d3fae48168969fdef2d2081ec3',
  'E-1': '6d5d6ed2c05a004123f4688581633418448c79223a858467a85a557baf9716ae',
  'F-1': 'c1d72bb4a16b48435fea6c52db3b64eec405d3b9136a7d1a8e16d6a56e4424c6',
  'F-2': '44e659f80b7e69bdbb9fb291b45be523d00f52168c560a32602f6d1a6a878461',
  '7-3': 'd98aa741618ea613fbca21574bf2389d92136da890a05a291af2951e49f980b7',
  '7-4': '0e3c64e7db3dbf36be1b57c7447c59413a54977183f3acdfa8be6886f1eb4d4e',
  '7-5': 'cde7ce40b17eca6b25155180b446992996d59b2b20728108da2085ed6b774be1',
  '7-6': '4be4d5982cd42e2ff07387f0de7b70ab3f36b745433407938fb1d36b217649ff',
};

/**
 * The seven-file ledger's own sha256, pinned as a literal independent of the FIGURE_SOURCE_LEDGER
 * module constant (P3-4 fix: the prior test only checked every row against that module constant,
 * so the ledger sha itself was pinned by no test literal). Copied programmatically from
 * MATRIX_SEVEN_SOURCE_DELTA_LEDGER_20260924.md's own recorded hash (source_native_parity.json /
 * REGISTER_LINEAGE_RECEIPT.md), never retyped or completed by hand.
 */
const EXPECTED_LEDGER_SHA256 = 'b07c457f07771883b823eaf530b21fd4ee02165e57a4a19c8fc9b89243b56fdd';

/**
 * Per-row whole-file live/staged sha256 and fence start line for the 11 source-native rows,
 * copied programmatically from .tmp/run-mo-paper-figures-20260924/source_native_parity.json
 * (case-folded to lowercase hex to match the module's own casing) -- pinned as literals so a
 * coordinated edit to figure-register.ts cannot silently drift from the ledger (P3-4 fix; the
 * prior test pinned fenceSha256 only).
 */
const EXPECTED_LIVE_FILE_SHA256: Record<string, string> = {
  'A-1': '77aa94738e89d49c204b026fd5988c1ee0d2884b43010c7c2df06b9cb08ec7f7',
  'A-2': '77aa94738e89d49c204b026fd5988c1ee0d2884b43010c7c2df06b9cb08ec7f7',
  'A-3': '77aa94738e89d49c204b026fd5988c1ee0d2884b43010c7c2df06b9cb08ec7f7',
  'A-4': '77aa94738e89d49c204b026fd5988c1ee0d2884b43010c7c2df06b9cb08ec7f7',
  'E-1': '6f46fb12b75519841f6fbb6eed5c224f4659fbbbe987100f85e05682d8758c52',
  'F-1': 'b7d0c2c2a528dbe21bbe02ddf518a088fc8f6a16d45b599bda712533230558f0',
  'F-2': 'b7d0c2c2a528dbe21bbe02ddf518a088fc8f6a16d45b599bda712533230558f0',
  '7-3': '49ccaba87f5e9c978b55d090e8fa56e1920f3e32752283fd2b3553b17966270a',
  '7-4': '49ccaba87f5e9c978b55d090e8fa56e1920f3e32752283fd2b3553b17966270a',
  '7-5': '37bbd1e843386969c2cfdf8a673a9ea62e73a1e331542132ff27a2dfe7e6e55c',
  '7-6': '37bbd1e843386969c2cfdf8a673a9ea62e73a1e331542132ff27a2dfe7e6e55c',
};
const EXPECTED_STAGED_FILE_SHA256: Record<string, string> = {
  'A-1': '08aac3d88a2a03f85da2c9fc0a88d20607d91edd9737fdb2cef643999b28b319',
  'A-2': '08aac3d88a2a03f85da2c9fc0a88d20607d91edd9737fdb2cef643999b28b319',
  'A-3': '08aac3d88a2a03f85da2c9fc0a88d20607d91edd9737fdb2cef643999b28b319',
  'A-4': '08aac3d88a2a03f85da2c9fc0a88d20607d91edd9737fdb2cef643999b28b319',
  'E-1': 'f3be080af4bfc69ccc81f4872d41b6bd33e4308c2b0a5e988af6b0e276a86eb0',
  'F-1': '4d10840f0ac9610ea6acb5871e048ecb997b7fc92f08466a8dbf31b0806e51d6',
  'F-2': '4d10840f0ac9610ea6acb5871e048ecb997b7fc92f08466a8dbf31b0806e51d6',
  '7-3': 'b42077b0a0ac981813e99d2a5c135f4d56ce7e1847cf791fe1e02fe889643d84',
  '7-4': 'b42077b0a0ac981813e99d2a5c135f4d56ce7e1847cf791fe1e02fe889643d84',
  '7-5': 'add774b7e3d446f13e00b9e72fd9b53f3f2861e772e9f8793b8ac5d7ae953e84',
  '7-6': 'add774b7e3d446f13e00b9e72fd9b53f3f2861e772e9f8793b8ac5d7ae953e84',
};
const EXPECTED_FENCE_START_LINE: Record<string, number> = {
  'A-1': 89, 'A-2': 169, 'A-3': 302, 'A-4': 568,
  'E-1': 79, 'F-1': 55, 'F-2': 127,
  '7-3': 20, '7-4': 39, '7-5': 18, '7-6': 66,
};

describe('the 20-figure register', () => {
  it('has exactly one row per v0.9.87 List of Figures entry, in that order', () => {
    expect(FIGURE_REGISTER.map((row) => row.number)).toEqual(V0987_LIST_OF_FIGURES);
  });

  it('marks every figure the current paper draws as rendered, and every rendered row is drawn with its registry disposition', () => {
    const rendered = FIGURE_REGISTER.filter((row) => row.implementation.startsWith('rendered-current') || row.implementation === 'prototype-nonfinal');
    expect(rendered.map((row) => row.number).sort()).toEqual([...drawn.keys()].sort());
    for (const row of rendered) {
      const entry = PAPER_FIGURES.find((candidate) => candidate.figureNumber === row.number)!;
      expect(row.disposition, row.number).toBe(entry.disposition);
      expect(row.implementation === 'rendered-current-math-notation', row.number).toBe(entry.notation === 'math');
      expect(row.implementation === 'prototype-nonfinal', row.number).toBe(Boolean(entry.prototype));
    }
  });

  it('reuses one scientific asset for each duplicate placement (7-2 -> E-1, G-1 -> 7-5)', () => {
    const duplicates = FIGURE_REGISTER.filter((row) => row.implementation === 'referenced-duplicate');
    expect(duplicates.map((row) => [row.number, row.reuseOf])).toEqual([['7-2', 'E-1'], ['G-1', '7-5']]);
    for (const row of duplicates) expect(drawn.has(row.reuseOf!), row.number).toBe(true);
    expect(FIGURE_REGISTER.filter((row) => row.reuseOf !== null)).toHaveLength(2);
  });

  it('keeps G-2 historical-only in the register (LAYOUT_SKELETONS retains only G-2; the other five former layout-only rows are superseded by a Matrix MC content candidate)', () => {
    // Equal-or-stronger replacement for the pre-candidate assertion: 7-1, 7-7, B-1, G-3 and H-1 no
    // longer carry an empty "awaiting Matrix MC" layout skeleton -- see the candidate-prototype-nonfinal test below.
    expect(Object.keys(LAYOUT_SKELETONS)).toEqual(['G-2']);
    const g2 = FIGURE_REGISTER.find((row) => row.number === 'G-2')!;
    expect(g2.implementation).toBe('historical-proposal-layout-only');
    expect(g2.disposition).toBe('DO_NOT_RESTORE_AS_CURRENT_SCHEMA');
    expect(layoutPrototypeBinding(g2).statusNote).toMatch(/^Historical proposal - not current design/);
    expect(layoutPrototypeModel('G-2')).not.toBeNull();
    expect(layoutPrototypeBinding(g2)).toMatchObject({ kind: 'prototype', status: 'historical-proposal' });
    expect(LAYOUT_SKELETONS['G-2'].structureSha256).toMatch(/^[0-9a-f]{64}$/);
    for (const number of ['7-1', '7-7', 'B-1', 'G-3', 'H-1']) expect(layoutPrototypeModel(number), number).toBeNull();
  });

  it('puts no scientific text in the one remaining layout prototype (G-2): only generic box names and the historical-proposal marker', () => {
    const allowed = /^(Box \d+|Historical proposal only)$/;
    for (const [number, skeleton] of Object.entries(LAYOUT_SKELETONS)) {
      for (const node of skeleton.nodes) {
        expect(node.label, `${number} ${node.id}`).toMatch(allowed);
        for (const line of node.lines) expect(line, `${number} ${node.id}`).toMatch(allowed);
      }
    }
  });

  it('marks 7-1, B-1, 7-7, G-3 and H-1 as candidate-prototype-nonfinal, each bound to its Matrix MC content-candidate semantic asset', () => {
    const expectedAssetByNumber: Record<string, string> = {
      '7-1': 'mx-asset-bioaccumulation-pathways',
      'B-1': 'mx-asset-bioaccumulation-pathways',
      '7-7': 'mx-asset-parameter-evidence-modules',
      'G-3': 'mx-asset-future-pathway-testing',
      'H-1': 'mx-asset-parameter-evidence-governance',
    };
    const candidateRows = FIGURE_REGISTER.filter((row) => row.implementation === 'candidate-prototype-nonfinal').map((row) => row.number);
    expect(candidateRows.sort()).toEqual(['7-1', '7-7', 'B-1', 'G-3', 'H-1'].sort());
    for (const [number, assetId] of Object.entries(expectedAssetByNumber)) {
      const row = FIGURE_REGISTER.find((candidate) => candidate.number === number)!;
      expect(row.semanticAssetId, number).toBe(assetId);
      expect(row.candidatePacketSha256, number).toBe(FIGURE_CANDIDATE_PACKET.packetSha256);
      const asset = figureCandidateAsset(assetId)!;
      const binding = candidateBinding(asset, number);
      expect(binding.status, number).toBe('candidate-nonfinal');
      expect(binding.statusNote, number).toMatch(/not final and not scientifically accepted/);
      expect(binding.overrideAuthority, number).toBeNull();
      expect(binding.contentAuthority, number).toContain(FIGURE_CANDIDATE_PACKET.packetSha256);
      expect(candidateModel(asset).nodes.length, number).toBeGreaterThan(0);
    }
    // 7-1 and B-1 share one semantic asset and its content hash (per the packet's ONE_SEMANTIC_ASSET_TWO_PLACEMENTS disposition).
    const seven1 = FIGURE_REGISTER.find((row) => row.number === '7-1')!;
    const bOne = FIGURE_REGISTER.find((row) => row.number === 'B-1')!;
    expect(seven1.semanticAssetId).toBe(bOne.semanticAssetId);
  });

  it("records G-2's Matrix MC replacement-workflow candidate on the historical row without disturbing its DO_NOT_RESTORE_AS_CURRENT_SCHEMA disposition", () => {
    const g2 = FIGURE_REGISTER.find((row) => row.number === 'G-2')!;
    expect(g2.semanticAssetId).toBe('mx-asset-database-vv-workflow');
    expect(g2.candidatePacketSha256).toBe(FIGURE_CANDIDATE_PACKET.packetSha256);
    expect(g2.remainingDecision).toMatch(/treatment A/);
    expect(g2.remainingDecision).toMatch(/treatment B/);
    expect(g2.remainingDecision).toMatch(/PX-4/);
    const asset = figureCandidateAsset(g2.semanticAssetId!)!;
    expect(asset.placements).toEqual(['G-2A', 'G-2B']);
  });

  it('gives every row a visibleStatus and accessibleEquivalent field (status is never color alone)', () => {
    for (const row of FIGURE_REGISTER) {
      expect(row.visibleStatus.length, row.number).toBeGreaterThan(5);
      expect(row.accessibleEquivalent.length, row.number).toBeGreaterThan(20);
    }
  });

  // ROUND6_FIX_BRIEF item 2 (leg1a_r6 P3-1): the only test on this field checked length > 20,
  // which a regression back to CANDIDATE_ACCESSIBLE_EQUIVALENT ("names the candidate packet hash")
  // would still satisfy. Pin the two-sided fact directly: the 6-1 row's accessibleEquivalent must
  // NOT claim the inline note names a packet hash, and MUST describe the plain draft note instead.
  it("6-1's accessibleEquivalent never claims the inline note names a packet hash, and describes the plain draft note", () => {
    const six = FIGURE_REGISTER.find((row) => row.number === '6-1')!;
    expect(six.accessibleEquivalent).not.toContain('names the candidate packet hash');
    expect(six.accessibleEquivalent).toContain('it names no packet hash');
  });

  it('records a remaining Matrix MC decision for every row', () => {
    for (const row of FIGURE_REGISTER) expect(row.remainingDecision.length, row.number).toBeGreaterThan(20);
  });

  // ROUND4_FIX_BRIEF item 5 (Leg1b P2-3): a required placement field so Matrix MC can see, without
  // opening the lab, which numbers the default-on inline stakeholder paper actually draws today.
  it("gives every row a placement field matching what it draws inline: the 12 PAPER_FIGURES numbers are 'inline+lab', G-2 is 'historical-lab-only', and every other row (7-1, 7-2, 7-7, B-1, G-1, G-3, H-1 -- never yet placed inline) is 'lab-only'", () => {
    const inlineNumbers = new Set(PAPER_FIGURES.map((entry) => entry.figureNumber));
    expect(inlineNumbers.size).toBe(12);
    for (const row of FIGURE_REGISTER) {
      if (row.number === 'G-2') {
        expect(row.placement, row.number).toBe('historical-lab-only');
      } else if (inlineNumbers.has(row.number)) {
        expect(row.placement, row.number).toBe('inline+lab');
      } else {
        expect(row.placement, row.number).toBe('lab-only');
      }
    }
    expect(FIGURE_REGISTER.filter((row) => row.placement === 'inline+lab').map((row) => row.number).sort()).toEqual([...inlineNumbers].sort());
    expect(FIGURE_REGISTER.filter((row) => row.placement === 'lab-only').map((row) => row.number).sort()).toEqual(['7-1', '7-2', '7-7', 'B-1', 'G-1', 'G-3', 'H-1'].sort());
  });

  it('no visibleStatus claims "accepted" except F-2\'s disposition-backed wording; none claims "final" or "canonical" without negation/pending (P2-4)', () => {
    // "not ... scientifically accepted" is the sanctioned negated phrase every candidate row carries; strip it
    // before checking for an unqualified acceptance claim.
    const withoutNegatedAccepted = (text: string) => text.replace(/not\s+(?:final\s+and\s+not\s+)?scientifically accepted/gi, '');
    for (const row of FIGURE_REGISTER) {
      if (row.number === 'F-2') {
        expect(row.visibleStatus).toContain('direction accepted');
        continue;
      }
      expect(withoutNegatedAccepted(row.visibleStatus).toLowerCase(), row.number).not.toContain('accepted');
    }
    for (const row of FIGURE_REGISTER) {
      if (/\bfinal\b/i.test(row.visibleStatus)) {
        expect(row.visibleStatus, row.number).toMatch(/not final|final binding pending/i);
      }
      if (/\bcanonical\b/i.test(row.visibleStatus)) {
        expect(row.visibleStatus, row.number).toMatch(/not (the )?canonical/i);
      }
    }
  });
});

describe('the 20-figure register lineage (MATRIX_SEVEN_SOURCE_DELTA_LEDGER_20260924.md)', () => {
  it('pins the ledger sha256 itself as a literal, and checks every row against it', () => {
    expect(FIGURE_SOURCE_LEDGER.sha256).toBe(EXPECTED_LEDGER_SHA256);
    for (const row of FIGURE_REGISTER) expect(row.lineage.ledgerSha256, row.number).toBe(FIGURE_SOURCE_LEDGER.sha256);
  });

  it('has exactly the 11 source-native rows, each IDENTICAL to its expected fence sha256, live/staged file sha256 and fence start line', () => {
    const sourceNative = FIGURE_REGISTER.filter((row) => row.lineage.kind === 'source-native-fence');
    expect(sourceNative.map((row) => row.number).sort()).toEqual(Object.keys(EXPECTED_SOURCE_NATIVE_FENCE_SHA256).sort());
    for (const row of sourceNative) {
      expect(row.lineage.fenceSha256, row.number).toBe(EXPECTED_SOURCE_NATIVE_FENCE_SHA256[row.number]);
      expect(row.lineage.liveFileSha256?.toLowerCase(), row.number).toBe(EXPECTED_LIVE_FILE_SHA256[row.number]);
      expect(row.lineage.stagedFileSha256?.toLowerCase(), row.number).toBe(EXPECTED_STAGED_FILE_SHA256[row.number]);
      expect(row.lineage.fenceStartLine, row.number).toBe(EXPECTED_FENCE_START_LINE[row.number]);
      expect(row.lineage.parity, row.number).toBe('IDENTICAL');
      expect(row.lineage.fenceOrdinal, row.number).not.toBeNull();
      expect(row.lineage.diagramSummary, row.number).not.toBeNull();
    }
  });

  it('gives 7-2 and G-1 the same fence fields as the E-1 / 7-5 assets they reuse', () => {
    const e1 = FIGURE_REGISTER.find((row) => row.number === 'E-1')!;
    const sevenTwo = FIGURE_REGISTER.find((row) => row.number === '7-2')!;
    expect(sevenTwo.lineage.kind).toBe('referenced-duplicate');
    expect(sevenTwo.lineage.fenceSha256).toBe(e1.lineage.fenceSha256);
    expect(sevenTwo.lineage.sourceFile).toBe(e1.lineage.sourceFile);
    expect(sevenTwo.lineage.diagramSummary).toBe(e1.lineage.diagramSummary);

    const seven5 = FIGURE_REGISTER.find((row) => row.number === '7-5')!;
    const gOne = FIGURE_REGISTER.find((row) => row.number === 'G-1')!;
    expect(gOne.lineage.kind).toBe('referenced-duplicate');
    expect(gOne.lineage.fenceSha256).toBe(seven5.lineage.fenceSha256);
    expect(gOne.lineage.sourceFile).toBe(seven5.lineage.sourceFile);
    expect(gOne.lineage.diagramSummary).toBe(seven5.lineage.diagramSummary);
  });

  it('marks 6-1 outside-ledger (MASTER_TEMPLATE.md has no diagram fence)', () => {
    const sixOne = FIGURE_REGISTER.find((row) => row.number === '6-1')!;
    expect(sixOne.lineage.kind).toBe('outside-ledger');
    expect(sixOne.lineage.fenceSha256).toBeNull();
    expect(sixOne.lineage.diagramSummary).toBe(8);
  });

  it('gives every candidate row (packet-candidate or historical-only) a null sourceFile and a note naming the packet sha256', () => {
    const candidateKindRows = FIGURE_REGISTER.filter((row) => row.lineage.kind === 'packet-candidate' || row.lineage.kind === 'historical-only');
    expect(candidateKindRows.map((row) => row.number).sort()).toEqual(['7-1', '7-7', 'B-1', 'G-2', 'G-3', 'H-1'].sort());
    for (const row of candidateKindRows) {
      expect(row.lineage.sourceFile, row.number).toBeNull();
      expect(row.lineage.fenceSha256, row.number).toBeNull();
      expect(row.lineage.note, row.number).toContain(FIGURE_CANDIDATE_PACKET.packetSha256);
    }
  });
});
