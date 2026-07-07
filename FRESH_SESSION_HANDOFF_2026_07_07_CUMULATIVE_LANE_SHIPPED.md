# Fresh Session Handoff -- 2026-07-07 (cumulative-effects lane SHIPPED + hardened; owner decisions pending)

Supersedes `FRESH_SESSION_HANDOFF_2026_07_06e_CUMULATIVE_SHIPPED.md`. Plain ASCII. Checkpoint at the end
of a long autonomous session (07-06e overnight + 07-07 continuation). Everything is committed + merged;
no in-flight work. Migrating to a fresh session.

## 0. PROJECT GOAL, PRINCIPLES + ROADMAP (fresh session: LOCK IN ON THIS FIRST)

### The goal (the end state we are building toward)
Give a Qualified Professional a WORKING, provenance-tracked, regulatory-framework-aware CUMULATIVE-EFFECTS
calculator inside the SSTAC-Dashboard Matrix Options module -- so a site's dioxin-like congeners
(TEF/TEQ), carcinogenic PAHs (RPF/BaP-equivalent), and total/non-dioxin-like PCBs (mass-based) can be
combined correctly, compared to the RIGHT framework's standard, with every congener/PAH contribution
attributed to its source -- replacing error-prone manual spreadsheet math. "Done" = a live UI where a QP
picks a framework + enters congener/PAH concentrations and gets a defensible, verified, provenance-backed
TEQ / BaP-eq PASS/FAIL with contribution breakdown.

### Non-negotiable principles (the HOW -- honor these on every task)
1. **Verify the PRIMARY source, never a memory or a subagent's secondary read**, for ANY regulatory
   value (owner-reinforced 2026-07-07). Read the actual PDF (vision-first: Claude Read `pages` / Docling
   -- NEVER install poppler).
2. **AI never promotes / mutates catalog values or writes qa_status.** AI authors needs_review candidates
   + dry-runs a promote-*.mjs; the OWNER runs `--apply` (that is the attestation). AI surfaces evidence;
   HITL judges.
3. **Fail closed.** A screening tool must block/underestimate-flag on any unknown/ambiguous input, never
   silently over- or under-count (this session caught a 3x over-count + an ADAF mis-frame exactly here).
4. **D0 -- standalone + additive.** The reducers do not extend `ProvenancePathway` / dispatch / frames /
   existing files; build-first, zero policy mutation.
5. **Honest QA flags.** needs_review is usable build-first but must reach the user; only primary-verified
   rows are `verified`.
6. **Ship discipline:** codex-review to mutual-agreement GREEN (commit gate) -> lint/test:ci/build/e2e
   (push gate) -> owner merge. `/ship-protocols` + `/codex-review`.

### Roadmap (where we are on the path to the goal)
- **[DONE] Phase A -- calculation ENGINE.** A1 reference tables (TEF/RPF/ADAF, DeVito primary-verified) +
  A3a headless reducers (computeTEQ/computeBaPeq/compare, fail-closed) -- SHIPPED + hardened (8 PRs).
- **[NOW -- OWNER-GATED] Phase B -- unlock the anchors + fix SPEC representation.** The engine is headless
  and its real anchors are not promoted. Owner decisions D1-D4 (below) promote the dioxin TEQ TDI, frame
  the BaP anchor+ADAF, adopt PCB Option A, and correct the BC scheme. NOTHING downstream is usable until
  these land.
- **[NEXT -- AI-executable] Phase C -- framework-A2 verification.** Flip the non-HC TEF/RPF rows from
  needs_review to verified against primaries (vision-first). Can run parallel to Phase B.
- **[THEN] Phase D -- A3b UI (the user-facing feature).** The per-congener/PAH input grid + wiring the
  compare step to the A4-attested anchors. Gated behind B (anchors) + C (verified schemes).

### Recommended NEXT BEST STEPS (in order)
1. **Take up the owner decisions D1-D4** (Phase B) -- start with whichever the owner picks; D1 (dioxin
   TEQ) and D3 (PCB Option A) are the cleanest. For each: AI prepares the dry-run (candidate row +
   promote script, before/after), owner attests inline, AI ships.
2. **In parallel, framework-A2 WHO verification** (Phase C, vision-first) -- unblocks who-1998 editions +
   confirms hc-pqra-v3; does not need owner judgment (verification, not promotion).
3. **Then A3b UI** (Phase D) once B+C provide verified, anchored inputs.
Do NOT jump to the UI (Phase D) before B+C -- it would render an unverified, unanchored calculator.

---

## Status: engine SHIPPED, reviewed, hardened. Remaining work is OWNER-GATED.

8 PRs merged to `main` (tip `1a7297f`) this session -- all codex-GREEN + 4-gate GREEN + owner-approved:
- **#531** SSTAC `/sessionstart` skill (ported from OHD; fixes the cross-project ritual leak).
- **#532** A1 reference tables (`tefTable.ts` 29 congeners x 5 editions; `rpfTable.ts` PAH RPF;
  `adafTable.ts`) + double-entry cross-check tests. DeVito-2024 TEFs PRIMARY-verified from the HC PDF.
- **#536** A3a headless reducers (`cumulative.ts`: computeTEQ / computeBaPeq / compareEquivalentToStandard,
  fail-closed, D0-standalone) + anchor tests. (Replaced auto-closed #533 -- see stacked-PR note below.)
- **#534** 07-06e handoff + framework-A2 research findings.
- **#535** eslint `.venv` ignore (local `npm run lint` now exits 0).
- **#537** benzo[b+j+k]fluoranthene RPF **over-count fix** (a real bug found + fixed post-ship -- see below).
- **#538** ADAF anchor-pairing + single-bin **contract clarification** + BaP (D2) decision reframe.

## Two correctness issues found + FIXED late (both primary-verified, both owner-prompted)

1. **benzo[b+j+k]fluoranthene over-count (#537, SPEC S3 correction):** CCME 2010 Table 6-6
   (VERIFIED-primary) defines ONE combined PEF 0.1 for benzo[b+j+k]fluoranthene (co-elution); the
   shipped table gave each isomer its own 0.1 in the GROUP schemes (hc-pqra-v3/ccme-2010/who-1998-pah)
   -> up to 3x over-count. FIX: combined `benzo_bjk_fluoranthene` key (0.1 for group schemes; nd for
   nisbet-1992/epa-2010-draft) + individual b/j/k `not-defined` under group schemes (fail closed ->
   forces the combined key). Kept per-isomer for nisbet + epa-2010 (distinct potencies). Evidence:
   `docs/MATRIX_OPTIONS_BJ_FLUORANTHENE_GROUPING_FINDINGS_2026_07_06.md`.
2. **ADAF framing (#538):** primary-verified the HC v4.0 ADAF position (read HC 2025 PDF p.6 + p.20
   directly). HC 1.289 is an ADULT-base oral SF; HC v4.0 ADDED a note recommending ADAFs be applied ON
   TOP for early-life exposures (adult-only = used as-is, ADAF=1). Structurally like EPA's adult 1.0,
   NOT its lifetime 2.0 (which BAKES ADAF in -- do not re-apply). So D2 is reframed as "choose an
   ANCHOR + its ADAF treatment," not a bare number pick. `computeBaPeq` ADAF logic verified correct;
   contract clarified (anchor-pairing + SINGLE-BIN scope: it applies one age bin, not lifetime 0-70yr
   weighting -- caller must per-window weight). Evidence: `docs/MATRIX_OPTIONS_ADAF_BAP_EXPLAINER_2026_07_07.md`.

## OWNER DECISIONS PENDING (nothing AI can advance without HITL judgment)

Priority order (A4 anchors before A3b; framework-A2 parallel). All packets:
`docs/MATRIX_OPTIONS_CUMULATIVE_A4_ATTESTATION_PACKETS_2026_07_06.md`.
- **D1 -- promote dioxin/DL-PCB TEQ oral TDI 2.3e-9 mg TEQ/kgBW-day** (primary-verified, HC v4.0 p.42).
  Recommend a NEW dedicated key `dioxin_like_teq` + input_key `oral_tdi_teq_mg_per_kg_bw_day`. NOTE:
  this needs a NEW `SubstanceKey` registered in `src/lib/matrix-options/substanceLibrary.ts` (the
  SubstanceKey union) + a new input_key + a catalog candidate row in
  `matrix_research/reference_catalog/human_health_trv_values.json` + a `promote-*.mjs` script (AI
  authors + dry-runs; OWNER runs `--apply` = attestation). Not a trivial row-add.
- **D2 -- benzo_a_pyrene current_default = anchor + ADAF treatment** (HC 1.289/EPA 1.0 = adult+ADAF-on-top;
  EPA 2.0 = ADAF-embedded, no re-apply). Owner policy call; store the anchor WITH its ADAF-stage tag.
  Scenario-tagging (metadata) recommended APPROVE.
- **D3 -- PCB Option A** (total-default mass; congener/Aroclor alternatives never additive; DL fraction
  via TEQ 50%-apportioned). The non-DL PCB value already exists+approved in the catalog. ADOPT recommended;
  codex flagged: sync PCB current_default/scaffold rows so stale rows don't win provenance.
- **D4 -- BC PAH scheme (SPEC S4 correction, owner-gated):** BC TG-7 (2017, VERIFIED-primary) directs BC
  CSR to HC PQRA Table 7 (8-PAH), NOT the SPEC's claimed "BC 5-PAH WHO-1998". Recommend remap
  `RPF_SCHEME_BY_AUTHORITY['bc-csr']` -> `ccme-2010` (the verified 8-PAH; NOT hc-pqra-v3 which is broader/
  unblocked) + retire `who-1998-pah`. INTERIM SAFETY: who-1998-pah scoring is already BLOCKED
  (`RPF_SCHEME_SCORING_BLOCKED` in cumulative.ts). Evidence:
  `docs/MATRIX_OPTIONS_FRAMEWORK_A2_RESEARCH_FINDINGS_2026_07_06.md`.

## BROADER MATRIX-OPTIONS OPEN DECISIONS (NOT cumulative-specific -- do NOT lose these)

The cumulative lane is ONE workstream. The prior session's wider MO work left owner-decisions that are
NOT part of D1-D4. AUTHORITATIVE register: `docs/MATRIX_OPTIONS_OWNER_DECISIONS_2026_07_06.md` (read it).
Genuinely-open items there (cross-checked 2026-07-07):
- **`phenylmercuric_acetate` ContaminantClass** -- no clean class fit (between methyl-Hg / inorganic-Hg /
  organics); owner picks a class or approves `organomercury`. OPEN.
- **Confirm `cadmium` (0.0008) + `methylmercury` (0.0002) current_defaults** -- applied despite a hold
  flag; both defensible (most-protective); owner confirms after-the-fact or redirects. LOW urgency, OPEN.
- `dichlorobenzene_1_2` default -- RESOLVED (keep IRIS 0.09; HC 0.43 is 1996-vintage despite the "2025"
  table label). NO action.
- OVERLAP: that doc's "PCB policy" item == cumulative **D3**; its `benzo_a_pyrene` HELD item == cumulative
  **D2** (SF question A2-resolved; ADAF framing done #538). Resolve once, in the cumulative lane.
- Deferred backlog (owner-curation-gated, from the MO memory anchors -- see MEMORY.md): ~22
  jurisdiction-conflict substances; `beryllium`/`selenium` (multi-same-value catalog, no current_default
  row -> resolveTupleRecord null); PCBs/diquat/fosetyl_al wiring. NOT cumulative; separate lane.
- **Lane 2 (HC v4.0 catalog re-verification) is RESOLVED** (byte-identical, 0 value errors -- prior
  session's close-out; the owner-decisions doc's "Lane 2 OPEN" line is STALE).

## FOLLOW-UP LANES (AI-executable once greenlit)

- **Framework-A2 WHO verification:** verify WHO-2005 (Van den Berg 2006) + WHO-1998 mammal/avian/PCB TEF
  columns against primaries -> flip needs_review -> verified. **USE VISION-FIRST OCR** (Claude Read-tool
  PDF `pages` vision + Docling cross-check) -- codex RED on the earlier poppler-install idea; do NOT
  install poppler. Caveat: double-pass tiny numbers (0.00003 vs 0.0003). WHO-1998 fish PCDD/PCDF already
  verified (CCME 2001). HC PQRA Table 7 primary (H129-108-2021 PDF) blocked by an archive redirect ->
  get a readable copy to upgrade hc-pqra-v3 to primary-verified.
- **A3b UI:** the per-congener/PAH input grid consuming `CumulativeContributionRow` + wire the compare
  step to the A4-attested anchors. Deferred until D1-D4 land. A UI test MUST force `applyAdaf=false` when
  the anchor is EPA-2.0; grep `applyAdaf: true` call sites for the single-bin/lifetime contract.

## Process lessons (carry forward)

- **VERIFY primary, do not trust a subagent's secondary read** (owner-reinforced 2026-07-07): a subagent
  claimed a HC ADAF fact; a direct HC-PDF read confirmed it, but the discipline stands -- read the
  primary for any regulatory-value claim.
- **PDF OCR = vision-first** (Claude Read `pages` / Docling / AGY), NEVER a new poppler install
  (`feedback_pdf_vision_first` HIGH AUTHORITY; codex-confirmed).
- **codex file-capture:** NEVER launch codex with a nested `&` inside a `run_in_background` bash (the
  child dies + truncates the review). Use a single background command. codex reads its own MEMORY.md at
  startup, so a stray `VERDICT: GREEN` can appear in that dump -- read the TRUE last codex turn.
- **Stacked-PR gotcha:** merging a base PR + deleting its branch CLOSES a dependent PR (does not
  retarget). #533 (A3a stacked on #532) auto-closed -> reopened as #536 targeting main. Retarget stacked
  PRs to main BEFORE merging the base, or open fresh.
- Catalog = `matrix_research/reference_catalog/human_health_trv_values.json` (1573 rows) + `sources.json`;
  promote-*.mjs scripts are AI-authored + dry-run, OWNER runs `--apply` (the attestation). AI never
  writes qa_status.

## Environment / gates

- All 8 PRs merged; main CI green. Local gate commands: `npm run lint` (0 errors now), `npm run test:ci`
  (5424 pass), `npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10`, `npm run test:e2e`
  (117 pass). Repo auto-merge DISABLED -> merge manually after green.
- Pre-existing uncommitted `.gitignore` (+`.gstack/`) leftover still follows the tree (not this session's
  work). ~1 FOREIGN Regulatory-Review `gold-reliability` process may show in `Get-Process` -- leave it.
- Memory anchor updated: `dashboard_mo_cumulative_effects_lane_2026_07_06.md`.
