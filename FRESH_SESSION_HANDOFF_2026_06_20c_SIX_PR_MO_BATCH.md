# Fresh Session Handoff -- 2026-06-20c (6-PR matrix-options batch + housekeeping)

Current continuity anchor. Supersedes FRESH_SESSION_HANDOFF_2026_06_20b_CATALOG_EXPANSION_COMPLETE.md
(still at root, tracked). Plain ASCII only.

## Shipped this session (6 PRs, ALL OPEN awaiting owner merge + GitHub CI)

Started at main = `0397273` (#364). Each PR: ground-truth + web verification -> codex (gpt-5.5 xhigh)
mutual-agreement GREEN -> gates. NOTHING promoted (all build-first needs_review; no qa_status writes).
Authoring was parallelized via a Workflow (3 lanes in isolated worktrees) + a focused agent for Batch F.

1. **#365 (CAS map)** -- ETL substance_cas_map 49 -> 51: nonylphenol `84852-15-3` (owner-decided
   branched-technical) + methyl_mercury `22967-92-6`. Both web-verified. Python-only (16 unittests).
2. **#366 (Carcinogen both-endpoints)** -- populate the non-cancer RfD for HCB (8.0e-4), PCP (5.0e-3),
   1,4-dioxane (3.0e-2) in SUBSTANCE_LIBRARY so both cancer-SF and non-cancer-RfD are selectable (the
   calculator + derivations.pickHumanHealthEndpoint already pick the more conservative). Library-only,
   no manifest bump. 6 gates GREEN.
3. **#367 (C3 ETL all-345-sites dry-run)** -- generalize the ETL: resolve_site_ids / per-station
   resolve_station_coord / `--site-ids` seam / build_sql(site_ids=...) / dynamic tier counters /
   station_ids chunking / defaults repointed to DB2 + the committed FULL centroid CSV / source DB
   opened read-only (immutable=1 only for the canonical DB2). 53 Python unittests (19 new). NO load.
   codex caught + fixed 2: read-only open of the G: DB2 (P1), reserve immutable=1 to DB2 (P2).
4. **#368 (PR5 promote scripts)** -- new owner-run `promote-hc-pqra-lifestage.mjs` (6 HC PQRA v4
   lifestage BW/SA rows) + `promote-wlrs-low-level.mjs` (1 WLRS IR-food row). Fail-closed guards;
   dry-run default. NOT applied. vitest 4211 -> 4283 (+72). 6 gates GREEN.
5. **#369 (D17 archive)** -- moved 38 stale untracked root scratch docs into
   `docs/archive/root-scratch-2026/`. docs:gate PASS.
6. **#370 (Batch F PFOA/PFOS)** -- 4 needs_review direct-source rows (PFOA 3e-8, PFOS 1e-7
   mg/kg-bw/day; value_text verbatim from the EPA PDFs). Two per-document pinned sources
   (`src-us-epa-pfoa-2024` 815-R-24-006 / `src-us-epa-pfos-2024` 815-R-24-007). Reuses the existing
   keys (perfluoroctanoic_acid_pfoa misspelled + perfluorooctane_sulfonate). Catalog-only;
   needs_review/pending. 4 codex rounds. tsc/lint/test:ci GREEN on final tip; build/e2e GREEN on the
   prior functionally-identical tip (final delta = catalog data + 1 test assertion).

Housekeeping: **MEMORY.md consolidated 56KB -> 16.6KB** (dropped 4 self-declared SUPERSEDED entries,
trimmed every index line to a one-line hook; all links preserved).

## Owner decisions captured this session
- nonylphenol CAS = `84852-15-3` (branched-technical). [shipped #365]
- Carcinogen endpoints = BOTH SF + RfD selectable for HCB/PCP/1,4-dioxane. [shipped #366]
- Promotions = sweep all source-verified needs_review rows -> reality = 7 rows (tooling shipped #368).
- PFAS source precedence = US EPA 2024 (not Health Canada). [shipped #370]

## HITL / owner-gated outstanding (next session)
- **Merge the 6 open PRs** (#365-#370) after GitHub CI green. After each merge, open PRs go behind base
  -> `gh pr update-branch <n>` before merge; `--match-head-commit <full-sha>`. CI ~40 min/PR; rerun
  `--failed` on the write-EPIPE OOM flake.
- **Promotions (inline-approval = attestation):** PR5 (#368) scripts are ready to promote the 7 HC PQRA
  lifestage + WLRS-low-level rows -- dry-run shown clean; on inline approval run promote-*.mjs --apply.
  The new carcinogen RfD rows (#366 wired from catalog) and the PFOA/PFOS rows (#370) remain
  needs_review -> promote when owner attests.
- **PFOA/PFOS substanceLibrary wiring** deferred (kept #370 catalog-only / independent of #366). Wire
  PFOA/PFOS into SUBSTANCE_LIBRARY in a follow-up once #366 + #370 are on main.
- **Map DATA LOAD (Supabase)** still gated on D-dates (relax event_date nullable vs impute) +
  D-visibility (public=false). C3 (#367) is the dry-run generator; no load. Artifact:
  docs/design/matrix-map/PR_MAP_8_LOAD_DECISION_REPORT.md. Supabase MCP dead -> owner pastes chunked SQL.
- **More CAS map expansion / WIRE batches / Batch E source-pinning** -- the remaining ~107 needs_review
  ETL substances (dioxin/furan, other chlorophenols, organotins) + ~18 pending_owner_export sources.

## Lessons / load-bearing facts
- Parallel authoring via the Workflow tool (isolated worktrees, each commits its lane branch) works
  well for independent lanes; the orchestrator gates + pushes. CI (~40 min/PR) is the real throughput
  floor, not authoring.
- A worktree-authoring agent can't run vitest (no node_modules) -> validate catalog-data PRs in the
  PRIMARY checkout. Best done by overlaying the branch's files onto main (`git checkout <branch> -- <paths>`)
  + test:ci, avoiding a branch checkout when the worktree holds it.
- **Do NOT json.dump round-trip a big catalog JSON** to make small edits -- it reformats ~100+ lines
  (number re-serialization). Use block-scoped string replacement bounded to the new-row block.
- codex catches catalog-coupling that worktree agents miss: invalid EvidenceLocatorType (use
  source_section, not source_text); needs_review rows must keep evidence_support_status=pending_source_locator
  + canonical_source_status=needs_direct_source_check until promotion (premature approved_source_backed +
  direct_source_verified makes getParameterValueReviewDisposition mislabel as "Approved alternative");
  one-source-per-document (a combined source record renders only one URL); US EPA rows = jurisdiction
  US_federal (not general, else Canada/CCME-eligible after promotion); bump library.test.ts hard-coded
  counts (valueGroups/approvedSourceBacked/pendingSourceLocator/availableOptions) when adding catalog rows.
- vitest local test:ci count is INFLATED by leftover `.tmp/review-<sha>` codex scratch (duplicate test
  files) -- subtract those for the true CI count; CI (clean checkout) never sees `.tmp`.
- Worktree removal hit recurring `Permission denied` (Windows lock on the agent worktrees, likely the
  large `.tmp` PDFs / AV). Branches pushed fine regardless. CLEANUP TODO (below).

## CLEANUP TODO (owner / next session)
- Prune the leftover workflow/agent worktrees that failed to remove this session:
  `.claude/worktrees/c3fix` and `.claude/worktrees/agent-a726a7f4af0bb5d30` (both node_modules-free,
  junction-safe). Try `git worktree remove --force` after the lock clears, then `git worktree prune`.
- ~28 tracked older root docs remain (e.g. STREAM_*, NEXT_SESSION_2026_05_28*, AUTONOMOUS_SESSION_SUMMARY)
  -- out of D17 untracked-scratch scope; a tracked-file archive move needs separate owner sign-off.

## Pointers
- Plan file: `~/.claude/plans/explore-code-base-and-encapsulated-cookie.md` (this session's approved plan).
- Gate discipline: `docs/GATE_MODE_SOP.md`. Roadmap: `docs/MATRIX_OPTIONS_CONSOLIDATED_PLAN_2026_06_16.md`.
