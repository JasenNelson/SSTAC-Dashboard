# Matrix Options: Phase C Source Preflight Check (2026-07-09)

## Preflight Objective
Verify the presence of primary source PDFs required for the Phase C TEF/RPF calculation verification in the `matrix_research/reference_catalog/` directory.

## Findings
An automated inventory of the `matrix_research/reference_catalog/` directory was performed to locate the required source PDFs.

**Status: MISSING**

The following required documents were **NOT** found in the reference catalog:
- `WHO-2005 TEF paper` (for dioxins and dioxin-like compounds)
- `WHO-1998 TEF paper` (for PCBs)
- `HC PQRA v4.0` (Health Canada Preliminary Quantitative Risk Assessment)

No `.pdf` files currently exist within `matrix_research/reference_catalog/` or any of its subdirectories.

## Recommendation
The Phase C TEF/RPF Verification task is **BLOCKED**.

Do not proceed with TEF/RPF verification coding until the owner uploads these primary source PDFs to the reference catalog to satisfy the strict data provenance requirements.
