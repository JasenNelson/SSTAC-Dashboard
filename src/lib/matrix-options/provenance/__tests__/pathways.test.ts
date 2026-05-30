import { describe, expect, it } from 'vitest';

import {
  CATALOG_EVIDENCE_PATHWAYS,
  CATALOG_PATHWAYS,
  PROVENANCE_PATHWAYS,
  isCatalogEvidencePathway,
  isCatalogPathway,
  isProvenancePathway,
} from '../pathways';
import { humanizeCatalogLabel } from '../library';

describe('pathway vocabularies', () => {
  it('keeps the 5 calculator derivation pathways stable', () => {
    expect([...PROVENANCE_PATHWAYS]).toEqual([
      'eco-direct-eqp',
      'eco-food-bsaf',
      'background-adjustment',
      'human-health-direct',
      'human-health-food',
    ]);
  });

  it('declares the 6 catalog evidence categories', () => {
    expect([...CATALOG_EVIDENCE_PATHWAYS]).toEqual([
      'hh-toxicity-value',
      'hh-toxicity-weighting',
      'hh-exposure-parameter',
      'eco-soil',
      'eco-soil-screening',
      'reference-background',
    ]);
  });

  it('builds CatalogPathway as the disjoint union of the two sets (11 unique)', () => {
    expect(CATALOG_PATHWAYS).toHaveLength(11);
    expect(new Set(CATALOG_PATHWAYS).size).toBe(11);
    // The two source vocabularies must not overlap, or a calculator pathway could be
    // mistaken for an evidence category (or vice versa) at a type boundary.
    const calc = new Set<string>(PROVENANCE_PATHWAYS);
    for (const evidence of CATALOG_EVIDENCE_PATHWAYS) {
      expect(calc.has(evidence)).toBe(false);
    }
  });
});

describe('pathway guards', () => {
  it('isProvenancePathway accepts only the 5 calculator pathways', () => {
    for (const pathway of PROVENANCE_PATHWAYS) {
      expect(isProvenancePathway(pathway)).toBe(true);
    }
    for (const pathway of CATALOG_EVIDENCE_PATHWAYS) {
      expect(isProvenancePathway(pathway)).toBe(false);
    }
    expect(isProvenancePathway('not-a-pathway')).toBe(false);
    expect(isProvenancePathway(undefined)).toBe(false);
    expect(isProvenancePathway(42)).toBe(false);
  });

  it('isCatalogEvidencePathway accepts only the 6 evidence categories', () => {
    for (const pathway of CATALOG_EVIDENCE_PATHWAYS) {
      expect(isCatalogEvidencePathway(pathway)).toBe(true);
    }
    for (const pathway of PROVENANCE_PATHWAYS) {
      expect(isCatalogEvidencePathway(pathway)).toBe(false);
    }
    expect(isCatalogEvidencePathway('not-a-pathway')).toBe(false);
  });

  it('isCatalogPathway accepts every member of both sets and nothing else', () => {
    for (const pathway of CATALOG_PATHWAYS) {
      expect(isCatalogPathway(pathway)).toBe(true);
    }
    expect(isCatalogPathway('made-up')).toBe(false);
    expect(isCatalogPathway(null)).toBe(false);
  });
});

describe('evidence-category badge labels', () => {
  it('renders a readable, non-empty label for every catalog evidence pathway', () => {
    // Guards against blank pathway badges once canonical catalog rows are present.
    for (const pathway of CATALOG_EVIDENCE_PATHWAYS) {
      const label = humanizeCatalogLabel(pathway);
      expect(label.length).toBeGreaterThan(0);
      // No raw kebab token should survive (a missing label would fall back to a
      // hyphen-stripped string, which is acceptable, but these 6 are explicitly mapped).
      expect(label).not.toContain('-');
    }
  });
});
