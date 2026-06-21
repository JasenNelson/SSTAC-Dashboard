# Fresh-session handoff -- SSTAC-Dashboard matrix-options lane -- 2026-06-12 (checkpoint @ 94% context)

Plain ASCII only. Single anchor for the next session in this lane. Read L0 (C:\Projects\CLAUDE.md)
+ SSTAC-Dashboard\CLAUDE.md + docs/GATE_MODE_SOP.md first. Owner: J. Nelson.
Supersedes FRESH_SESSION_HANDOFF_2026_06_11_MATRIX_OPTIONS_RECOVERY.md (deleted in this session's
lane-scratch cleanup; its content is all merged/in memory).

---

## 0. VERIFY STATE FIRST (state drifts; owner runs parallel sessions -- L0 1.6)

```
git fetch origin
git log --oneline -8 origin/main      # expect tip 60403b1 (#306), then 12b9e36 (#305), abef5b7 (#304),
                                       # 46d9827 (#303), 87edaf0 (#302), 7fa9869 (#301), 52c74c4 (#300)
gh pr list --state merged --limit 8    # expect #300-#306 all MERGED 2026-06-11/12
git status --short                     # primary should be CLEAN of tracked changes, synced to 60403b1
git worktree list                      # the 5 worktrees I created are cleaned; ~16 OTHER-lane worktrees linger (not mine)
```
If origin/main tip != 60403b1, STOP and reconcile (a parallel session may have shipped past this).

---

## 1. WHAT SHIPPED THIS SESSION (all merged to origin/main, VERIFIED)

Lane theme: Phase D HC PQRA v4.0 direct-contact catalog -> data -> live calculator -> CI hardening.

- **#300 (52c74c4)** -- Phase D EF/ED/AT direct-contact exposure factors (5 needs_review rows).
- **#301 (7fa9869)** -- BW_kg (5 age groups) + IR_sed_mg_per_day (3) direct-contact receptor rows.
- **#302 (87edaf0)** -- SA_cm2 (total-body, 6) + AF_sed_mg_per_cm2 (2) dermal rows; PLUS the C-3/C-4
  food-web BW promotions (pv-wlrs-2023-bw-adult-bc 70.7 + pv-epa-2000-bw-adult-us 70 -> approved).
- **#303 (46d9827)** -- collision fix: re-authored 4 stranded uncommitted LESSONS.md lessons + a
  docs-manifest facts entry that were blocking the primary checkout's ff-pull.
- **#304 (abef5b7)** -- chore: package-lock root engines `>=20.0.0` -> `22.x` (stop the recurring drift).
- **#305 (12b9e36)** -- DIRECT-CONTACT WIRING LIVE: HHDirectContactCalculator now seeded by the HC
  PQRA v4.0 residential-toddler receptor under the `canada-fcsap-aquatic` frame. Added
  promote-hc-pqra-direct.mjs (+37 tests; promoted the 7 toddler rows + the PQRA source, owner
  inline-approved); SEEDABLE_KEYS['human-health-direct'] = 7 factors + units; a FRAME_DEFAULT_PROFILES
  row; the 7-input calculator wiring (shared activeDirectDefaultFor/seedDirectFor helper). The 21
  PQRA rows now drive a live calculator (toddler 7 = active; other rows = needs_review alternatives).
- **#306 (60403b1)** -- CI DURABLE OOM FIX: the `unit-tests` job now runs vitest in 4 SEQUENTIAL
  shards (fresh process each) to bound the v8-coverage memory. Proven on its own CI run (no EPIPE).

Net catalog state: 21 HC PQRA v4.0 direct-contact rows; 7 (toddler scenario) + the PQRA source =
approved/direct_source_verified; the rest needs_review. library.test counts as of #305:
approvedSourceBacked 1229, pendingSourceLocator 386, valueGroups 1606, availableOptions 1606.

---

## 2. OWNER-PENDING / OPEN ITEMS (decide before auto-starting -- L0)

1. **The formal docs update (THIS session's lessons) -- QUEUED, do this FIRST next session.** Add the
   following NET-NEW lessons to docs/LESSONS.md (reverse-chron, date-ordered, then ship via the gated
   PR pipeline + refresh docs-manifest vitest_test_count -- it is flagged stale). The lessons:
   a. **2026-06-12 CI v8-coverage OOM is STRUCTURAL [CRITICAL]** -- maxWorkers=1 makes ALL files run in
      one process where v8 coverage accumulates an END-OF-RUN remap spike proportional to TOTAL modules
      (NOT a per-file leak; isolate:true reclaims per-file). The 8GB heap + maxWorkers=1 were ceiling-
      raises against a rising floor (suite+catalog grow every PR), so each re-crossed it; intermittent
      because v8 GC timing varies. DURABLE fix shipped #306: 4 SEQUENTIAL vitest shards (fresh process
      each, ~1/4 retention, freed on exit). MUST stay ONE "Unit Tests" job -- branch protection requires
      that check BY NAME (matrix would block all PRs). Coverage = per-shard json -> one multi-file
      Codecov upload (blob+--merge-reports = EMPTY coverage in vitest 4). Shard-by-FILE is imbalanced
      (shard 4 took ~19 of 24 min) -- future tuning, not required.
   b. **2026-06-12 ff-pull collision: plain `git restore`, not --source [HIGH]** -- when the primary
      checkout can't ff-pull because tracked files are dirty AND incoming commits changed them:
      preserve net-new local work by RE-AUTHORING in a worktree + gated PR (NOT stash/pop on main),
      then `git diff --cached --quiet` + plain `git restore -- <files>` (NOT `--source=origin/main`,
      which leaves files dirty-vs-HEAD so ff-pull still aborts) + pull. READ THE WHOLE DIFF (it was 4
      lessons, not 1). codex/Opus sandbox-proved the mechanics.
   c. **2026-06-12 PQRA v4.0 access [MEDIUM]** -- canada.ca 403s automated fetch; use the
      publications.gc.ca direct PDF + a browser User-Agent + `-e https://publications.gc.ca/` referer to
      bypass the GoC "Information Archived on the Web" interstitial. PQRA v4.0 =
      publications.gc.ca/collections/collection_2024/sc-hc/H129-114-2023-eng.pdf. Don't copy PDFs into
      the repo (L0 1.14); fetch to TEMP, read, delete.
   d. **2026-06-12 junction trap recurrence [HIGH]** -- I batch-removed a worktree with `git worktree
      remove` WITHOUT deleting its node_modules junction first -> git followed it and EMPTIED the shared
      store (npm ci recovered). EVERY worktree removal needs its OWN junction-delete-first, even in a
      batch where you JUST did a sibling worktree right. Do NOT batch-remove worktrees.
   (All four are already captured in MEMORY.md / memory files; the LESSONS.md write is the queued part.)

2. **More direct-contact receptor scenarios (owner-gated).** #305 wired the residential TODDLER as the
   default. The other 14 PQRA rows (infant/child/teen/adult BW; commercial/industrial EF/ED; worker
   IR_sed/SA/AF; per-age SA) are approved-able alternatives but NOT promoted/wired. FRAME_DEFAULT_PROFILES
   is one row per (frameId,pathway) -- a second scenario needs a different frame or a design change.

3. **Deferred dermal data (owner-gated):** per-region SA (hands/arms/legs/feet) + hands-specific soil
   loading + sediment dermal adherence (site-specific, HC 2017). Verified values are in the 2026-06-11/12
   subagent reports if a refined dermal model is built. Backup zip of removed scratch:
   C:\Projects\_sstac_mo_lane_scratch_backup_2026-06-12.zip (57 files); .tmp_collision_backup/ in repo.

4. **CI shard tuning (optional):** shard-4 imbalance (~19/24 min). Could tune shard count or balance, or
   (only if owner edits branch-protection required-check name) switch to a parallel matrix (~6 min).

5. **Carry-over already DONE this session:** WLRS IR applicability-stamp (no-op), BW promotions (#302),
   docs PR #296 (merged), package-lock drift (#304). Nothing left from the prior recovery handoff.

---

## 3. STANDING DIRECTIVES (HIGH AUTHORITY -- do not violate)

- **Inline approval IS the attestation** (owner 2026-06-12, memory feedback_inline_approval...): owner
  approves catalog promotions INLINE in chat; AI dry-runs first, shows before/after, then on inline
  approval RUNS `promote-*.mjs --apply --reviewer "J. Nelson" --date <today>` ITSELF (from
  C:\Projects\sstac-dashboard, NOT Regulatory-Review) + ships it. Do NOT make the owner run PowerShell.
  Still never promotes on AI's own judgment / silently.
- **AI finds + verifies values, not HITL** (memory feedback_ai_finds_and_verifies...): AI searches repo
  inventories + Zotero(localhost:23119) + G:\References + OneDrive + web, verifies against the PRIMARY,
  only escalates if truly not found.
- **PQRA v4.0 (NOT DQRAChem) has the operationalized HC defaults** (Table 2 = exposure duration/frequency;
  Appendix E = receptor characteristics). DQRAChem 2009 = framework/equations only (a subagent wrongly
  concluded "HC has no defaults" from it).
- codex two-tier + 4(6)-gate before push; ship-protocols proactively; path-scoped staging; ASCII <=127.

---

## 4. HOW-TO / PATTERNS THAT WORK (session-to-session continuity)

### 4.1 Frame-default seed for a NEW pathway (the #305 pattern -- reusable)
1. Locate+verify values vs the PRIMARY; add needs_review rows (mirror an existing row field-for-field;
   evidence_items need reviewed_by/at:null).
2. Author promote-<src>-<scope>.mjs (mirror promote-wlrs-bw-default.mjs: fail-closed pre-check, dry-run
   default, --apply, +~30 tests). IMPORTANT: promote BOTH the value records AND the SOURCE record's
   canonical_source_status -> direct_source_verified (isDirectCurrentSource checks the source; absent =
   blocked even after value promotion).
3. frameDefaults.ts: SEEDABLE_KEYS[pathway] += keys; SEEDABLE_KEY_UNITS += units; a FRAME_DEFAULT_PROFILES
   row (frameId must support the pathway with status != 'unsupported' and 'general' in eligibleCatalog-
   Jurisdictions -- canada-fcsap-aquatic works for human-health-direct).
4. Calculator wiring (mirror HHFoodWebCalculator BW): BASELINE consts (= prior useState defaults), one
   shared activeXDefaultFor/seedXFor helper, lazy useState seeds, ONE during-render reseed guard
   (jurisdiction != prevJurisdiction; reseed each input if still == old seed; setPrevJurisdiction once --
   NOT a useEffect), useMemo active default + isFrameDefault bool, data-testids + label + reset button,
   provenance switches to 'source-backed default' when isFrameDefault.
5. Tests: frameDefaults.test (SEEDABLE_KEYS assertion + "others empty" exclusion), integration
   (profile count +1, seeds resolve ACTIVE post-promotion), library.test (approvedSourceBacked +N,
   pendingSourceLocator -N from promotion), calculator test (label/reset testids).
6. Use SUBAGENTS for the big files (promote helper = sonnet; calculator wiring = opus) + the scope
   exploration, to protect orchestrator context. Commit incrementally.

### 4.2 Gates + codex + ship
- 6-gate push protocol SERIALIZED (never build+e2e concurrently in one worktree): lint, `npx tsc --noEmit`,
  `npm run test:ci`, `npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10`,
  `npm run test:e2e`, `npm run docs:gate`. CI Unit Tests now ~24-30 min (sharded). codex two-tier; prefer
  the native `codex review --commit <sha>` / `--base origin/main` form (file-captured; grep the verdict,
  never tail). The CI "Unit Tests" v8-coverage OOM can STILL flake near the (now-sharded) ceiling -- on a
  RED unit job with `write EPIPE` + no summary, it's the OOM, not a code failure: `gh run rerun <id>
  --failed`. The watch (`gh pr checks N --watch`) exit 0 does NOT mean pass -- always re-check `gh pr
  checks N`.
- Worktrees: junction-safe (L0 1.15). Create: `git worktree add <path> -b <branch> origin/main` +
  PowerShell `New-Item -ItemType Junction` (NOT bash mklink) + cp .env.local. CLEANUP per-worktree:
  PowerShell delete the junction FIRST, verify shared count unchanged (~723), THEN `git worktree remove`.
  NEVER batch-remove. For YAML/docs-only worktrees, skip the junction (no npm needed) -> removal is safe.

### 4.3 Branch protection (Opus queried live 2026-06-12)
Required checks are EXACTLY: "Lint & TypeScript Check", "Unit Tests", "Production Build", "E2E Tests"
(strict:false). "CI Status Check" is NOT required. So renaming any of those 4 (e.g. via a matrix) blocks
all PRs until the OWNER edits branch protection.

---

## 5. KEY FILES
- src/lib/matrix-options/frameDefaults.ts -- SEEDABLE_KEYS, SEEDABLE_KEY_UNITS, FRAME_DEFAULT_PROFILES
  (now has bc-protocol1-v5-dra + canada-fcsap-aquatic rows), resolveSeed, getActiveFrameDefaults.
- src/components/matrix-options/HHDirectContactCalculator.tsx (#305 wiring) + HHFoodWebCalculator.tsx (template).
- scripts/matrix-options/promote-hc-pqra-direct.mjs (+ promote-wlrs-bw-default.mjs = the helper template).
- matrix_research/reference_catalog/{parameter_values.json, sources.json} -- the catalog.
- src/lib/matrix-options/provenance/__tests__/library.test.ts -- audit-count guardrail.
- .github/workflows/ci.yml -- the sharded unit-tests job (#306).
- vitest.config.ts -- maxWorkers:1 (CI) + coverage.reporter ['text','json','html'].
- Memory: MEMORY.md index -> dashboard_phase_d_hc_pqra_direct_contact_2026_06_11.md (the lane record,
  covers #300-#306), feedback_inline_approval..., dashboard_ffpull_collision_restore_mechanics_2026_06_12.

---

*Checkpoint authored 2026-06-12 at 94% context. State: origin/main = 60403b1 (#306); #300-#306 all
merged; primary checkout clean + synced. NEXT SESSION first task: the queued docs/LESSONS.md + manifest
update (section 2 item 1). Everything else is owner-gated scope (section 2).*
