// Tests for generate-eco-catalog-records.mjs.
// Plain ASCII only (code point <= 127).

import { describe, it, expect } from 'vitest';
import {
  parseArgs,
  normalizeToCanonical,
  buildEcoRecord,
  generate,
  reconcileApprovals,
  applyApprovalGuard,
} from '../generate-eco-catalog-records.mjs';

// Minimal eco-record fixtures for the approval-preservation guard (only the fields the guard reads).
function rec(id, qa, extra = {}) {
  return { parameter_value_id: id, substance_key: 's', pathway: 'eco-direct-eqp', qa_status: qa, ...extra };
}

const SRC = new Map([
  ['src-esb', { short_citation: 'ESB', source_authority_tier: 'tier_1_government_or_regulatory' }],
  ['src-nrwqc', { short_citation: 'NRWQC', source_authority_tier: 'tier_2_peer_reviewed_literature' }],
  ['src-fcsap', { short_citation: 'FCSAP', source_authority_tier: 'tier_3_supporting_science' }],
  ['src-refmine', { short_citation: 'RM', source_authority_tier: 'tier_3_supporting_science', calculator_source_role: 'reference_mining' }],
]);

describe('normalizeToCanonical', () => {
  it('normalizes fcv_ug_per_L identity: ug/L', () => {
    const res = normalizeToCanonical('130', 'ug/L', 'fcv_ug_per_L');
    expect(res).toEqual({ value: 130, unit: 'ug/L' });
  });

  it('normalizes fcv mg/L to ug/L (x1000)', () => {
    const res = normalizeToCanonical('1.8', 'mg/L', 'fcv_ug_per_L');
    expect(res).toEqual({ value: 1800, unit: 'ug/L' });
  });

  it('normalizes fcv ng/L to ug/L (x1e-3)', () => {
    const res = normalizeToCanonical('1000', 'ng/L', 'fcv_ug_per_L');
    expect(res).toEqual({ value: 1, unit: 'ug/L' });
  });

  it('normalizes trv mg/kg-bw/day identity', () => {
    const res = normalizeToCanonical('1.04', 'mg/kg-bw/day', 'trv_eco_mg_per_kg_bw_day');
    expect(res).toEqual({ value: 1.04, unit: 'mg/kg-bw/day' });
  });

  it('normalizes trv ug/kg/day to mg/kg-bw/day (x1e-3)', () => {
    const res = normalizeToCanonical('1000', 'ug/kg/day', 'trv_eco_mg_per_kg_bw_day');
    expect(res).toEqual({ value: 1, unit: 'mg/kg-bw/day' });
  });

  it('throws on TEQ unit (fail closed)', () => {
    expect(() => {
      normalizeToCanonical('0.19', 'ng TEQ/kg-bw/day', 'trv_eco_mg_per_kg_bw_day');
    }).toThrow(/TEQ/i);
  });

  it('throws on wrong class for fcv (fail closed)', () => {
    expect(() => {
      normalizeToCanonical('5', 'mg/kg', 'fcv_ug_per_L');
    }).toThrow(/mass\/L/i);
  });

  it('throws on trv missing /day (fail closed)', () => {
    expect(() => {
      normalizeToCanonical('1', 'mg/kg', 'trv_eco_mg_per_kg_bw_day');
    }).toThrow(/day/i);
  });

  it('throws on non-numeric value (fail closed)', () => {
    expect(() => {
      normalizeToCanonical('abc', 'ug/L', 'fcv_ug_per_L');
    }).toThrow(/Non-numeric/i);
  });

  it('throws on zero value (fail closed)', () => {
    expect(() => {
      normalizeToCanonical('0', 'ug/L', 'fcv_ug_per_L');
    }).toThrow(/Non-positive/i);
  });

  it('throws on negative value (fail closed)', () => {
    expect(() => {
      normalizeToCanonical('-5', 'ug/L', 'fcv_ug_per_L');
    }).toThrow(/Non-positive/i);
  });
});

describe('buildEcoRecord', () => {
  it('builds a correct eco-food TRV mammal record', () => {
    const row = {
      substance_key: 'arsenic_inorganic',
      input_key: 'trv_eco_mg_per_kg_bw_day',
      receptor: 'mammal',
      source_id: 'src-fcsap',
      locator: 'T1',
      jurisdiction: 'Canada_federal',
    };
    const resolvedSource = SRC.get('src-fcsap');
    const normalized = { value: 1.04, unit: 'mg/kg-bw/day' };

    const rec = buildEcoRecord(row, resolvedSource, normalized);

    expect(rec.input_key).toBe('trv_eco_mg_per_kg_bw_day');
    expect(rec.pathway).toBe('eco-food-bsaf');
    expect(rec.jurisdiction).toBe('Canada_federal');
    expect(rec.receptor_groups).toEqual(['wildlife']);
    expect(rec.species_groups).toEqual(['mammal']);
    expect(rec.candidate_group_id).not.toContain('undefined');
    expect(rec.bc_protocol_alignment).toContain('tier_3');
  });

  it('builds a correct eco-direct FCV record', () => {
    const row = {
      substance_key: 'benzene',
      input_key: 'fcv_ug_per_L',
      receptor: 'aquatic',
      source_id: 'src-esb',
      locator: 'Table 2',
      eco_direct_eligible: true,
    };
    const resolvedSource = SRC.get('src-esb');
    const normalized = { value: 130, unit: 'ug/L' };

    const rec = buildEcoRecord(row, resolvedSource, normalized);

    expect(rec.pathway).toBe('eco-direct-eqp');
    expect(rec.receptor_groups).toEqual(['aquatic life']);
    expect(rec.bc_protocol_alignment).toContain('tier_1');
  });

  it('falls back to jurisdiction "general" if omitted', () => {
    const row = {
      substance_key: 'benzene',
      input_key: 'fcv_ug_per_L',
      receptor: 'aquatic',
      source_id: 'src-esb',
      locator: 'Table 2',
      eco_direct_eligible: true,
    };
    const resolvedSource = SRC.get('src-esb');
    const normalized = { value: 130, unit: 'ug/L' };

    const rec = buildEcoRecord(row, resolvedSource, normalized);

    expect(rec.jurisdiction).toBe('general');
  });

  it('throws if eco-food does not have mammal or bird receptor', () => {
    const row = {
      substance_key: 'arsenic_inorganic',
      input_key: 'trv_eco_mg_per_kg_bw_day',
      receptor: 'aquatic',
      source_id: 'src-fcsap',
      locator: 'T1',
    };
    const resolvedSource = SRC.get('src-fcsap');
    const normalized = { value: 1.04, unit: 'mg/kg-bw/day' };

    expect(() => {
      buildEcoRecord(row, resolvedSource, normalized);
    }).toThrow(/requires receptor mammal\|bird/i);
  });

  it('throws when the source has no recognized authority tier (fail closed)', () => {
    const row = {
      substance_key: 'benzene',
      input_key: 'fcv_ug_per_L',
      receptor: 'aquatic',
      source_id: 'src-x',
      locator: 'T',
      eco_direct_eligible: true,
    };
    expect(() => {
      buildEcoRecord(row, { short_citation: 'X' }, { value: 130, unit: 'ug/L' });
    }).toThrow(/source_authority_tier/i);
  });
});

describe('generate', () => {
  it('skips rows marked with hold: true', () => {
    const input = {
      rows: [
        {
          substance_key: 'benzene',
          input_key: 'fcv_ug_per_L',
          eco_direct_eligible: true,
          raw_value: '130',
          raw_unit: 'ug/L',
          source_id: 'src-esb',
          locator: 'Table 2',
          hold: true,
        },
      ],
    };
    const res = generate(input, SRC);
    expect(res.skipped.hold).toBe(1);
    expect(res.records.length).toBe(0);
  });

  it('skips no_value rows including SUFFIX markers and nulls', () => {
    const input = {
      rows: [
        {
          substance_key: 'benzene',
          input_key: 'fcv_ug_per_L',
          eco_direct_eligible: true,
          raw_value: 'N/S (both receptors)',
          raw_unit: 'ug/L',
          source_id: 'src-esb',
          locator: 'Table 2',
        },
        {
          substance_key: 'benzene',
          input_key: 'fcv_ug_per_L',
          eco_direct_eligible: true,
          raw_value: 'N/A (acute only)',
          raw_unit: 'ug/L',
          source_id: 'src-esb',
          locator: 'Table 2',
        },
        {
          substance_key: 'benzene',
          input_key: 'fcv_ug_per_L',
          eco_direct_eligible: true,
          raw_value: 'N/S',
          raw_unit: 'ug/L',
          source_id: 'src-esb',
          locator: 'Table 2',
        },
        {
          substance_key: 'benzene',
          input_key: 'fcv_ug_per_L',
          eco_direct_eligible: true,
          raw_value: '',
          raw_unit: 'ug/L',
          source_id: 'src-esb',
          locator: 'Table 2',
        },
        {
          substance_key: 'benzene',
          input_key: 'fcv_ug_per_L',
          eco_direct_eligible: true,
          raw_value: null,
          raw_unit: 'ug/L',
          source_id: 'src-esb',
          locator: 'Table 2',
        },
      ],
    };
    const res = generate(input, SRC);
    expect(res.skipped.no_value).toBe(5);
    expect(res.records.length).toBe(0);
  });

  it('treats a whitespace-only raw_value as no_value (fail closed)', () => {
    const input = {
      rows: [
        {
          substance_key: 'benzene',
          input_key: 'fcv_ug_per_L',
          eco_direct_eligible: true,
          raw_value: '   ',
          raw_unit: 'ug/L',
          source_id: 'src-esb',
          locator: 'Table 2',
        },
      ],
    };
    const res = generate(input, SRC);
    expect(res.skipped.no_value).toBe(1);
    expect(res.records.length).toBe(0);
  });

  it('skips TEQ rows and increments skipped.teq', () => {
    const input = {
      rows: [
        {
          substance_key: 'pcb_total',
          input_key: 'trv_eco_mg_per_kg_bw_day',
          receptor: 'mammal',
          raw_value: '0.19',
          raw_unit: 'ng TEQ/kg-bw/day',
          source_id: 'src-fcsap',
          locator: 'T1',
        },
      ],
    };
    const res = generate(input, SRC);
    expect(res.skipped.teq).toBe(1);
    expect(res.records.length).toBe(0);
  });

  it('throws on empty locator (G2)', () => {
    const input = {
      rows: [
        {
          substance_key: 'benzene',
          input_key: 'fcv_ug_per_L',
          eco_direct_eligible: true,
          raw_value: '130',
          raw_unit: 'ug/L',
          source_id: 'src-esb',
          locator: '',
        },
      ],
    };
    expect(() => {
      generate(input, SRC);
    }).toThrow(/locator/i);
  });

  it('throws on metal substance in fcv (G3)', () => {
    const input = {
      rows: [
        {
          substance_key: 'cadmium',
          input_key: 'fcv_ug_per_L',
          eco_direct_eligible: true,
          raw_value: '1.8',
          raw_unit: 'ug/L',
          source_id: 'src-esb',
          locator: 'Table 2',
        },
      ],
    };
    expect(() => {
      generate(input, SRC);
    }).toThrow(/ineligible/i);
  });

  it('throws on fcv row for organic substance without eco_direct_eligible (G3)', () => {
    const input = {
      rows: [
        {
          substance_key: 'benzene',
          input_key: 'fcv_ug_per_L',
          raw_value: '130',
          raw_unit: 'ug/L',
          source_id: 'src-esb',
          locator: 'Table 2',
        },
      ],
    };
    expect(() => {
      generate(input, SRC);
    }).toThrow(/eco_direct_eligible/i);
  });

  it('emits record for organic substance with eco_direct_eligible (G3)', () => {
    const input = {
      rows: [
        {
          substance_key: 'benzene',
          input_key: 'fcv_ug_per_L',
          eco_direct_eligible: true,
          raw_value: '130',
          raw_unit: 'ug/L',
          source_id: 'src-esb',
          locator: 'Table 2',
        },
      ],
    };
    const res = generate(input, SRC);
    expect(res.records.length).toBe(1);
  });

  it('throws when source_id is a reference_mining source (G4)', () => {
    const input = {
      rows: [
        {
          substance_key: 'benzene',
          input_key: 'trv_eco_mg_per_kg_bw_day',
          receptor: 'mammal',
          raw_value: '1.04',
          raw_unit: 'mg/kg-bw/day',
          source_id: 'src-refmine',
          locator: 'T1',
        },
      ],
    };
    expect(() => {
      generate(input, SRC);
    }).toThrow(/reference_mining/i);
  });

  it('throws when a duplicate parameter_value_id occurs', () => {
    const input = {
      rows: [
        {
          substance_key: 'benzene',
          input_key: 'fcv_ug_per_L',
          eco_direct_eligible: true,
          raw_value: '130',
          raw_unit: 'ug/L',
          source_id: 'src-esb',
          locator: 'Table 2',
        },
        {
          substance_key: 'benzene',
          input_key: 'fcv_ug_per_L',
          eco_direct_eligible: true,
          raw_value: '130',
          raw_unit: 'ug/L',
          source_id: 'src-esb',
          locator: 'Table 2',
        },
      ],
    };
    expect(() => {
      generate(input, SRC);
    }).toThrow(/Duplicate/i);
  });

  it('supports mammal and bird receptor coexistence', () => {
    const input = {
      rows: [
        {
          substance_key: 'benzo_a_pyrene',
          input_key: 'trv_eco_mg_per_kg_bw_day',
          receptor: 'mammal',
          raw_value: '3.6',
          raw_unit: 'mg/kg-bw/day',
          source_id: 'src-fcsap',
          locator: 'T1',
        },
        {
          substance_key: 'benzo_a_pyrene',
          input_key: 'trv_eco_mg_per_kg_bw_day',
          receptor: 'bird',
          raw_value: '0.001',
          raw_unit: 'mg/kg-bw/day',
          source_id: 'src-fcsap',
          locator: 'T1',
        },
      ],
    };
    const res = generate(input, SRC);
    expect(res.records.length).toBe(2);

    const mammalRec = res.records.find((r) => r.parameter_value_id.includes('mammal'));
    const birdRec = res.records.find((r) => r.parameter_value_id.includes('bird'));

    expect(mammalRec).toBeDefined();
    expect(birdRec).toBeDefined();

    expect(mammalRec.candidate_group_id).toBe(birdRec.candidate_group_id);
    expect(mammalRec.parameter_value_id).not.toBe(birdRec.parameter_value_id);
  });

  it('emits distinct ids but a shared candidate_group_id for two sources of one substance', () => {
    const input = {
      rows: [
        { substance_key: 'benzene', input_key: 'fcv_ug_per_L', eco_direct_eligible: true, raw_value: '130', raw_unit: 'ug/L', source_id: 'src-esb', locator: 'Table 2' },
        { substance_key: 'benzene', input_key: 'fcv_ug_per_L', eco_direct_eligible: true, raw_value: '120', raw_unit: 'ug/L', source_id: 'src-nrwqc', locator: 'NRWQC CCC' },
      ],
    };
    const res = generate(input, SRC);
    expect(res.records.length).toBe(2);
    const [a, b] = res.records;
    expect(a.parameter_value_id).not.toBe(b.parameter_value_id);
    expect(a.candidate_group_id).toBe(b.candidate_group_id);
  });

  it('throws when two different source_ids collide to the same source-short (one-to-one guard)', () => {
    // Different substances (benzene, toluene) so the duplicate-id guard does NOT fire; only the
    // one-to-one source-short guard catches the collision. Both unmapped sources sanitize to the
    // same short via short_citation, so the suffix would silently stop discriminating sources.
    const dupSources = new Map([
      ['src-dup-a', { short_citation: 'Dup Source', source_authority_tier: 'tier_1_government_or_regulatory' }],
      ['src-dup-b', { short_citation: 'Dup Source', source_authority_tier: 'tier_1_government_or_regulatory' }],
    ]);
    const input = {
      rows: [
        { substance_key: 'benzene', input_key: 'fcv_ug_per_L', eco_direct_eligible: true, raw_value: '130', raw_unit: 'ug/L', source_id: 'src-dup-a', locator: 'A' },
        { substance_key: 'toluene', input_key: 'fcv_ug_per_L', eco_direct_eligible: true, raw_value: '9.8', raw_unit: 'ug/L', source_id: 'src-dup-b', locator: 'B' },
      ],
    };
    expect(() => generate(input, dupSources)).toThrow(/Source-short collision/i);
  });
});

describe('parseArgs --preserve-approvals', () => {
  it('defaults preserveApprovals to undefined (falsy)', () => {
    expect(parseArgs(['node', 'gen', '--write']).preserveApprovals).toBeFalsy();
  });
  it('sets preserveApprovals when the flag is passed', () => {
    expect(parseArgs(['node', 'gen', '--write', '--preserve-approvals']).preserveApprovals).toBe(true);
  });
});

describe('reconcileApprovals (preserve-approvals guard)', () => {
  it('is a no-op when no existing rows are approved: records === generated content', () => {
    const generated = [rec('pv-1', 'needs_review'), rec('pv-2', 'needs_review')];
    const existing = [rec('pv-1', 'needs_review'), rec('pv-2', 'needs_review')];
    const r = reconcileApprovals(generated, existing);
    expect(r.approvedExistingIds).toEqual([]);
    expect(r.droppedApprovedIds).toEqual([]);
    expect(r.preservedIds).toEqual([]);
    expect(r.records).toEqual(generated);
  });

  it('flags approved existing rows and carries them forward WHOLESALE (preserving prose + attestation)', () => {
    const generated = [rec('pv-1', 'needs_review'), rec('pv-2', 'needs_review')];
    const approvedPrior = rec('pv-1', 'approved', {
      applicability: 'PROMOTED applicability text',
      review_notes: 'PROMOTED review note',
      evidence_items: [{ qa_status: 'approved', reviewed_by: 'J. Nelson', reviewed_at: '2026-06-19' }],
    });
    const existing = [approvedPrior, rec('pv-2', 'needs_review')];
    const r = reconcileApprovals(generated, existing);
    expect(r.approvedExistingIds).toEqual(['pv-1']);
    expect(r.droppedApprovedIds).toEqual([]);
    expect(r.preservedIds).toEqual(['pv-1']);
    // pv-1 is the EXISTING approved record (prose + attestation preserved), NOT the regenerated stub.
    expect(r.records[0]).toBe(approvedPrior);
    expect(r.records[0].applicability).toBe('PROMOTED applicability text');
    expect(r.records[0].evidence_items[0].reviewed_by).toBe('J. Nelson');
    // pv-2 (needs_review) is regenerated fresh.
    expect(r.records[1]).toBe(generated[1]);
  });

  it('FAILS CLOSED when the existing catalog is not an array (corrupt/unexpected shape)', () => {
    const generated = [rec('pv-1', 'needs_review')];
    expect(() => reconcileApprovals(generated, { records: [rec('pv-1', 'approved')] }))
      .toThrow(/must be a JSON array/i);
    expect(() => reconcileApprovals(generated, null)).toThrow(/must be a JSON array/i);
  });

  it('FAILS CLOSED on duplicate existing parameter_value_ids (a dup could shadow an approved row)', () => {
    const generated = [rec('pv-1', 'needs_review')];
    const existing = [rec('pv-1', 'approved'), rec('pv-1', 'needs_review')];
    expect(() => reconcileApprovals(generated, existing)).toThrow(/duplicate parameter_value_id/i);
  });

  it('reports an approved row that staging no longer produces as DROPPED', () => {
    const generated = [rec('pv-2', 'needs_review')]; // pv-1 no longer generated
    const existing = [rec('pv-1', 'approved'), rec('pv-2', 'needs_review')];
    const r = reconcileApprovals(generated, existing);
    expect(r.approvedExistingIds).toEqual(['pv-1']);
    expect(r.droppedApprovedIds).toEqual(['pv-1']);
  });

  it('preserves multiple approved rows and leaves needs_review rows regenerated', () => {
    const generated = [rec('pv-1', 'needs_review'), rec('pv-2', 'needs_review'), rec('pv-3', 'needs_review')];
    const existing = [rec('pv-1', 'approved'), rec('pv-2', 'approved'), rec('pv-3', 'needs_review')];
    const r = reconcileApprovals(generated, existing);
    expect(r.preservedIds.sort()).toEqual(['pv-1', 'pv-2']);
    expect(r.records[2]).toBe(generated[2]);
  });

  it('preservedIds counts only carried-forward existing approved rows (not generated rows)', () => {
    // preservedIds + droppedApprovedIds === approvedExistingIds, by construction.
    const generated = [rec('pv-1', 'needs_review')];
    const existing = [rec('pv-1', 'approved'), rec('pv-gone', 'approved')];
    const r = reconcileApprovals(generated, existing);
    expect(r.approvedExistingIds.sort()).toEqual(['pv-1', 'pv-gone']);
    expect(r.preservedIds).toEqual(['pv-1']);
    expect(r.droppedApprovedIds).toEqual(['pv-gone']);
  });
});

describe('applyApprovalGuard (policy enforcement)', () => {
  const gen = [rec('pv-1', 'needs_review'), rec('pv-2', 'needs_review')];

  it('no-op when no approved rows exist: returns generated, no warnings', () => {
    const out = applyApprovalGuard(gen, [rec('pv-1', 'needs_review'), rec('pv-2', 'needs_review')], { dryRun: false });
    expect(out.records).toBe(gen);
    expect(out.warnings).toEqual([]);
    expect(out.preservedCount).toBe(0);
  });

  it('REFUSES to overwrite (throws) when approved rows exist and --preserve-approvals is absent', () => {
    const existing = [rec('pv-1', 'approved'), rec('pv-2', 'needs_review')];
    expect(() => applyApprovalGuard(gen, existing, { preserveApprovals: false, dryRun: false }))
      .toThrow(/Refusing to overwrite[\s\S]*approved/i);
  });

  it('dry-run WARNS instead of throwing when approvals would be erased (no write happens)', () => {
    const existing = [rec('pv-1', 'approved'), rec('pv-2', 'needs_review')];
    const out = applyApprovalGuard(gen, existing, { preserveApprovals: false, dryRun: true });
    expect(out.warnings.length).toBe(1);
    expect(out.warnings[0]).toMatch(/WOULD REFUSE WRITE/);
    expect(out.records).toBe(gen);
  });

  it('with --preserve-approvals: carries approved rows forward, no throw', () => {
    const approvedPrior = rec('pv-1', 'approved', { applicability: 'PROMOTED' });
    const existing = [approvedPrior, rec('pv-2', 'needs_review')];
    const out = applyApprovalGuard(gen, existing, { preserveApprovals: true, dryRun: false });
    expect(out.records[0]).toBe(approvedPrior);
    expect(out.records[0].applicability).toBe('PROMOTED');
    expect(out.preservedCount).toBe(1);
    expect(out.warnings).toEqual([]);
  });

  it('REFUSES to drop (throws) when --preserve-approvals is set but an approved row vanished from staging', () => {
    const generatedMissingApproved = [rec('pv-2', 'needs_review')];
    const existing = [rec('pv-1', 'approved'), rec('pv-2', 'needs_review')];
    expect(() => applyApprovalGuard(generatedMissingApproved, existing, { preserveApprovals: true, dryRun: false }))
      .toThrow(/Refusing to drop[\s\S]*pv-1/i);
  });
});
