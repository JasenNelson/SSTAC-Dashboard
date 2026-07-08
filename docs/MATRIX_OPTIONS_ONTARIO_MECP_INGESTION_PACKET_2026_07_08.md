# Matrix Options Ontario MECP Ingestion Packet - 2026-07-08

## Verdict

Do not ingest Ontario MECP TRVs during the autonomous run.

The source packet exists locally, but ingestion is not scoped. It would create or reconcile
catalog-derived toxicity values and therefore crosses the current run's no-catalog-mutation boundary.
The correct next step is a dedicated source-inventory and extraction design, not ad hoc value wiring.

## Local Source Evidence

Reference root checked:

```text
G:\My Drive\SABCS - Sediment Project\References
```

Ontario-related files found:

- `2026 Ontario MECP TRVs.zip`
- `Ontario Benchmarks table7.pdf`
- `Ontario Sediments (std01_079844).pdf`
- `Ontario 93-contaminated-sediments-en.pdf`

The `2026 Ontario MECP TRVs.zip` file is present and readable. Read-only zip inspection found:

- `_MECP list of TRVs, RAFs, & SAFs 2026.pdf`
- `all MECP TRV, SAF, & RAF documents 2014-2026.zip`

The outer archive contains a PDF index plus a nested archive. That shape means ingestion should start
with a file inventory and extraction plan, not direct catalog edits.

## Why This Is Separate From Phase C

Phase C TEF/RPF verification remains blocked on missing WHO/HC primary PDFs. The Ontario MECP source
packet is present, but it is not a substitute for:

- WHO-2005 / Van den Berg 2006 TEF source
- WHO-1998 / Van den Berg 1998 TEF/RPF source
- Health Canada PQRA H129-108-2021 source

Ontario MECP ingestion is therefore a separate source-ingestion lane, not a Phase C unblocker.

## Why This Is Not Autonomous Wiring

Ontario MECP TRV ingestion may affect:

- human-health toxicity candidate rows
- source records and locators
- jurisdiction/default-selection behavior
- source-priority conflicts with Health Canada, IRIS, BC Protocol 28, or other sources
- catalog counts and tests

Those are catalog-derived data changes. They need a reviewed ingestion plan, dry-run inventory, and
owner approval before any values become runtime candidates or defaults.

## Recommended Future Plan

Create a dedicated `Ontario MECP TRV ingestion` plan/PR sequence:

1. Extract the outer zip into a scratch directory outside the repo.
2. Inventory the nested archive without modifying repo files.
3. Produce a source manifest with:
   - file names
   - document dates
   - source type: TRV, SAF, RAF, benchmark, sediment guideline, or context
   - exact page/table targets
   - extraction readability
4. Map candidate source documents to Matrix Options input keys:
   - oral RfD/TDI
   - oral slope factor
   - inhalation RfC
   - inhalation unit risk
   - dermal RAF / absorption factors
   - eco TRV, only if applicable
5. Compare against existing catalog candidates before proposing additions.
6. Produce a dry-run report before any catalog file is edited.

## Explicit Non-Goals

Do not:

- add Ontario values to `src/data/**` or catalog JSON in this autonomous run
- change `qa_status`, `default_status`, or source status
- promote/demote Ontario rows
- treat Ontario MECP values as default candidates without source-priority review
- extract nested archives into the repo
- use the Ontario packet as a substitute for missing Phase C TEF/RPF primary PDFs

## Current Autonomous-Run Status

Status: resolved as future source-ingestion lane.

The useful autonomous output is this packet plus the backlog map entry. Implementation should wait
for a dedicated ingestion plan and owner approval.
