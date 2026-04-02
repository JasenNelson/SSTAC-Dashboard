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

  it('normalizes external site semantics and interpretation rules', () => {
    const normalized = normalizeRiskComparison({
      _meta: {
        externalComparisonClassDefinitions: {
          editorial_only: 'Editorial only.',
          bn_descriptive_site_level: 'Descriptive site-level BN semantics.',
        },
        externalInterpretationRules: {
          defaultOutputGranularity: 'site_level_only',
          pooledStatisticsAuthorized: false,
          benchmarkComparable: false,
          interpretationNote: 'Not pooled and not benchmark comparable.',
        },
      },
      externalSites: [
        {
          siteId: '0139',
          siteName: 'Westminster Pier Park',
          registryId: '0139',
          region: 'Metro Vancouver',
          waterbody: 'estuarine',
          gateOutcome: 'DESCRIPTIVE_ONLY',
          gateReason: 'Area-level only.',
          consultant: 'Example',
          reportDate: '2011-12',
          reportTitle: 'Example report',
          comparisonType: 'descriptive-integrated',
          bnInferenceStatus: 'partial_evidence_site_level_ready',
          externalComparisonClass: 'bn_descriptive_site_level',
          outputGranularity: 'site_level_only',
          interpretationAuthorization: 'descriptive_only',
          contaminantOverlap: 'meaningful_partial',
          modifierEffectsStatus: {
            modifiers: 'missing_or_unconfirmed',
            effectsEvidence: 'available_but_partial',
          },
          uncertaintyFlags: ['partial_domain_overlap'],
          uncertaintyNote: 'Partial overlap only.',
          bnInputCoverage: {
            metals: true,
            pahs: true,
            pcbs: false,
            toc: false,
            grainSize: false,
            sulfideBinding: false,
            toxicity: true,
            community: false,
            note: 'Partial evidence.',
          },
          reportConclusions: [],
          statisticalAuthorization: {
            kappa: false,
            confusionMatrix: false,
            agreement: false,
            mcNemar: false,
            reason: 'Descriptive only.',
          },
        },
      ],
    });

    expect(normalized.meta.externalComparisonClassDefinitions.bn_descriptive_site_level).toContain('Descriptive site-level');
    expect(normalized.meta.externalInterpretationRules?.defaultOutputGranularity).toBe('site_level_only');
    expect(normalized.externalSites).toHaveLength(1);
    expect(normalized.externalSites[0].externalComparisonClass).toBe('bn_descriptive_site_level');
    expect(normalized.externalSites[0].modifierEffectsStatus?.modifiers).toBe('missing_or_unconfirmed');
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
