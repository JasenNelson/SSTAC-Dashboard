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
  createEvidenceLibraryFilters,
} from '../library';

describe('matrix options evidence library helpers', () => {
  it('builds the default view from repo-local catalog records', () => {
    const view = buildEvidenceLibraryView(createEvidenceLibraryFilters());

    expect(view.totalCounts.sources).toBeGreaterThan(20);
    expect(view.totalCounts.values).toBeGreaterThan(20);
    expect(view.totalCounts.equations).toBe(5);
    expect(view.totalCounts.sourceLeads).toBe(4);
    expect(view.values.length).toBe(view.totalCounts.values);
    expect(view.equations.length).toBe(view.totalCounts.equations);
    expect(view.valueGroups).toHaveLength(view.totalCounts.values);
    expect(view.audit.values.approvedSourceBacked).toBe(0);
    expect(view.audit.values.pendingSourceLocator).toBe(15);
    expect(view.audit.values.currentCalculatorScaffold).toBe(65);
    expect(view.audit.values.currentDefaults).toBe(57);
    expect(view.audit.values.availableOptions).toBe(6);
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
    expect(view.sources.map((row) => row.record.source_id)).toEqual([
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

    expect(view.values.map((row) => row.record.parameter_value_id).sort()).toEqual([
      'pv-arsenic-hh-food-rfd',
      'pv-p28-arsenic-hh-food-rfd',
    ]);
    expect(view.valueGroups.map((group) => group.groupId).sort()).toEqual([
      'human-health-food__arsenic_inorganic__rfd_oral_mg_per_kg_bw_day__BC',
      'human-health-food__arsenic_inorganic__rfd_oral_mg_per_kg_bw_day__general',
    ]);
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
      'src-us-epa-iris-bap-2017',
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

  it('catalogs every current HH calculator input as a review scaffold', () => {
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

    for (const substance of SUBSTANCE_LIBRARY) {
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
