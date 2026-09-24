import { afterEach, describe, expect, it, vi } from 'vitest';

import { numberedReviewTopicLabel, REVIEW_TOPIC_PRESENTATION_LABELS, reviewTopicLabel } from '../topic-labels';
import { DEFAULT_READER_WIDTH, READER_WIDTH_STORAGE_KEY, readReaderWidth, writeReaderWidth } from '../reader-width';
import { CONTENTS_DISPLAY_LABELS, presentChunkLabel, presentChunkMarkdown, sectionRegion } from '../contents-heading';
import { APPENDIX_BOUNDARY_LABEL } from '../outline-hierarchy';
import cohorts from '../contracts/cohorts-v1.json';

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('review topic presentation labels', () => {
  const manifest = (cohorts as { cohorts: { id: string; name: string }[] }).cohorts;

  it('labels and numbers the five topics in manifest order, keeping the stable ids', () => {
    expect(manifest.map((cohort, index) => numberedReviewTopicLabel(cohort.id, cohort.name, index))).toEqual([
      '1. Sediment Uses',
      '2. Receptors and Pathways',
      '3. Exposure Assumptions',
      '4. Inputs and Evidence',
      '5. Methods and Water Types',
    ]);
    // Two-sided: the manifest names are unchanged (identity is not rewritten).
    expect(manifest.map((cohort) => cohort.name)).toEqual(['Categories', 'Pathway and grid', 'Exposure assumptions', 'Inputs and evidence', 'Methods and water type']);
    expect(Object.keys(REVIEW_TOPIC_PRESENTATION_LABELS).sort()).toEqual(manifest.map((cohort) => cohort.id).sort());
  });

  it('an unknown cohort keeps its manifest name', () => {
    expect(reviewTopicLabel('new-topic', 'New topic')).toBe('New topic');
  });
});

describe('reader width preference', () => {
  it('defaults to comfortable, persists wide, and ignores junk', () => {
    expect(readReaderWidth()).toBe(DEFAULT_READER_WIDTH);
    expect(writeReaderWidth('wide')).toBe(true);
    expect(readReaderWidth()).toBe('wide');
    window.localStorage.setItem(READER_WIDTH_STORAGE_KEY, 'huge');
    expect(readReaderWidth()).toBe('comfortable');
  });

  it('blocked storage falls back to the default and reports the write failed', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readReaderWidth()).toBe('comfortable');
    expect(writeReaderWidth('wide')).toBe(false);
  });
});

describe('contents heading presentation', () => {
  const markdown = '## Master Table of Contents\n\n1. [Intro](#intro)\n\n## Master Table of Contents of something else\n';

  it('relabels only the exact heading, by region, without touching the rest', () => {
    expect(presentChunkMarkdown(markdown, 'Master Table of Contents', 'main')).toBe('## Paper contents\n\n1. [Intro](#intro)\n\n## Master Table of Contents of something else\n');
    expect(presentChunkMarkdown(markdown, 'Master Table of Contents', 'appendix').startsWith('## Appendix contents\n')).toBe(true);
    // Two-sided: any other chunk is returned byte-for-byte.
    expect(presentChunkMarkdown(markdown, '1.0 Intro', 'main')).toBe(markdown);
    expect(presentChunkLabel('Master Table of Contents', 'appendix')).toBe(CONTENTS_DISPLAY_LABELS.appendix);
    expect(presentChunkLabel('1.0 Intro', 'appendix')).toBe('1.0 Intro');
  });

  it('regions switch at the appendix boundary section', () => {
    const sections = ['Title', 'Master Table of Contents', APPENDIX_BOUNDARY_LABEL, 'Appendix A: First'];
    expect(sections.map((_, index) => sectionRegion(sections, index, APPENDIX_BOUNDARY_LABEL))).toEqual(['main', 'main', 'appendix', 'appendix']);
    expect(sectionRegion(['Title'], 0, APPENDIX_BOUNDARY_LABEL)).toBe('main');
  });
});
