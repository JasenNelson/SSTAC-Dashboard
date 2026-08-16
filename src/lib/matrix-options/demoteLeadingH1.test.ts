import { describe, it, expect } from 'vitest';
import { demoteLeadingH1 } from './demoteLeadingH1';

/**
 * Audit item #16. Two-sided by construction: every case asserts BOTH what changed and what
 * did not, because the realistic regression here is over-reach (demoting headings that were
 * never duplicates) rather than under-reach.
 *
 * Falsification record -- each mutation was run and the named tests watched failing:
 *  - forcing the match to null -> 4 tests FAIL (the demotion cases).
 *  - dropping the `[ \t]` requirement -> 3 FAIL: "leaves an h2 or deeper alone", "leaves a
 *    bare hash with no space alone", and idempotency (`## X` would become `### X`).
 *
 * Recorded because it was measured and is not what I first assumed: an earlier draft of the
 * regex also had a `(?!#)` lookahead, and this comment claimed removing it would fail the h2
 * case. It does not -- the `[ \t]` requirement already excludes `##`, so the lookahead was
 * dead. It was removed rather than kept with a comment overstating its role.
 */
describe('demoteLeadingH1', () => {
  it('demotes a level-1 heading that opens the document', () => {
    expect(demoteLeadingH1('# The Guide: Matrix Options Workspace\n\nbody')).toBe(
      '## The Guide: Matrix Options Workspace\n\nbody'
    );
  });

  it('demotes past leading blank lines', () => {
    expect(demoteLeadingH1('\n\n# Title\n\nbody')).toBe('\n\n## Title\n\nbody');
  });

  it('demotes past a UTF-8 BOM, which survives readFileSync as U+FEFF', () => {
    expect(demoteLeadingH1('\uFEFF# Title\n')).toBe('\uFEFF## Title\n');
  });

  it('leaves an h2 or deeper alone', () => {
    expect(demoteLeadingH1('## Already a section\n')).toBe('## Already a section\n');
    expect(demoteLeadingH1('### Deeper\n')).toBe('### Deeper\n');
  });

  it('leaves a bare hash with no space alone (not a heading)', () => {
    expect(demoteLeadingH1('#hashtag is not a heading\n')).toBe('#hashtag is not a heading\n');
  });

  it('only demotes the FIRST heading, never later ones', () => {
    const input = '# Title\n\n## Section\n\n# Later top-level\n';
    expect(demoteLeadingH1(input)).toBe('## Title\n\n## Section\n\n# Later top-level\n');
  });

  it('leaves a document that does not open with a heading untouched', () => {
    const input = 'Intro paragraph.\n\n# Not the first line\n';
    expect(demoteLeadingH1(input)).toBe(input);
  });

  it('handles empty and whitespace-only input without throwing', () => {
    expect(demoteLeadingH1('')).toBe('');
    expect(demoteLeadingH1('   \n\n')).toBe('   \n\n');
  });

  it('is idempotent -- applying it twice does not reach h3', () => {
    const once = demoteLeadingH1('# Title\n');
    expect(demoteLeadingH1(once)).toBe(once);
  });
});
