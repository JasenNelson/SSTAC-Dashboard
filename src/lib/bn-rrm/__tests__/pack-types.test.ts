// Unit tests for src/lib/bn-rrm/pack-types.ts
//
// Covers:
//   - getScopeBadge(): all four scope_type branches
//   - getReleaseBadge(): all five release_stage branches
//   - validatePackSchema(): canonical-20node-v1 (pass/fail node/edge counts)
//   - validatePackSchema(): generic-bn-rrm-v1 (pass/fail node/edge counts)
//   - validatePackSchema(): unknown schema version throws
//   - assertCanonicalSchema(): backward-compat delegate to validatePackSchema
//   - isReadOnlyPack(): benchmark vs non-benchmark
//   - CANONICAL_SCHEMA_VERSION constant value
//   - REVIEW_ARTIFACT_KEYS completeness
//   - MAP_ARTIFACT_KEYS completeness
//   - MAP_ARTIFACT_CATEGORIES coverage

import { describe, it, expect } from 'vitest';
import {
  CANONICAL_SCHEMA_VERSION,
  REVIEW_ARTIFACT_KEYS,
  MAP_ARTIFACT_KEYS,
  MAP_ARTIFACT_CATEGORIES,
  getScopeBadge,
  getReleaseBadge,
  validatePackSchema,
  assertCanonicalSchema,
  isReadOnlyPack,
} from '../pack-types';
import type { PackManifest, ScopeType, ReleaseStage } from '../pack-types';

// ---------------------------------------------------------------------------
// Minimal manifest factory
// ---------------------------------------------------------------------------

function makeManifest(overrides: Partial<PackManifest> = {}): PackManifest {
  return {
    pack_id: 'test-pack',
    display_name: 'Test Pack',
    model_family: 'general',
    scope_type: 'general',
    site_scope: null,
    site_inventory: [],
    runtime_schema_version: 'canonical-20node-v1',
    dag_node_count: 20,
    dag_edge_count: 24,
    training_corpus: {
      n_stations: 10,
      n_co_located: 2,
      n_sites: 3,
      cohort_rule: 'standard',
      dataset_status: 'final',
    },
    evaluation_profile: {
      decision_rule: 'MAP',
      primary_metric: 'loo_accuracy',
    },
    release_stage: 'internal',
    is_default: false,
    parent_pack_id: null,
    applicability_boundaries: [],
    version_history: {
      created: '2025-01-01',
      model_version: '1.0.0',
      architecture_version: '1.0.0',
    },
    artifacts: {
      runtime_model: 'model.json',
      review: {
        model_overview: 'overview.md',
        validation: 'validation.md',
        comparison: 'comparison.md',
        decisions: 'decisions.md',
        cpt_transparency: 'cpt.md',
        provenance: 'provenance.md',
        site_reports: 'site_reports.json',
        risk_comparison: 'risk.json',
        explainer: 'explainer.md',
        sensitivity: 'sensitivity.md',
        published_reference: 'pub.md',
        comparison_results: 'results.md',
      },
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// CANONICAL_SCHEMA_VERSION
// ---------------------------------------------------------------------------

describe('CANONICAL_SCHEMA_VERSION', () => {
  it('equals "canonical-20node-v1"', () => {
    expect(CANONICAL_SCHEMA_VERSION).toBe('canonical-20node-v1');
  });
});

// ---------------------------------------------------------------------------
// REVIEW_ARTIFACT_KEYS
// ---------------------------------------------------------------------------

describe('REVIEW_ARTIFACT_KEYS', () => {
  it('contains all expected review artifact keys', () => {
    const expected = [
      'model_overview',
      'validation',
      'comparison',
      'decisions',
      'cpt_transparency',
      'provenance',
      'site_reports',
      'risk_comparison',
      'explainer',
      'sensitivity',
      'published_reference',
      'comparison_results',
    ];
    expect(REVIEW_ARTIFACT_KEYS).toEqual(expect.arrayContaining(expected));
    expect(REVIEW_ARTIFACT_KEYS).toHaveLength(expected.length);
  });
});

// ---------------------------------------------------------------------------
// MAP_ARTIFACT_KEYS and MAP_ARTIFACT_CATEGORIES
// ---------------------------------------------------------------------------

describe('MAP_ARTIFACT_KEYS', () => {
  it('contains all 12 expected map overlay keys', () => {
    const expected = [
      'basins_gsl',
      'basins_gbs',
      'advisory_lakes',
      'commercial_fisheries',
      'historic_mines',
      'large_mines',
      'mineral_claims',
      'oil_gas_claims',
      'hydro_facilities',
      'communities',
      'climate_stations',
      'thaw_slumps',
    ];
    expect(MAP_ARTIFACT_KEYS).toEqual(expect.arrayContaining(expected));
    expect(MAP_ARTIFACT_KEYS).toHaveLength(12);
  });
});

describe('MAP_ARTIFACT_CATEGORIES', () => {
  it('every MAP_ARTIFACT_KEY has a category entry', () => {
    for (const key of MAP_ARTIFACT_KEYS) {
      expect(MAP_ARTIFACT_CATEGORIES).toHaveProperty(key);
      expect(typeof MAP_ARTIFACT_CATEGORIES[key]).toBe('string');
    }
  });

  it('assigns expected categories to specific keys', () => {
    expect(MAP_ARTIFACT_CATEGORIES.basins_gsl).toBe('basins');
    expect(MAP_ARTIFACT_CATEGORIES.advisory_lakes).toBe('advisories');
    expect(MAP_ARTIFACT_CATEGORIES.historic_mines).toBe('mining');
    expect(MAP_ARTIFACT_CATEGORIES.oil_gas_claims).toBe('energy');
    expect(MAP_ARTIFACT_CATEGORIES.communities).toBe('communities');
    expect(MAP_ARTIFACT_CATEGORIES.thaw_slumps).toBe('permafrost');
  });
});

// ---------------------------------------------------------------------------
// getScopeBadge()
// ---------------------------------------------------------------------------

describe('getScopeBadge()', () => {
  it('returns "General" badge with variant "default" for scope_type "general"', () => {
    const badge = getScopeBadge(makeManifest({ scope_type: 'general' }));
    expect(badge.text).toBe('General');
    expect(badge.variant).toBe('default');
  });

  it('returns "Benchmark (read-only)" badge with variant "benchmark" for scope_type "benchmark"', () => {
    const badge = getScopeBadge(makeManifest({ scope_type: 'benchmark' }));
    expect(badge.text).toBe('Benchmark (read-only)');
    expect(badge.variant).toBe('benchmark');
  });

  it('returns "Site: <name>" badge for site_specific with named site_scope', () => {
    const badge = getScopeBadge(
      makeManifest({
        scope_type: 'site_specific',
        site_scope: { registry_id: 'SITE-001', name: 'Burnaby Creek', waterbody: 'freshwater' },
      }),
    );
    expect(badge.text).toBe('Site: Burnaby Creek');
    expect(badge.variant).toBe('site');
  });

  it('returns fallback "Site-Specific" label when site_scope.name is absent', () => {
    const badge = getScopeBadge(
      makeManifest({
        scope_type: 'site_specific',
        site_scope: null,
      }),
    );
    expect(badge.text).toBe('Site-Specific');
    expect(badge.variant).toBe('site');
  });

  it('returns "Experimental" badge with variant "experimental" for scope_type "experimental"', () => {
    const badge = getScopeBadge(makeManifest({ scope_type: 'experimental' }));
    expect(badge.text).toBe('Experimental');
    expect(badge.variant).toBe('experimental');
  });
});

// ---------------------------------------------------------------------------
// getReleaseBadge()
// ---------------------------------------------------------------------------

describe('getReleaseBadge()', () => {
  const cases: Array<[ReleaseStage, string, string, boolean]> = [
    ['scaffold', 'Scaffold', 'gray', true],
    ['prototype', 'Prototype', 'yellow', true],
    ['internal', 'Internal', 'blue', false],
    ['review', 'Under Review', 'orange', true],
    ['published', 'Published', 'green', false],
  ];

  for (const [stage, text, color, showBanner] of cases) {
    it(`returns correct badge for stage "${stage}"`, () => {
      const badge = getReleaseBadge(stage);
      expect(badge.text).toBe(text);
      expect(badge.color).toBe(color);
      expect(badge.showBanner).toBe(showBanner);
    });
  }

  it('scaffold badge includes bannerText', () => {
    const badge = getReleaseBadge('scaffold');
    expect(typeof badge.bannerText).toBe('string');
    expect(badge.bannerText!.length).toBeGreaterThan(0);
  });

  it('internal badge has no bannerText', () => {
    const badge = getReleaseBadge('internal');
    expect(badge.bannerText).toBeUndefined();
  });

  it('published badge has no bannerText', () => {
    const badge = getReleaseBadge('published');
    expect(badge.bannerText).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// validatePackSchema()
// ---------------------------------------------------------------------------

describe('validatePackSchema()', () => {
  describe('canonical-20node-v1', () => {
    it('passes for exactly 20 nodes and 24 edges', () => {
      expect(() =>
        validatePackSchema(makeManifest({ dag_node_count: 20, dag_edge_count: 24 })),
      ).not.toThrow();
    });

    it('throws when node count is not 20', () => {
      expect(() =>
        validatePackSchema(makeManifest({ dag_node_count: 19, dag_edge_count: 24 })),
      ).toThrow(/19 nodes.*expected 20/);
    });

    it('throws when edge count is not 24', () => {
      expect(() =>
        validatePackSchema(makeManifest({ dag_node_count: 20, dag_edge_count: 25 })),
      ).toThrow(/25 edges.*expected 24/);
    });
  });

  describe('generic-bn-rrm-v1', () => {
    it('passes when node_count > 0 and edge_count > 0', () => {
      expect(() =>
        validatePackSchema(
          makeManifest({
            runtime_schema_version: 'generic-bn-rrm-v1',
            dag_node_count: 15,
            dag_edge_count: 18,
          }),
        ),
      ).not.toThrow();
    });

    it('throws when node_count is 0', () => {
      expect(() =>
        validatePackSchema(
          makeManifest({
            runtime_schema_version: 'generic-bn-rrm-v1',
            dag_node_count: 0,
            dag_edge_count: 10,
          }),
        ),
      ).toThrow(/0 nodes.*expected > 0/);
    });

    it('throws when edge_count is 0', () => {
      expect(() =>
        validatePackSchema(
          makeManifest({
            runtime_schema_version: 'generic-bn-rrm-v1',
            dag_node_count: 5,
            dag_edge_count: 0,
          }),
        ),
      ).toThrow(/0 edges.*expected > 0/);
    });
  });

  describe('unknown schema version', () => {
    it('throws for an unrecognised schema version', () => {
      expect(() =>
        validatePackSchema(
          makeManifest({
            // @ts-expect-error -- intentional invalid value for test
            runtime_schema_version: 'future-unknown-v99',
          }),
        ),
      ).toThrow(/unsupported schema version/);
    });
  });
});

// ---------------------------------------------------------------------------
// assertCanonicalSchema() -- backward-compat delegate
// ---------------------------------------------------------------------------

describe('assertCanonicalSchema()', () => {
  it('does not throw for a valid canonical-20node-v1 manifest', () => {
    expect(() =>
      assertCanonicalSchema(makeManifest({ dag_node_count: 20, dag_edge_count: 24 })),
    ).not.toThrow();
  });

  it('throws the same error as validatePackSchema for wrong node count', () => {
    const manifest = makeManifest({ dag_node_count: 10, dag_edge_count: 24 });
    expect(() => assertCanonicalSchema(manifest)).toThrow(/10 nodes.*expected 20/);
  });
});

// ---------------------------------------------------------------------------
// isReadOnlyPack()
// ---------------------------------------------------------------------------

describe('isReadOnlyPack()', () => {
  it('returns true for benchmark packs', () => {
    expect(isReadOnlyPack(makeManifest({ scope_type: 'benchmark' }))).toBe(true);
  });

  it('returns false for general packs', () => {
    expect(isReadOnlyPack(makeManifest({ scope_type: 'general' }))).toBe(false);
  });

  it('returns false for site_specific packs', () => {
    expect(isReadOnlyPack(makeManifest({ scope_type: 'site_specific' }))).toBe(false);
  });

  it('returns false for experimental packs', () => {
    expect(isReadOnlyPack(makeManifest({ scope_type: 'experimental' }))).toBe(false);
  });
});
