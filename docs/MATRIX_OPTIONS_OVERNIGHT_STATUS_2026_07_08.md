# Matrix Options Overnight Status - 2026-07-08

Purpose: current execution board for the Matrix Options lane after Phase B merged and the CI Unit Tests
Node 22 pin landed. This file corrects stale handoff claims by verifying against `origin/main` at
`3285998` and the live PR state checked during the Codex autonomous run.

## Verified Baseline

- `origin/main`: `3285998` (`#547`, Unit Tests pinned to Node 22).
- Phase B PRs are merged on main:
  - `#540` D1 dioxin-like TEQ oral TDI.
  - `#541` D4 BC PAH RPF remap to `ccme-2010`.
  - `#542` D2 BaP ADAF-stage anchor tags.
  - `#543` handoff and D3 closeout.
- Open active Matrix Options PR:
  - `#545` A3 DL-PCB TEQ parallel screening card, head `fd271a3`, all checks green, merge state
    `CLEAN` at verification time.
- D3 PCB Option A is data-layer satisfied; runtime scoring is deferred to A3.
- Phase C is parked, not failed, pending primary source PDFs.

## Ready Now

### PR #545 - A3 DL-PCB TEQ parallel screening card

Status: open, green, mergeable at verification time.

Recommended action: owner merge when ready. After merge, verify main CI and confirm the card appears only
for `total_pcbs_aroclor_1254` while the mass-based card remains unchanged.

Notes:
- This PR is additive and does not mutate catalog values or review status.
- If Unit Tests passes on the post-merge main run, count it as the next clean Node 22 confirmation run
  toward the 3-5 clean-run threshold for the former EPIPE/ForksPoolWorker flake.

### Post-merge regression coverage

Status: candidate small follow-up.

Recommended action: after #545 merges, decide whether the component tests are enough. If not, add one
narrow regression that asserts:

- total PCBs shows the mass-based card and the DL-PCB TEQ parallel card.
- the DL-PCB card shows the provisional/needs-review badge.
- a non-PCB substance does not show the DL-PCB card.

This is a low-risk AGY work item if scoped to tests only.

## Blocked On Primary Sources

### Phase C - Framework-A2 TEF/RPF verification

Status: blocked.

Required local source files:

- WHO-2005 / Van den Berg 2006 TEF evaluation.
- WHO-1998 / Van den Berg 1998 TEF/RPF evaluation.
- Health Canada PQRA H129-108-2021 source for the HC PQRA PAH RPF table.

Current local reference preflight:

- `G:\My Drive\SABCS - Sediment Project\References` exists.
- `HC 2025 - Toxicological Reference Values TRV.pdf` is present.
- `2026 Ontario MECP TRVs.zip` is present.
- Likely WHO-2005, WHO-1998, PCB-specific TEF source files, and HC PQRA H129-108-2021 are not present by
  filename search.
- `DQRA HC final draft Feb 2009.pdf`, FCSAP manuals, and dioxin BSAF PDFs are present but are not the
  missing primary TEF/PQRA sources.

Recommended action: owner supplies the three primary PDFs above, then rerun source acquisition preflight.
Do not flip TEF editions or RPF QA status until citation-grade source access passes.

## Owner Decision Required

These are real owner decisions, not autonomous implementation tasks.

- `phenylmercuric_acetate`: owner previously approved an `organomercury` class. Remaining work is
  mechanical enum/library wiring, but it should be a separate scoped PR because it changes a shared
  type/classification surface.
- PCB key housekeeping: optional alias/deprecation of `polychlorinated_biphenyls_total_pcbs`. Do not
  delete rows. Any Option A aliasing must account for existing eco FCV and BC Protocol 28 catalog rows.
- Cyanide speciation cluster: requires policy decision before wiring.
- Inhalation-only schema gap: 48 substances require schema and calculator support, not a quick catalog
  edit.
- Ontario MECP TRV ingestion: source archive is present locally, but ingestion requires owner approval
  and a separate source-specific plan.

## Superseded Or Corrected

- Any handoff text saying `#540`, `#541`, `#542`, or `#543` are pending is stale. They are merged on
  `origin/main`.
- Any D3 plan that treats PCB Option A as a reducer/data-layer coding task is stale. D3 is closed at the
  data layer; runtime DL-PCB scoring belongs to A3.
- Node 24 Unit Tests guidance is stale for the Unit Tests job. The job is now pinned to Node 22; fallback
  if EPIPE recurs on Node 22 is 8 shards, not `maxWorkers=2`.

## Recommended Next Sequence

1. Owner merge `#545`.
2. Verify post-merge main CI and DL-PCB card behavior.
3. Add a narrow regression test PR only if existing `#545` tests/evidence are insufficient.
4. Wait for owner-provided WHO-2005 / WHO-1998 / HC PQRA PDFs before resuming Phase C.
5. Pick one owner-decision item for a separate plan: `organomercury` class wiring is the smallest
   plausible next implementation PR.

## Autonomy Notes

- Safe for Codex+AGY: source inventory scripts, docs consolidation, narrow tests, and bounded UI/test
  hardening.
- Not safe without owner approval: merges, catalog value/status flips, Supabase writes, Gate 2B work,
  engine-v2 paths, or PCB alias/catalog migration.
