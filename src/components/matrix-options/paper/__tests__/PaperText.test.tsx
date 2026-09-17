import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { getCohortManifest } from '@/lib/matrix-options/cohort-contract';
import { deriveCohortPortions } from '@/lib/matrix-options/paper/cohort-portions';
import { markdownHeadingLevels } from '@/lib/matrix-options/paper/full-document';
import { loadRevisedPaperStructure } from '@/lib/matrix-options/revised-paper-structure';
import {
  PAPER_DOCUMENT_HEADING_OFFSET,
  PAPER_PORTION_TOP_HEADING_LEVEL,
  PaperText,
  paperHeadingClasses,
  portionHeadingOffset,
} from '../PaperText';

/*
 * M1R2-01. MathRenderer styles only its own direct children h1-h4, so before
 * this round the demoted h5/h6 rendered as unstyled body text and every other
 * level was a step too small. These tests pin the class contract for both
 * heading maps (h5 AND h6 present in each) and the level arithmetic.
 */

const DOCUMENT_LEVELS = ['h2', 'h3', 'h4', 'h5', 'h6'] as const;
const PORTION_LEVELS = ['h3', 'h4', 'h5', 'h6'] as const;

describe('paper heading style contract', () => {
  it('styles every demoted level, including h5 and h6, for both maps', () => {
    const document = paperHeadingClasses(PAPER_DOCUMENT_HEADING_OFFSET);
    for (const level of DOCUMENT_LEVELS) expect(document).toContain(`[&_.math-renderer>${level}]:`);
    // Working Draft: rendered h2 carries the pre-demotion h1 treatment and drops
    // MathRenderer's h2 underline; rendered h3 takes it.
    expect(document).toContain('[&_.math-renderer>h2]:text-3xl');
    expect(document).toContain('[&_.math-renderer>h2]:border-b-0');
    expect(document).toContain('[&_.math-renderer>h3]:text-2xl');
    expect(document).toContain('[&_.math-renderer>h3]:border-b ');
    expect(document).toContain('[&_.math-renderer>h4]:text-xl');
    expect(document).toContain('[&_.math-renderer>h5]:text-lg');
    expect(document).toContain('[&_.math-renderer>h5]:font-semibold');
    expect(document).toContain('[&_.math-renderer>h6]:font-semibold');
    expect(document).toContain('[&_.math-renderer>h6]:mt-4');

    const portion = paperHeadingClasses(2);
    for (const level of PORTION_LEVELS) expect(portion).toContain(`[&_.math-renderer>${level}]:`);
    expect(portion).toContain('[&_.math-renderer>h5]:font-semibold');
    expect(portion).toContain('[&_.math-renderer>h6]:font-semibold');
    // Portion headings never outsize the portion's own h2 heading (text-xl).
    expect(portion).toContain('[&_.math-renderer>h3]:text-lg');
    expect(portion).not.toContain('[&_.math-renderer>h3]:text-2xl');
    expect(document).not.toBe(portion);
  });

  it('selects the map from the offset and honours an explicit variant', () => {
    expect(paperHeadingClasses(PAPER_DOCUMENT_HEADING_OFFSET)).toBe(paperHeadingClasses(1, 'document'));
    expect(paperHeadingClasses(2)).toBe(paperHeadingClasses(0, 'portion'));
    expect(paperHeadingClasses(1, 'portion')).toBe(paperHeadingClasses(2));
    expect(paperHeadingClasses(0)).toBe(paperHeadingClasses(2));
  });

  it('applies the wrapper classes and the demotion when rendering', () => {
    const { container } = render(<PaperText markdown={'# Top level\n\ntext\n\n##### Deepest source level\n\nmore'} headingOffset={PAPER_DOCUMENT_HEADING_OFFSET} />);
    const wrapper = container.querySelector('.reader-prose');
    expect(wrapper?.className).toContain('[&_.math-renderer>h6]:font-semibold');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Top level');
    expect(screen.getByRole('heading', { level: 6 })).toHaveTextContent('Deepest source level');
    expect(container.querySelectorAll('h1')).toHaveLength(0);
  });

  it('renders a portion so its headings sit below the portion heading and stay distinct', () => {
    const markdown = '## 7.5 Section\n\nbody\n\n### 7.5.1 Child\n\nmore\n\n#### 7.5.1.1 Grandchild\n\nlast';
    const offset = portionHeadingOffset(markdown);
    expect(offset).toBe(1);
    const { container } = render(<PaperText markdown={markdown} headingOffset={offset} headingVariant="portion" />);
    const levels = Array.from(container.querySelectorAll('h1,h2,h3,h4,h5,h6')).map((heading) => Number(heading.tagName.slice(1)));
    expect(levels).toEqual([3, 4, 5]);
    expect(new Set(levels).size).toBe(levels.length);
    expect(Math.min(...levels)).toBe(PAPER_PORTION_TOP_HEADING_LEVEL);
  });
});

describe('portionHeadingOffset', () => {
  it.each([
    ['a top-level portion', '# One\n\ntext', 2],
    ['a section portion', '## 4.1 One\n\ntext', 1],
    ['an already deep portion', '### 7.5.1 One\n\ntext', 0],
    ['a deeper portion', '#### 7.5.1.1 One\n\ntext', 0],
    ['no headings', 'just prose', 0],
  ])('demotes %s so its shallowest heading renders at h3', (_name, markdown, expected) => {
    expect(portionHeadingOffset(markdown)).toBe(expected);
    const levels = markdownHeadingLevels(markdown);
    if (levels.length > 0) expect(Math.min(...levels) + expected).toBe(Math.max(PAPER_PORTION_TOP_HEADING_LEVEL, Math.min(...levels)));
  });

  it('ignores heading-like lines inside fenced code', () => {
    expect(portionHeadingOffset('```\n# not a heading\n```\n\n## 4.1 Real\n')).toBe(1);
    expect(markdownHeadingLevels('```\n# not a heading\n```\n\n## 4.1 Real\n')).toEqual([2]);
  });

  it('keeps every authenticated cohort portion below its h2 with no two source levels colliding', () => {
    const structure = loadRevisedPaperStructure();
    const portions = deriveCohortPortions(structure, getCohortManifest()).filter((portion) => portion.status === 'available' && portion.text);
    expect(portions.length).toBeGreaterThan(0);
    for (const portion of portions) {
      const text = portion.text ?? '';
      const offset = portionHeadingOffset(text);
      const sourceLevels = [...new Set(markdownHeadingLevels(text))].sort((a, b) => a - b);
      const rendered = sourceLevels.map((level) => Math.min(6, level + offset));
      // Distinct source levels stay distinct, every heading is below the portion h2
      // (which is an h2, so h3 or deeper), and none is lost to the level-6 cap.
      expect(new Set(rendered).size).toBe(sourceLevels.length);
      expect(Math.min(...rendered)).toBeGreaterThanOrEqual(PAPER_PORTION_TOP_HEADING_LEVEL);
      expect(Math.max(...rendered)).toBeLessThanOrEqual(6);
      // A portion that starts deeper than h3 is never promoted above it either.
      expect(Math.min(...rendered)).toBe(Math.max(PAPER_PORTION_TOP_HEADING_LEVEL, Math.min(...sourceLevels)));
    }
  });
});
