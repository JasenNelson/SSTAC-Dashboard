# Matrix Options Phase C Source Preflight - 2026-07-08

Purpose: record the current source-acquisition state for Framework-A2 / Phase C before any TEF or RPF
verification work resumes.

## Verdict

Phase C remains blocked on missing primary source PDFs. Do not flip TEF editions or RPF QA status until
the missing sources are supplied and citation-grade extraction succeeds.

## Reference Root Checked

`G:\My Drive\SABCS - Sediment Project\References`

The folder is present and readable from this workstation. A filename-level preflight found 397 local
files. This was not OCR and did not copy source files into the repo.

## Present But Not Sufficient

These local files may be useful context, but they are not the missing primary sources for Phase C:

- `HC 2025 - Toxicological Reference Values TRV.pdf`
  - Present.
  - Already used for Health Canada TRV v4.0 crosschecks.
- `2026 Ontario MECP TRVs.zip`
  - Present.
  - Separate owner-gated ingestion lane; not a Phase C TEF/RPF source.
- `DQRA HC final draft Feb 2009.pdf`
  - Present.
  - Older Health Canada DQRA context; not the H129-108-2021 PQRA source required for PAH RPF table
    verification.
- FCSAP manuals and working-harbour guides.
  - Present.
  - Contextual guidance, not the missing primary WHO/HC PQRA source documents.
- `dioxin BSAF.pdf` and `dioxin BSAF flatfish.pdf`
  - Present.
  - Bioaccumulation context, not primary WHO TEF/TEQ source tables.

## Missing Phase C Sources

The following sources were not found by filename preflight:

- WHO-2005 / Van den Berg 2006 TEF evaluation.
- WHO-1998 / Van den Berg 1998 TEF/RPF evaluation.
- Health Canada PQRA H129-108-2021 source needed to verify the HC PQRA PAH RPF table.
- PCB-specific primary source files by filename.

## Extraction Notes

- Do not install Poppler or rely on `pdftoppm`.
- If primary PDFs are supplied, start with a text extraction smoke using the existing PyMuPDF / `fitz`
  pattern used by Matrix Options probe scripts.
- If text extraction is poor, produce an owner decision packet for alternate extraction rather than
  silently guessing values.

## Resume Criteria

Phase C can resume only when all are true:

1. The missing primary PDFs are present under the approved local References path or another owner-approved
   local source path.
2. A source-acquisition preflight records exact file paths, page targets, and extraction readability.
3. The verification packet identifies which TEF/RPF edition cells are supported by which page/table.
4. The packet is reviewed before any catalog status or table QA changes are made.

## Owner Action Needed

Place the following PDFs in the References folder, or provide an explicit alternate local path:

- Van den Berg et al. 2006 / WHO-2005 TEF evaluation.
- Van den Berg et al. 1998 / WHO-1998 TEF/RPF evaluation.
- Health Canada PQRA H129-108-2021.

Until then, Phase C is parked by source availability, not by implementation uncertainty.
