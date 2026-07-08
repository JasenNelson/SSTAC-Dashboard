# Matrix Options Dioxin TDI Probe Portability Packet - 2026-07-08

## Task

Create a candidate portability patch for `scripts/matrix-options/probe_dioxin_tdi.py` so the script can
run against a caller-provided PDF path while preserving the default HC TRV 2025 path.

## Scope

- `scripts/matrix-options/probe_dioxin_tdi.py`

Out of scope:

- any extraction/search logic or emitted probe results
- any default output text format changes
- any catalog or policy data

## Change Details

1. Add CLI argument parsing for `--pdf-path`.
2. Add environment fallback `SSTAC_HC_TRV_PDF_PATH`.
3. Preserve legacy default:

```text
G:\My Drive\SABCS - Sediment Project\References\HC 2025 - Toxicological Reference Values TRV.pdf
```

4. Preserve existing diagnostic behavior in the probe output, only changing the path source when multiple
   sources are available.
5. Add fail-closed validation before PDF open:
   - file existence check
   - file type check
6. Delay importing `fitz` until after argument parsing and path validation so `--help` and
   missing-PDF checks do not require fitz.

## Verification

- `git diff --check`: passed.
- In-memory syntax compile with `python -B -c "compile(...)"`: passed.
- `python scripts/matrix-options/probe_dioxin_tdi.py --help`: passed.
- Missing-path check:
  `python scripts/matrix-options/probe_dioxin_tdi.py --pdf-path C:\tmp\does-not-exist.pdf`
  exited fail-closed with `PDF path not found: ...`.
- Not-a-file check:
  `python scripts/matrix-options/probe_dioxin_tdi.py --pdf-path C:\tmp`
  exited fail-closed with `PDF path is not a file: ...`.
- Full probe execution was not run here because this Python environment does not have `fitz`
  installed.

## Notes

This keeps search logic, snippet criteria, and output structure unchanged; only the source of the PDF
path is now configurable.
