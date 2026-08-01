// Regression guards for docs-gate.mjs. Plain ASCII.
//
// Why this file exists (2026-07-26 documentation recovery):
// docs:gate collects requirements ONLY from bundles whose trigger globs match a
// changed path. Before this recovery, no bundle matched the Matrix Map / Option C
// lane at all, so gate 6 of the mandatory six-gate push suite exited 0 without
// inspecting anything on every matrix-map change -- a green gate that proved
// nothing.
//
// WHY THESE ASSERTIONS ARE IDENTITY-BASED, NOT COUNT-BASED (2026-07-27):
// An earlier revision of this file asserted `activated_bundles.length > 0`. That
// is itself vacuous. For any path under src/app/api/** the generic API_GATE
// fires, so a non-empty count passes whether or not the MATRIX_MAP_GATE domain
// authority activated -- the test written to prevent a vacuous gate pass was a
// vacuous assertion. Every bundle-wiring test below therefore asserts the EXACT
// expected bundle id AND the expected authority document ids.

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const GATE = path.join(REPO_ROOT, 'scripts', 'verify', 'docs-gate.mjs');
const MANIFEST = JSON.parse(
  readFileSync(path.join(REPO_ROOT, 'docs', '_meta', 'docs-manifest.json'), 'utf8')
);

const MATRIX_MAP_AUTHORITIES = ['matrixmap.plan_v3_4_2', 'matrixmap.option_c_design'];
const AGY_GOVERNANCE_AUTHORITIES = [
  'docs.index',
  'core.agents',
  'root.agents',
  'governance.gate_mode_sop',
  'governance.agy_usage',
  'governance.sstac_ai_pipeline',
];

const AGY_SECTIONS = [
  'agy.role_and_mode',
  'agy.boundaries',
  'agy.validated_invocation',
  'agy.supervised_launch',
  'root.mc_token_efficiency',
  'root.agy_autonomous_runs',
];

function runGate(files) {
  const out = execFileSync('node', [GATE, '--json', '--files', ...files], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  return JSON.parse(out);
}

describe('docs-gate bundle wiring - exact identity, never counts', () => {
  // The six path classes below are the acceptance table for the documentation
  // recovery. Each asserts WHICH bundle activated, not how many.

  it('Option C API changes activate MATRIX_MAP_GATE with its authorities', () => {
    // This is the case the recovery originally MISSED: MATRIX_MAP_GATE had no
    // src/app/api/matrix-map/** trigger, so an API-only Option C change matched
    // only the generic API_GATE and was never checked against the Matrix Map
    // authorities at all.
    const result = runGate([
      'src/app/api/matrix-map/admin/site-aggregates/candidate/route.ts',
    ]);
    expect(result.activated_bundles).toContain('MATRIX_MAP_GATE');
    expect(result.required_documents).toEqual(
      expect.arrayContaining(MATRIX_MAP_AUTHORITIES)
    );
  });

  it('Matrix Map UI changes activate MATRIX_MAP_GATE with its authorities', () => {
    const result = runGate([
      'src/app/(dashboard)/admin/matrix-map/site-aggregates/page.tsx',
    ]);
    expect(result.activated_bundles).toContain('MATRIX_MAP_GATE');
    expect(result.required_documents).toEqual(
      expect.arrayContaining(MATRIX_MAP_AUTHORITIES)
    );
  });

  it('Matrix Map lib changes activate MATRIX_MAP_GATE with its authorities', () => {
    const result = runGate(['src/lib/matrix-map/fetch-site-aggregates-server.ts']);
    expect(result.activated_bundles).toContain('MATRIX_MAP_GATE');
    expect(result.required_documents).toEqual(
      expect.arrayContaining(MATRIX_MAP_AUTHORITIES)
    );
  });

  it('SQL / validation-harness changes activate MATRIX_MAP_GATE with its authorities', () => {
    const result = runGate([
      'scripts/matrix-map/validation/option-c-phase2/test-option-c.sql',
    ]);
    expect(result.activated_bundles).toContain('MATRIX_MAP_GATE');
    expect(result.required_documents).toEqual(
      expect.arrayContaining(MATRIX_MAP_AUTHORITIES)
    );
  });

  it('matrix-map design-doc changes activate MATRIX_MAP_GATE', () => {
    const result = runGate(['docs/design/matrix-map/PLAN_V3_4_2.md']);
    expect(result.activated_bundles).toContain('MATRIX_MAP_GATE');
  });

  it('manifest changes activate DOCS_GOVERNANCE_GATE with its authorities', () => {
    const result = runGate(['docs/_meta/docs-manifest.json']);
    expect(result.activated_bundles).toContain('DOCS_GOVERNANCE_GATE');
    expect(result.required_documents).toEqual(
      expect.arrayContaining(['docs.index', 'docs.manifest', 'core.agents'])
    );
  });

  it('docs/INDEX.md changes activate DOCS_GOVERNANCE_GATE', () => {
    const result = runGate(['docs/INDEX.md']);
    expect(result.activated_bundles).toContain('DOCS_GOVERNANCE_GATE');
  });

  it('the gate IMPLEMENTATION activates DOCS_GOVERNANCE_GATE (was self-ungated)', () => {
    // The code that enforces the documentation gate was itself outside every
    // trigger, so a change to the resolver activated no bundle at all.
    const result = runGate(['scripts/verify/docs-gate.mjs']);
    expect(result.activated_bundles).toContain('DOCS_GOVERNANCE_GATE');
  });

  it('the gate TEST activates DOCS_GOVERNANCE_GATE (was self-ungated)', () => {
    const result = runGate(['scripts/verify/__tests__/docs-gate.test.mjs']);
    expect(result.activated_bundles).toContain('DOCS_GOVERNANCE_GATE');
  });

  it('root AGENTS.md changes activate AGY_GOVERNANCE_GATE with its authorities and sections', () => {
    const result = runGate(['AGENTS.md']);
    expect(result.activated_bundles).toContain('AGY_GOVERNANCE_GATE');
    expect(result.required_documents).toEqual(
      expect.arrayContaining(AGY_GOVERNANCE_AUTHORITIES)
    );
    expect(result.required_sections).toEqual(
      expect.arrayContaining(AGY_SECTIONS)
    );
  });

  it('AGY usage changes activate AGY_GOVERNANCE_GATE with its authorities and sections', () => {
    const result = runGate(['docs/AGY_USAGE.md']);
    expect(result.activated_bundles).toContain('AGY_GOVERNANCE_GATE');
    expect(result.required_documents).toEqual(
      expect.arrayContaining(AGY_GOVERNANCE_AUTHORITIES)
    );
    expect(result.required_sections).toEqual(
      expect.arrayContaining(AGY_SECTIONS)
    );
  });

  it('AI pipeline changes activate AGY_GOVERNANCE_GATE with its authorities and sections', () => {
    const result = runGate(['SSTAC_AI_PIPELINE.md']);
    expect(result.activated_bundles).toContain('AGY_GOVERNANCE_GATE');
    expect(result.required_documents).toEqual(
      expect.arrayContaining(AGY_GOVERNANCE_AUTHORITIES)
    );
    expect(result.required_sections).toEqual(
      expect.arrayContaining(AGY_SECTIONS)
    );
  });

  it('AGY tooling changes activate AGY_GOVERNANCE_GATE with its authorities and sections', () => {
    const result = runGate(['tooling/agy/Invoke-AgyAutonomousWorker.ps1']);
    expect(result.activated_bundles).toContain('AGY_GOVERNANCE_GATE');
    expect(result.required_documents).toEqual(
      expect.arrayContaining(AGY_GOVERNANCE_AUTHORITIES)
    );
    expect(result.required_sections).toEqual(
      expect.arrayContaining(AGY_SECTIONS)
    );
  });

  it('NEGATIVE CONTROL: an unrelated path activates nothing', () => {
    // Without this, every assertion above could be satisfied by a trigger that
    // matches everything. This is what makes the identity assertions meaningful.
    const result = runGate(['README.md']);
    expect(result.activated_bundles).toEqual([]);
    expect(result.required_documents).toEqual([]);
  });

  it('NEGATIVE CONTROL: MATRIX_MAP_GATE does not fire for unrelated source', () => {
    const result = runGate(['README.md']);
    expect(result.activated_bundles).not.toContain('MATRIX_MAP_GATE');
    expect(result.activated_bundles).not.toContain('DOCS_GOVERNANCE_GATE');
  });
});

describe('docs-manifest integrity', () => {
  it('every bundle requires only doc ids that exist in documents[]', () => {
    const ids = new Set(MANIFEST.documents.map((d) => d.id));
    const dangling = [];
    for (const [bundleName, bundle] of Object.entries(MANIFEST.bundles || {})) {
      for (const req of bundle.requires_documents || []) {
        if (!ids.has(req.doc_id)) dangling.push(`${bundleName} -> ${req.doc_id}`);
      }
    }
    expect(dangling).toEqual([]);
  });

  it('every registered document path exists on disk', () => {
    const missing = MANIFEST.documents
      .filter((d) => !existsSync(path.join(REPO_ROOT, d.path)))
      .map((d) => `${d.id} -> ${d.path}`);
    expect(missing).toEqual([]);
  });

  it('has no duplicate document ids', () => {
    const ids = MANIFEST.documents.map((d) => d.id);
    const dups = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dups).toEqual([]);
  });

  it('the Matrix Map authorities this lane depends on are registered', () => {
    const ids = new Set(MANIFEST.documents.map((d) => d.id));
    for (const id of MATRIX_MAP_AUTHORITIES) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it('MATRIX_MAP_GATE covers the Option C API surface', () => {
    // Pins the specific trigger whose absence made API-only changes bypass the
    // Matrix Map authorities.
    const triggers = MANIFEST.bundles?.MATRIX_MAP_GATE?.triggers ?? [];
    expect(triggers).toContain('src/app/api/matrix-map/**');
  });

  it('DOCS_GOVERNANCE_GATE covers its own implementation and test', () => {
    const triggers = MANIFEST.bundles?.DOCS_GOVERNANCE_GATE?.triggers ?? [];
    expect(triggers).toContain('scripts/verify/docs-gate.mjs');
    expect(triggers).toContain('scripts/verify/__tests__/docs-gate.test.mjs');
  });

  it('AGY_GOVERNANCE_GATE covers all four AGY governance surfaces', () => {
    const triggers = MANIFEST.bundles?.AGY_GOVERNANCE_GATE?.triggers ?? [];
    expect(triggers).toEqual(
      expect.arrayContaining([
        'AGENTS.md',
        'docs/AGY_USAGE.md',
        'SSTAC_AI_PIPELINE.md',
        'tooling/agy/**',
      ])
    );
  });
});
