# FRESH SESSION HANDOFF -- 2026-07-15 (Stage 2 resume anchor)

Matrix-Options top-50 continuation. Plain ASCII. VERIFY load-bearing claims against live git/gh before trusting.

## 0. Baseline (verify live first)
- `origin/main` = **09b1686** (after PR #659 CSRF fix merged this session; verify `gh api repos/JasenNelson/SSTAC-Dashboard/branches/main --jq .commit.sha`).
- **PR #660 OPEN** (docs-only; owner-merge): Stage 0/1 decision docs. codex-GREEN (grind, 4 rounds). No src change.
- Work worktree: `C:\Projects\SSTAC-Dashboard-worktrees\top50-continue-2026-07-15` (branch `feat/top50-continue-2026-07-15`, node_modules junctioned, `.env.local` copied). Primary checkout still STALE -- do NOT reset; branch new work from `origin/main`.

## 1. What this session did
- Stage 0: merged #659 (unblocks prod DRA publish); fresh worktree; AGY authored `docs/SSTAC_TOP50_RECONCILED_2026_07_15.md` + `docs/WORKTREE_HYGIENE_TRIAGE_2026_07_15.md` (verified).
- Stage 1: 10 owner rulings in `docs/STAGE1_DECISION_LOG_2026_07_15.md` (AUTHORITATIVE) + AGY packet `docs/STAGE1_DECISION_PACKET_2026_07_15.md`. Orchestrator verified every load-bearing value vs cited sources; corrected 2 AGY errors (S1 rationale, S9 write-class) + 2 stale framings (S3, PCB label).

## 2. Rulings -> Stage 2 work (all PRODUCTION-WRITEs need a SEPARATE exact-op approval)
- **#9 Cd/MeHg**: confirmed HC defaults (0.0008 / 0.0002). No write.
- **#7 IOCO publish**: APPROVED. OWNER ACTION: in-app flip at `/admin/matrix-map/publish` (dra `ea15e94a-b093-4cb4-bd4d-80ab9eae16d4`, public false->true). #8 resolved (read-back #642 + #659).
- **#12 BaP anchor**: keep EPA 2.0. No write.
- **#13 PCB**: Option A + RELABEL row `aroclor_1254` -> "Total PCBs" (provenance notes) + Decision-2 convention. Library relabel = Stage 2 code (no data write); catalog re-key BLOCKED behind #15.
- **#15 PCB QP**: NOT attested. AUTHORIZED: AGY drafts a QP protectiveness packet (site congener vs FCV 0.014/logKow 6.5 EqP benchmark + non-coplanar RfD). No write.
- **#16 multi-bin ADAF API**: BUILD (`src/lib/matrix-options/cumulative.ts` computeBaPeq -> `{ageBin,exposureFraction}[]`, EPA default ADAF bins). Unblocks #22. Stage 2 code.
- **#17 IRIS 41 alternates**: per-group, VERIFY counts vs live catalog FIRST (AGY inventory script). No write yet.
- **#18 copper**: promote HC 0.426 to current_default + dispose P28 0.09/0.141 + 0.04 starter. PRODUCTION-WRITE (Stage 2 Lane B, T32 fail-closed template + exact-op approval).
- **#19 catalog count**: adopt live 13/31/85; park the untraceable "20". No write.

## 3. Stage 2 lanes (AGY writes code/scripts, orchestrator gates + codex, owner merges; ONE write surface per PR)
- **Lane A**: cumulative-effects UI (#22) + multi-bin ADAF (#16). D1 done + D2 EPA 2.0 confirmed + D3 ruled -> unblocked. No data write. `src/lib/matrix-options/{equationDispatch,cumulative}.ts` + component.
- **Lane B**: copper HC 0.426 promote (#18) -- catalog PRODUCTION-WRITE, fail-closed template, exact-op approval.
- **Lane C**: DRA publish read-back extend (#26). Code-only.
- **Lane D**: deprecated run-engine route (#43) -- NOT cheap: live caller `RunEngineButton.tsx` + `src/types/api.ts` + `docs/API_REFERENCE.md` ripple.
- **Lane E**: PCB library relabel (#13, no data write); Agents-tab copy (#44); IRIS inventory (#17) + count re-verify (#50).
- **AGY drafts (no write)**: QP packet (#15); IRIS inventory script (#17).

## 4. Owner actions pending
1. Merge PR #660 (docs).
2. IOCO in-app publish flip (#7).
3. Pick Stage 2 lane order (recommend A first -- highest completion leverage, no data write).

## 5. Guardrails / config
- AGY: model "Gemini 3.1 Pro (High)"; write-allowlist covers `C:\Projects\SSTAC-Dashboard-worktrees`; brief -> `.tmp_agy_brief_*.md`, verify via git diff + acceptance, never trust closeout. AGY has NO web access (not a live-source verifier).
- Gates: `/codex-review` targeted per commit (grind -> 5.5-xhigh for code); full 4-gate suite before any code push (`npm run lint` / `test:ci` / `build:monitored:clean` / `test:e2e`).
- Supabase writes: current AGENTS.md protocol (preflight -> exact owner-approved exec -> postflight -> closeout), NOT the stale "MCP fails 100%" ban.
- Token posture: AGY-first mechanical; Sonnet subagents when Claude-internal; Opus only for codex iteration + HITL synthesis. Claude budget ~60% used (day 3/7) at session start.

## 6. Closeout fields
- Claude-token spend risk for next step (Stage 2 Lane A): medium (code gating). AGY delegation opportunity: yes (Lane A code, QP packet, IRIS inventory all AGY-writes).
