import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Drift guard for DEMOTED_DOCUMENT_TABS (MatrixDashboard.tsx).
 *
 * Two facts have to agree, and nothing in the source made them:
 *   1. which tabs render their markdown through demoteLeadingH1(), which strips the
 *      document's own level-1 heading because the app shell supplies one on SCREEN; and
 *   2. DEMOTED_DOCUMENT_TABS, the set that decides which tabs get a replacement
 *      `hidden print:block` <h1> so the document is not printed with ZERO level-1 headings.
 *
 * The shell <h1> lives inside a `print:hidden` toolbar, so a demoted document with no entry
 * in this set prints headless -- and does so SILENTLY. That is the failure class this project
 * keeps shipping: the regulatory content is correct, the page just stops telling you what it
 * is. The declaration's own comment claimed the set is "kept beside the call sites it mirrors
 * so the two cannot drift apart silently". They are roughly eleven hundred lines apart in a
 * two-thousand-line file, so proximity was never doing any work. This test is what does.
 *
 * No line numbers here on purpose. An earlier draft of this paragraph cited the declaration and
 * both call sites by line, and the very commit that introduced it shifted all three -- which is
 * the same defect the comments in MatrixDashboard.tsx were corrected for in that same commit.
 *
 * WHAT THIS DOES NOT CATCH, stated so the guard is not read as stronger than it is: it asserts
 * CARDINALITY (one set member per call site) plus exact MEMBERSHIP. It does not assert
 * CORRESPONDENCE -- it cannot see which tab a given call site belongs to. So moving a
 * demoteLeadingH1() call from one tab's render to another, leaving the set alone, keeps the
 * count at 2 and the membership identical, and passes. Correspondence is not recoverable from
 * source text without parsing the render tree, which is why the membership assertion is pinned
 * exactly: any deliberate change to WHICH documents are demoted has to be typed here too, and
 * that edit is where a human notices. This is a drift alarm, not a proof.
 *
 * Falsified two-sided:
 *   - adding a third demoteLeadingH1() call without extending the set FAILS the count check;
 *   - removing a member from the set FAILS both the count check and the membership check;
 *   - on the current tree both checks PASS.
 *
 * The existence assertions below are defence-in-depth, and are honestly redundant IN THIS test:
 * the exact-membership assertion already fails on an empty member list, and the cardinality
 * assertion already fails on 0-vs-2. They earn their place by failing with a clearer message,
 * and because the general hazard is real -- a count check ALONE is satisfiable by 0 === 0, so if
 * the source moved and both regexes stopped matching, an absence-only test would certify the
 * very drift it exists to catch. Stated this way rather than as "not padding", which overclaimed
 * for this particular test.
 */

const DASHBOARD = path.join(process.cwd(), 'src', 'components', 'MatrixDashboard.tsx');

// The set is authored as a literal, so the members are readable from source without
// evaluating the module (which would pull in the whole client component tree).
const SET_DECL = /const DEMOTED_DOCUMENT_TABS = new Set\(\[([^\]]*)\]\)/;

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^[ \t]*\/\/.*$/gm, ' ');
}

describe('DEMOTED_DOCUMENT_TABS drift guard', () => {
  const source = fs.readFileSync(DASHBOARD, 'utf8');
  const code = stripComments(source);

  it('has a readable DEMOTED_DOCUMENT_TABS literal', () => {
    expect(SET_DECL.test(code)).toBe(true);
  });

  it('has one set member per demoteLeadingH1 call site, and the expected members', () => {
    const match = code.match(SET_DECL);
    expect(match).not.toBeNull();

    const members = (match as RegExpMatchArray)[1]
      .split(',')
      .map((raw) => raw.trim())
      .filter((raw) => raw.length > 0)
      .map((raw) => raw.replace(/^['"]|['"]$/g, ''));

    const callSites = code.match(/demoteLeadingH1\(/g) ?? [];

    // Existence half. Without these, a source move that breaks both regexes yields
    // 0 === 0 and the guard silently certifies nothing.
    expect(members.length).toBeGreaterThan(0);
    expect(callSites.length).toBeGreaterThan(0);

    // No duplicate members. `new Set(['A','A'])` has ONE entry, so a duplicated literal would
    // make members.length disagree with the set the component actually builds -- and would let
    // three call sites reconcile against a two-tab set. Assert it directly rather than relying
    // on the cardinality check below to notice.
    const unique = new Set(members);
    expect(unique.size, 'DEMOTED_DOCUMENT_TABS contains a duplicate entry').toBe(members.length);

    // Compare call sites against UNIQUE tabs, which is what the Set actually contains.
    expect(callSites.length).toBe(unique.size);

    // Membership half. Pins WHICH tabs, so swapping one demoted document for another
    // (count unchanged) still has to be a conscious edit here.
    expect(new Set(members)).toEqual(new Set(['The Guide']));
  });
});
