# Matrix Options HC TRV Extractor Portability Packet

Date: 2026-07-08
Author: automated bounded workhorse

## Goal
Fix import-safety for the HC TRV v4 extractor by ensuring module import does not parse CLI args, validate paths, import `fitz`, or open a PDF.

## Scope
- Target file only: `scripts/matrix-options/hc_trv_v4_extract.py`
- Preserve existing CLI/env behavior and output schema.

## Changes
- `--help` is now safe before runtime because all CLI/path/IO work moved into `main()`.
- Added explicit entrypoint:
  - `if __name__ == "__main__": main()`
- `resolve_pdf_path()` now runs only under `main()`, not at import time.
- `fitz` import and `fitz.open(...)` now run only inside `main()`.
- Extraction logic was wrapped in helper functions but retains all parsing, output fields, and ordering.
- Removed an inherited empty-pattern string replacement in qualifier cleanup that would raise `ValueError` during extraction.
- Output destination remains:
  - `scripts\matrix-options\data\hc_trv_v4_table1_extracted.json`
- Default and precedence behavior is unchanged:
  - `--pdf-path` > `SSTAC_HC_TRV_PDF_PATH` > `C:\Users\jasen\Downloads\HC 2025 - Toxicological Reference Values TRV.pdf`

## Verification
- `git diff --check`: passed.
- In-memory compile check:
  - `compile(code, 'scripts/matrix-options/hc_trv_v4_extract.py', 'exec')` via stdin python script: `compile-ok`.
- CLI help check:
  - `python scripts/matrix-options/hc_trv_v4_extract.py --help`: passes.
- Fail-closed behavior:
  - missing path (`--pdf-path C:\tmp\does_not_exist_12345.pdf`) exits non-zero with explicit `PDF path not found` message.
  - not-a-file (`--pdf-path C:\tmp`) exits non-zero with explicit `PDF path is not a file` message.
- importlib import safety:
  - `importlib.util.spec_from_file_location(...); spec.loader.exec_module(module)` prints `import-ok`.
  - No `fitz` import or PDF open is required during module import.
- Qualifier cleanup no longer calls `str.replace('', '')`.

## Notes
- No schema, data, or destination changes.
- No other runtime files were modified.
