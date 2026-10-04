import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { presentWithheldSections, shownWithheldEntryCount } from '@/lib/matrix-options/paper/withheld-sections';

import { PaperText } from '../PaperText';

/*
 * The proof at the reader's own renderer: what PaperText DRAWS for a text that had
 * an entry for a withheld appendix. Each form below is an entry the two line-based
 * rules before this one removed only in part (successor-002 review, cases A1, A2,
 * A3, B1, B2) or refused. Synthetic text: "Appendix X" under `app-x`; every word
 * of the entry is one of the PARTS listed, every other paragraph says "Kept".
 */

const IDS = ['app-x'];
const TAB = String.fromCharCode(9);
const PARTS = ['Appendix X', 'A title', 'quoted paragraph of the same entry', 'An entry under it', 'second paragraph of the same entry', 'runs on to a second line'];

const FORMS: readonly (readonly [string, string])[] = [
  ['A1', 'Kept before.\n\n- Appendix X: A title\n\n  >A quoted paragraph of the same entry.\n\nKept after.\n'],
  ['A2', 'Kept before.\n\n  - Appendix X: A title\n\n    > A quoted paragraph of the same entry.\n\nKept after.\n'],
  ['A3', 'Kept before.\n\n  - Appendix X: A title\n    > - An entry under it\n\nKept after.\n'],
  ['B1', `Kept before.\n\n- Kept parent\n  - Appendix X: A title\n${TAB}- An entry under it\n- Kept sibling\n\nKept after.\n`],
  ['B2', `Kept before.\n\n  - Appendix X: A title\n\n${TAB}A second paragraph of the same entry.\n\nKept after.\n`],
  ['runs on', 'Kept before.\n\n- Kept first\n- Appendix X: A title\n  that runs on to a second line\n- Kept last\n\nKept after.\n'],
  ['ordered', 'Kept before.\n\n1. Kept one\n2. Appendix X: A title\n3. Kept three\n\nKept after.\n'],
];

/** What the renderer drew: all its text, the text of each list item, and how many "Kept" pieces. */
function drawn(markdown: string): { readonly text: string; readonly items: string[]; readonly kept: number } {
  const { container, unmount } = render(<PaperText markdown={markdown} />);
  const text = container.textContent ?? '';
  const items = Array.from(container.querySelectorAll('li'), (item) => item.textContent ?? '');
  // Each paragraph and item outside the entry says "Kept" exactly once.
  const kept = (text.match(/Kept/g) ?? []).length;
  unmount();
  return { text, items, kept };
}

describe('what the reader is drawn for a text with an entry for a withheld appendix', () => {
  it.each(FORMS)('%s: no part of the entry is drawn, and everything else is', (_name, text) => {
    const before = drawn(text);
    // Control: without the rule the renderer draws the entry, as a list item.
    expect(before.items.some((item) => item.includes('Appendix X'))).toBe(true);
    const shown = presentWithheldSections(text, IDS);
    const after = drawn(shown);
    for (const part of PARTS) expect(after.text.includes(part)).toBe(false);
    expect(after.items.some((item) => item.includes('Appendix X'))).toBe(false);
    // Every paragraph and item that is not part of the entry is drawn as before.
    expect(after.kept).toBe(before.kept);
    expect(after.kept).toBeGreaterThanOrEqual(2);
    expect(shownWithheldEntryCount(shown, IDS)).toBe(0);
  });

  it('draws a near match as it is, beside the removed entry', () => {
    const list = '- Appendix X: A title\n- Appendix X_1: Kept one\n- Appendix X-1: Kept two\n- Appendix XA: Kept three\n';
    const after = drawn(presentWithheldSections(list, IDS));
    expect(after.items).toEqual(['Appendix X_1: Kept one', 'Appendix X-1: Kept two', 'Appendix XA: Kept three']);
  });

  it('draws a sentence that mentions the appendix as it is', () => {
    const text = 'Kept: the method is set out in Appendix X.\n\n- Appendix X: A title\n';
    const after = drawn(presentWithheldSections(text, IDS));
    expect(after.text).toContain('Kept: the method is set out in Appendix X.');
    expect(after.items).toEqual([]);
  });

  it('keeps the numerals of an ordered list in step: the list still counts from its first remaining item', () => {
    const { container } = render(<PaperText markdown={presentWithheldSections('4. Appendix X: A title\n5. Kept five\n6. Kept six\n', IDS)} />);
    const list = container.querySelector('ol')!;
    expect(list.getAttribute('start')).toBe('5');
    expect(list.querySelectorAll('li')).toHaveLength(2);
  });
});
