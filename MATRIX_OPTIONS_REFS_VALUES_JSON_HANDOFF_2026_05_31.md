# Matrix-Options References & Values JSON-first expansion -- session handoff (2026-05-31)

Autonomous session. Built the in-repo JSON catalog expansion for the Matrix-Options
References & Values library, correct-by-construction from already-extracted authoritative
payloads, units normalized, surfaced in the Values view with NO Supabase approve-gate,
shipped as gated + codex-reviewed draft PRs. Owner was away.

## TL;DR -- what shipped

~478 new TRV candidate values added to `matrix_research/reference_catalog/human_health_trv_values.json`,
all `default_status=available_option` + `qa_status=needs_review` (AI never sets a calculator
default; QP/HITL selects per Protocol 1 s4.4). Surfaced in the Values view via
`buildEvidenceLibraryView` (static JSON import; no DB round-trip).

4 batch DRAFT PRs (all 4 gates GREEN: lint, unit, monitored build, e2e; all codex-CLI reviewed):

| PR | Branch | Base | Content | New records |
|---|---|---|---|---|
| #214 (PR1) | feat/matrix-options-refs-values-json-2026-05-31 | main | P28 App 8A HH-soil TRVs + generator + src record | 213 |
| #217 (PR2) | feat/matrix-options-refs-values-iris2-2026-05-31 | PR1 | Validated US EPA IRIS TRVs + expanded snapshot | 34 |
| #215 (PR3) | feat/matrix-options-refs-values-hc-2026-05-31 | PR1 | Health Canada TRV v4.0 | 107 |
| #216 (PR4) | feat/matrix-options-refs-values-p28water-2026-05-31 | PR1 | P28 water/vapour TRVs | 124 |

All PRs are additions-heavy with single-digit deletions (test-count lines only) -- verified
no clobber. PR1 base=main; PR2/3/4 stacked on PR1.

## How to merge (owner action)

These 4 PRs all branch from PR1 and each appends records to the SAME file
`human_health_trv_values.json` (disjoint record sets at the array tail) + edit the same
hardcoded test-count lines. Two options:

**Option A (per-batch, current PR structure):** merge #214 (PR1) FIRST to main. Then #215/#216/#217
auto-retarget to main; each will conflict ONLY on the disjoint-append tail of
`human_health_trv_values.json` (+ the test counts in library.test.ts / catalog.test.ts /
iris-canonical.test.ts). Resolve by UNION-by-`parameter_value_id` (keep all records from both
sides) and recompute the test counts to the integrated actuals. Merge order after PR1:
#217 (IRIS, also brings the expanded snapshot), then #215 (HC), then #216 (P28-water).

**Option B (single integration PR):** an integration branch that pre-merges all four can be
created to land everything in one clean merge to main (the orchestrator can produce this on
request; it was not completed this session due to a tooling cascade -- see Process notes).

NOTE: PR #213 (expanded IRIS snapshot, 179 records / 101 substances) is now REDUNDANT --
PR2 (#217) absorbed its snapshot file directly. Close #213 after #217 lands, or rebase.

## The generator (reusable)

`scripts/matrix-options/generate-catalog-records.mjs` (plain Node ESM, no new deps).
- Parses `.tmp/catalog-paste/*.sql` payloads (`$cat${json}$cat$::jsonb`) from the SHARED
  checkout `C:\Projects\SSTAC-Dashboard\.tmp\catalog-paste` (default --input-dir).
- Maps source input_keys (oral_rfd / oral_slope_factor / inhalation_rfc /
  inhalation_unit_risk) -> calculator input_keys; oral feeds human-health-direct AND
  human-health-food, inhalation feeds direct only.
- Normalizes every value to the input_key base unit; FAIL-CLOSED on unrecognized units
  (Greek-mu U+03BC / micro-sign U+00B5 mapped to 'ug' BEFORE lowercasing to avoid 1000x
  errors; reciprocal slope-factor and IUR handled).
- Sets default_status='available_option', qa_status='needs_review'; idempotent (dedups by
  parameter_value_id incl. cross-file vs parameter_values.json); deterministic ids.
- Flags: `--pass`/`--passes`, `--substances` (include filter), `--limit`, `--dry-run`,
  `--write`, `--emit-sql`, `--input-dir`, `--quiet`.
- `--emit-sql` writes later-batch `promoted_parameter_values` paste-SQL to
  `.tmp/catalog-paste/json-migration/` (owner pastes; AI never pastes).

## Reference inventory (processed vs pending)

PROCESSED (in PRs):
- d0c00003 P28 App 8A HH-soil (oral RfD/SF) -> PR1 (213 records; TEF rows skipped).
- d0c00011 + d0c00013 US EPA IRIS -> PR2 (34 shipped; rest deferred -- see below).
- d0c00012 Health Canada TRV v4.0 -> PR3 (107; 2 TEQ-unit + unmapped-input rows skipped).
- d0c00004 P28 water/vapour (RfC/IUR + new oral) -> PR4 (124; dups of d0c00003 deduped).

PENDING (not in these PRs; separate later lanes):
- d0c00005 eco-soil effect concentrations (2305), d0c00010 EcoSSL (60) -- ECO pathways;
  need eco source-pathway -> eco calculator-pathway mapping + their own review.
- d0c00006 background soil (27), d0c00007/09 HH exposure params (24), d0c00008 WHO2005 TEFs
  (29) -- not single-substance toxicity values; separate handling.
- d0c00001/d0c00002 -- already on main via #190.

DEFERRED (owner decisions; do not block):
- IRIS orphan substances NOT in the EPA snapshot, and snapshot-covered substances absent from
  the d0c00011/d0c00013 passes (antimony, copper, cyanide, dibutyl_phthalate, endosulfan,
  fluorene, mercury, methoxychlor, nickel, silver, bis_2_ethylhexyl_phthalate, etc.). To add:
  confirm coverage in the EPA snapshot (or extend it from `Chemicals_Details (1).xlsx`), then
  re-run the PR2 generator with them in the --substances allow-list.
- IRIS DATA-INTEGRITY MISMATCHES excluded from PR2 (d0c00013 values inconsistent with EPA;
  PR1/main already carry correct values for the first two): benzo_a_pyrene (SF 1 vs EPA 2;
  IUR 0.0006 vs 0.001), chromium_hexavalent (SF 0.16 vs 0.27; IUR 0.011 vs 0.018),
  carbon_tetrachloride (IUR 1.5e-5 vs EPA 6e-6, ~2.5x). The catalog extraction lane should
  investigate d0c00013 provenance before re-using those rows.
- d0c00012 TEQ-unit rows (PCBs coplanar, PCDDs/PCDFs oral RfD): unit `mg TEQ/kgBW-day` is a
  toxic-equivalency basis, not standard mass/bw -- needs a HITL decision on TEF workflow.
- CCME eco-soil (Protocol 1 s4.4.2 rank-1) -- not extracted; may need owner to provide source.

NON-PASS references not processed this session: the SABCS folder
`G:\My Drive\SABCS - Sediment Project\References` (L0 1.14 canonical external root) and the
Zotero local API -- no new toxicity values needed beyond the extracted passes for this expansion.

## Cross-source value spreads (informational; for the QP, not bugs)

The catalog deliberately keeps ALL candidate values per (substance, input, pathway) across
jurisdictions so the QP can compare (Protocol 1 s4.4). Several substances now carry P28
(BC_provincial) vs IRIS (US_federal) vs HC (Canada_federal) candidates with different values
and distinct candidate_group_id. This is the intended hierarchy-for-consideration pattern,
not a collision. AI never selects.

## Later Supabase migration (owner action)

Per-pass paste-SQL emitted to `.tmp/catalog-paste/json-migration/promoted_*.sql`
(promoted_parameter_values, correct-by-construction, units carried). MCP is dead -> paste
into Supabase Studio SQL Editor. JSON-first means the Values view already surfaces these
without the paste; the paste is only for the later DB migration batch.

## Process notes / lessons

- New L0 rule 1.16 (tool-call batching anti-cascade) added to `C:\Projects\CLAUDE.md`
  + memory `feedback_tool_call_batching_anti_cascade.md`: ONE failed call in a parallel
  batch CANCELS all siblings (wastes tokens, misleading transcript). Node 24 also removed
  `assert { type: 'json' }` (use fs.readFileSync+JSON.parse or `with { type: 'json' }`).
  This rule was violated several times this session via over-batched subagent-launch + verify
  fan-outs; the fix is to launch one subagent (or one uncertain call) per message.
- PR2 was initially mis-based (cut from main not PR1 -> would have clobbered PR1's 213
  records on merge); detected via record-count + merge-base check, rebuilt on the correct
  PR1 tip (branch suffixed `-iris2` because `-iris` name was taken), verified additions-only.
- codex CLI (gpt-5.5 xhigh) was AVAILABLE this session and caught real issues per PR
  (e.g. PR2: an approval-disposition bug where robot-extracted IRIS rows could read as
  "Approved alternative" despite needs_review -- fixed in library.ts).
- Worktrees created this session (junction-safe cleanup only -- `cmd /c rmdir` the
  node_modules junction then `git worktree remove`; NEVER Remove-Item -Recurse a junction):
  refs-values-json, refs-values-iris2, refs-values-hc, refs-values-p28water (all under
  `C:\Projects\SSTAC-Dashboard-worktrees\`). Left for owner post-merge cleanup.

## Open owner decisions (surfaced, not blocking)

1. Merge the 4 batch PRs (Option A: #214 first, then resolve union conflicts for #217/#215/#216),
   or request a single integration PR (Option B). Then close redundant #213.
2. Add the deferred IRIS substances (snapshot coverage check / extension, then re-run PR2 gen).
3. Investigate d0c00013 BaP / Cr(VI) / carbon_tetrachloride source values (inconsistent with EPA).
4. TEQ-unit HH RfDs (PCBs/PCDDs-PCDFs): TEF workflow decision.
5. Eco passes (d0c00005/d0c00010) + CCME eco-soil rank-1 gap: own lane + possible source.
6. Paste the json-migration SQL into Supabase when ready.
