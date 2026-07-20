import { describe, expect, it } from 'vitest';

import {
  REGULATORY_FRAME_OPTIONS_IDS,
  DEFAULT_REGULATORY_FRAME,
  REGULATORY_FRAME_OPTIONS,
  isRegulatoryFrame,
  coerceRegulatoryFrame,
  ALL_JURISDICTIONS,
  DEFAULT_JURISDICTION,
  JURISDICTION_OPTIONS,
  isJurisdiction,
  coerceJurisdiction,
} from '../jurisdictions';

describe('jurisdictions / regulatoryFrames', () => {
  // INDEPENDENT ROSTER ANCHOR (load-bearing -- do not replace with a loop over the live array).
  // RegulatoryFrameId is DERIVED from REGULATORY_FRAME_IDS ((typeof REGULATORY_FRAME_IDS)[number]),
  // so if a member is dropped the type shrinks in lockstep: tsc stays green, the exhaustiveness
  // guards stay green (they check the type against that same tuple), and every "for (const id of
  // ALL_JURISDICTIONS)" loop below simply stops exercising the dropped member. This pinned list is
  // the ONLY independent source of truth -- adding or removing a frame must be a deliberate,
  // reviewed edit here.
  const EXPECTED_REGULATORY_FRAME_IDS = [
    'bc-protocol1-v5-dra',
    'bc-csr-sediment-numerical',
    'canada-fcsap-aquatic',
    'ccme-sediment-quality',
    'us-epa-usace-sediment',
    'site-specific',
  ];

  describe('roster anchor', () => {
    it('REGULATORY_FRAME_OPTIONS_IDS matches the pinned roster exactly', () => {
      expect([...REGULATORY_FRAME_OPTIONS_IDS]).toEqual(EXPECTED_REGULATORY_FRAME_IDS);
    });

    it('ALL_JURISDICTIONS (deprecated alias) stays in sync with the pinned roster', () => {
      expect([...ALL_JURISDICTIONS]).toEqual(EXPECTED_REGULATORY_FRAME_IDS);
    });
  });

  describe('isRegulatoryFrame', () => {
    it('returns true for every member of REGULATORY_FRAME_OPTIONS_IDS', () => {
      for (const id of REGULATORY_FRAME_OPTIONS_IDS) {
        expect(isRegulatoryFrame(id)).toBe(true);
      }
    });

    it('returns false for invalid inputs', () => {
      expect(isRegulatoryFrame('invalid-frame')).toBe(false);
      expect(isRegulatoryFrame('')).toBe(false);
      expect(isRegulatoryFrame(null as unknown)).toBe(false);
      expect(isRegulatoryFrame(undefined as unknown)).toBe(false);
      expect(isRegulatoryFrame(123 as unknown)).toBe(false);
      expect(isRegulatoryFrame({} as unknown)).toBe(false);
    });
  });

  describe('coerceRegulatoryFrame', () => {
    it('returns the value itself for valid members', () => {
      for (const id of REGULATORY_FRAME_OPTIONS_IDS) {
        expect(coerceRegulatoryFrame(id)).toBe(id);
      }
    });

    it('returns null for invalid inputs', () => {
      expect(coerceRegulatoryFrame('invalid-frame')).toBeNull();
      expect(coerceRegulatoryFrame('')).toBeNull();
      expect(coerceRegulatoryFrame(null as unknown)).toBeNull();
      expect(coerceRegulatoryFrame(undefined as unknown)).toBeNull();
      expect(coerceRegulatoryFrame(123 as unknown)).toBeNull();
      expect(coerceRegulatoryFrame({} as unknown)).toBeNull();
    });
  });

  describe('isJurisdiction', () => {
    it('returns true for every member of ALL_JURISDICTIONS', () => {
      for (const id of ALL_JURISDICTIONS) {
        expect(isJurisdiction(id)).toBe(true);
      }
    });

    it('returns false for invalid inputs', () => {
      expect(isJurisdiction('invalid-jurisdiction')).toBe(false);
      expect(isJurisdiction('')).toBe(false);
      expect(isJurisdiction(null as unknown)).toBe(false);
      expect(isJurisdiction(undefined as unknown)).toBe(false);
      expect(isJurisdiction(123 as unknown)).toBe(false);
      expect(isJurisdiction({} as unknown)).toBe(false);
    });
  });

  describe('coerceJurisdiction', () => {
    it('returns the value itself for valid members', () => {
      for (const id of ALL_JURISDICTIONS) {
        expect(coerceJurisdiction(id)).toBe(id);
      }
    });

    it('returns null for invalid inputs', () => {
      expect(coerceJurisdiction('invalid-jurisdiction')).toBeNull();
      expect(coerceJurisdiction('')).toBeNull();
      expect(coerceJurisdiction(null as unknown)).toBeNull();
      expect(coerceJurisdiction(undefined as unknown)).toBeNull();
      expect(coerceJurisdiction(123 as unknown)).toBeNull();
      expect(coerceJurisdiction({} as unknown)).toBeNull();
    });
  });

  describe('invariants', () => {
    it('DEFAULT_REGULATORY_FRAME is a member of REGULATORY_FRAME_OPTIONS_IDS', () => {
      expect(REGULATORY_FRAME_OPTIONS_IDS).toContain(DEFAULT_REGULATORY_FRAME);
    });

    it('DEFAULT_JURISDICTION is a member of ALL_JURISDICTIONS', () => {
      expect(ALL_JURISDICTIONS).toContain(DEFAULT_JURISDICTION);
    });

    it('REGULATORY_FRAME_OPTIONS ids line up exactly with REGULATORY_FRAME_OPTIONS_IDS', () => {
      const optionIds = REGULATORY_FRAME_OPTIONS.map((opt) => opt.id);
      expect(optionIds).toEqual(REGULATORY_FRAME_OPTIONS_IDS);
    });

    it('JURISDICTION_OPTIONS ids line up exactly with ALL_JURISDICTIONS', () => {
      const optionIds = JURISDICTION_OPTIONS.map((opt) => opt.id);
      expect(optionIds).toEqual(ALL_JURISDICTIONS);
    });
  });
});
