# Matrix Options -- HC TRV Promotion & Helper Script Packet (2026-07-08)

Scope: map what already exists for Health Canada TRV v4.0 promotion, verification, and source-checking so the owner can safely close remaining work without catalog mutation.

## Script map (existing)

1. `scripts/matrix-options/promote-hc-trv-v4-2025.mjs`
   - Owner-run helper for 90 Health Canada TRV `pv-hc-*` records (`PROMOTION_ROWS`, `HC_TRV_V4_2025_PROMOTION_VALUE_IDS`).
   - Fail-closed preconditions:
     - strict expected identity check, exact `source_ids`, nested-source provenance check, exact pre/post state checks for `qa_status` and `canonical_source_status` (`lines 212-305`, `216-250`, `272-301`).
     - source direct-current eligibility checks (`source_storage`, `calculator_source_role`, `currentness_status`) (`lines 349-363`).
   - Explicit owner boundary:
     - `--apply` requires `--reviewer` and `--date` (`lines 197-206`).
     - dry run by default (`lines 630-633`).
     - does not mutate `default_status` (`lines 473-475`, `474`).
   - `applyPromotion` flips only QA/canonical provenance fields and evidence attestation fields (`lines 470-476`, `563-563`).
   - Includes coupling guidance: after apply, update `library.test.ts` audit counters and HH tripwire union in catalog test (`lines 678-689`).

2. `scripts/matrix-options/promote-hc-dioxin-teq.mjs`
   - Owner-run helper for one TEQ oral TDI row (`PV_HC_DIOXIN...`) with the same boundary style as #1 (`PROMOTION_ROWS` at `lines 55-71`; exports at `59`).
   - Fail-closed and source-role checks mirror the 90-row tool (`lines 109-161`, `195-247`).
   - Requires reviewer/date + provenance guard for durable locator on approve path (`lines 451-463`).
   - Same catalog-tripwire coupling note: row enters `promotedBeyondFrozen`, so sanctioned ID set update must be in same owner apply commit (`lines 24-33`).

3. `scripts/matrix-options/__tests__/promote-hc-trv-v4-2025.test.mjs` and `scripts/matrix-options/__tests__/promote-hc-dioxin-teq.test.mjs`
   - Both scripts are explicit fail-closed test coverage for scope, parser, plan preconditions, and idempotency (`lines 145-253` in the 90-row test; `190-255` in dioxin).
   - Tests assert 90-row scope and idempotent second-run no-op (`lines 145-149`, `285-325`; `140-145`, `222-229`).
   - These tests are the strongest safety net for automation risk before owner apply.

4. `scripts/matrix-options/hc-trv-v4-crosscheck.mjs`
   - Compares extracted Table 1 values to catalog and emits MATCH/MISMATCH/AMBIGUOUS with confidence notes (`lines 277-336`).
   - It hard-codes a 2026-07-06 adjudication baseline; if ambiguous or mismatch set drifts, it emits explicit stale warning (`lines 301-306`, `330-395`).
   - Writes `docs/MATRIX_OPTIONS_HC_TRV_V4_CROSSCHECK_2026_07_06.md` and `.tmp_agy_closeout_hc_comparator.md` (`lines 439-440`, `456`).
   - Contains the owner-decision-ready population/value tensions for `methylmercury` and `vinyl_chloride` (`lines 344-356` plus docs mirror at 69-81 in the generated report).

5. `scripts/matrix-options/hc_trv_v4_extract.py`
   - Extracts Table 1 from authoritative HC PDF and writes `scripts/matrix-options/data/hc_trv_v4_table1_extracted.json` (`lines 1-3`, `169-170`, `17-22`, `62-64`).
   - Uses a hardcoded local `pdf_path` default (`lines 15-17`) that is environment-specific.
   - Includes multiple extraction/normalization heuristics for names, age-bracket disambiguation, and output validation (`lines 18-120`).

6. `scripts/matrix-options/hc_trv_v4_table4_devito_tef_extract.py`
   - Extracts HC TRV Table 4 DeVito TEFs for `who-2022-devito-2024` and writes `scripts/matrix-options/data/hc_trv_v4_table4_devito_tef_extracted.json` (`lines 1-10`, `15-16`, `62-64`).
   - Hardcoded PDF path and fixed page pair `(53,54)` for extraction (`lines 15-16`, `36-37`).

7. `scripts/matrix-options/probe_dioxin_tdi.py`
   - Diagnostic-only PDF scanner for dioxin/TEQ/TDI patterns (`lines 1-20`, `32-104`).
   - No catalog mutation; manual PDF path default at `G:\My Drive...` (`lines 10-11`).

## Source/verification docs (current state and conclusions)

- `docs/MATRIX_OPTIONS_HC_TRV_V4_CROSSCHECK_2026_07_06.md`
  - Records a stabilized run: 107 MATCH, 0 MISMATCH, 4 AMBIGUOUS, with three remaining owner-tension rows highlighted (methylmercury, vinyl chloride SF and IUR) (`lines 34-44`, `50-58`, `69-75`).

- `docs/MATRIX_OPTIONS_HC_V4_REVERIFICATION_LEDGER_2026_07_06.md`
  - Confirms extraction drift = zero vs authoritative PDF and source source-of-truth location in G-drive (`lines 26-31`, `58-60`).
  - Explicitly calls out follow-up for parameterizing the extractor `pdf_path` (`lines 58-60`) and optional source locator stamping (`61-62`).

- `docs/MATRIX_OPTIONS_OWNER_DECISIONS_2026_07_06.md`
  - Keeps Lane 2 open pending owner-led source pointer + existing scripted triage run (`lines 62-70`).
  - Confirms three open decisions remain around population/value tension rows (no automation-safe correction yet).

- `docs/MATRIX_OPTIONS_CUMULATIVE_A4_ATTESTATION_PACKETS_2026_07_06.md`
  - Packet 1 explicitly frames TEQ key as owner policy/representation decision and requires owner attestation before apply (`lines 17-33`, `48-50`).

- `docs/MATRIX_OPTIONS_PR545_READINESS_2026_07_08.md`
  - Demonstrates DL-PCB TEQ card work is separate from catalog promotion, reinforcing that TEQ row remains needs_review and provisional at this point (`lines 74-76`, `105-107`).

## What is safe to automate now

1. Full re-run of non-mutating validation:
   - extraction (`hc_trv_v4_extract.py` and table4 TEF extractor),
   - compare (`hc-trv-v4-crosscheck.mjs`),
   - tests (`scripts/matrix-options/__tests__/promote-hc-trv-v4-2025.test.mjs`, promote-hc-dioxin-teq tests).
2. `--dry-run` planning for both promote scripts and diffing expected touched row list.
3. Evidence stamping behavior and idempotency checks via existing tests.
4. Local generation of crosscheck closeout packets and summaries.

## What must stay owner-gated

1. Any `--apply` run of either promote script (`promote-hc-trv-v4-2025.mjs`, `promote-hc-dioxin-teq.mjs`).
2. Owner attestation values (`--reviewer`, `--date`) and locator proof (`--source-url` and/or `--zotero-key`) in production paths.
3. Updating sanctioned ID sets in `src/lib/matrix-options/provenance/__tests__/catalog.test.ts` (called out by script comments for both promote paths).
4. Decision on owner-tension rows left `AMBIGUOUS` in source verification:
   - `pv-hc-methylmercury-hh-direct-rfd`,
   - `pv-hc-vinyl_chloride-hh-direct-sf`,
   - `pv-hc-vinyl_chloride-hh-direct-iur`.
5. Any changes to catalog `source locator` stamping or `current_default` semantics.

## Clear blockers / risk items

1. Environment-specific hardcoded PDF locations in both extractors (`hc_trv_v4_extract.py:15`, `hc_trv_v4_table4_devito_tef_extract.py:15`) and probe (`probe_dioxin_tdi.py:10`), preventing one-command portability across machines.
2. Re-verification freshness risk in crosscheck: AMBIGUOUS baseline guard will warn when current ambiguous set drifts (`scripts/matrix-options/hc-trv-v4-crosscheck.mjs:330-395`), so any source/catalog change must be manually re-reviewed before trusting zero-error claims.
3. The TEQ promotion script (`promote-hc-dioxin-teq.mjs`) and its test still rely on a dead canada.ca style URL in one fixture field (`url` value at lines 69-71), but now canonical PDF locator should be supplied via owner-run `source-url/zotero` on apply.
4. The same two promote scripts can mutate catalog rows; owner-run enforcement is intentional and should not be bypassed.

## Open owner decisions (exactly what remains)

- Confirm canonical HC TRV locator in a durable, reproducible location for both re-verification and long-run attribution (G-drive path already documented, but path should be owner-confirmed and pinned consistently).
- Resolve the three owner-reviewed tagging/value-tension rows above before any TEQ/HC-v4 default policy changes depend on them.
- If any apply action is required, run in same explicit owner-approved commit with catalog test tripwire updates and post-commit `test:ci` reconciliation.
