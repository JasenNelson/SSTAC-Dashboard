# Matrix Options Candidate Code PR Manifest - 2026-07-08

## Purpose

Separate candidate code patches from the docs-only autonomous-run preservation PR. These patches are
useful but should not be bundled with the preservation docs because they require code-specific review
and gates.

## Candidate PR 1 - Matrix Options e2e Auth Visibility

Files:

```text
e2e/matrix-options.spec.ts
docs/MATRIX_OPTIONS_E2E_AUTH_VISIBILITY_PACKET_2026_07_08.md
```

Change:

- Adds a route-level Matrix Options e2e assertion that accepts either an authenticated Matrix Options
  page or an unauthenticated redirect to `/login`.
- Keeps existing authenticated assertions guarded by `gotoMatrixOptionsOrSkip`.

Verification:

- Static review performed.
- Focused Playwright execution from this Codex sandbox was blocked by process/filesystem restrictions:
  direct dependency execution required `NODE_PATH`, then failed with `spawn EPERM` and reporter mkdir
  permission errors.

Required before commit:

```powershell
npm run test:e2e -- --project=chromium e2e/matrix-options.spec.ts -g "matrix-options route is either authenticated or redirects to /login"
```

- If the focused test passes, commit as a narrow e2e PR.
- If it fails, fix only `e2e/matrix-options.spec.ts` and this packet.

## Candidate PR 2 - HC TRV Extractor Portability

Files:

```text
scripts/matrix-options/hc_trv_v4_extract.py
scripts/matrix-options/hc_trv_v4_table4_devito_tef_extract.py
docs/MATRIX_OPTIONS_HC_TRV_EXTRACTOR_PORTABILITY_PACKET_2026_07_08.md
```

Change:

- Adds `--pdf-path` to both HC TRV extraction scripts.
- Adds `SSTAC_HC_TRV_PDF_PATH` as an environment override.
- Preserves resolution order: CLI path, then environment variable, then existing default path.
- Adds fail-closed path checks before opening the PDF.
- Keeps module import side-effect free for `hc_trv_v4_extract.py`; CLI parsing, PDF path resolution,
  `fitz` import, and PDF open happen only under `main()`.
- Removes an inherited empty-pattern qualifier cleanup call that could raise `ValueError` during
  extraction.
- Keeps extraction logic, output paths, and JSON schemas unchanged.

Verification already run:

- `git diff --check`: passed after trailing-whitespace cleanup.
- In-memory Python syntax compile: passed.
- `--help` for both scripts: passed.
- Missing-path fail-closed checks for both scripts: passed.
- Importlib safety checks for both scripts: passed.
- Empty-pattern qualifier cleanup grep for `str.replace('', '')`: no matches.

Recommended additional verification:

- If the HC TRV PDF and `fitz` dependency are available, run one extraction with `--pdf-path` and compare
  generated JSON shape/counts against the existing committed artifacts before committing.
- In this Codex sandbox, both PDF paths exist but `fitz` is not installed and scratch directory creation
  was denied, so full extraction was not run here.
- If `fitz` is unavailable in the committing environment, syntax/help/fail-closed checks are the minimum
  reasonable gate for this portability-only change.

## Candidate PR 3 - Dioxin TDI Probe Portability

Files:

```text
scripts/matrix-options/probe_dioxin_tdi.py
docs/MATRIX_OPTIONS_DIOXIN_TDI_PROBE_PORTABILITY_PACKET_2026_07_08.md
```

Change:

- Adds `--pdf-path` to the dioxin-like TEQ TDI probe script.
- Adds `SSTAC_HC_TRV_PDF_PATH` as an environment override.
- Preserves the existing default HC TRV PDF path.
- Preserves current probe diagnostics while selecting path via CLI -> env var -> built-in default.
- Delays `fitz` import until after argument parsing and path validation so `--help` and path failures
  do not require PyMuPDF.

Verification already run:

- `git diff --check`: passed.
- In-memory syntax compile: passed.
- `--help`: passed.
- Missing-path and not-a-file fail-closed checks: passed.

Recommended additional verification:

- Run the full probe in an environment with `fitz` installed and the HC TRV PDF reachable.

## Do Not Include

Do not include any of these in any code PR:

- `.mcp.json`
- `supabase/`
- `src/lib/engine-v2/`
- `src/app/api/engine-v2/`
- `src/data/`
- catalog values
- `qa_status`
- `default_status`
- promotion/demotion data

## Staging

Use path-scoped staging only. Never use `git add .`, `git add -A`, or `git add -u`.
