/**
 * Audit item #16 -- duplicate H1.
 *
 * The Matrix Options shell already renders the page-level `<h1>Matrix Options</h1>`
 * (MatrixDashboard.tsx:1783). Several markdown documents rendered inside it also open with
 * their own `# ` heading, so those tabs ship two level-1 headings: a WCAG 1.3.1 / screen
 * reader defect, and visually a second oversized title under the real one.
 *
 * The fix is applied at the CALL SITE, not inside MathRenderer. MathRenderer is shared:
 * JermilovaReviewPortal.tsx:819 renders through it and has NO other `<h1>`, so demoting
 * headings globally would delete that page's only title. That is why this is a standalone
 * pure helper rather than a change to the renderer.
 *
 * Scope is deliberately narrow: only a level-1 heading that OPENS the document is demoted.
 * A `# ` appearing later is left alone -- this helper removes a duplicate TITLE, it does not
 * rewrite a document's heading structure.
 */

// A UTF-8 BOM survives fs.readFileSync(path, 'utf8') as U+FEFF and would otherwise sit
// between the start of the string and the '#', defeating the match. Written as an escape
// rather than a literal to keep this file inside the ASCII-only rule (L0 CLAUDE.md 1.1).
const LEADING_H1 = /^([\s\uFEFF]*)#[ \t]/;

export function demoteLeadingH1(markdown: string): string {
  if (typeof markdown !== 'string' || markdown.length === 0) {
    return markdown;
  }

  // Leading whitespace/BOM, then '#', then a space or tab. That trailing requirement does
  // all the work: it rules out '#hashtag', and it rules out h2..h6 too, because '## X' has
  // a '#' rather than a space at the position after the first hash. An earlier draft also
  // carried a `(?!#)` lookahead for the h2 case; falsification showed removing it changed
  // nothing, so it was dead and is gone rather than left in place looking load-bearing.
  const match = LEADING_H1.exec(markdown);
  if (!match) {
    return markdown;
  }

  const hashIndex = match[1].length;
  return `${markdown.slice(0, hashIndex)}#${markdown.slice(hashIndex)}`;
}
