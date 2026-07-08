# Matrix Options UI/Runtime Backlog Packet - 2026-07-08

## Scope

- Runtime/UI backlog for Matrix Options, focused on Human Health Direct Contact runtime behavior.
- Excludes catalog mutation, Supabase tooling, and engine-v2/API paths.
- Work is on `C:\tmp\sstac-mo-overnight-20260708` only.

## Evidence snapshot (current clean worktree, `main`)

- `src/components/matrix-options/HHDirectContactCalculator.tsx:16` still imports only
  `HumanHealthDirectContactResult` from `types` and has no `resolveDlPcbTeqTdi` import.
- The component currently renders one direct-contact result card with
  `data-testid="hh-direct-preliminary-standard"` at lines `723-742`; there are no
  `hh-direct-dlpcb...` test IDs in this file.
- `src/components/matrix-options/__tests__/HHDirectContactCalculator.test.tsx` contains
  HH-DIRECT baseline behavior tests at lines `14-170` but no DL-PCB `describe` block and no
  `hh-direct-dlpcb-teq-*` assertions.
- `e2e/matrix-options.spec.ts:29-33` explicitly skips Matrix Options assertions when unauthenticated,
  which hides runtime/UI behavior in CI if storageState is unavailable.
- `docs/MATRIX_OPTIONS_OVERNIGHT_STATUS_2026_07_08.md:15-17` and
  `:99-104` already treat PR `#545` as the active next unit and recommend owner merge sequencing.
- `docs/MATRIX_OPTIONS_PR545_READINESS_2026_07_08.md:31-36` lists the exact PR files:
  `HHDirectContactCalculator.tsx`, `HHDirectContactCalculator.test.tsx`,
  `dlPcbTeqTdi.ts`, and `dlPcbTeqTdi.unit.test.ts`.

## Backlog classification

### Safe to do autonomously (independent of PR #545 merge)

1. **Harden Matrix-Options e2e visibility coverage**
   - `gotoMatrixOptionsOrSkip` currently bypasses runtime assertions under auth failures.
   - Scope: add a dedicated authenticated route test strategy (shared storageState fixture or
     explicit test-guard path) so UI behavior can be exercised non-brittly in CI.
   - Status: safe now, low risk.

2. **Create a short Matrix-Options runtime QA packet for post-merge verification**
   - Add/update docs that explicitly list expected HH-DIRECT card-level assertions so the PR-owner
     handoff is reproducible.
   - Scope: docs-only, no runtime behavior changes.
   - Status: safe now.

3. **Re-run/track existing HH direct assertions**
   - Add a focused local test harness for `hh-direct-preliminary-standard` numerical stability and
     blocked-state clarity if needed by owner review cadence.
   - Status: safe now; does not overlap any forbidden paths.

### Blocked until PR #545 is merged

1. **Activate DL-PCB TEQ parallel card in `main`**
   - Required by design in PR `#545` (`fd271a3`): `resolveDlPcbTeqTdi()` + conditional DL-PCB card + provisional
     badge wiring are not present in this worktree.
   - Dependency: owner merge of `#545` first.

2. **Post-merge HH-DIRECT DL-PCB component regression tests**
   - New component cases expected by the PR include:
     - total-PCB renders DL-PCB card + needs-review badge + TEQ units,
     - non-PCB hides the card,
     - mass-calculation blocking propagates to DL-PCB block state.
   - These must be added/validated after merge to avoid false-positive local pass on old behavior.

3. **Post-merge DL-PCB resolver unit coverage**
   - `src/lib/matrix-options/dlPcbTeqTdi.ts` (new in #545) should be covered for:
     - happy path and fail-closed reasons (missing/invalid/non-positive/unit mismatch).
   - Dependency: new resolver file must exist in merged `main` before tests are meaningful.

4. **Post-merge UI/UX clarity hardening**
   - Verify the dual-card interpretation (mass-based + TEQ-based) in the calculator page:
     distinguish copy, labels, and interpretation under error states.
   - This is easiest as a narrow follow-up once merged.

### Requires owner design decision

1. **PCB key/alias handling in the HH pathway**
   - Existing docs flag optional alias/deprecation discussion for
     `polychlorinated_biphenyls_total_pcbs` and related catalog rows that are not part of this PR
     (`docs/MATRIX_OPTIONS_OVERNIGHT_STATUS_2026_07_08.md:80-82`).
   - This is not a runtime-only change and should stay owner-driven.

2. **Broader runtime scope boundaries**
   - Separate owner decisions remain around cyanide grouping and inhalation-only schema expansion
     (`docs/MATRIX_OPTIONS_OVERNIGHT_STATUS_2026_07_08.md:82-84`).
   - These alter shared design/routing scope and should not be merged as automatic follow-up from A3.

## Recommended implementation order

1. Owner merges `#545` after CI green.
2. Immediately run focused unit suite:
   - `HHDirectContactCalculator` + `dlPcbTeqTdi` resolver tests.
3. Add/finalize any missing DL-PCB card-specific tests if regression confidence is low.
4. Address e2e auth-visibility gap (authenticated matrix-options path) so runtime behavior is actually
   observable in CI.
5. Defer cross-surface owner decisions (PCB aliasing, cyanide, inhalation schema) to separate scoped PRs.

## Blockers to close before wider implementation

- The main blocker is still whether #545 is merged into `main` in the current execution lane
  (`docs/MATRIX_OPTIONS_PR545_READINESS_2026_07_08.md:15-16` already notes merge readiness rather than
  post-merge validation state).
- E2E verification is partially blind today for Matrix Options due to the auth skip in
  `e2e/matrix-options.spec.ts:29-33`.
- No additional blocking infra/tooling issues observed in the checked files.
