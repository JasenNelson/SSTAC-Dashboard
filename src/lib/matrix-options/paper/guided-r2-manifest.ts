import 'server-only';

import { sha256Object } from './contracts';
import { GUIDED_R2_FOCUS_AREAS, GUIDED_R2_PROMPTS, GUIDED_R2_SCHEMA_VERSION, GUIDED_R2_SECTION_ANCHORS, GUIDED_R2_TARGETS } from './guided-r2-contract';
import { getReviewManifest } from './review-manifest';
import { getPaperRelease, PHASE2_R2_PAPER_VERSION } from './releases';

export function getGuidedR2Manifest() {
  const release = getPaperRelease(PHASE2_R2_PAPER_VERSION);
  if (!release) throw new Error('R2 release identity is unavailable');
  const identity = {
    schemaVersion: GUIDED_R2_SCHEMA_VERSION,
    documentVersion: release.documentVersion,
    paperSha256: release.sha256,
    reviewManifestSha256: getReviewManifest(PHASE2_R2_PAPER_VERSION).sha256,
    focusAreas: GUIDED_R2_FOCUS_AREAS,
    prompts: GUIDED_R2_PROMPTS,
    sectionAnchors: GUIDED_R2_SECTION_ANCHORS,
    targets: GUIDED_R2_TARGETS,
  } as const;
  return Object.freeze({ ...identity, guidedManifestSha256: sha256Object(identity) });
}
