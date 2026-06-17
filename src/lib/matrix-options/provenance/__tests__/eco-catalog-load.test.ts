// Validates the generated eco_values.json catalog data file directly.
// NOTE: the eco rows are deliberately NOT wired into PARAMETER_VALUE_RECORDS / catalog.ts in this PR
// (deferred to the owner-promotion follow-up). Loading needs_review candidates into the global tuple
// provenance resolver would mis-attribute library-seeded calculator values (e.g. Eco-Food arsenic
// 0.043) to a new needs_review TRV row. So this test asserts the FILE is correct + invariant-clean,
// independent of catalog wiring. Plain ASCII only.
import { describe, it, expect } from 'vitest';
import ecoValuesRaw from '../../../../../matrix_research/reference_catalog/eco_values.json';

type EcoRecord = {
  parameter_value_id: string;
  substance_key: string;
  pathway: string;
  input_key: string;
  value: number;
  qa_status: string;
  default_status: string;
  jurisdiction: string;
  source_authority_tier?: string;
  evidence_items: { locator?: string }[];
};

const ecoValues = ecoValuesRaw as EcoRecord[];

describe('eco_values.json data file', () => {
  it('has 88 records (43 eco-direct fcv + 45 eco-food trv)', () => {
    expect(ecoValues.length).toBe(88);
    const fcv = ecoValues.filter(
      (r) => r.pathway === 'eco-direct-eqp' && r.input_key === 'fcv_ug_per_L',
    );
    const trv = ecoValues.filter(
      (r) => r.pathway === 'eco-food-bsaf' && r.input_key === 'trv_eco_mg_per_kg_bw_day',
    );
    expect(fcv.length).toBe(43);
    expect(trv.length).toBe(45);
  });

  it('every record is a needs_review available_option with a tier and no undefined jurisdiction', () => {
    for (const r of ecoValues) {
      expect(r.qa_status).toBe('needs_review');
      expect(r.default_status).toBe('available_option');
      expect(r.source_authority_tier).toBeTruthy();
      expect(String(r.jurisdiction)).not.toContain('undefined');
    }
  });

  it('has unique parameter_value_ids and a truthy evidence locator on every record', () => {
    const ids = ecoValues.map((r) => r.parameter_value_id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of ecoValues) {
      expect(r.evidence_items.length).toBeGreaterThan(0);
      expect(r.evidence_items[0].locator).toBeTruthy();
    }
  });

  it('uses the lowercase trv catalog input_key (the calculator-facing contract), never uppercase', () => {
    for (const r of ecoValues) {
      expect(r.input_key).not.toBe('TRV_eco_mg_per_kg_bw_day');
      if (r.pathway === 'eco-food-bsaf') {
        expect(r.input_key).toBe('trv_eco_mg_per_kg_bw_day');
      }
    }
  });

  it('reconciles substance keys to existing canonical catalog keys (no orphan aliases)', () => {
    const orphanAliases = new Set([
      'chromium_vi',
      'chromium_total',
      'tetrachloroethene',
      'tetrachloromethane',
      'trichloroethene',
      'ddt_4_4',
      'lindane',
      'alpha_bhc',
      'tribromomethane',
      'total_pcbs',
    ]);
    for (const r of ecoValues) {
      expect(orphanAliases.has(r.substance_key)).toBe(false);
    }
  });

  it('keeps benzo_a_pyrene mammal (3.6) and bird (0.001) eco-food rows distinct', () => {
    const bap = ecoValues.filter((r) =>
      r.parameter_value_id.startsWith('pv-eco-benzo_a_pyrene-food-'),
    );
    expect(bap.length).toBe(2);
    expect(bap.some((r) => r.value === 3.6)).toBe(true);
    expect(bap.some((r) => r.value === 0.001)).toBe(true);
  });
});
