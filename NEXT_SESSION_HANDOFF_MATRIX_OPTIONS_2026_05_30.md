# Matrix-Options session handoff -- 2026-05-30 (fresh session resume)

Plain ASCII. Working dir: `C:\Projects\SSTAC-Dashboard` (PRIMARY checkout, in-place branches).

## Merged to main today
- #196 live-merge promoted catalog data into Evidence Library
- #197 Catalog Staging Review click-to-review affordance
- #200 References & Values IA redesign (tabs -> Values+Sources, row-click inspect)
- #201 bulk-approve staging rows (admin button + `catalog_approve_staging_rows_bulk` RPC; migration ALREADY applied live; owner used it: approved 18 / skipped 261 dupes / 0 failed)
- #202 panel rebalance (filters left, dashboards right at-rest)

## OPEN draft PR -- #203 (RESUME HERE)
Branch `fix/matrix-options-references-layout-2026-05-30` (pushed, tip c508ca8). The full
References & Values UX overhaul: scrollbar/layout fixes, column proportions, tab order
References+Values, **filter popover** + lean filter set (Substance/Pathway/Parameter/Jurisdiction;
refs: Authority/Source role/Currentness), **dynamic/contextual facet counts**, **user-saved views**
(localStorage, "Save current" button; removed broken seed presets), **right-panel REFERENCES
inventory** (sources list + linked-value count + checked date; status/QA/admin demoted to a
collapsed "Catalog status & admin" section).

Gates: tsc 0, lint 0, unit 2659, build 0. **e2e NOT re-confirmed on the final commits** -- the
suite needs port 3000 which was held by the owner's dev server + parallel Claude sessions,
causing collisions (a 9.5h zombie e2e shell resulted). Last clean e2e on this branch = 138
passed; the commits since are component-internal (e2e smoke/poll/SSD doesn't exercise them).
**ACTION: stop all dev servers, run `npm run test:e2e` ONCE on a free port 3000, confirm GREEN,
then owner merges #203.**

codex: each piece reviewed (mostly GREEN). YELLOWs addressed. Final 2 fixes (selectedSource
baseline fallback + loadSavedViews validation) are Opus-self-reviewed (codex backend was
intermittent) -- queued in `C:\Users\jasen\.claude\projects\C--Projects-Regulatory-Review\memory\codex_rereview_queue_2026_05_17.md`.

## Phase 2 / follow-ups (owner-gated)
- Per-reference full/partial retrieval status + retrieval/source/QA **dates** in the inventory
  -> NEW catalog fields (Supabase migration + extract.py emission + owner data decisions).
- Optional Supabase persistence for saved views (currently localStorage / per-browser).
- Contextual facets for source-side filters constrained by promoted-only values (pre-existing).
- Equations -> Jurisdictional Frameworks tab (the workflow mapper didn't return cleanly; re-map).
- Draggable panel widths (workflow scoped it: reuse MatrixDashboard's matrix-map resize pattern).
- Catalog DATA lanes (proposals_canonical/*.sql paste, eco-soil staging, substanceLibrary
  18->294, held data-decisions) -- owner-gated, on feat/catalog-data-backlog.

## PROCESS / SAFETY NOTES (important)
- Owner runs MULTIPLE parallel Claude sessions. DO NOT mass-kill node/python or run
  cleanup-orphans -- you will kill other sessions' work. Leave node processes alone.
- e2e (Playwright) needs port 3000; it collides with any running `npm run dev`. Run e2e only
  when port 3000 is free; never fire it repeatedly (it zombies).
- There were ~21 node processes + a 9.5h zombie e2e shell at handoff (from e2e/dev port
  collisions). Owner to clear via the UI "Background tasks" panel; do not blanket-kill.
- Gate channel: codex CLI backend intermittent (drops mid-review); cursor-agent at monthly Pro
  limit (resets 2026-06-15). Use codex CLI `codex exec` default model when up; else Opus + queue.
- `.tmp/catalog-paste/` holds extracted canonical SQL + d0c00005/d0c00012 chunk folders (owner
  paste source). Bulk-approve in Supabase = the DO-block (set_config jwt claims) or the new
  "Approve all pending" button (#201, live).

## Memory anchors
- [[dashboard-matrix-options-lane1-livemerge-2026-05-30]] (resume pointer; update for #203)
- [[reference-cursor-agent-cli]], [[feedback-never-remove-item-recurse-on-junction]]
