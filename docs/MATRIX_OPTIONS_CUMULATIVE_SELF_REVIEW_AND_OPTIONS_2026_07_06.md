# Cumulative-Effects Lane -- Self-Review, Open Issues, Options, Recommended Next Steps (2026-07-06)

Autonomous overnight build of the cumulative-effects lane (A1 reference tables + A3a headless reducers,
following the codex-GREEN plan). This doc reviews what shipped, what is NOT fully working, develops
OPTIONS for each open issue, and proposes recommended next steps -- the input to a codex-review pass.
Plain ASCII.

## 1. What shipped (working + reviewed)

- **PR #531 -- SSTAC /sessionstart skill** (codex GREEN). Fixes the cross-project ritual leak.
- **A1 reference tables** (`tefTable.ts`, `rpfTable.ts`, `adafTable.ts`) + 289 tests. codex GREEN with
  ZERO numeric findings (codex ran its own programmatic cross-check vs SPEC + the DeVito JSON).
  - DeVito-2024 TEF column: all 29 congeners PRIMARY-VERIFIED, extracted cell-by-cell from the HC v4.0
    PDF Table 4 (pp.54-55) via a committed extractor + provenance JSON.
  - Full-table independent double-entry cross-check (every 29x5 + 23x5 cell).
- **A3a headless reducers** (`cumulative.ts`) + 27 anchor tests. codex GREEN after 2 rounds (round 1
  caught 4 real fail-closed gaps -- partial-TEQ, excluded-vs-skipped, ADAF-no-age, negative-conc -- all
  fixed). D0 holds (standalone; no ProvenancePathway/dispatch/frame/catalog edits).
- **A4 owner-attestation packets** (dry-run doc; no promotion): dioxin TEQ TDI 2.3e-9 (now
  primary-confirmed from the PDF), BaP EPA-2.0 scenario tag, PCB Option A.
- Gates: lint clean for the PR (see issue 6), test:ci GREEN (5414 passed), monitored build + e2e in
  progress at time of writing.

## 2. Open issues + OPTIONS (the "what is not fully working")

### Issue 1 (HIGH) -- BC `who-1998-pah` 5-PAH subset is UNVERIFIED (may over-sum)  [RESOLVED: 1B enforced]
The BC CSR PAH scheme is a RESTRICTED 5-PAH subset, but the exact 5 PAHs are framework-A2 (not done).
`rpfTable.ts` seeds `who-1998-pah` with the CCME carcinogenic-PAH values as a PLACEHOLDER, flagged
`needs_review` + a scheme-note.
- **Option 1A:** run framework-A2 -- read BC CSR Sched 3.1/3.4 + Protocol 28 primary to pin BC's exact
  5 PAHs + their WHO-1998 TEFs; then mark the non-BC-5 PAHs `excluded` in the scheme. (Still the
  eventual unblock path.)
- **Option 1B (EXECUTED 2026-07-06, per codex self-review P1):** `computeBaPeq` now BLOCKS scoring for
  `who-1998-pah` (via `RPF_SCHEME_SCORING_BLOCKED` in `cumulative.ts`) -- a warning alone is not enough
  for a screening tool, so a caller that ignores warnings cannot ship an over-summed BaP-eq. The scheme
  stays a documented data placeholder but is non-scoring until 1A verifies the subset.
- **Option 1C (REJECTED):** leave the placeholder scoring with only a warning -- too weak; codex P1
  correctly flagged the over-sum risk in a live screening tool.

### Issue 2 (MEDIUM) -- non-HC TEF editions (`who-2005`, `who-1998-*`) are `needs_review`
Only the HC DeVito-2024 column is primary-verified. The WHO columns were transcribed from the SPEC
(which cites them) but not checked against the WHO primary docs.
- **Option 2A (recommended):** framework-A2 -- verify `who-2005` against Van den Berg et al. 2006 and
  `who-1998-*` against WHO/IPCS 1998 (both public). Flip to `verified` per-column on confirmation.
- **Option 2B:** leave `needs_review` (usable build-first; honest). Acceptable until a non-HC authority
  is actually wired for scoring.
- **EXECUTED 2026-07-06 (per codex self-review P2):** `computeTEQ` now emits a `needs_review` WARNING
  whenever a non-HC (needs_review) TEF edition is used, so the QA level reaches a caller that reads
  only `equivalent` + `warnings` (parallels the RPF needs_review warning). The verify work (2A) is
  still the unblock path.

### Issue 3 (MEDIUM) -- 6 EPA-2010-draft RPFs UNCONFIRMED
The primary EPA PDF (deid 194584) is binary-encoded; 6 RPFs were only secondarily corroborated. The
whole `epa-2010-draft` scheme is SUSPENDED (2019) regardless.
- **Option 3A:** obtain + read the primary EPA draft PDF to confirm the 6 (low value -- scheme is
  suspended/non-policy).
- **Option 3B (recommended):** leave `needs_review`; the honest flag + scheme SUSPENDED note is
  sufficient. Prefer a current EPA scheme if EPA scoring is ever needed.

### Issue 4 (BY DESIGN) -- A3b input-grid UI + framework-criterion wiring deferred
The reducers are headless; there is no per-congener/PAH input grid, and the compare step's real anchors
(dioxin TDI, BaP SF) are owner-gated (A4). End-to-end TEQ-vs-standard for a real framework awaits A4
promotions + the A3b UI. This matches the plan (A3b = separate PR; A4 = owner-attested).
- **Option 4A (recommended):** next lane = A3b (per-congener/PAH input grid consuming
  `CumulativeContributionRow`) + wire the compare step to the A4-promoted anchors AFTER the owner attests.

### Issue 5 (LOW, hygiene) -- eslint does not ignore `scripts/**/.venv/`
`npm run lint` (= `eslint .`) reports 48 errors, ALL in untracked vendored JS inside a Python `.venv`
(`scripts/catalog-overnight/.venv/.../*.min.js`). Invisible to origin/main + CI (untracked), but it
makes the local lint gate noisy.
- **Option 5A (recommended):** add `**/.venv/` (and `**/site-packages/`) to the eslint `ignores` in
  `eslint.config.mjs` -- a tiny, correct hygiene fix benefiting every local lint run. Could bundle into
  a small separate PR (not the cumulative PRs, to keep them scoped).
- **Option 5B:** leave it; document that local lint noise is untracked-venv-only.

### Issue 6 (LOW) -- unit coverage of `normalizeConcentration`
Supports pg/ng/ug/mcg/mg/g over g/kg. Does not alias `ppm`/`ppb` or handle `pg/kg`. Not needed by any
current caller; add on demand.

## 3. Recommended next steps (proposed -- for codex review + owner)

Ordered so a gating dependency is never started before its input exists (codex self-review P3: A4
owner attestation MUST precede the A3b compare-step anchor wiring):

1. **Ship A1 (#532) + A3a (#533 stacked)** -- gates GREEN, PRs open; owner merges (#532 first).
2. **A4 owner decisions (owner-gated; do FIRST of the follow-ups)** -- surface the 3 packets (dioxin TEQ
   TDI, BaP scenario/default, PCB Option A) for owner attestation. AI does not promote. This must land
   before any real compare-step anchor is wired (step 4), because those anchors ARE the A4 values.
3. **Framework-A2 verification lane (highest-value research follow-up)** -- resolves Issues 1 + 2 (and
   optionally 3): a Sonnet-subagent research pass against BC CSR / Protocol 28 (BC 5-PAH subset),
   Van den Berg 2006 + WHO/IPCS 1998 (TEF editions), and CCME/Ontario/EPA framework criteria. Output:
   flip verified rows, mark BC non-5 PAHs `excluded` + remove `who-1998-pah` from
   `RPF_SCHEME_SCORING_BLOCKED`, resolve the CCME "21.5" ambiguity. Can run in PARALLEL with A4.
4. **A3b UI + compare-step anchor wiring** -- deferred lane; starts ONLY AFTER A4 attestation (step 2)
   provides the approved anchors AND framework-A2 (step 3) unblocks the schemes.
5. **eslint `.venv` ignore** -- trivial hygiene fix (Issue 5A), separate small PR; independent, anytime.

## 4. What AI did NOT do (guardrails held)
No catalog value promoted or mutated. No default-policy re-ranking. No verdicts written. D0 held (git
diff = new files only). All non-HC values honestly flagged needs_review. A4 is dry-run only.
