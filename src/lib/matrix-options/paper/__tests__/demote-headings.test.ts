import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { loadRevisedPaperStructure } from '../../revised-paper-structure';
import { demoteMarkdownHeadings } from '../full-document';

const ATX_HEADING = /^ {0,3}(#{1,6})(?=[ \t]|$)/gm;

function levelCounts(markdown: string): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const match of markdown.matchAll(ATX_HEADING)) counts[match[1].length] += 1;
  return counts;
}

describe('demoteMarkdownHeadings (M1-09)', () => {
  it('shifts ATX heading levels, caps at 6, and keeps heading text and every other line unchanged', () => {
    const source = ['# One', '## Two', '   ### Three indented', '#### Four', '##### Five', '###### Six', '#NoSpace', '####### Seven hashes', 'Text # not a heading', '    # indented code', '#', ''].join('\n');
    expect(demoteMarkdownHeadings(source, 1)).toBe(['## One', '### Two', '   #### Three indented', '##### Four', '###### Five', '###### Six', '#NoSpace', '####### Seven hashes', 'Text # not a heading', '    # indented code', '##', ''].join('\n'));
    expect(demoteMarkdownHeadings(source, 2).split('\n').slice(0, 2)).toEqual(['### One', '#### Two']);
  });

  it('leaves fenced code blocks untouched, including tilde and longer closing fences', () => {
    const source = ['```python', '# comment', '```', '# After backticks', '~~~~', '# tilde comment', '~~~', '# still inside', '~~~~~', '## After tildes', '```', '# unclosed fence body'].join('\n');
    expect(demoteMarkdownHeadings(source, 1)).toBe(['```python', '# comment', '```', '## After backticks', '~~~~', '# tilde comment', '~~~', '# still inside', '~~~~~', '### After tildes', '```', '# unclosed fence body'].join('\n'));
  });

  it('is a no-op for a zero, negative or non-integer offset', () => {
    const source = '# One\n## Two';
    for (const offset of [0, -1, 1.5, Number.NaN]) expect(demoteMarkdownHeadings(source, offset)).toBe(source);
  });

  it('demotes every heading of the real release by one level with no level-1 heading left', () => {
    const { content } = loadRevisedPaperStructure();
    const before = levelCounts(content);
    const after = levelCounts(demoteMarkdownHeadings(content, 1));
    expect(before[1]).toBeGreaterThan(0);
    expect(before[6]).toBe(0);
    expect(after).toEqual([0, 0, before[1], before[2], before[3], before[4], before[5]]);
    expect(demoteMarkdownHeadings(content, 1).replace(/^( {0,3})#(#{1,6})(?=[ \t]|$)/gm, '$1$2')).toBe(content);
  });
});
