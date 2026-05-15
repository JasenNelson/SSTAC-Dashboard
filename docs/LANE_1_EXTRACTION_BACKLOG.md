# Lane 1 Extraction Quality Backlog

**Created:** 2026-05-14
**Discovered during:** Phase 3 canary on site 13254 Stage 2 PSI (eval IDs `8bfc1c30`, `efda25fb`, `31a711b4`).

**Why this exists:** The engine's submission-side retrieval + chunking architecture (commits `c533bbd6` through `ab5a716d`) correctly produces verbatim citations with full provenance. But the upstream Lane 1 / Docling extraction has multiple quality issues that surface as artifacts in HITL reviewer-facing citations. The chunker preserves whatever the extractor hands it; broken extraction = broken citations.

**Scope:** This backlog covers extraction-quality items that affect owner-facing citation readability. It does NOT cover engine, chunker, or HITL judgment surfaces (those work).

**Priority semantics:**
- **P0**: breaks owner comprehension entirely (reviewer cannot use the citation).
- **P1**: significantly degrades trust / readability (reviewer must context-switch to verify).
- **P2**: cosmetic noise (reviewer can read past it).

---

## P0 — must fix before broader rollout

### LX1: Mirrored / reversed-character text on some bullets

**Empirical example (eval `31a711b4`, AUTH-1, p.10 region, SCOPE OF WORK):**

```
• s snos pue saidses aoens anoy 'sajou jabne puey e 'shld isai zt jo uoeaeoxa vapour probes.
```

Reading the words right-to-left reveals the original content:
- `"shld isai zt jo uoeaeoxa"` -> `"excavation of 12 test pits"`
- `"jabne puey e"` -> `"3 hand auger"`
- `"sajou"` -> `"holes"`
- `"saidses aoens anoy"` -> `"4 surface samples"`

**Hypothesis:** Source PDF's text layer has rotated/reversed character encoding (common in scanned PDFs OCR'd with non-standard layout detection, OR PDFs produced by certain authoring tools that encode text-runs in unconventional order). Docling reads the text layer in its raw byte order without detecting the reversal.

**Owner impact:** the HITL reviewer literally cannot read this bullet. They must reach for the source PDF to verify what the policy is about. Trust collapses.

**Fix paths (pick one or combine):**
1. Force Docling to use the OCR layer (re-OCR the page image) rather than the text layer for this document class. Add a heuristic: if extracted text contains >N reversed-word indicators (rare-letter-pair sequences like `"jo "` or `"pue "` that don't appear in real English text), trigger OCR re-extraction.
2. Add a post-extraction sanity gate: detect reversed-text patterns via a lightweight English-word-frequency check (sample 200 chars; if <30% of words are dictionary words, flag the chunk for OCR fallback).
3. Use a fallback extractor (pdfplumber, pdftotext, or PyMuPDF) when Docling output fails the sanity gate.

**Effort:** medium. Sanity gate is small; OCR fallback configuration is medium.

---

## P1 — should fix before broader rollout

### LX2: Page headers/footers leaking into body text

**Empirical example (eval `31a711b4`, multiple citations):**

```
... applicable regulatory standards. The applicable regulatory standards for the Site included:
• Contaminated Sites Regulation (CSR) Industrial Land Use (IL) Standards for soil;
• Hazardous Waste Regulations (HwR) Standards for soil and groundwater. iLimited Stage 2 Preliminary Site Investigation 816IndustrialRoad#1,CranbrookBCAugust 14, 2011 Soil contamination was identified ...
```

The bolded segment `iLimited Stage 2 Preliminary Site Investigation 816IndustrialRoad#1,CranbrookBCAugust 14, 2011` is a page footer that appears between page N's last paragraph and page N+1's first paragraph. Docling included it in the body content layer instead of filtering it as `furniture`.

**Owner impact:** the HITL reviewer reads body text suddenly interrupted by header/footer noise. Disorienting; raises questions about whether the document was extracted correctly.

**Fix paths:**
1. Tune Docling's `content_layer` filter to exclude `furniture` more aggressively (the existing extract adapter already filters `furniture`; verify this PDF's headers/footers are correctly classified by Docling).
2. Add a post-extraction step that detects repeating text patterns (same string appearing on every Nth block) and removes them as headers/footers.
3. Pattern-based scrubber: regex for `"Limited Stage 2 Preliminary Site Investigation \d+\..*August 14, 2011"` removes this specific footer; generalize to any `<title> <page>.<address> <date>` pattern.

**Effort:** medium. Pattern scrubber is easiest. Docling tuning is right but harder.

### LX3: Section labels missing on many blocks ("Section Unknown")

**Empirical example (eval `31a711b4`, AUTH-1 first citation):**

```
4f45cd4d-c807-4b29-b106-31cbbf5409d3_VERBATIM.json   p. 1   Section Unknown
```

Section is `Unknown` on the cover page / executive summary blocks. Lane 1 extraction did not propagate the section heading to the per_block_index entry for these blocks.

**Owner impact:** when the reviewer sees `"Section Unknown"` they lose anchor context — they don't know where in the document the citation is from.

**Fix paths:**
1. Improve `extract_to_submission_adapter.py` section-detection heuristic: walk Docling output structurally, propagate the most recent heading marker to every block until the next heading. Currently may only set section when Docling explicitly tags the block.
2. For cover pages / front matter: detect and label as `"Cover"`, `"Title Page"`, `"Executive Summary"` based on PDF page sequence + content cues.
3. Worst case: render `"Section Unknown"` as `"Front matter"` or `"Unsectioned content"` in the dashboard for friendlier UX.

**Effort:** small-medium.

### LX4: Missing spaces between adjacent text runs

**Empirical examples:**

```
"GroundwaterStandardsCSR"     -- should be "Groundwater Standards   CSR"
"matrixbased"                 -- should be "matrix-based"
"816IndustrialRoad#1"          -- should be "816 Industrial Road #1"
"CranbrookBCAugust"            -- should be "Cranbrook BC   August"
"5.1S Soil Standards"         -- should be "5.1   Soil Standards"
"5.0 REGULATORYSTANDARDS"      -- should be "5.0 REGULATORY STANDARDS"
"4.0 SCOPE.OF WORK"            -- should be "4.0 SCOPE OF WORK"
```

**Hypothesis:** Docling's text-flow reconstruction concatenates adjacent text runs without inserting a space when run boundaries occur mid-line. PDFs that store text as a sequence of glyph runs without explicit space characters between them (common in PDFs produced by certain typesetting tools) trigger this.

**Owner impact:** moderate. Reviewer can usually decode (`"GroundwaterStandardsCSR"` is parseable as `"Groundwater Standards CSR"`) but it taxes attention on every citation.

**Fix paths:**
1. Post-extraction normalizer: insert a space between adjacent characters where the transition is `lowercase->uppercase` or `letter->digit` (CamelCase / number-letter boundaries). Risks: false positives on legitimate camel-case identifiers like `BTeXxylenes`.
2. Tune Docling's text-run merging logic (if exposed via configuration).
3. Use a different PDF extractor for documents flagged with this issue.

**Effort:** small (a regex normalizer for the most common patterns) to medium (full Docling tuning).

---

## P2 — track but defer

### LX5: OCR typos in body content

**Empirical examples:**

```
"weils"      -> "wells"
"lt"          -> "It" (lowercase L vs uppercase I)
"5oom"       -> "500m"
"TDs"        -> "TDS"
"levei"      -> "level"
"Industriai" -> "Industrial"
"piugged"    -> "plugged"
"generaly"   -> "generally"
"fal"        -> "fall"
"Potentia!"  -> "Potential" (exclamation mark for letter L)
"Soivents"   -> "Solvents"
"PrepaseeFor"-> "Prepared For"
"Two building proposed" -> "Two buildings proposed"
"an agricultural land" -> "and agricultural land"
```

**Hypothesis:** Source PDF was OCR'd with a non-perfect engine. Common confusions: `l<->1`, `i<->!`, `o<->0`, `u<->ii`, doubled-letter dropping.

**Owner impact:** low-medium. Reviewer pattern-matches past typos easily; technical terms (`TDS`) are unmistakable in context.

**Fix paths:**
1. Domain-specific spell-checker pass with a regulatory/site-investigation dictionary (BTEX, VOC, LEPH, HEPH, PAH, PSI, DSI, CSR, MOE, etc. as known-good tokens).
2. Re-OCR with a better engine (Tesseract 5 with custom training, or commercial alternatives).
3. Document-level confidence score from OCR; flag low-confidence pages for manual review or re-extraction.

**Effort:** medium-high. Spell-check dictionary is achievable; full re-OCR is heavier.

### LX6: Bullet character preservation inconsistencies

**Empirical examples:**

```
"• The uses of groundwater"     -- standard bullet (correct)
"• eThe closest surface water"  -- leading "e" before content (extracted as text, then bullet)
"• ·A review of the BC Water"   -- middle-dot bullet kept as character
"• ? Contaminated Sites"        -- question mark instead of bullet
"• s snos pue saidses..."       -- bullet kept but content reversed (LX1)
```

**Hypothesis:** Docling normalizes some bullet glyphs to `•` but not others (depends on the PDF's font / glyph encoding for the bullet character). Some PDFs use a font glyph that Docling doesn't recognize as a bullet.

**Owner impact:** low. Reviewer recognizes intent regardless of character.

**Fix paths:**
1. Post-extraction normalizer: detect "leading non-letter character" patterns at start of bulleted lines and normalize to `•`.
2. Docling configuration: investigate whether bullet-character mapping is configurable.

**Effort:** small.

### LX7: Special characters preserved oddly

**Empirical examples:**

```
"applicable provincial ® standards"   -- registered trademark mark mid-sentence
"groundwater is contained within organic soils or muskeg"  -- truncated at start (missing "DW does not apply where")
"10- m/s"                              -- truncated unit (missing exponent)
"a ss ( a ba p () na s     and,"      -- mostly-illegible fragment
```

**Hypothesis:** Mixed. Some are extraction artifacts where special characters or partial-text-run boundaries are preserved. Some are likely mirrored-text issues like LX1 partially decoded.

**Owner impact:** low (small fragments) to high (LX1-pattern fragments).

**Fix paths:** addressed by LX1 + LX2 + LX5 in combination.

**Effort:** N/A (covered by other items).

---

## Recommended sequencing

1. **P0 LX1 (mirrored text)** — highest owner-impact; should be the first Lane 1 fix after canary completes.
2. **P1 LX2 (page headers/footers)** — high frequency; small fix.
3. **P1 LX3 (Section Unknown)** — high frequency; small fix.
4. **P1 LX4 (missing spaces)** — high frequency; medium fix; some risk of false positives.
5. **P2 LX5-LX7** — defer until P0 and P1 land. Some may be obviated by re-OCR strategy from LX1.

## Validation strategy

Each Lane 1 fix should be validated by:
1. Re-running extraction on site 13254 PSI.
2. Comparing the extracted `submission_text` before vs. after for the specific patterns the fix addresses.
3. Re-running an evaluation through the dashboard and checking that the affected citation patterns are gone.

A regression test fixture should be added to Lane 1's test suite using the site 13254 PSI as a known-bad source, asserting the post-fix output meets quality bars.

## When this applies

These items are blocking for **broad production rollout** (multiple owners using the system on diverse submission types). They are NOT blocking for the **canary gate** (the engine + chunking + dashboard pipeline is validated end-to-end; the canary's purpose is to confirm the architecture works, which it does).

The owner can proceed to Phase 3 canary recording on the current build. Lane 1 cleanup follows.
