import { describe, expect, it } from 'vitest';
import { SUBSTANCE_LIBRARY } from '../../substanceLibrary';
import {
  PARAMETER_VALUE_RECORDS,
  getParameterValueRecord,
  getSourceRecord,
} from '../catalog';
import {
  buildCalculatorEvidenceRequest,
  buildEvidenceLibraryView,
  buildProtocol28ReviewSummary,
  createEvidenceLibraryFilters,
  getParameterValueReviewDisposition,
  getSourceLeadReviewDisposition,
} from '../library';
import type { SourceRecord } from '../types';

describe('matrix options evidence library helpers', () => {
  it('builds the default view from repo-local catalog records', () => {
    const view = buildEvidenceLibraryView(createEvidenceLibraryFilters());

    expect(view.totalCounts.sources).toBeGreaterThan(20);
    expect(view.totalCounts.values).toBeGreaterThan(20);
    expect(view.totalCounts.equations).toBe(5);
    expect(view.totalCounts.sourceLeads).toBe(4);
    expect(view.values.length).toBe(view.totalCounts.values);
    expect(view.equations.length).toBe(view.totalCounts.equations);
    // Catalog regenerated 2026-06-01 (class-1 collapse + class-3 dirty exclusion + IRIS EPA
    // data-integrity gate; IRIS coverage expanded to the snapshot-validated master-list set).
    // 2026-06-02 IRIS orphan expansion landed in batches: first +95 (new-input + ambiguous),
    // then new-substance orphans in batches of ~113 substances. All US EPA IRIS records carry
    // default_status=available_option, qa_status=needs_review; every value validated against the
    // EPA snapshot within 2%. This batch (new-substance B3, FINAL, pass d0c00017, +255 records)
    // closes the new-substance orphan backlog (recon remaining now 0) on top of B2 (d0c00016).
    // valueGroups counts UNIQUE candidate_group_id over the full view (HH-TRV +
    // parameter_values.json) -> 1599 groups, because multi-endpoint candidate families
    // intentionally share one group id. (2026-06-03: -1 from 1600 -- the asbestos IUR was a
    // singleton candidate_group, deleted as a non-convertible fiber-unit defect.)
    expect(view.valueGroups).toHaveLength(1599);
    // approvedSourceBacked: was 1219; -1 (asbestos IUR deletion) = 1218.
    // (P28 rows use pending_source_locator, not approved_source_backed.)
    expect(view.audit.values.approvedSourceBacked).toBe(1218);
    // pendingSourceLocator: 355 P28 (soil + water/vapour) + 15 base/other pending = 370 (unchanged).
    expect(view.audit.values.pendingSourceLocator).toBe(370);
    expect(view.audit.values.currentCalculatorScaffold).toBe(65);
    expect(view.audit.values.currentDefaults).toBe(57);
    // availableOptions: was 1580; -1 (asbestos IUR deletion) = 1579. The ETBE IUR value
    // re-scale (8e-5 -> 8e-8 per ug/m3) does not change any count.
    expect(view.audit.values.availableOptions).toBe(1579);
    expect(view.audit.values.notDefaults).toBe(17);
    expect(view.audit.equations.pendingReview).toBe(5);
    expect(view.audit.equations.pendingSourceLocator).toBe(2);
    expect(view.audit.equations.currentCalculatorScaffold).toBe(3);
    expect(view.audit.sourceLeads.equationLeads).toBe(10);
    expect(view.audit.sourceLeads.parameterValueLeads).toBe(9);
    expect(view.audit.sourceLeads.canonicalSourceLeads).toBe(22);
    expect(view.audit.sourceLeads.documentLeads).toBe(25);
  });

  it('filters values and equations by human-health pathway', () => {
    const view = buildEvidenceLibraryView(
      createEvidenceLibraryFilters({
        pathways: ['human-health-direct'],
      }),
    );

    expect(view.values.length).toBeGreaterThan(0);
    expect(view.values.every((row) => row.record.pathway === 'human-health-direct')).toBe(true);
    expect(view.equations).toHaveLength(1);
    expect(view.equations[0].record.equation_id).toBe(
      'eq-human-health-direct-contact',
    );
    // sources order updated 2026-05-31: src-bc-protocol-28-2021-jan added by d0c00003 HH-direct records.
    expect(view.sources.map((row) => row.record.source_id)).toEqual([
      'src-bc-protocol-28-2021-jan',
      'src-us-epa-iris-rfd-table-live',
      'src-us-epa-iris-chemical-details-live',
      'src-health-canada-trv-v4-2025',
      'src-bc-protocol-28-v3-0-2024',
    ]);
  });

  it('filters by receptor and population scaffolds', () => {
    const view = buildEvidenceLibraryView(
      createEvidenceLibraryFilters({
        receptorGroups: ['human'],
        populationGroups: ['screening adult'],
      }),
    );

    expect(view.values.length).toBeGreaterThan(0);
    expect(
      view.values.every(
        (row) =>
          row.receptorGroups.includes('human') &&
          row.populationGroups.includes('screening adult'),
      ),
    ).toBe(true);
  });

  it('filters equations through linked substance value records', () => {
    const matchingView = buildEvidenceLibraryView(
      createEvidenceLibraryFilters({
        pathways: ['eco-direct-eqp'],
        substanceKeys: ['benzo_a_pyrene'],
      }),
    );
    const nonMatchingView = buildEvidenceLibraryView(
      createEvidenceLibraryFilters({
        pathways: ['eco-direct-eqp'],
        substanceKeys: ['copper'],
      }),
    );

    expect(matchingView.equations.map((row) => row.record.equation_id)).toEqual([
      'eq-eco-direct-eqp-di-toro',
    ]);
    expect(nonMatchingView.equations).toHaveLength(0);
  });

  it('searches across source, value, and evidence text', () => {
    const view = buildEvidenceLibraryView(
      createEvidenceLibraryFilters({
        search: 'Aroclor 1254 freshwater BSAF',
      }),
    );

    expect(
      view.values.some(
        (row) => row.record.parameter_value_id === 'pv-pcb-hh-food-bsaf',
      ),
    ).toBe(true);
  });

  it('builds exact calculator drill-in requests', () => {
    const rows = [
      {
        catalog_record:
          PARAMETER_VALUE_RECORDS.find(
            (record) => record.parameter_value_id === 'pv-pcb-hh-food-bsaf',
          ) ?? null,
        sources: [],
      },
    ];
    const request = buildCalculatorEvidenceRequest(
      'human-health-food',
      rows,
      ['eq-human-health-food-web'],
    );
    const view = buildEvidenceLibraryView(createEvidenceLibraryFilters(request));

    expect(view.values.map((row) => row.record.parameter_value_id)).toEqual([
      'pv-pcb-hh-food-bsaf',
    ]);
    expect(request.candidateGroupIds).toEqual([
      'human-health-food__total_pcbs_aroclor_1254__bsaf_loc_freshwater__general',
    ]);
    expect(view.equations.map((row) => row.record.equation_id)).toEqual([
      'eq-human-health-food-web',
    ]);
    expect(view.sources).toHaveLength(0);
  });

  it('filters alternatives by pathway, substance, and input key across jurisdictions', () => {
    const view = buildEvidenceLibraryView(
      createEvidenceLibraryFilters({
        pathways: ['human-health-food'],
        substanceKeys: ['arsenic_inorganic'],
        inputKeys: ['rfd_oral_mg_per_kg_bw_day'],
      }),
    );

    // values and valueGroups updated 2026-05-31: pv-p28-arsenic_inorganic-hh-food-rfd added by d0c00003.
    expect(view.values.map((row) => row.record.parameter_value_id).sort()).toEqual([
      'pv-arsenic-hh-food-rfd',
      'pv-iris-arsenic-hh-food-rfd',
      'pv-p28-arsenic-hh-food-rfd',
      'pv-p28-arsenic_inorganic-hh-food-rfd',
    ]);
    expect(view.valueGroups.map((group) => group.groupId).sort()).toEqual([
      'human-health-food__arsenic_inorganic__rfd_oral_mg_per_kg_bw_day__BC',
      'human-health-food__arsenic_inorganic__rfd_oral_mg_per_kg_bw_day__BC_provincial',
      'human-health-food__arsenic_inorganic__rfd_oral_mg_per_kg_bw_day__US_federal',
      'human-health-food__arsenic_inorganic__rfd_oral_mg_per_kg_bw_day__general',
    ]);
  });

  it('finds Health Canada and IRIS TRVs by extraction date', () => {
    const view = buildEvidenceLibraryView(
      createEvidenceLibraryFilters({
        search: '2026-05-23',
        pathways: ['human-health-food'],
        substanceKeys: ['benzo_a_pyrene'],
        evidenceSupportStatuses: ['approved_source_backed'],
      }),
    );

    expect(view.values.map((row) => row.record.parameter_value_id).sort()).toEqual([
      'pv-hc-bap-hh-food-rfd-tdi',
      'pv-hc-bap-hh-food-sf',
      'pv-iris-bap-hh-food-rfd-immune',
      'pv-iris-bap-hh-food-rfd-neuro',
      'pv-iris-bap-hh-food-rfd-repro',
      'pv-iris-bap-hh-food-sf',
    ]);
    expect(
      view.values.every(
        (row) => row.record.evidence_support_status === 'approved_source_backed',
      ),
    ).toBe(true);
  });

  it('labels Phase 1 review dispositions without promoting defaults', () => {
    const healthCanada = PARAMETER_VALUE_RECORDS.find(
      (record) => record.parameter_value_id === 'pv-hc-bap-hh-food-rfd-tdi',
    );
    const protocol28 = PARAMETER_VALUE_RECORDS.find(
      (record) => record.parameter_value_id === 'pv-p28-arsenic-hh-food-rfd',
    );
    const erdcBsaf = PARAMETER_VALUE_RECORDS.find(
      (record) => record.parameter_value_id === 'pv-bap-bsaf-freshwater',
    );

    expect(healthCanada).toBeDefined();
    expect(protocol28).toBeDefined();
    expect(erdcBsaf).toBeDefined();

    const sourceRecordsFor = (sourceIds: string[]) =>
      sourceIds
        .map((sourceId) => getSourceRecord(sourceId))
        .filter((source): source is SourceRecord => Boolean(source));

    expect(
      getParameterValueReviewDisposition(
        healthCanada!,
        sourceRecordsFor(healthCanada!.source_ids),
      ),
    ).toMatchObject({
      label: 'Approved alternative',
      blocksCalculatorDefault: true,
    });
    expect(
      getParameterValueReviewDisposition(
        protocol28!,
        sourceRecordsFor(protocol28!.source_ids),
      ),
    ).toMatchObject({
      label: 'Needs original-source verification',
      blocksCalculatorDefault: true,
    });
    expect(
      getParameterValueReviewDisposition(
        erdcBsaf!,
        sourceRecordsFor(erdcBsaf!.source_ids),
      ),
    ).toMatchObject({
      label: 'Needs original-source verification',
      blocksCalculatorDefault: true,
    });

    const sourceLeads = buildEvidenceLibraryView(
      createEvidenceLibraryFilters({
        search: 'WQCIU',
      }),
    ).sourceLeads;

    expect(sourceLeads.length).toBeGreaterThan(0);
    expect(getSourceLeadReviewDisposition(sourceLeads[0])).toMatchObject({
      label: 'Needs original-source verification',
      blocksCalculatorDefault: true,
    });
  });

  it('summarizes Protocol 28 as a blocked review queue', () => {
    const summary = buildProtocol28ReviewSummary();

    // candidateValueCount/blockedCandidateCount recomputed 2026-06-01:
    // 355 generated P28 records (soil + water/vapour, after class-1 collapse + 5 dirty exclusions)
    // + 6 other P28-aligned pending records = 361 human-health pending P28 records.
    expect(summary).toMatchObject({
      candidateValueCount: 361,
      blockedCandidateCount: 361,
      currentDefaultCount: 0,
      sourceLeadSetCount: 1,
      canDriveCalculatorDefaults: false,
    });
    expect(summary.nextActions.length).toBeGreaterThan(0);
    expect(summary.nextActions.join(' ')).toMatch(
      /original government or regulatory source/i,
    );
  });

  it('keeps mixed calculator value and equation sources visible in drill-ins', () => {
    const rows = ['pv-bap-logkow', 'pv-bap-fcv'].map((parameterValueId) => ({
      catalog_record:
        PARAMETER_VALUE_RECORDS.find(
          (record) => record.parameter_value_id === parameterValueId,
        ) ?? null,
      sources:
        PARAMETER_VALUE_RECORDS.find(
          (record) => record.parameter_value_id === parameterValueId,
        )?.source_ids.flatMap((sourceId) => {
          const source = getSourceRecord(sourceId);
          return source ? [source] : [];
        }) ?? [],
    }));
    const request = buildCalculatorEvidenceRequest(
      'eco-direct-eqp',
      rows,
      ['eq-eco-direct-eqp-di-toro'],
    );
    const view = buildEvidenceLibraryView(createEvidenceLibraryFilters(request));

    expect(view.values.map((row) => row.record.parameter_value_id).sort()).toEqual(
      ['pv-bap-fcv', 'pv-bap-logkow'],
    );
    expect(view.equations.map((row) => row.record.equation_id)).toEqual([
      'eq-eco-direct-eqp-di-toro',
    ]);
    expect(view.sources.map((row) => row.record.source_id).sort()).toEqual([
      'src-us-epa-esb-tier2-nonionic-organics-2008',
    ]);
  });

  it('keeps HH scaffolds as current-calculator needs-review records', () => {
    const hhRecords = PARAMETER_VALUE_RECORDS.filter(
      (record) =>
        record.pathway.startsWith('human-health') &&
        record.source_ids.includes('src-current-calculator-design-v1'),
    );

    expect(hhRecords.length).toBeGreaterThan(0);
    for (const record of hhRecords) {
      expect(record.qa_status, record.parameter_value_id).toBe('needs_review');
      expect(
        ['current_default', 'not_default'],
        record.parameter_value_id,
      ).toContain(record.default_status);
      expect(record.evidence_support_status, record.parameter_value_id).toBe(
        'current_calculator_scaffold',
      );
      expect(record.source_ids, record.parameter_value_id).toEqual([
        'src-current-calculator-design-v1',
      ]);
      expect(record.evidence_items.length, record.parameter_value_id).toBeGreaterThan(0);
      for (const evidence of record.evidence_items) {
        expect(evidence.extraction_method, evidence.evidence_id).toBe(
          'current_calculator_scaffold',
        );
        expect(evidence.locator_type, evidence.evidence_id).toBe(
          'current_calculator',
        );
        expect(evidence.qa_status, evidence.evidence_id).toBe('needs_review');
      }
    }
  });

  it('catalogs every current HH calculator default input as a review scaffold', () => {
    const inputKeysByPathway = {
      'human-health-direct': [
        'rfd_oral_mg_per_kg_bw_day',
        'sf_oral_per_mg_per_kg_bw_per_day',
        'abs_dermal',
        'ba_oral',
      ],
      'human-health-food': [
        'rfd_oral_mg_per_kg_bw_day',
        'sf_oral_per_mg_per_kg_bw_per_day',
        'bsaf_loc_freshwater',
        'ba_oral',
      ],
    } as const;

    const scaffoldSubstanceKeys = new Set(
      PARAMETER_VALUE_RECORDS.filter(
        (record) =>
          record.pathway.startsWith('human-health') &&
          record.source_ids.includes('src-current-calculator-design-v1'),
      ).map((record) => record.substance_key),
    );
    const scaffoldSubstances = SUBSTANCE_LIBRARY.filter((substance) =>
      scaffoldSubstanceKeys.has(substance.key),
    );

    expect(scaffoldSubstances.map((substance) => substance.key).sort()).toEqual([
      'arsenic_inorganic',
      'benzo_a_pyrene',
      'cadmium',
      'copper',
      'lead',
      'methylmercury',
      'total_pcbs_aroclor_1254',
      'zinc',
    ]);
    expect(scaffoldSubstanceKeys.has('benzene')).toBe(false);

    for (const substance of scaffoldSubstances) {
      for (const [pathway, inputKeys] of Object.entries(inputKeysByPathway)) {
        for (const inputKey of inputKeys) {
          const record = getParameterValueRecord(
            substance.key,
            pathway as keyof typeof inputKeysByPathway,
            inputKey,
          );

          expect(record, `${substance.key} ${pathway} ${inputKey}`).toBeDefined();
          expect(record?.qa_status).toBe('needs_review');
          expect(record?.source_ids).toEqual(['src-current-calculator-design-v1']);
          expect(record?.candidate_group_id).toBe(
            `${pathway}__${substance.key}__${inputKey}__general`,
          );
          expect(record?.evidence_support_status).toBe(
            'current_calculator_scaffold',
          );
          expect(record?.evidence_items[0]?.extraction_method).toBe(
            'current_calculator_scaffold',
          );
        }
      }
    }
  });
});

describe('buildEvidenceLibraryView live-merge of promoted records', () => {
  // Promoted (approved canonical) records are passed as extraRecords; they extend
  // ParameterValueRecord, so cloning a seed record and overriding the distinguishing
  // fields yields a valid fixture without restating every required field.
  const seed = PARAMETER_VALUE_RECORDS[0];

  function makeExtra(
    overrides: Partial<typeof seed> & { parameter_value_id: string },
  ): typeof seed {
    return { ...seed, ...overrides };
  }

  it('preserves baseline counts when extraRecords is empty (default path)', () => {
    const fromDefault = buildEvidenceLibraryView();
    const fromEmpty = buildEvidenceLibraryView(undefined, []);

    expect(fromEmpty.totalCounts.values).toBe(fromDefault.totalCounts.values);
    expect(fromEmpty.valueGroups).toHaveLength(fromDefault.valueGroups.length);
    expect(fromEmpty.audit.values.total).toBe(fromDefault.audit.values.total);
  });

  it('merges extra records into value rows and total counts', () => {
    const base = buildEvidenceLibraryView();
    const extra = makeExtra({
      parameter_value_id: 'pv-test-promoted-merge',
      substance_key: 'test_promoted_substance',
    });
    const view = buildEvidenceLibraryView(undefined, [extra]);

    expect(view.totalCounts.values).toBe(base.totalCounts.values + 1);
    expect(
      view.values.some(
        (row) => row.record.parameter_value_id === 'pv-test-promoted-merge',
      ),
    ).toBe(true);
  });

  it('dedups by parameter_value_id with promoted-wins on collision', () => {
    const base = buildEvidenceLibraryView();
    const collision = makeExtra({
      parameter_value_id: seed.parameter_value_id,
      value: 'PROMOTED_OVERRIDE',
    });
    const view = buildEvidenceLibraryView(undefined, [collision]);

    // Same id -> no new row added.
    expect(view.totalCounts.values).toBe(base.totalCounts.values);
    const row = view.values.find(
      (item) => item.record.parameter_value_id === seed.parameter_value_id,
    );
    // Promoted/extra record wins on collision.
    expect(row?.record.value).toBe('PROMOTED_OVERRIDE');
  });

  it('surfaces a promoted hh-toxicity-weighting pathway in the facet and rows', () => {
    const extra = makeExtra({
      parameter_value_id: 'pv-test-weighting',
      pathway: 'hh-toxicity-weighting',
    });
    const view = buildEvidenceLibraryView(undefined, [extra]);

    expect(
      view.facets.pathways.some(
        (option) => option.value === 'hh-toxicity-weighting',
      ),
    ).toBe(true);
    expect(
      view.values.some(
        (row) =>
          row.record.parameter_value_id === 'pv-test-weighting' &&
          row.record.pathway === 'hh-toxicity-weighting',
      ),
    ).toBe(true);
  });

  it('includes promoted rows in audit value counts', () => {
    const base = buildEvidenceLibraryView();
    const extra = makeExtra({
      parameter_value_id: 'pv-test-audit',
      evidence_support_status: 'approved_source_backed',
      default_status: 'available_option',
    });
    const view = buildEvidenceLibraryView(undefined, [extra]);

    expect(view.audit.values.total).toBe(base.audit.values.total + 1);
    expect(view.audit.values.approvedSourceBacked).toBe(
      base.audit.values.approvedSourceBacked + 1,
    );
    expect(view.audit.values.availableOptions).toBe(
      base.audit.values.availableOptions + 1,
    );
  });
});

describe('buildEvidenceLibraryView contextual facet counts', () => {
  const sumCounts = (options: { count: number }[]) =>
    options.reduce((total, option) => total + option.count, 0);

  it('narrows other facets to the active filter, but keeps the filtered dimension full', () => {
    const all = buildEvidenceLibraryView();
    const byPathway = buildEvidenceLibraryView(
      createEvidenceLibraryFilters({ pathways: ['human-health-food'] }),
    );

    // The substances facet (its own dimension is NOT the active filter) now counts only the
    // records matching the active pathway filter -> fewer total than the unfiltered view.
    expect(sumCounts(byPathway.facets.substances)).toBeLessThan(
      sumCounts(all.facets.substances),
    );
    expect(byPathway.facets.substances.length).toBeGreaterThan(0);

    // The pathways facet clears its OWN selection, so every pathway option still appears
    // (so the user can switch pathways) -- same option set as unfiltered.
    expect(byPathway.facets.pathways.map((option) => option.value).sort()).toEqual(
      all.facets.pathways.map((option) => option.value).sort(),
    );
  });

  it('a facet count equals the result count when that option is then selected', () => {
    const byPathway = buildEvidenceLibraryView(
      createEvidenceLibraryFilters({ pathways: ['human-health-food'] }),
    );
    const firstSubstance = byPathway.facets.substances[0];
    expect(firstSubstance).toBeDefined();

    // Selecting that substance on top of the pathway yields exactly the advertised count --
    // no "dropdown says N -> 0 results" mismatch.
    const combined = buildEvidenceLibraryView(
      createEvidenceLibraryFilters({
        pathways: ['human-health-food'],
        substanceKeys: [firstSubstance.value],
      }),
    );
    expect(combined.values.length).toBe(firstSubstance.count);
  });
});
