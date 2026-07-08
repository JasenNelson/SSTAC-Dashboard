# Matrix Options PR #545 Readiness - 2026-07-08

## Verdict

Ready for owner merge, subject to the owner's normal visual review preference.

PR #545 is an additive A3 Option A implementation: a DL-PCB TEQ parallel screening-standard card for
`total_pcbs_aroclor_1254` in the human-health direct-contact calculator. The existing mass-based total-PCB
card remains in place.

## Evidence Checked

Worktree inspected:

- `C:\Projects\SSTAC-Dashboard-worktrees\mo-cumulative-2026-07-07`
- branch head: `fd271a3`

Changed files in PR #545:

- `src/components/matrix-options/HHDirectContactCalculator.tsx`
- `src/components/matrix-options/__tests__/HHDirectContactCalculator.test.tsx`
- `src/lib/matrix-options/dlPcbTeqTdi.ts`
- `src/lib/matrix-options/__tests__/dlPcbTeqTdi.unit.test.ts`

## Behavior Evidence

### Card scope

- `HHDirectContactCalculator.tsx:346` gates the DL-PCB card to `substanceKey === 'total_pcbs_aroclor_1254'`.
- `HHDirectContactCalculator.test.tsx:178-186` asserts the DL-PCB TEQ card renders for
  `total_pcbs_aroclor_1254`.
- `HHDirectContactCalculator.test.tsx:198-202` asserts the DL-PCB card does not render for
  `benzo_a_pyrene`.

### Existing mass card

- `HHDirectContactCalculator.test.tsx:190` asserts the existing `hh-direct-preliminary-standard` card is still
  present for total PCBs.

### Provisional badge

- `HHDirectContactCalculator.tsx:852-855` renders `hh-direct-dlpcb-teq-provisional-badge` with
  `Provisional -- needs review`.
- `HHDirectContactCalculator.test.tsx:185-186` asserts that badge text.

### TDI resolution and fail-closed behavior

- `dlPcbTeqTdi.ts` is isolated resolver code.
- The component imports it at `HHDirectContactCalculator.tsx:25` and resolves once at
  `HHDirectContactCalculator.tsx:345`.
- The component blocks the DL-PCB card when the resolver is not OK at `HHDirectContactCalculator.tsx:365-366`.
- It passes the resolved TDI into the existing inverse direct-contact calculation as the non-cancer RfD at
  `HHDirectContactCalculator.tsx:401`.

### Forbidden-path check

The PR file list is limited to Matrix Options component/lib/test files. It does not include:

- `.mcp.json`
- Supabase config, env, migrations, branch tooling, or project tooling
- `src/lib/engine-v2/**`
- `src/app/api/engine-v2/**`
- `src/data/**`
- `matrix_research/reference_catalog/**`
- catalog review status or default status files

## E2E Note

The existing Matrix Options e2e coverage is auth-gated and skips authenticated assertions when no authenticated
session is available. Component and unit tests provide stronger current evidence for the PR-specific behavior
than adding a brittle or always-skipped e2e assertion.

## Recommended Owner Action

Merge #545 when ready. After merge, the next safe post-merge task is not more DL-PCB direct-contact code; it is
backlog triage for the remaining owner-gated Matrix Options items.
