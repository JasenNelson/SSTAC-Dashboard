// Tests for generate-catalog-records.mjs.
// Coverage areas:
//   C3 -- pure helpers: dirtyExtractionReason, irisSnapshotDropReason, buildIrisSnapshotIndex
//   C2 -- generate() orchestration via temp-dir fixtures in the $cat$...$cat$::jsonb format
//
// Plain ASCII only (code point <= 127).

import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  dirtyExtractionReason,
  irisSnapshotDropReason,
  buildIrisSnapshotIndex,
  generate,
  parseArgs,
  parsePayloads,
  buildRecord,
} from '../generate-catalog-records.mjs';

// ---------------------------------------------------------------------------
// C3: dirtyExtractionReason
// ---------------------------------------------------------------------------

describe('dirtyExtractionReason -- C3', () => {
  // The function receives a payload OBJECT; source_excerpt is read off it.

  it('returns empty string for a clean excerpt (no heuristic triggers)', () => {
    const p = { source_excerpt: 'RfD = 3e-4 mg/kg/day. CAS 50-00-0.' };
    expect(dirtyExtractionReason(p)).toBe('');
  });

  // (a) consecutive duplicated unit token
  it('flags "mg/kg mg/kg" as a duplicate unit token', () => {
    const p = { source_excerpt: 'value: 3e-4 mg/kg mg/kg bw/day' };
    const reason = dirtyExtractionReason(p);
    expect(reason).not.toBe('');
    expect(reason).toMatch(/unit token duplicated/i);
  });

  it('case-insensitive: "MG/KG mg/kg" triggers duplicate flag', () => {
    const p = { source_excerpt: 'value: 1e-3 MG/KG mg/kg' };
    const reason = dirtyExtractionReason(p);
    expect(reason).not.toBe('');
  });

  it('single unit token (no duplication) is clean', () => {
    const p = { source_excerpt: 'value: 3e-4 mg/kg/day' };
    expect(dirtyExtractionReason(p)).toBe('');
  });

  it('unit token separated by non-whitespace is clean (no dup match)', () => {
    // "mg/kg-day" is a single token; "mg/kg day" has a day that is a different token
    const p = { source_excerpt: 'value: 3e-4 mg/kg-day; endpoint: chronic' };
    expect(dirtyExtractionReason(p)).toBe('');
  });

  // (b) empty CAS parentheses
  it('flags "()" as empty CAS', () => {
    const p = { source_excerpt: 'Substance () RfD 1e-3 mg/kg-bw/day' };
    const reason = dirtyExtractionReason(p);
    expect(reason).not.toBe('');
    expect(reason).toMatch(/empty CAS/i);
  });

  it('flags "(   )" (whitespace only) as empty CAS', () => {
    const p = { source_excerpt: 'Substance (   ) RfD 1e-3' };
    const reason = dirtyExtractionReason(p);
    expect(reason).not.toBe('');
    expect(reason).toMatch(/empty CAS/i);
  });

  it('non-empty parens like "(50-00-0)" are clean', () => {
    const p = { source_excerpt: 'Formaldehyde (50-00-0) RfD 2e-2 mg/kg/day' };
    expect(dirtyExtractionReason(p)).toBe('');
  });

  // (c) two distinct CAS numbers
  it('flags an excerpt with two distinct CAS numbers', () => {
    // CAS format: 1-7 digits, dash, 2 digits, dash, 1 digit
    const p = { source_excerpt: 'Compounds 50-00-0 and 71-43-2 combined RfD 1e-4 mg/kg/day' };
    const reason = dirtyExtractionReason(p);
    expect(reason).not.toBe('');
    expect(reason).toMatch(/two CAS numbers/i);
  });

  it('single CAS number is clean', () => {
    const p = { source_excerpt: 'Benzene 71-43-2 oral RfD 4e-3 mg/kg/day' };
    expect(dirtyExtractionReason(p)).toBe('');
  });

  it('same CAS repeated twice is NOT flagged (only 1 UNIQUE CAS)', () => {
    // Two occurrences of the same CAS => uniqueCas.size === 1 => clean
    const p = { source_excerpt: 'CAS 50-00-0. See also 50-00-0 for confirmation.' };
    expect(dirtyExtractionReason(p)).toBe('');
  });

  it('missing source_excerpt (undefined) is treated as clean empty string', () => {
    const p = {};
    expect(dirtyExtractionReason(p)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// C3: buildIrisSnapshotIndex + irisSnapshotDropReason
// ---------------------------------------------------------------------------

describe('buildIrisSnapshotIndex -- C3', () => {
  it('builds a Map from records array', () => {
    const raw = {
      records: [
        { substance_key: 'benzene', input_key: 'rfd_oral_mg_per_kg_bw_day', epa_values: [4e-3] },
        { substance_key: 'benzene', input_key: 'unit_risk_inhalation_per_ug_m3', epa_values: [2.2e-6, 7.8e-6] },
      ],
    };
    const idx = buildIrisSnapshotIndex(raw);
    expect(idx).toBeInstanceOf(Map);
    expect(idx.get('benzene::rfd_oral_mg_per_kg_bw_day')).toEqual([4e-3]);
    expect(idx.get('benzene::unit_risk_inhalation_per_ug_m3')).toEqual([2.2e-6, 7.8e-6]);
  });

  it('handles null/undefined input gracefully (returns empty Map)', () => {
    expect(buildIrisSnapshotIndex(null).size).toBe(0);
    expect(buildIrisSnapshotIndex(undefined).size).toBe(0);
    expect(buildIrisSnapshotIndex({}).size).toBe(0);
  });
});

describe('irisSnapshotDropReason -- C3', () => {
  const raw = {
    records: [
      { substance_key: 'toluene', input_key: 'rfd_oral_mg_per_kg_bw_day', epa_values: [0.08] },
      { substance_key: 'toluene', input_key: 'unit_risk_inhalation_per_ug_m3', epa_values: [1e-5, 2e-5] },
    ],
  };
  const idx = buildIrisSnapshotIndex(raw);

  it('returns empty string when value is within 2% of the single EPA anchor', () => {
    // 0.08 * 1.01 = 0.0808 (within 2%)
    expect(irisSnapshotDropReason(idx, 'toluene', 'rfd_oral_mg_per_kg_bw_day', 0.0808)).toBe('');
  });

  it('returns empty string when value is exactly at the EPA anchor', () => {
    expect(irisSnapshotDropReason(idx, 'toluene', 'rfd_oral_mg_per_kg_bw_day', 0.08)).toBe('');
  });

  it('returns non-empty reason when value is out of band (>2% deviation)', () => {
    // 0.08 * 1.03 = 0.0824 (3% above -> out of band)
    const reason = irisSnapshotDropReason(idx, 'toluene', 'rfd_oral_mg_per_kg_bw_day', 0.0824);
    expect(reason).not.toBe('');
    expect(reason).toMatch(/not within 2%/i);
  });

  it('returns empty string when value matches ONE of multiple EPA anchors (multi-anchor set)', () => {
    // Two anchors: 1e-5 and 2e-5; value = 1.005e-5 (within 2% of 1e-5)
    expect(irisSnapshotDropReason(idx, 'toluene', 'unit_risk_inhalation_per_ug_m3', 1.005e-5)).toBe('');
  });

  it('returns drop reason when value is between anchors but outside 2% of both', () => {
    // Two anchors: 1e-5 and 2e-5; value = 1.5e-5 is 50% from each -- out of band for both
    const reason = irisSnapshotDropReason(idx, 'toluene', 'unit_risk_inhalation_per_ug_m3', 1.5e-5);
    expect(reason).not.toBe('');
  });

  it('returns drop reason when no snapshot anchor exists for substance/input combo', () => {
    const reason = irisSnapshotDropReason(idx, 'mystery_chemical', 'rfd_oral_mg_per_kg_bw_day', 1e-3);
    expect(reason).not.toBe('');
    expect(reason).toMatch(/no EPA IRIS snapshot anchor/i);
  });

  it('handles a degenerate value=0 with no anchor: drops via the no-anchor path', () => {
    // 'zero_chem' has no snapshot anchor, so the lookup misses and the record drops
    // regardless of the value -- this exercises the no-anchor drop branch, not a 2% comparison.
    const reason = irisSnapshotDropReason(idx, 'zero_chem', 'rfd_oral_mg_per_kg_bw_day', 0);
    expect(reason).not.toBe('');
  });
});

// ---------------------------------------------------------------------------
// C2: parsePayloads
// ---------------------------------------------------------------------------

describe('parsePayloads -- C2 helper', () => {
  it('extracts JSON objects from $cat$...$cat$::jsonb wrapper', () => {
    // Build the SQL via concatenation to avoid template-literal parse issues with
    // Rollup treating $cat$ as a tagged-template-literal tag.
    const CAT = '$cat$';
    const CAST = '$cat$::jsonb';
    const p1 = '{"substance_key":"benzene","input_key":"oral_rfd"}';
    const p2 = '{"substance_key":"toluene","input_key":"oral_rfd"}';
    const sql = 'INSERT INTO t (payload) VALUES (' + CAT + p1 + CAST + '),\n(' + CAT + p2 + CAST + ');';
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gcr-test-'));
    const sqlFile = path.join(tmpDir, 'test.sql');
    try {
      fs.writeFileSync(sqlFile, sql, 'utf8');
      const payloads = parsePayloads(sqlFile);
      expect(payloads).toHaveLength(2);
      expect(payloads[0].substance_key).toBe('benzene');
      expect(payloads[1].substance_key).toBe('toluene');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns empty array for SQL with no $cat$ blocks', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gcr-test-'));
    const sqlFile = path.join(tmpDir, 'empty.sql');
    try {
      fs.writeFileSync(sqlFile, '-- no payloads here\n', 'utf8');
      expect(parsePayloads(sqlFile)).toHaveLength(0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// C2: generate() orchestration via temp-dir fixtures
// ---------------------------------------------------------------------------

// Build a minimal SQL staging file in the exact $cat$...$cat$::jsonb format.
// Uses string concatenation to avoid Rollup treating $cat$ as a template tag.
function makePayloadSql(payloads) {
  const CAT = '$cat$';
  const CAST = '$cat$::jsonb';
  const rows = payloads.map((p) => {
    const j = JSON.stringify(p);
    return '(' + CAT + j + CAST + ')';
  });
  return 'INSERT INTO catalog_extraction_staging (payload) VALUES\n' + rows.join(',\n') + ';\n';
}

// Minimal valid payload for oral_rfd (input_key is the STAGING key, not the canonical key).
function makeOralRfdPayload(overrides = {}) {
  return {
    parameter_value_id: 'pv-iris-benzene-hh-direct-rfd',
    substance_key: 'benzene',
    display_name: 'Benzene',
    input_key: 'oral_rfd',
    value: '4e-3',
    unit: 'mg/kg/day',
    source_ids: ['src-us-epa-iris'],
    source_excerpt: 'Benzene oral RfD = 4e-3 mg/kg/day. CAS 71-43-2.',
    locator: 'IRIS benzene chemical details',
    extracted_at: '2026-05-29',
    ...overrides,
  };
}

describe('generate() orchestration -- C2', () => {
  let tmpDir = null;

  afterEach(() => {
    if (tmpDir) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
      tmpDir = null;
    }
  });

  function setup(payloads, passId = 'd0c00099') {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gcr-gen-test-'));
    const sqlFile = path.join(tmpDir, passId + '_test.sql');
    fs.writeFileSync(sqlFile, makePayloadSql(payloads), 'utf8');
    return tmpDir;
  }

  // The generate() call requires sourceIdSet to contain ALL resolved source ids.
  // oral_rfd remaps 'src-us-epa-iris' -> 'src-us-epa-iris-rfd-table-live'.
  const SOURCE_ID_SET = new Set([
    'src-us-epa-iris-rfd-table-live',
    'src-us-epa-iris-chemical-details-live',
  ]);

  function makeArgs(inputDir, passId = 'd0c00099') {
    return { passes: [passId], inputDir, dryRun: true };
  }

  // Build a snapshotIndex that approves benzene oral_rfd = 4e-3 (within 2%).
  function makeSnapshotIndex() {
    return buildIrisSnapshotIndex({
      records: [
        {
          substance_key: 'benzene',
          input_key: 'rfd_oral_mg_per_kg_bw_day',
          epa_values: [4e-3],
        },
        {
          substance_key: 'benzene',
          input_key: 'sf_oral_per_mg_per_kg_bw_per_day',
          epa_values: [5.5e-2],
        },
      ],
    });
  }

  it('generates a clean record from a valid oral_rfd payload', () => {
    const payload = makeOralRfdPayload();
    const inputDir = setup([payload]);
    const args = makeArgs(inputDir);
    const snapshotIndex = makeSnapshotIndex();

    const { generated, skipped } = generate(
      args,
      SOURCE_ID_SET,
      new Set(),
      [],
      snapshotIndex,
    );

    // oral_rfd maps to exactly 2 pathways: human-health-direct + human-health-food
    expect(generated.length).toBe(2);
    expect(skipped.duplicate).toBe(0);
    expect(skipped.dirty).toBe(0);
    expect(skipped.dataIntegrity).toBe(0);
    // Confirm generated record has required shape
    const rec = generated[0];
    expect(rec).toHaveProperty('parameter_value_id');
    expect(rec).toHaveProperty('substance_key', 'benzene');
    expect(rec).toHaveProperty('input_key', 'rfd_oral_mg_per_kg_bw_day');
    expect(rec.qa_status).toBe('needs_review');
    expect(rec.default_status).toBe('available_option');
    expect(Array.isArray(rec.source_ids)).toBe(true);
    expect(rec.source_ids[0]).toBe('src-us-epa-iris-rfd-table-live');
  });

  it('result object has the expected shape { generated, skipped, warnings }', () => {
    const payload = makeOralRfdPayload();
    const inputDir = setup([payload]);
    const result = generate(
      makeArgs(inputDir),
      SOURCE_ID_SET,
      new Set(),
      [],
      makeSnapshotIndex(),
    );
    expect(result).toHaveProperty('generated');
    expect(result).toHaveProperty('skipped');
    expect(result).toHaveProperty('warnings');
    const { skipped } = result;
    expect(skipped).toHaveProperty('duplicate');
    expect(skipped).toHaveProperty('weighting');
    expect(skipped).toHaveProperty('unmappedInput');
    expect(skipped).toHaveProperty('filtered');
    expect(skipped).toHaveProperty('dirty');
    expect(skipped).toHaveProperty('dataIntegrity');
  });

  it('class-1 same-tuple-same-value duplicate is skipped (skipped.duplicate increments)', () => {
    const payload = makeOralRfdPayload();
    const inputDir = setup([payload]);
    const args = makeArgs(inputDir);
    const snapshotIndex = makeSnapshotIndex();

    // First call: collect generated records
    const firstRun = generate(args, SOURCE_ID_SET, new Set(), [], snapshotIndex);
    expect(firstRun.generated.length).toBeGreaterThan(0);

    // Second call: seed existingRecords with the first run's output (same tuple+value) BUT pass an
    // EMPTY existingIds set. This ISOLATES the class-1 tuple/value dedup branch: if it were the
    // downstream existingIds.has(parameter_value_id) collision check skipping these, an empty id
    // set would let them through. So the skip below can ONLY come from the tuple/value dedup -- a
    // genuine pin that fails if that logic regresses.
    const secondRun = generate(
      args,
      SOURCE_ID_SET,
      new Set(),
      firstRun.generated,
      snapshotIndex,
    );
    // All records from payload are duplicates via the tuple/value branch specifically.
    expect(secondRun.generated.length).toBe(0);
    expect(secondRun.skipped.duplicate).toBeGreaterThan(0);
  });

  it('class-3 dirty payload is routed to skipped.dirty with ADJUDICATE: warning', () => {
    // Use a dirty excerpt: unit token duplicated consecutively
    const dirty = makeOralRfdPayload({
      source_excerpt: 'RfD = 4e-3 mg/kg/day mg/kg/day. CAS 71-43-2.',
    });
    const inputDir = setup([dirty]);
    const args = makeArgs(inputDir);
    const snapshotIndex = makeSnapshotIndex();

    const { generated, skipped, warnings } = generate(
      args,
      SOURCE_ID_SET,
      new Set(),
      [],
      snapshotIndex,
    );

    expect(skipped.dirty).toBe(1);
    expect(generated.length).toBe(0);
    const adjWarn = warnings.filter((w) => w.startsWith('ADJUDICATE:'));
    expect(adjWarn.length).toBe(1);
    expect(adjWarn[0]).toMatch(/dirty extraction excluded/i);
  });

  it('IRIS out-of-band value is routed to skipped.dataIntegrity with DATA-INTEGRITY: warning', () => {
    // Use a value 20x the EPA anchor (1.5e-5 vs 1e-6 -> clearly out of band)
    // oral_rfd payload with value = 0.50 (far from EPA anchor 4e-3)
    const badValue = makeOralRfdPayload({ value: '0.50' });
    const inputDir = setup([badValue]);
    const args = makeArgs(inputDir);
    const snapshotIndex = makeSnapshotIndex();

    const { generated, skipped, warnings } = generate(
      args,
      SOURCE_ID_SET,
      new Set(),
      [],
      snapshotIndex,
    );

    expect(skipped.dataIntegrity).toBe(1);
    expect(generated.length).toBe(0);
    const diWarn = warnings.filter((w) => w.startsWith('DATA-INTEGRITY:'));
    expect(diWarn.length).toBe(1);
    expect(diWarn[0]).toMatch(/IRIS value dropped/i);
  });

  it('payload with unmapped input_key (tef_relative_potency) increments skipped.weighting', () => {
    const tef = makeOralRfdPayload({ input_key: 'tef_relative_potency' });
    const inputDir = setup([tef]);
    const { skipped } = generate(
      makeArgs(inputDir),
      SOURCE_ID_SET,
      new Set(),
      [],
      makeSnapshotIndex(),
    );
    expect(skipped.weighting).toBe(1);
  });

  it('payload with unknown input_key increments skipped.unmappedInput', () => {
    const unknown = makeOralRfdPayload({ input_key: 'some_unknown_key' });
    const inputDir = setup([unknown]);
    const { skipped } = generate(
      makeArgs(inputDir),
      SOURCE_ID_SET,
      new Set(),
      [],
      makeSnapshotIndex(),
    );
    expect(skipped.unmappedInput).toBe(1);
  });

  it('passes when no snapshotIndex is provided (null) even for IRIS source', () => {
    // NOTE: when snapshotIndex is null, the IRIS integrity check is skipped (line 453 guard)
    const payload = makeOralRfdPayload();
    const inputDir = setup([payload]);
    const { generated, skipped } = generate(
      makeArgs(inputDir),
      SOURCE_ID_SET,
      new Set(),
      [],
      null, // no snapshot index
    );
    // Should generate records (integrity gate bypassed)
    expect(generated.length).toBeGreaterThan(0);
    expect(skipped.dataIntegrity).toBe(0);
  });

  it('throws when a payload source_id is not in sourceIdSet', () => {
    const payload = makeOralRfdPayload({ source_ids: ['src-unknown-not-in-set'] });
    const inputDir = setup([payload]);
    expect(() =>
      generate(
        makeArgs(inputDir),
        SOURCE_ID_SET, // does not contain 'src-unknown-not-in-set'
        new Set(),
        [],
        makeSnapshotIndex(),
      ),
    ).toThrow(/not in sources.json/i);
  });

  // ---------------------------------------------------------------------------
  // Gap 1: skipped.filtered via args.substances filter
  // The generate() loop at line 410 checks:
  //   if (args.substances && !args.substances.has(payload.substance_key)) { skipped.filtered++; }
  // ---------------------------------------------------------------------------

  it('skipped.filtered increments and 0 records generate when substance is EXCLUDED by filter', () => {
    // The fixture payload has substance_key='benzene'.
    // Supply a substances Set that does NOT include 'benzene'.
    const payload = makeOralRfdPayload();
    const inputDir = setup([payload]);
    const args = {
      ...makeArgs(inputDir),
      substances: new Set(['toluene', 'xylene']), // benzene excluded
    };

    const { generated, skipped } = generate(
      args,
      SOURCE_ID_SET,
      new Set(),
      [],
      makeSnapshotIndex(),
    );

    expect(skipped.filtered).toBe(1);
    expect(generated.length).toBe(0);
  });

  it('skipped.filtered stays 0 and records generate when substance IS included by filter', () => {
    // Supply a substances Set that INCLUDES 'benzene' -> filter passes -> records generated.
    const payload = makeOralRfdPayload();
    const inputDir = setup([payload]);
    const args = {
      ...makeArgs(inputDir),
      substances: new Set(['benzene', 'toluene']),
    };

    const { generated, skipped } = generate(
      args,
      SOURCE_ID_SET,
      new Set(),
      [],
      makeSnapshotIndex(),
    );

    expect(skipped.filtered).toBe(0);
    expect(generated.length).toBeGreaterThan(0);
  });

  it('skipped.filtered stays 0 when args.substances is absent (no filter applied)', () => {
    // No substances field in args -> filter check is skipped entirely.
    const payload = makeOralRfdPayload();
    const inputDir = setup([payload]);
    const args = makeArgs(inputDir); // no substances key

    const { generated, skipped } = generate(
      args,
      SOURCE_ID_SET,
      new Set(),
      [],
      makeSnapshotIndex(),
    );

    expect(skipped.filtered).toBe(0);
    expect(generated.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // Gap 2: within-batch id-collision slug disambiguation
  //
  // REACHABILITY ANALYSIS (from buildRecord):
  //   baseId = 'pv-' + tag + '-' + substance_key + '-hh-' + pathShort + '-' + short
  //   It does NOT include the value -- only source tag, substance, pathway, and input
  //   kind. Two payloads with the same substance_key + input_key + source but
  //   DIFFERENT values share the same baseId for each pathway. Their tupleValueKeys
  //   differ (the key includes String(normalized.value)), so the class-1 tuple-value
  //   guard does NOT deduplicate them. The within-batch id-collision branch at line
  //   485-494 IS therefore REACHABLE and is tested below.
  //
  // SLUG derivation (line 487):
  //   payload.parameter_value_id -> replace non-alnum with '-', lowercase,
  //   collapse runs, strip leading/trailing '-', take last 16 chars.
  // ---------------------------------------------------------------------------

  it('within-batch id collision: second distinct-value payload gets slug suffix, both records appear', () => {
    // Two payloads: same substance/input/source but DIFFERENT values.
    // They collide on baseId within the batch (value is not in baseId).
    // The second payload must receive the slug suffix and both must be in generated.
    const payloadA = makeOralRfdPayload({
      parameter_value_id: 'pv-iris-benzene-hh-direct-rfd',
      value: '4e-3',
    });
    const payloadB = makeOralRfdPayload({
      parameter_value_id: 'pv-iris-benzene-hh-direct-rfd-alt',
      value: '3e-3', // different value -> different tupleValueKey, same baseId
    });

    const inputDir = setup([payloadA, payloadB]);
    const args = makeArgs(inputDir);
    const snapshotIndex = buildIrisSnapshotIndex({
      records: [
        // Anchor both values so neither hits the IRIS data-integrity gate.
        { substance_key: 'benzene', input_key: 'rfd_oral_mg_per_kg_bw_day', epa_values: [4e-3, 3e-3] },
        { substance_key: 'benzene', input_key: 'sf_oral_per_mg_per_kg_bw_per_day', epa_values: [5.5e-2] },
      ],
    });

    const { generated, skipped } = generate(
      args,
      SOURCE_ID_SET,
      new Set(),
      [],
      snapshotIndex,
    );

    // oral_rfd maps to 2 pathways (human-health-direct + human-health-food).
    // PayloadA produces 2 records with baseId (no suffix).
    // PayloadB collides on those same baseIds -> slug branch fires -> 2 more records with suffix.
    // Total: 4 records. No duplicates skipped because values differ.
    expect(generated.length).toBe(4);
    expect(skipped.duplicate).toBe(0);

    // The slug for payloadB is derived from 'pv-iris-benzene-hh-direct-rfd-alt':
    //   replace non-alnum -> 'pv-iris-benzene-hh-direct-rfd-alt'
    //   lowercase -> same
    //   collapse runs -> same
    //   strip leading/trailing '-' -> 'pv-iris-benzene-hh-direct-rfd-alt'
    //   'pv-iris-benzene-hh-direct-rfd-alt' length=34; last 16 chars = 'h-direct-rfd-alt'
    const expectedSlug = 'pv-iris-benzene-hh-direct-rfd-alt'
      .replace(/[^a-z0-9]/gi, '-')
      .toLowerCase()
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(-16);

    const sluggedIds = generated
      .map((r) => r.parameter_value_id)
      .filter((id) => id.endsWith('-' + expectedSlug));
    expect(sluggedIds.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// C3: parseArgs (basic coverage)
// ---------------------------------------------------------------------------

describe('parseArgs -- C3', () => {
  it('parses --pass into passes array', () => {
    const a = parseArgs(['node', 's', '--pass', 'd0c00003', '--dry-run']);
    expect(a.passes).toEqual(['d0c00003']);
    expect(a.dryRun).toBe(true);
  });

  it('parses --passes comma-list', () => {
    const a = parseArgs(['node', 's', '--passes', 'd0c00003,d0c00005', '--dry-run']);
    expect(a.passes).toEqual(['d0c00003', 'd0c00005']);
  });

  it('parses --write sets dryRun=false', () => {
    const a = parseArgs(['node', 's', '--pass', 'd0c00001', '--write']);
    expect(a.dryRun).toBe(false);
  });

  it('parses --input-dir', () => {
    const a = parseArgs(['node', 's', '--pass', 'd0c00001', '--input-dir', '/tmp/my-dir', '--dry-run']);
    expect(a.inputDir).toBe('/tmp/my-dir');
  });

  it('throws when no --pass or --passes supplied', () => {
    expect(() => parseArgs(['node', 's', '--dry-run'])).toThrow(/Specify --pass/i);
  });

  it('throws on unknown flag', () => {
    expect(() => parseArgs(['node', 's', '--pass', 'd0c00001', '--unknown'])).toThrow(/Unknown flag/i);
  });
});

// ---------------------------------------------------------------------------
// C3: buildRecord (shape smoke-test)
// ---------------------------------------------------------------------------

describe('buildRecord -- C3 shape smoke-test', () => {
  it('returns a record with the correct structure for oral_rfd + human-health-direct pathway', () => {
    const payload = {
      parameter_value_id: 'pv-iris-benzene-hh-direct-rfd',
      substance_key: 'benzene',
      display_name: 'Benzene',
      source_excerpt: 'RfD = 4e-3 mg/kg/day',
      locator: 'IRIS benzene',
      extracted_at: '2026-05-29',
    };
    const normalized = { value: 4e-3, unit: 'mg/kg-bw/day' };
    const rec = buildRecord(
      payload,
      'rfd_oral_mg_per_kg_bw_day',
      'human-health-direct',
      'src-us-epa-iris-rfd-table-live',
      normalized,
    );
    expect(rec.substance_key).toBe('benzene');
    expect(rec.pathway).toBe('human-health-direct');
    expect(rec.input_key).toBe('rfd_oral_mg_per_kg_bw_day');
    expect(rec.value).toBe(4e-3);
    expect(rec.unit).toBe('mg/kg-bw/day');
    expect(rec.qa_status).toBe('needs_review');
    expect(rec.default_status).toBe('available_option');
    expect(rec.source_ids).toEqual(['src-us-epa-iris-rfd-table-live']);
    expect(rec.jurisdiction).toBe('US_federal');
    expect(typeof rec.parameter_value_id).toBe('string');
    expect(rec.parameter_value_id.startsWith('pv-')).toBe(true);
    expect(Array.isArray(rec.evidence_items)).toBe(true);
    expect(rec.evidence_items).toHaveLength(1);
    expect(rec.candidate_group_id).toBe(
      'human-health-direct__benzene__rfd_oral_mg_per_kg_bw_day__US_federal',
    );
  });

  it('uses idSuffix to distinguish records from distinct payloads', () => {
    const payload = {
      parameter_value_id: 'pv-iris-benzene-hh-direct-rfd',
      substance_key: 'benzene',
      display_name: 'Benzene',
      extracted_at: '2026-05-29',
    };
    const normalized = { value: 4e-3, unit: 'mg/kg-bw/day' };
    const recA = buildRecord(payload, 'rfd_oral_mg_per_kg_bw_day', 'human-health-direct', 'src-us-epa-iris-rfd-table-live', normalized);
    const recB = buildRecord(payload, 'rfd_oral_mg_per_kg_bw_day', 'human-health-direct', 'src-us-epa-iris-rfd-table-live', normalized, 'neuro');
    expect(recB.parameter_value_id).toContain('-neuro');
    expect(recA.parameter_value_id).not.toBe(recB.parameter_value_id);
  });
});
