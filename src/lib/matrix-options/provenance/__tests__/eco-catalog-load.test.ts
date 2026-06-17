import { describe, it, expect } from 'vitest';
import { PARAMETER_VALUE_RECORDS } from '../catalog';

describe('eco-catalog-load', () => {
  it('has the expected number of eco-food rows', () => {
    const rows = PARAMETER_VALUE_RECORDS.filter(
      (r) =>
        r.pathway === 'eco-food-bsaf' &&
        r.input_key === 'trv_eco_mg_per_kg_bw_day' &&
        r.parameter_value_id.startsWith('pv-eco-')
    );
    expect(rows.length).toBe(45);
  });

  it('has the expected number of eco-direct rows', () => {
    const rows = PARAMETER_VALUE_RECORDS.filter(
      (r) =>
        r.pathway === 'eco-direct-eqp' &&
        r.input_key === 'fcv_ug_per_L' &&
        r.parameter_value_id.startsWith('pv-eco-')
    );
    expect(rows.length).toBe(43);
  });

  it('ensures all eco-generated rows are needs_review and available_option', () => {
    const ecoRows = PARAMETER_VALUE_RECORDS.filter((r) =>
      r.parameter_value_id.startsWith('pv-eco-')
    );
    expect(ecoRows.length).toBeGreaterThan(0);
    for (const r of ecoRows) {
      expect(r.qa_status).toBe('needs_review');
      expect(r.default_status).toBe('available_option');
    }
  });

  it('asserts no eco-generated record uses uppercase TRV key', () => {
    const ecoRows = PARAMETER_VALUE_RECORDS.filter((r) =>
      r.parameter_value_id.startsWith('pv-eco-')
    );
    for (const r of ecoRows) {
      expect(r.input_key).not.toBe('TRV_eco_mg_per_kg_bw_day');
      if (r.pathway === 'eco-food-bsaf') {
        expect(r.input_key).toBe('trv_eco_mg_per_kg_bw_day');
      }
    }
  });

  it('verifies benzo_a_pyrene coexistence for mammal and bird', () => {
    const bapRows = PARAMETER_VALUE_RECORDS.filter(
      (r) =>
        r.parameter_value_id.startsWith('pv-eco-benzo_a_pyrene-food-')
    );
    expect(bapRows.length).toBe(2);

    const mammalRow = bapRows.find((r) => r.parameter_value_id.includes('mammal'));
    const birdRow = bapRows.find((r) => r.parameter_value_id.includes('bird'));

    expect(mammalRow).toBeDefined();
    expect(birdRow).toBeDefined();
    expect(mammalRow!.value).toBe(3.6);
    expect(birdRow!.value).toBe(0.001);
  });
});
