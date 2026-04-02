import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RiskComparison } from '../RiskComparison';
import { ValidationDashboard } from '../ValidationDashboard';
import { ExternalSites } from '../../casestudies/ExternalSites';

const usePackArtifactMock = vi.fn();
const usePackStoreMock = vi.fn();

vi.mock('@/hooks/bn-rrm/usePackArtifact', () => ({
  usePackArtifact: (...args: unknown[]) => usePackArtifactMock(...args),
}));

vi.mock('@/stores/bn-rrm/packStore', () => ({
  usePackStore: (selector: (state: unknown) => unknown) => usePackStoreMock(selector),
}));

vi.mock('@/components/bn-rrm/shared/InfoTooltip', () => ({
  InfoTooltip: () => null,
}));

vi.mock('@/components/bn-rrm/shared/ExpandableSection', () => ({
  ExpandableSection: ({ title, children }: { title: string; children: ReactNode }) => (
    <section>
      <h3>{title}</h3>
      {children}
    </section>
  ),
}));

const packState = {
  packManifest: {
    scope_type: 'general',
    version_history: { model_version: '1.0' },
    site_scope: null,
    training_corpus: { n_stations: 93 },
  },
};

beforeEach(() => {
  usePackArtifactMock.mockReset();
  usePackStoreMock.mockImplementation((selector) => selector(packState));
});

describe('BN-RRM semantic banners', () => {
  it('renders mixed-state banner, denominator explanation, and prediction-rule column in RiskComparison', () => {
    usePackArtifactMock.mockReturnValue({
      loading: false,
      error: null,
      data: {
        _meta: {
          governanceSpec: 'BN-RRM governance v1',
          modelVersion: 'bnrrm-landis-causal v1.0',
          note: 'Mixed-state artifact retained.',
          status: 'mixed_evaluation_framework',
          evaluationRule: 'mixed: entropy-aware v1.0 (9/59) + v4.0 MAP (50/59)',
          note_externalSites: 'External sites remain descriptive only.',
          externalSitesStatus: 'pending_v1_alignment',
          externalSitesNote: 'No LOO coverage.',
        },
        summary: {
          totalWOERecords: 59,
          matchedStations: 48,
          excludedNoLOO: 11,
          excludedNoWOE: 0,
          sitesWithWOE: 5,
          sitesWithoutWOE: 3,
          sitesWithoutWOENames: ['A', 'B', 'C'],
        },
        mappingTable: {
          source: 'test',
          mappings: {
            'Moderate risk': {
              mapped: 'moderate',
              confidence: 'high',
              justification: 'explicit',
            },
          },
        },
        siteComparisons: [
          {
            siteId: 1,
            siteName: 'Site 1',
            registryId: 'S1',
            stationComparisons: [
              {
                stationId: 1,
                stationName: 'ST-1',
                bnrrmPredicted: 'moderate',
                bnrrmObserved: 'moderate',
                prediction_rule: 'v1.0_entropy_1.06',
                reportEstimate: {
                  originalLabel: 'Moderate risk',
                  mappedBNClass: 'moderate',
                  mappingConfidence: 'high',
                  mappingJustification: 'explicit',
                  comparatorType: 'WOE',
                  frameworkType: 'training',
                  provenance: { sourceDocument: 'report.pdf', sourcePage: 10 },
                },
              },
              {
                stationId: 2,
                stationName: 'ST-2',
                bnrrmPredicted: 'low',
                bnrrmObserved: 'low',
                prediction_rule: 'v4.0_MAP',
                reportEstimate: {
                  originalLabel: 'Low risk',
                  mappedBNClass: 'low',
                  mappingConfidence: 'medium',
                  mappingJustification: 'fallback',
                  comparatorType: 'WOE',
                  frameworkType: 'training',
                  provenance: { sourceDocument: 'report.pdf', sourcePage: 11 },
                },
              },
            ],
            excludedStations: {
              noLOOPrediction: [],
              noWOERecord: [],
            },
          },
        ],
      },
    });

    render(<RiskComparison />);

    expect(screen.getByText(/Mixed-state comparison artifact/i)).toBeInTheDocument();
    expect(screen.getByText(/Rule counts are across all 59 WOE station records/i)).toBeInTheDocument();
    expect(screen.getByText('Rule')).toBeInTheDocument();
    expect(screen.getByText('v1.0_entropy_1.06')).toBeInTheDocument();
    expect(screen.getByText('v4.0_MAP')).toBeInTheDocument();
  });

  it('renders the MAP development-baseline banner in ValidationDashboard', () => {
    usePackArtifactMock.mockImplementation((key: string) => {
      if (key === 'validation') {
        return {
          loading: false,
          error: null,
          data: {
            n_complete: 93,
            loo_accuracy: 0.6237,
            loo_kappa: 0.1846,
            disclaimer: 'This file remains the MAP development-baseline artifact.',
            status: 'development_baseline_map',
            semantic_scope: 'development_baseline',
            predictions: [
              { station_id: 1, station_name: 'ST-1', predicted: 'low', observed: 'low' },
            ],
            per_class: {
              low: { precision: 1, recall: 1, f1: 1, support: 1 },
            },
          },
        };
      }

      if (key === 'comparison') {
        return {
          loading: false,
          error: null,
          data: {
            _meta: { status: 'legacy_evaluation_framework' },
            three_class: {
              M1: { accuracy: 0.5, n: 10, cohen_kappa: 0.1, per_class: { High: { recall: 0.2, precision: 0.2, f1: 0.2 } } },
            },
          },
        };
      }

      return { loading: false, error: null, data: null };
    });

    render(<ValidationDashboard />);

    expect(screen.getByText('Development-Baseline MAP View')).toBeInTheDocument();
    expect(screen.getByText(/publication-baseline entropy-aware evaluation is separate/i)).toBeInTheDocument();
    expect(screen.getByText(/Confusion matrix and prediction table below reflect the MAP development baseline/i)).toBeInTheDocument();
  });

  it('renders the external-site semantics status banner in ExternalSites', () => {
    usePackArtifactMock.mockReturnValue({
      loading: false,
      error: null,
      data: {
        _meta: {
          modelVersion: 'bnrrm-landis-causal v1.0',
          externalSitesStatus: 'site_level_semantics_operationalized',
          externalSitesNote: 'Meaningful partial BN-domain overlap can support descriptive BN site-level semantics.',
          externalInterpretationRules: {
            defaultOutputGranularity: 'site_level_only',
            pooledStatisticsAuthorized: false,
            benchmarkComparable: false,
            interpretationNote: 'External outputs remain site-level only and not benchmark comparable.',
          },
        },
        siteComparisons: [],
        summary: {},
        mappingTable: { source: 'test', mappings: {} },
        externalSites: [],
      },
    });

    render(<ExternalSites />);

    expect(screen.getByText(/Site-level semantics operationalized/i)).toBeInTheDocument();
    expect(screen.getByText(/Meaningful partial BN-domain overlap can support descriptive BN site-level semantics/i)).toBeInTheDocument();
    expect(screen.getByText(/Output granularity defaults to/i)).toBeInTheDocument();
  });
});
