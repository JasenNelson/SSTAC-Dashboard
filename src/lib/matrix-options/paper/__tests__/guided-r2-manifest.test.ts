import { describe, expect, it } from 'vitest';

import { GUIDED_R2_FOCUS_AREAS, GUIDED_R2_PROMPTS, GUIDED_R2_SECTION_ANCHORS, GUIDED_R2_TARGETS } from '../guided-r2-contract';
import { getGuidedR2Manifest } from '../guided-r2-manifest';

describe('R2 guided manifest', () => {
  it('freezes the accepted six areas, six prompts and distinct identity', () => {
    const manifest = getGuidedR2Manifest();
    expect(GUIDED_R2_FOCUS_AREAS).toHaveLength(6);
    expect(GUIDED_R2_PROMPTS).toHaveLength(6);
    expect(new Set(GUIDED_R2_TARGETS.map((target) => `${target.kind}:${target.id}`)).size).toBe(GUIDED_R2_TARGETS.length);
    expect(manifest.guidedManifestSha256).toBe('25e9a8cf1ed7017a55773b144ac699ba474cc9e73941c3e03982f38bab9ab576');
    expect(manifest.guidedManifestSha256).not.toBe(manifest.reviewManifestSha256);
    expect(GUIDED_R2_SECTION_ANCHORS).toContain('sec-phase2-9');
  });
});
