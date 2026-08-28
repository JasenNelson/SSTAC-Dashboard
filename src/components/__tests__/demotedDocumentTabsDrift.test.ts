import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Drift guard for DEMOTED_DOCUMENT_TABS (MatrixDashboard.tsx).
 *
 * Two facts have to agree, and nothing in the source made them:
 *   1. which tabs render their markdown through demoteLeadingH1(), which strips the
 *      document's own level-1 heading because the app shell supplies one on screen; and
 *   2. DEMOTED_DOCUMENT_TABS, the set that decides which tabs get a replacement
 *      `hidden print:block` <h1> so the document is not printed with zero level-1 headings.
 *
 * The shell <h1> lives inside a `print:hidden` toolbar, so a demoted document with no entry
 * in this set prints headless. This test binds the set membership to the demotion call count.
 * It asserts cardinality plus exact membership; it does not parse the render tree, so it is a
 * drift alarm rather than proof that each call is inside the expected tab branch.
 */

const DASHBOARD = path.join(process.cwd(), 'src', 'components', 'MatrixDashboard.tsx');
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

    expect(members.length).toBeGreaterThan(0);
    expect(callSites.length).toBeGreaterThan(0);

    const unique = new Set(members);
    expect(unique.size, 'DEMOTED_DOCUMENT_TABS contains a duplicate entry').toBe(members.length);
    expect(callSites.length).toBe(unique.size);
    expect(unique).toEqual(new Set(['The Guide']));
  });
});
