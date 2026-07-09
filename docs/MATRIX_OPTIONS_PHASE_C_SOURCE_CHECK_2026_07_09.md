# Matrix Options: Phase C Source Preflight Check (2026-07-09)

## Preflight Objective
Verify the presence of primary source PDFs required for the Phase C TEF/RPF calculation verification in the `matrix_research/reference_catalog/` directory.

## Findings
An automated inventory can now be performed using the dedicated preflight script:
`npx tsx scripts/matrix-options/phase-c-source-preflight.ts`

**Status: MISSING**

The following required documents were **NOT** found in the reference catalog during the latest run:
- `WHO-2005_TEF_paper.pdf` (for dioxins and dioxin-like compounds)
- `WHO-1998_TEF_paper.pdf` (for PCBs)
- `HC_PQRA_v4.0.pdf` (Health Canada Preliminary Quantitative Risk Assessment)

## Recommendation
The Phase C TEF/RPF Verification task is **BLOCKED**.

Do not proceed with TEF/RPF verification coding until the owner uploads these primary source PDFs to the reference catalog to satisfy the strict data provenance requirements.

### Expected Upload Paths
The owner should upload the missing PDFs into the `matrix_research/reference_catalog/` directory (or a subdirectory within it). The `phase-c-source-preflight.ts` script will perform a recursive search to locate them by their exact filenames.
