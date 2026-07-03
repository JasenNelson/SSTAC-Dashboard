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
  evidence_support_status: string;
  canonical_source_status: string;
  default_status: string;
  jurisdiction: string;
  source_authority_tier?: string;
  evidence_items: { locator?: string; qa_status: string; reviewed_by?: string; reviewed_at?: string }[];
};

const ecoValues = ecoValuesRaw as EcoRecord[];

describe('eco_values.json data file', () => {
  it('has 99 records (52 eco-direct fcv + 47 eco-food trv)', () => {
    expect(ecoValues.length).toBe(99);
    const fcv = ecoValues.filter(
      (r) => r.pathway === 'eco-direct-eqp' && r.input_key === 'fcv_ug_per_L',
    );
    const trv = ecoValues.filter(
      (r) => r.pathway === 'eco-food-bsaf' && r.input_key === 'trv_eco_mg_per_kg_bw_day',
    );
    expect(fcv.length).toBe(52);
    expect(trv.length).toBe(47);
  });

  it('emits per-source eco-direct candidates for multi-source substances (e.g. diazinon ESB + NRWQC)', () => {
    const diazinon = ecoValues.filter(
      (r) => r.substance_key === 'diazinon' && r.pathway === 'eco-direct-eqp',
    );
    expect(diazinon.length).toBe(2);
    expect(new Set(diazinon.map((r) => r.parameter_value_id)).size).toBe(2);
  });

  it('every record is an available_option with a tier, no undefined jurisdiction, and a COHERENT qa shape', () => {
    // Eco rows are emitted needs_review and may be HITL-promoted to approved (Step-6). Each row must be
    // either the exact pre-promotion shape OR the exact promoted shape -- a partial/incoherent row fails.
    for (const r of ecoValues) {
      expect(r.default_status).toBe('available_option');
      expect(r.source_authority_tier).toBeTruthy();
      expect(String(r.jurisdiction)).not.toContain('undefined');
      expect(['needs_review', 'approved']).toContain(r.qa_status);
      if (r.qa_status === 'approved') {
        expect(r.evidence_support_status).toBe('approved_source_backed');
        expect(r.canonical_source_status).toBe('direct_source_verified');
        for (const ev of r.evidence_items) {
          expect(ev.qa_status).toBe('approved');
          expect(ev.reviewed_by).toBeTruthy();
          expect(ev.reviewed_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
      } else {
        expect(r.evidence_support_status).toBe('pending_source_locator');
        expect(r.canonical_source_status).toBe('needs_direct_source_check');
      }
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
      'butyl_benzyl_phthalate',
      'di_n_butyl_phthalate',
      'diethyl_phthalate',
      'pentachlorobenzene',
      'chlordane',
      'xylene_m',
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
