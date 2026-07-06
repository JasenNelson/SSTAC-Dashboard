# HC TRV v4.0 -- Catalog Re-Verification Ledger (2026-07-06)

Resolves the correctness-critical Lane 2 concern (`docs/NEXT_STEPS.md` 2026-07-04): "the catalog's HC
values were extracted from a canada.ca page that is now dead, so no HC value is currently re-verifiable
against its cited source." The owner supplied the canonical HC 2025 PDF, and the catalog's HC values
were re-verified against it. No catalog values were changed by this verification.

## Canonical source locator (PIN THIS)

`G:\My Drive\SABCS - Sediment Project\References\HC 2025 - Toxicological Reference Values TRV.pdf`
(Health Canada Toxicological Reference Values v4.0, 2025 edition; owner-owned G-drive SABCS reference
root per L0 rule 1.14). This is the stable re-verification source now that the canada.ca web page is
dead. Do NOT copy the PDF into the repo; reference the locator.

## Method

- Re-extracted Table 1 from the authoritative PDF using `scripts/matrix-options/hc_trv_v4_extract.py`
  (PyMuPDF / `fitz`) run under the repo `.venv` (`.venv\Scripts\python.exe`, Python 3.11.9, PyMuPDF
  1.27.2.3). NOTE: plain `python` on PATH resolves to a different (hermes-agent) venv WITHOUT fitz --
  the repo convention `.venv\Scripts\python.exe` is required.
- Diffed the fresh extraction against the committed
  `scripts/matrix-options/data/hc_trv_v4_table1_extracted.json` (field-by-field, all rows).
- Ran `scripts/matrix-options/hc-trv-v4-crosscheck.mjs` to compare the extracted table against the
  catalog `matrix_research/reference_catalog/human_health_trv_values.json`.

## Result 1 -- extraction is stable (no drift)

Fresh extraction = 84 rows; committed extraction = 84 rows; **0 field differences** (substance,
type_of_trv, value, unit, qualifier_hint, page). The committed HC source-of-truth is byte-identical to
a fresh extraction of the authoritative 2025 PDF. No extraction drift, no PDF-edition mismatch.

## Result 2 -- catalog matches the source (zero value errors)

Crosscheck over 111 HC-sourced catalog rows: **107 MATCH, 0 MISMATCH, 4 AMBIGUOUS.**

| # | Substance | Field | Catalog | PDF candidates | Disposition |
|---|-----------|-------|---------|----------------|-------------|
| 1 | manganese | rfc_inhalation | 0.00005 | 0.00005; 3.5 | BENIGN -- "3.5" is the "PM3.5" unit annotation, not a second TRV. No action. |
| 2 | methylmercury | rfd_oral | 0.00047 | 0.0002; 0.00047 | OPEN tension -- row tagged "screening child" holds the ADULT (less-protective) value; the sensitive-population 0.0002 is a separate row. Owner tagging decision. |
| 3 | vinyl_chloride | sf_oral | 0.24 | 0.24; 0.48 | OPEN tension -- tagged "screening child" but holds the ADULT-scenario SF (0.24), not from-birth (0.48). Owner tagging decision. |
| 4 | vinyl_chloride | iur_inhalation | 0.0000044 | 0.0044; 0.0088 (per mg/m3) | OPEN tension -- adult (0.0044) vs from-birth (0.0088). Owner tagging decision. |

Rows 2-4 are the SAME three population/value tensions already annotated in the catalog by PR #522
(text-only, flagged-not-resolved). None is `current_default`, so there is no live-calculator impact
pending the owner decision.

## Conclusion

The HC TRV v4.0 catalog values are VERIFIED against the authoritative 2025 PDF: zero value errors, zero
extraction drift. The Lane 2 "unverifiable HC values" concern is RESOLVED. The only remaining HC items
are the 3 population/value tensions (a tagging decision -- should "screening child" map to the
more-conservative value?), which are owner calls, not correctness defects.

## Reproduce / follow-ups

- Reproduce: `.venv\Scripts\python.exe scripts\matrix-options\hc_trv_v4_extract.py` (repoint its
  `pdf_path` to the canonical locator above) -> `node scripts\matrix-options\hc-trv-v4-crosscheck.mjs`.
- Minor follow-up (not blocking): `hc_trv_v4_extract.py` hardcodes a `C:\Users\jasen\Downloads\...`
  `pdf_path`. Parameterize it (argv, default = the canonical G-drive locator) so re-verification is a
  one-command, reproducible step. Deferred as a small code change.
- Stamp the canonical PDF locator into the HC-sourced rows' evidence items (page already present) so
  each value carries a reproducible source pointer -- owner-attested, per-row, in a later pass.
