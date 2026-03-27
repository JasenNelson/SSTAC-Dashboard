/**
 * Tests for transparency-adapters.ts
 *
 * Verifies data transformation from site_reports.json and risk_comparison.json
 * into SiteData[] for the siteDataStore.
 *
 * Tests run against the actual transparency data files to catch regressions
 * when data is re-exported from the engine.
 */

import { describe, it, expect } from 'vitest';
import { adaptTrainingSites, adaptComparisonSites } from '../transparency-adapters';
import type { SiteReportsJSON, RiskComparisonJSON } from '../transparency-adapters';
import siteReportsData from '@/data/bn-rrm/transparency/site_reports.json';
import riskComparisonData from '@/data/bn-rrm/transparency/risk_comparison.json';

const siteReports = siteReportsData as unknown as SiteReportsJSON;
const riskComparison = riskComparisonData as unknown as RiskComparisonJSON;

describe('adaptTrainingSites', () => {
  const result = adaptTrainingSites(siteReports);

  it('returns the expected total count (40 stations + 4 centroids)', () => {
    expect(result.stationCount).toBe(40);
    expect(result.centroidCount).toBe(4);
    expect(result.imported).toBe(44);
    expect(result.sites).toHaveLength(44);
  });

  it('all entries have valid sedimentChemistry[0]', () => {
    for (const site of result.sites) {
      expect(site.sedimentChemistry).toHaveLength(1);
      const chem = site.sedimentChemistry[0];
      expect(chem.siteId).toBe(site.location.id);
      expect(chem.sampleId).toContain('site-mean');
      expect(chem.dateCollected).toBeTruthy();
    }
  });

  it('chemistry parameters are correctly mapped from summary means', () => {
    // CP Nelson has known chemistry (verified from site_reports.json)
    const cpNelsonStations = result.sites.filter(s => s.location.id.startsWith('training-s2-'));
    expect(cpNelsonStations.length).toBeGreaterThan(0);

    const chem = cpNelsonStations[0].sedimentChemistry[0];
    // CP Nelson has Copper mean ≈ 247.7 mg/kg
    expect(chem.copper).toBeCloseTo(247.7, 0);
    // CP Nelson has Lead mean ≈ 3525.3 mg/kg
    expect(chem.lead).toBeCloseTo(3525.3, 0);
    // CP Nelson has Zinc mean ≈ 2162.75 mg/kg
    expect(chem.zinc).toBeCloseTo(2162.75, 0);
  });

  it('centroid entries have SITE_CENTROID spatialClass and include station count in name', () => {
    const centroids = result.sites.filter(s => s.location.spatialClass === 'SITE_CENTROID');
    expect(centroids).toHaveLength(4);

    for (const centroid of centroids) {
      expect(centroid.location.name).toMatch(/\(\d+ stations, site centroid\)/);
      expect(centroid.location.sourceTag).toBe('training');
    }

    // Woodfibre should show 198 stations
    const woodfibre = centroids.find(c => c.location.name.includes('Woodfibre'));
    expect(woodfibre).toBeDefined();
    expect(woodfibre!.location.name).toContain('198 stations');
  });

  it('individual station entries have EXACT or APPROXIMATE spatialClass', () => {
    const stations = result.sites.filter(s => s.location.spatialClass !== 'SITE_CENTROID');
    expect(stations).toHaveLength(40);

    for (const stn of stations) {
      expect(['EXACT', 'APPROXIMATE']).toContain(stn.location.spatialClass);
    }
  });

  it('all siteType values are valid union members', () => {
    const validTypes = new Set(['reference', 'exposure', 'gradient']);
    for (const site of result.sites) {
      expect(validTypes.has(site.location.siteType)).toBe(true);
    }
  });

  it('all entries have sourceTag = training', () => {
    for (const site of result.sites) {
      expect(site.location.sourceTag).toBe('training');
    }
  });

  it('no duplicate location IDs', () => {
    const ids = result.sites.map(s => s.location.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('skippedNoCoords accounts for non-georeferenced stations', () => {
    // Total stations across all sites minus georeferenced (40) minus centroids (which represent remaining)
    // Woodfibre(198) + Island Copper(15) + Blue Water(24) + ALCAN(5) = 242
    expect(result.skippedNoCoords).toBe(242);
  });
});

describe('adaptComparisonSites', () => {
  const result = adaptComparisonSites(riskComparison, siteReports);

  it('returns the expected total count (10 stations + 3 centroids)', () => {
    expect(result.stationCount).toBe(10);
    expect(result.centroidCount).toBe(3);
    expect(result.imported).toBe(13);
    expect(result.sites).toHaveLength(13);
  });

  it('all entries have valid sedimentChemistry[0]', () => {
    for (const site of result.sites) {
      expect(site.sedimentChemistry).toHaveLength(1);
      const chem = site.sedimentChemistry[0];
      expect(chem.siteId).toBe(site.location.id);
      expect(chem.sampleId).toContain('site-mean');
      expect(chem.dateCollected).toBeTruthy();
    }
  });

  it('all entries have sourceTag = comparison', () => {
    for (const site of result.sites) {
      expect(site.location.sourceTag).toBe('comparison');
    }
  });

  it('centroid names include comparison station count', () => {
    const centroids = result.sites.filter(s => s.location.spatialClass === 'SITE_CENTROID');
    expect(centroids).toHaveLength(3);

    for (const centroid of centroids) {
      expect(centroid.location.name).toMatch(/\(\d+ comparison stations, site centroid\)/);
    }

    // Woodfibre should show 11 comparison stations
    const woodfibre = centroids.find(c => c.location.name.includes('Woodfibre'));
    expect(woodfibre).toBeDefined();
    expect(woodfibre!.location.name).toContain('11 comparison stations');
  });

  it('no ID collisions with training namespace', () => {
    const trainingResult = adaptTrainingSites(siteReports);
    const trainingIds = new Set(trainingResult.sites.map(s => s.location.id));
    for (const site of result.sites) {
      expect(trainingIds.has(site.location.id)).toBe(false);
    }
  });

  it('no duplicate location IDs within comparison set', () => {
    const ids = result.sites.map(s => s.location.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all siteType values are valid union members', () => {
    const validTypes = new Set(['reference', 'exposure', 'gradient']);
    for (const site of result.sites) {
      expect(validTypes.has(site.location.siteType)).toBe(true);
    }
  });
});
