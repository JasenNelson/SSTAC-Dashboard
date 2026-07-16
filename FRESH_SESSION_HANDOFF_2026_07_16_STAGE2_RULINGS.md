# FRESH SESSION HANDOFF -- 2026-07-16 (Stage 2 rulings + prepped applies)

Matrix-Options top-50 continuation. Plain ASCII. VERIFY load-bearing claims against live git/gh before trusting.

## 0. Baseline (verify live first)
- `origin/main` = **c5b32fb9afdd206144d8bd213d74d115dd708f97** (verified live this session; PRs #659-#665 merged).
- Work worktree: `C:\Projects\SSTAC-Dashboard-worktrees\top50-stage2-2026-07-16`
  (branch `feat/top50-stage2-2026-07-16` off origin/main; node_modules junctioned; `.env.local` copied).
- Primary checkout is STALE (`deede52`, ~9 days behind) -- do NOT use it; branch new work from origin/main.
- Authoritative rulings: `docs/STAGE1_DECISION_LOG_2026_07_15.md` (Stage 1) + this worktree's
  `STAGE2_DECISION_LOG_2026_07_16.md` (Stage 2, append-only).

## 1. What this session did (decision-gated Autonomous Multi-Hour)
- Plan (`~/.claude/plans/explore-code-base-and-imperative-honey.md`) codex-GREEN after 3 holistic rounds.
- Extracted 3 owner HITL rulings + prepped 2 owner-gated dry-run apply scripts (STOPPED for --apply).
- No autonomous production write; no catalog --apply; no code PR (PCB chain stayed blocked).

## 2. Rulings this session (all PRODUCTION-WRITEs need a SEPARATE exact-op approval)
- **Copper #18**: promote CONFIRMED already done (HC 0.426 current_default, commit 27a5d72). Dispose
  follow-up prepped: `scripts/matrix-options/promote-copper-hc0426.mjs` disposes 6 rows (4 P28 + 2
  scaffold) needs_review->superseded (top-level + nested evidence). Scaffold rows verified = 0.426
  (not the stale "0.04"). OWNER runs `--apply`. GUARD-TEST COUPLING: the apply PR MUST also edit 3
  tests (catalog.test.ts P28-pending; library.test.ts scaffold x2) that assert these rows stay
  needs_review -- they break on apply; ship the edits in the SAME PR.
- **IRIS #17**: RULED supersede all 41 alternates (keep 20 verified canonical siblings). Prepped:
  `scripts/matrix-options/supersede-iris-17-alternates.mjs` (41 rows, human_health_trv_values.json
  only). NO guard-test coupling (no test asserts these stay needs_review). OWNER runs `--apply`.
  PFDA anomaly RESOLVED: live EPA IRIS chronic RfD = 2e-9 = the approved canonical (CORRECT; the
  higher alternates were the errors). No correction needed.
- **PCB QP #15**: OWNER RULED = REQUEST MORE DATA (after a codex consult that recommended the same).
  PCB re-key (#13 D3) + relabel + HH-default switch REMAIN BLOCKED. #23 dl-PCB TEQ full integration
  stays gated (depends on D3). Verified for the follow-up: BOTH HC 1.0e-5 (`pv-hc-pcb-hh-*-rfd-nondioxin`)
  AND IRIS 2.0e-5 (`pv-iris-pcb-hh-*-rfd-aroclor1254`) already exist as approved available_option under
  `total_pcbs_aroclor_1254` (neither current_default); FCV 0.014 exists twice (pv-pcb-fcv in
  parameter_values.json + the eco_values.json NRWQC row).

## 3. Owner action queue (owner-only; NONE are autonomous)
1. Review + `--apply` the copper dispose script (#18) -- then commit JSON + the 3 coupled test edits
   together (same PR); full gates; codex; merge.
2. Review + `--apply` the IRIS supersede script (#17) -- clean standalone; full gates; codex; merge.
3. PCB #15 data request (to lift the block on #13/#15/#23): site PCB analytical basis + dominant
   Aroclor/congener (homolog) profile + site-weighted (or lower-Kow sensitivity) logKow + a deliberate
   HC-1.0e-5-vs-IRIS-2.0e-5 HH-default call + reconcile the two FCV rows.
4. Still-pending owner-only from prior handoff: IOCO publish flip (#7); T40 admin user + E2E_ADMIN_*
   secrets (#29); RLS-bypass hardening migration (#27).

## 4. Shipped this session
- Report-ready PR (docs + 2 inert dry-run scripts, no-write): see PR_MANIFEST.md. Owner merges.

## 5. Remaining top-50 (see docs/SSTAC_TOP50_RECONCILED_2026_07_15.md)
- Unblocked-by-apply once owner runs the 2 scripts: catalog hygiene for copper #18 + IRIS #17 complete.
- Blocked-on-PCB-data: #13 (D3), #15 (QP attest), #23 (dl-PCB TEQ full).
- Untouched lanes: DRA coordinate extraction (#24/#25), inhalation (#30/#31, parked), Tier 8 HITL
  groups (#32-36), verification gaps (#37/#38), reg-review/engine-v2 (#39-43), hygiene (#44-50).

## 6. Closeout fields
- Claude-token spend risk for next step: low (owner-gated applies + a data request; no heavy code).
- AGY delegation opportunity: yes (future dispose/promote scripts, the PCB data-request doc scaffold).
