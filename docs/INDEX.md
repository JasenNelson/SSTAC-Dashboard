# Documentation Index (Canonical)

This file is the **single canonical entrypoint** for project documentation.

- **Docs manifest (authoritative)**: `docs/_meta/docs-manifest.json`
- **Facts policy (volatile metrics)**: Volatile metrics (test counts, grades, etc.) must live in the manifest under `facts`.

## How to use this repo’s docs (humans + AI)

1. Start here.
2. Use the manifest to determine which docs/sections are required for your change.
3. Do not trust “current” claims or metrics found elsewhere unless they are explicitly labeled historical and dated.

## Gate system (deterministic doc review)

To resolve which documentation must be reviewed for a given change, run:

- `npm run docs:gate -- --base origin/main --head HEAD`

This uses `docs/_meta/docs-manifest.json` to map changed code paths → required docs/sections, and fails if required headings drift.

If you don’t have `origin/main` locally (or you want to force a specific check), you can pass explicit files:

- `npm run docs:gate -- --files src/app/api/polls/submit/route.ts`

### API Gate (lightweight)
Triggered by any change under `src/app/api/**`.

**Required**:
- `docs/AGENTS.md`
- This index (`docs/INDEX.md`)

### Polling Gate (strict)
Triggered by poll-adjacent changes (poll APIs, poll UI, admin poll results, matrix graph polling endpoint).

**Critical rule**: The three poll systems are independent (single-choice, ranking, wordcloud). Any poll-adjacent change must review **all three systems**, every time.

**Required (authoritative poll docs)**:
- `docs/poll-system/POLL_SYSTEM_COMPLETE_GUIDE.md`
- `docs/poll-system/SAFE_POLL_UPDATE_PROTOCOL.md`
- `docs/poll-system/POLL_SYSTEM_DEBUGGING_GUIDE.md`
- `docs/poll-system/CEW_DATA_FLOW.md`

The exact required sections are enumerated in `docs/_meta/docs-manifest.json` under `bundles.POLLING_GATE.requires_sections`.

## Canonical documentation sets

### Core safety + operational rules (authoritative)
- `docs/AGENTS.md`

### Poll system (authoritative)
- `docs/poll-system/README.md`
- `docs/poll-system/POLL_SYSTEM_COMPLETE_GUIDE.md`
- `docs/poll-system/SAFE_POLL_UPDATE_PROTOCOL.md`
- `docs/poll-system/POLL_SYSTEM_DEBUGGING_GUIDE.md`
- `docs/poll-system/CEW_DATA_FLOW.md`

### System design (reference)
- `docs/system-design/README.md`
- `docs/system-design/MATRIX_GRAPH_VISUALIZATION.md`

### Testing (reference; avoid volatile counts)
- `docs/testing/README.md`

### Review-analysis (reference/historical mix)
- `docs/review-analysis/README.md`
- `docs/review-analysis/NEXT_STEPS.md`
- `docs/review-analysis/REVIEW_SUMMARY.md`
- `docs/review-analysis/archive/` (historical records)

### Operations (reference)
- `docs/operations/VERCEL_SETUP.md`
- `docs/operations/MONITORING_GUIDE.md`

## Legacy index

- `docs/README.md` is a legacy index. It should not be treated as canonical.
