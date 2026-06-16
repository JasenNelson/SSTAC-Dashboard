import { describe, expect, it } from 'vitest';

import type { ProvenancePathway } from '../provenance/types';
import {
  DEFAULT_REGULATORY_FRAME_ID,
  REGULATORY_FRAME_IDS,
  REGULATORY_FRAMES,
  coerceRegulatoryFrameId,
  getPathwayApplicability,
  getRegulatoryFrame,
  isRegulatoryFrameId,
  pathwayApplicabilityLabel,
  pathwayApplicabilityTone,
  regulatoryFrameEvidenceFilter,
} from '../regulatoryFrames';

const PATHWAYS: ProvenancePathway[] = [
  'eco-direct-eqp',
  'eco-food-bsaf',
  'background-adjustment',
  'human-health-direct',
  'human-health-food',
];

describe('regulatoryFrames', () => {
  it('uses BC Protocol 1 v5 DRA as the default development frame', () => {
    expect(DEFAULT_REGULATORY_FRAME_ID).toBe('bc-protocol1-v5-dra');
    const frame = getRegulatoryFrame(DEFAULT_REGULATORY_FRAME_ID);
    expect(frame.label).toMatch(/Protocol 1 v5/);
    expect(frame.valueEligibilityRule).toMatch(/pending locators/i);
  });

  it('maps legacy jurisdiction ids to the new regulatory frame ids', () => {
    expect(coerceRegulatoryFrameId('bc-csr')).toBe('bc-protocol1-v5-dra');
    expect(coerceRegulatoryFrameId('federal-ccme')).toBe(
      'ccme-sediment-quality',
    );
    expect(coerceRegulatoryFrameId('site-specific')).toBe('site-specific');
    expect(coerceRegulatoryFrameId('made-up')).toBeNull();
  });

  it('declares pathway applicability for every frame and pathway', () => {
    for (const frameId of REGULATORY_FRAME_IDS) {
      for (const pathway of PATHWAYS) {
        const applicability = getPathwayApplicability(frameId, pathway);
        expect(applicability.status).toMatch(
          /^(calculation_ready|needs_review|reference_only|unsupported)$/,
        );
        expect(applicability.note.length).toBeGreaterThan(20);
      }
    }
  });

  it('uses catalog jurisdictions as eligibility filters', () => {
    expect(regulatoryFrameEvidenceFilter('ccme-sediment-quality')).toEqual({
      jurisdictions: ['Canada_federal', 'general'],
    });
    expect(regulatoryFrameEvidenceFilter('us-epa-usace-sediment')).toEqual({
      jurisdictions: ['US_federal', 'general'],
    });
    expect(regulatoryFrameEvidenceFilter('bc-protocol1-v5-dra')).toEqual({
      jurisdictions: ['BC', 'Canada_federal', 'US_federal', 'general'],
    });
  });

  it('keeps policy compilations and source-mined leads non-driving', () => {
    const bcFrame = getRegulatoryFrame('bc-protocol1-v5-dra');
    const policyCompilationTier = bcFrame.sourceHierarchy.find((item) =>
      item.label.includes('Protocol 28'),
    );
    expect(policyCompilationTier?.note).toMatch(/Reference-mining aids only/i);
    expect(bcFrame.safeUseNote).toMatch(/defaults yet/i);
  });

  it('keeps frame ids and frame records aligned', () => {
    expect(REGULATORY_FRAMES.map((frame) => frame.id)).toEqual(
      REGULATORY_FRAME_IDS,
    );
  });

  it('pathwayApplicabilityLabel returns the correct label for all 4 statuses', () => {
    expect(pathwayApplicabilityLabel('calculation_ready')).toBe('Calculation-ready');
    expect(pathwayApplicabilityLabel('needs_review')).toBe('Needs review');
    expect(pathwayApplicabilityLabel('reference_only')).toBe('Reference-only');
    expect(pathwayApplicabilityLabel('unsupported')).toBe('Unsupported');
  });

  it('pathwayApplicabilityTone returns the correct tone token for all 4 statuses', () => {
    expect(pathwayApplicabilityTone('calculation_ready')).toBe('emerald');
    expect(pathwayApplicabilityTone('needs_review')).toBe('amber');
    expect(pathwayApplicabilityTone('reference_only')).toBe('sky');
    expect(pathwayApplicabilityTone('unsupported')).toBe('slate');
  });
});

describe('isRegulatoryFrameId', () => {
  it('returns true for every id in REGULATORY_FRAME_IDS', () => {
    for (const id of REGULATORY_FRAME_IDS) {
      expect(isRegulatoryFrameId(id)).toBe(true);
    }
  });

  it('returns true for known individual frame ids', () => {
    expect(isRegulatoryFrameId('bc-protocol1-v5-dra')).toBe(true);
    expect(isRegulatoryFrameId('ccme-sediment-quality')).toBe(true);
  });

  it('returns false for an unknown or empty string', () => {
    expect(isRegulatoryFrameId('unknown-frame')).toBe(false);
    expect(isRegulatoryFrameId('')).toBe(false);
  });

  it('returns false for the legacy jurisdiction key bc-csr (not a RegulatoryFrameId)', () => {
    // 'bc-csr' is a legacy jurisdiction key handled by coerceRegulatoryFrameId,
    // NOT a member of REGULATORY_FRAME_IDS (only 'bc-csr-sediment-numerical' is).
    expect(isRegulatoryFrameId('bc-csr')).toBe(false);
  });

  it('returns false for non-string values (number, null, undefined, object)', () => {
    expect(isRegulatoryFrameId(42)).toBe(false);
    expect(isRegulatoryFrameId(null)).toBe(false);
    expect(isRegulatoryFrameId(undefined)).toBe(false);
    expect(isRegulatoryFrameId({ id: 'bc-protocol1-v5-dra' })).toBe(false);
  });
});
