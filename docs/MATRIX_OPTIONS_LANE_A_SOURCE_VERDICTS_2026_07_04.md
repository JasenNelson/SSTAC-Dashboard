# Lane A source verdicts -- HC v4.0 vs IRIS vs HC-2016a (2026-07-04)

Status: catalog-evidence-derived + IRIS-confirmed. Live HC v4.0 PDF re-acquisition attempted
(the prior session's clean PDF was in a cleared scratchpad); a bounded live web re-confirmation
is best-effort in progress. The catalog's own `evidence_items` are page-cited extractions of HC
TRV v4.0 and were proven INTERNALLY FAITHFUL by the Lane C audit (class-A value-vs-value_text
mismatch = 0 for all same-unit HC rows), so they are treated here as the authoritative v4.0 record.

## The reframe (why these are OWNER SOURCE-SELECTION decisions, not fixes)

The overnight report hypothesized the committed HC rows were OCR-garbled and the "true" HC values
equalled IRIS. The Lane C audit DISPROVES that: the HC v4.0 rows are internally consistent
page-cited extractions. So each "target" is really a choice between DIFFERENT sources, and under
the default `bc-protocol1-v5-dra` frame the resolver ranks Canada_federal (HC) ABOVE US_federal
(IRIS) -- so once wired, the displayed default follows the HC row, not IRIS.

## Per-substance verdicts

| substance | HC TRV v4.0 (page-cited) | US EPA IRIS (approved row) | HC 2016a | Overnight target | Recommendation |
|---|---|---|---|---|---|
| chromium_trivalent | **0.3** mg/kg-bw/d (p26, "provisional") | 1.5 | -- | 1.5 (IRIS) | **FLAG: inverted.** HC 0.3 is 5x MORE protective than IRIS 1.5. If the rule is most-protective, keep/wire **0.3** (HC v4.0), NOT 1.5. Decide: most-protective (0.3) vs adopt-IRIS (1.5). |
| barium | **0.19** (p18) | 0.2 | -- | 0.2 (IRIS) | Low-stakes: 0.19 vs 0.2 is a 5% rounding difference. HC v4.0 0.19 is marginally more protective. Recommend wire HC **0.19** (its own value, most-protective + frame-consistent); 0.2 is fine too. |
| benzo_a_pyrene | **3.0e-4** (p19, == IRIS 2017) | 3.0e-4 (neuro) | 6.67e-5 (Chen 2012, NOAEL 0.02/UF 300) | 6.67e-5 (HC 2016a) | HC-2016a 6.67e-5 is ~4.5x more protective than both v4.0 and IRIS. Owner already chose it. Needs a NEW `sources.json` record + NEW catalog rows (NOT an overwrite of the faithful v4.0 3e-4 rows). **Live-confirm HC-2016a 6.67e-5 before wiring.** |
| nickel_chloride | **0.0013** (p38, Oral TDI) | -- (0.02 is IRIS `nickel_soluble_salts`, a DIFFERENT species) | -- | 0.02 (WRONG -- conflation) | The "0.02 headline" does not exist for nickel_chloride. Its only value is v4.0 0.0013. Options: wire **0.0013** (new key, class-C unwired), OR defer. Confirm distinctness from `nickel`/`nickel_soluble_salts`/`nickel_sulfate` first. |

## Decisions needed from owner (mobile)

1. **chromium_trivalent:** most-protective HC v4.0 0.3, or adopt IRIS 1.5 (the overnight target, LESS
   protective)? (My recommendation: 0.3 if the standing rule is most-protective; this reverses M1b.)
2. **barium:** wire HC v4.0 0.19 (recommended) or IRIS 0.2? (Immaterial numerically.)
3. **benzo_a_pyrene:** confirm go-ahead to add an HC-2016a source + rows for 6.67e-5 (pending a live
   confirmation of that value/citation).
4. **nickel_chloride:** wire to its real v4.0 value 0.0013, or defer? (0.02 is off the table -- wrong
   species.)

No catalog/library edits made. Lane B stays blocked on these answers.
