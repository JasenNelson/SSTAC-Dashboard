import { describe, expect, it } from 'vitest';
import { normalizeRiskComparison, normalizeValidation } from '../normalize-artifacts';

describe('normalizeRiskComparison', () => {
  it('preserves mixed-state semantics and prediction rules', () => {
    const normalized = normalizeRiskComparison({
      _meta: {
        governanceSpec: 'BN-RRM governance v1',
        modelVersion: 'bnrrm-landis-causal v1.0',
        status: 'mixed_evaluation_framework',
        evaluationRule: 'mixed: entropy-aware v1.0 + v4.0 MAP',
        note_externalSites: 'external sites remain descriptive only',
        externalSitesStatus: 'pending_v1_alignment',
        externalSitesNote: 'No LOO coverage for non-training sites.',
      },
      summary: {
        totalWOERecords: 59,
        matchedStations: 48,
        excludedNoLOO: 11,
        excludedNoWOE: 0,
        sitesWithWOE: 5,
        sitesWithoutWOE: 3,
        sitesWithoutWOENames: ['Site X'],
      },
      mappingTable: {
        source: 'test',
        mappings: {},
      },
      siteComparisons: [
        {
          siteId: 1,
          siteName: 'Example Site',
          registryId: 'EX-001',
          stationComparisons: [
            {
              stationId: 100,
              stationName: 'ST-100',
              bnrrmPredicted: 'moderate',
              bnrrmObserved: 'moderate',
              prediction_rule: 'v1.0_entropy_1.06',
              reportEstimate: {
                originalLabel: 'Moderate risk',
                mappedBNClass: 'moderate',
                mappingConfidence: 'high',
                mappingJustification: 'explicit mapping',
                comparatorType: 'WOE',
                frameworkType: 'training',
                provenance: {
                  sourceDocument: 'report.pdf',
                  sourcePage: 12,
                },
              },
            },
            {
              stationId: 101,
              stationName: 'ST-101',
              bnrrmPredicted: 'low',
              bnrrmObserved: 'low',
              predictionRule: 'v4.0_MAP',
              reportEstimate: {
                originalLabel: 'Low risk',
                mappedBNClass: 'low',
                mappingConfidence: 'medium',
                mappingJustification: 'fallback',
                comparatorType: 'WOE',
                frameworkType: 'training',
                provenance: {
                  sourceDocument: 'report.pdf',
                  sourcePage: 13,
                },
              },
            },
          ],
          excludedStations: {
            noLOOPrediction: ['ST-999'],
            noWOERecord: [],
          },
        },
      ],
    });

    expect(normalized.meta.status).toBe('mixed_evaluation_framework');
    expect(normalized.meta.externalSitesStatus).toBe('pending_v1_alignment');
    expect(normalized.summary.totalWOERecords).toBe(59);
    expect(normalized.siteComparisons[0].stationComparisons[0].predictionRule).toBe('v1.0_entropy_1.06');
    expect(normalized.siteComparisons[0].stationComparisons[1].predictionRule).toBe('v4.0_MAP');
  });

  it('defaults newly added meta fields safely when absent', () => {
    const normalized = normalizeRiskComparison({
      siteComparisons: [],
      summary: {},
      mappingTable: { source: 'test', mappings: {} },
    });

    expect(normalized.meta.status).toBe('');
    expect(normalized.meta.evaluationRule).toBe('');
    expect(normalized.meta.noteExternalSites).toBe('');
    expect(normalized.meta.externalSitesStatus).toBe('');
    expect(normalized.meta.externalSitesNote).toBe('');
    expect(normalized.summary.totalWOERecords).toBe(0);
  });
});

describe('normalizeValidation', () => {
  it('preserves MAP-development semantic framing fields', () => {
    const normalized = normalizeValidation({
      n_complete: 93,
      loo_accuracy: 0.6237,
      loo_kappa: 0.1846,
      disclaimer: 'Development baseline MAP artifact.',
      status: 'development_baseline_map',
      semantic_scope: 'development_baseline',
      predictions: [
        {
          station_id: 1,
          station_name: 'ST-1',
          predicted: 'low',
          observed: 'low',
        },
      ],
    });

    expect(normalized.status).toBe('development_baseline_map');
    expect(normalized.semanticScope).toBe('development_baseline');
    expect(normalized.disclaimer).toContain('Development baseline');
    expect(normalized.predictions).toHaveLength(1);
  });
});
