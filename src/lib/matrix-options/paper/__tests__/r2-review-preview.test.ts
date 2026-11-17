import { describe, expect, it } from 'vitest';

import { PREVIEW_FOCUS_AREAS, PREVIEW_PROMPTS, previewAreaForAnchor, previewAreaState, previewInitialState } from '../r2-review-preview';

describe('R2 guided preview model', () => {
  it('keeps six stable areas apart from prompts and whole-paper comments', () => {
    expect(PREVIEW_FOCUS_AREAS.map((area) => area.id)).toEqual([
      'approach-structure', 'uses-waterbodies', 'substances-evidence',
      'human-health', 'ecological-health', 'common-rules-sequencing',
    ]);
    expect(PREVIEW_FOCUS_AREAS.map((area) => area.id)).not.toContain('whole-paper');
    expect(PREVIEW_FOCUS_AREAS.find((area) => area.id === 'substances-evidence')?.promptIds).toHaveLength(0);
    expect(PREVIEW_FOCUS_AREAS.find((area) => area.id === 'common-rules-sequencing')?.promptIds).toHaveLength(2);
    expect(PREVIEW_PROMPTS.filter((prompt) => prompt.kind === 'choice').length).toBeGreaterThan(0);
    expect(PREVIEW_PROMPTS.every((prompt) => PREVIEW_FOCUS_AREAS.some((area) => area.id === prompt.areaId && area.promptIds.includes(prompt.id)))).toBe(true);
  });

  it('maps paper sections without treating old feedback or a visit as a completed answer', () => {
    expect(previewAreaForAnchor('sec-phase2-6-2')).toBe('human-health');
    expect(previewAreaForAnchor('sec-phase2-8')).toBe('common-rules-sequencing');
    expect(previewAreaForAnchor('sec-phase2-9')).toBeNull();
    const area = PREVIEW_FOCUS_AREAS[1];
    const initial = previewInitialState();
    expect(previewAreaState(initial, area)).toBe('not-visited');
    expect(previewAreaState({ ...initial, visitedAreaIds: [area.id] }, area)).toBe('visited');
    expect(previewAreaState({ ...initial, sectionComments: { [area.anchor]: 'Site example' } }, area)).toBe('has-input');
    expect(previewAreaState({ ...initial, reviewedAreaIds: [area.id] }, area)).toBe('reviewed');
  });
});
