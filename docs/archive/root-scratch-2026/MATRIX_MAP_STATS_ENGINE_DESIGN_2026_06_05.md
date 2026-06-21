# Matrix-Map Selection-Stats Engine Design -- ProUCL-Equivalent UCL95 Panel

**Date:** 2026-06-05
**Status:** DESIGN (owner-facing; pending owner spec answers in section F)
**Audience:** Owner (regulatory scientist; uses USEPA ProUCL in practice)
**Scope:** Make the matrix-map SELECTION STATS panel a credible ProUCL-equivalent
that SHOWS its calculation basis (recommended UCL + method + why), runs on the
hybrid demo's Vercel cloud path, and handles censored (non-detect) data correctly.

This doc synthesizes three research reports (ProUCL methods; OSS libraries;
stack-integration constraints). All library names, licenses, formula sources,
and file:line references are carried verbatim from those reports -- nothing here
is invented. Where a value could not be fully verified against the source PDF,
it is flagged "verify before hardcoding."

---

## 0. The bottom line (one paragraph)

Build the stats engine as a **pure client-side TypeScript module** (with a Web
Worker for heavier iterative methods), not a Python API route. The deciding
constraint is Vercel: every Python-calling path in this app is hard-gated
local-only and 503s in production by design (`requireLocalEngine()` returns 503
unless `LOCAL_ENGINE_ENABLED === 'true'` -- src/lib/api-guards.ts:56). A Python
stats route would therefore work ONLY on the owner's machine, not on the deployed
demo. The selection data is already in the browser, so client-side TS is both the
only Vercel-viable path and the simplest. Ship a phased plan: Phase 1 (descriptive
stats + Student's-t + Chebyshev UCL) is autonomous-safe and ships on Vercel today;
Phase 2 adds distribution-fit + ProUCL recommended-UCL decision logic + bootstrap;
Phase 3 adds gamma/Land-H, outlier tests, and censored (KM) handling. An optional
LOCAL-ONLY Python "advanced stats" mode (scipy-backed, behind the existing
engine-v2 gate) can be offered later for full regulatory-defensible parity, but
the always-on default must be client-side TS.

---

## A. Recommended Architecture

### A.1 Recommendation: client-side TypeScript (with a Web Worker)

Implement the engine as a pure TS module, e.g. `src/lib/matrix-map/stats.ts`,
consumed directly by the panel. Move bootstrap / Land-H / gamma iterations into a
Web Worker so the UI thread stays responsive. This runs **identically on Vercel
and locally**.

### A.2 Why NOT Python (the Vercel constraint, stated plainly)

If a capability is implemented as Python in this app, it is LOCAL-ONLY and will
NOT work on the deployed demo. Concretely:

- Every Python-calling route in this codebase spawns Python via Node
  `child_process.spawn` (detached, stdio:ignore, windowsHide, unref) using
  env-var-driven absolute `C:/Projects/...` paths
  (src/lib/engine-v2/spawn_extraction.ts:32-71; path vars at
  src/app/api/engine-v2/projects/[id]/evaluate/route.ts:47-56,355-357).
- Those routes are HARD-GATED:
  `if (process.env.LOCAL_ENGINE_ENABLED !== "true") return 503`
  (evaluate route at src/app/api/engine-v2/projects/[id]/evaluate/route.ts:130;
  reusable guard `requireLocalEngine()` at src/lib/api-guards.ts:56 -- VERIFIED).
- On Vercel, `LOCAL_ENGINE_ENABLED` is not "true", so the **entire Python surface
  503s in production by design.**
- Vercel deploys this as a standard Next.js app: vercel.json declares NO Python
  `functions`/runtime (vercel.json:1-11); next.config.ts only externalizes
  better-sqlite3 + node-pty as "local-dev-only modules; production serves no
  surface that references them" (next.config.ts:18-33).

So a Python stats route would EITHER 503 on the demo (same fate as engine-v2,
useless for a cloud demo) OR force a brand-new Vercel Python serverless function
lane this codebase has never used -- which would mean bundling scipy/numpy into
the function (cold-start + size cost) and contradicting the established
"Python = local engine only" architecture. Not warranted for this workload.

### A.3 Why client-side wins for THIS data flow

The SELECTION STATS input is already in the browser. `MatrixMapRightPanel`
fetches rows once via `supabase.schema('matrix_map').rpc('fetch_measurements_for_samples', {p_sample_ids})`,
then filters them purely client-side via `filterMeasurementRows()` into
`filteredRows` (a `MatrixMapMeasurementRow[]`) -- see
src/components/matrix-options/MatrixMapRightPanel.tsx:113-156,172-175,849-863.
The stats input is exactly that in-memory array. No server round-trip; instant
recompute as filters change. Volume is modest (hundreds-to-low-thousands of
values; the table paginates at PAGE_SIZE=100), comfortably within JS capability
for ProUCL-style methods. There is currently NO JS stats dependency in
package.json (64 deps; recharts only, for charting).

### A.4 Supabase-RPC option (rejected as primary)

Postgres can do AVG/STDDEV/PERCENTILE_CONT, but ProUCL's censored estimators
(Kaplan-Meier, ROS) and Land's H-statistic are not built-in; you would round-trip
per filter change and reimplement stats in SQL. Not worth it since the data is
already client-side.

### A.5 Hybrid / future note (the ONE Python case)

If the program later needs full regulatory-defensible ProUCL parity (formal
gamma/lognormal GOF, EPA-validated UCL-selection logic with ProUCL critical-value
tables), reuse the engine-v2 spawn + `LOCAL_ENGINE_ENABLED` pattern as a
LOCAL-ONLY "advanced stats" route backed by scipy (scipy IS already installed
locally -- see C.4). Present it as a desktop-only enrichment; the client-side TS
path remains the always-on Vercel default. This is the hybrid: client-JS core
everywhere, optional Python enrichment on the owner's machine only.

### A.6 Two correctness invariants the engine MUST enforce

These are not optional -- they make the difference between credible and nonsense
output:

1. **Per (substance + unit) grouping.** `value` and `unit` are independent fields
   and the catalog mixes units; computing stats across mixed units produces
   nonsense aggregates. Bucket by (substance + unit); never aggregate across
   units (aligns with the project's standing "always normalize units before
   comparing" rule). Fields available per row: value, unit, detection_limit,
   qualifier, censored (src/stores/matrix-map/measurementStore.ts:7-28 -- VERIFIED).
2. **Censored-aware math.** Non-detects must be handled with a left-censored
   estimator (KM / ROS or, at minimum, a documented detection-limit
   substitution), NOT treated as the raw number. The row already exposes
   `censored:boolean` + `detection_limit` to drive this.

---

## B. Methods to Implement

ProUCL (current 5.2; core unchanged from 5.0/5.1) computes a 95% UCL of the mean
(UCL95) -- the EPC term for risk assessment -- plus distribution fits, outlier
tests, and nondetect handling. It is a GUI-only Windows freeware app (C#/.NET 4.0,
MSI) with NO API/library/CLI, so all methods must be reimplemented.

### B.1 UCL95 methods (per distribution)

- **Normal / symmetric:** Student's-t UCL = `xbar + t(0.95, n-1) * s / sqrt(n)`;
  also a modified-t for slight skew.
- **Gamma (preferred for positively skewed positive data):** approximate gamma
  UCL (Wilson-Hilferty / chi-square cutoff using MLE shape k-hat) when
  k-hat >= 0.5; ADJUSTED gamma UCL (small-shape correction) when
  0.1 <= k-hat < 0.5.
- **Lognormal:** Land's H-UCL (Land's H-statistic; available only at 0.90/0.95
  confidence). EPA discourages it for high skew (inflates wildly).
- **Nonparametric / skewed:** Chebyshev (mean, Sd) UCL =
  `xbar + sqrt((1/alpha) - 1) * s / sqrt(n)`, available for any confidence in
  [0.5, 1.0) (so 95%/97.5%/99% variants exist); CLT-UCL / adjusted-CLT; bootstrap
  UCLs -- standard (percentile) bootstrap, bootstrap-t, and BCA (bias-corrected
  accelerated).
- **Censored data:** Kaplan-Meier (KM) based UCLs -- KM(t), KM(%), KM(BCA),
  KM(Chebyshev) -- and ROS-based UCLs.

### B.2 Recommended-UCL DECISION LOGIC (so the panel can SHOW the basis)

The choice is driven by best-fit distribution, sample size n, and skewness
measured by **sigma-hat = SD of log-transformed data** (NOT classical skewness),
or by gamma shape k-hat. This is the logic the panel must surface as
"recommended: X because distribution=Y, n=Z, skew(sigma-hat)=...".

1. Fit-test normal, then gamma, then lognormal (GOF order below).
2. **Normal / approx-normal (sigma-hat < 0.5):** Student's-t UCL
   (KM(t)/KM(%) if censored).
3. **Gamma fit:** approximate gamma UCL if k-hat >= 0.5; adjusted gamma UCL if
   0.1 <= k-hat < 0.5. Gamma is preferred for skewed positive data.
4. **Lognormal fit (scales with sigma-hat and n):** roughly --
   sigma < 0.5 -> t-type; 0.5-1.0 -> 95% Chebyshev (mean Sd); 1.0-1.5 ->
   95-97.5% Chebyshev; 1.5-2.0 -> 97.5-99% Chebyshev; 2.0-3.0 -> 99% Chebyshev
   for small n (< 50-60) else 97.5% Chebyshev; > 3.0 -> data too unstable, use a
   larger confidence coefficient. (Land H-UCL historically used here; ProUCL
   warns it overestimates badly -- v5.2 reserves H-UCL for moderate/large n with
   strong lognormality.) **Flag these exact band cutoffs "verify before
   hardcoding" against proucl_5.1_tech-guide.pdf / current 5.2 Tech Guide
   Ch. 2-3** -- they are corroborated from EPA/600/R-06/022 Table 9-1 + the 4.x
   User Guide but the full Tech Guide PDF could not be fully fetched.
5. **No discernible distribution (nonparametric):** same Chebyshev-by-skewness
   ladder, or 95% KM/bootstrap (BCA) for mild skew. Censored recommendation grid
   is Table 9-1 of EPA/600/R-06/022 (KM(t), KM(%), 95/97.5/99% KM(Chebyshev),
   KM(BCA), keyed to sigma-hat bands and %ND).

ProUCL prints "Recommended UCL to Use" ("Suggested UCL to Use" in older output)
WITH the basis -- the panel should mirror this.

**Load-bearing cautions to surface in the UI:** EPA explicitly discourages the
lognormal model / H-UCL (inflated, unstable UCLs for sigma > 1); v5.2 also
dropped the routine Chebyshev recommendation (it overestimates the mean -> false
"contaminated" calls). Warn when sigma-hat > 1. Methods/UCLs are unreliable below
n ~ 8-10; bootstrap needs n > ~10-15. Lognormal vs gamma are nearly
indistinguishable for n < 50, so prefer gamma for positive skew.

### B.3 Goodness-of-fit (GOF) tests

Significance alpha is user-set; **v5.2 defaults differ by distribution: normal
1%, gamma 5%, lognormal 10%.** Replicate these to match ProUCL output.

- **Normal & Lognormal (lognormal tested on logged data):** Shapiro-Wilk +
  Lilliefors. Accept the distribution if EITHER p >= alpha.
- **Gamma:** "ProUCL Anderson-Darling" + "ProUCL Kolmogorov-Smirnov" (EDF tests
  with gamma-specific simulated critical values). Accept if EITHER p >= alpha.
- Order of testing: normal -> gamma -> lognormal; best-fit reported.

### B.4 Outlier tests (screening only; flag for HITL, never auto-remove)

Assume normality. **Dixon's test for n <= 25** (single/few outliers, test
least-to-most extreme); **Rosner's test (generalized ESD) for n > 25** (detects
multiple outliers at once, avoids masking). ProUCL flags candidates; disposition
is a professional/HITL judgment -- never auto-delete.

### B.5 Censored data (non-detects)

Kaplan-Meier (KM) is the PREFERRED method (handles multiple detection limits;
feeds gamma/lognormal/Chebyshev UCL equations). Regression on order statistics
(ROS) -- robust ROS on logged data (Helsel), and gamma ROS -- is acceptable but
underperforms KM(Chebyshev)/KM(BCA) for high skew. Substitution (DL, DL/2) is
DISCOURAGED -- DL/2(t) gives poor coverage even at 10-20% censoring and worsens
with n and %ND. Above ~70-80% ND, use nonparametric proportion-based methods, not
these.

### B.6 Standard descriptive set (always report)

n; number/percent of detects and nondetects (detection frequency); min; max;
mean; median; SD; coefficient of variation (CV); skewness; percentiles incl.
P90/P95; plus UCL/UPL/UTL and **sigma-hat (SD of log-transformed data)** -- the
skewness driver that explains the recommended-UCL choice.

---

## C. Library Choice

### C.1 Recommended path (matches the client-JS architecture in A)

Because the engine must run on Vercel, the **primary engine is hand-written TS
formulas + a small permissive JS stats lib** for descriptive/quantile primitives.
Candidate libs (both safe to depend on):

- **simple-statistics** (ISC license) -- descriptive stats, quantiles.
- **jStat** (MIT license) -- normal/lognormal/gamma/Student-t PDF/CDF/inverse-CDF
  and quantiles (enough for Student's-t UCL and basic GOF helpers).

Neither has Land H, gamma adjusted-UCL, censored methods, or Rosner ESD -- so
those are hand-coded (C.3). Either add one small lib for descriptive/distribution
primitives, or write the ~200 lines of formulas directly. Keep it a pure TS
module consumed by the panel; heavier iterations (bootstrap, H-UCL) go in a Web
Worker.

### C.2 If exact ProUCL parity is later mandated -> LOCAL-ONLY Python (path b)

For the optional desktop-only "advanced stats" mode (A.5), the Python primitives
exist (no single package replicates ProUCL end-to-end):

- **scipy.stats** (BSD) -- norm/lognorm/gamma `.fit`; GOF via `shapiro`,
  `anderson` (Anderson-Darling), `kstest`, and the newer `goodness_of_fit`
  Monte-Carlo helper; `scipy.stats.t` for the Student's-t quantile; and
  `scipy.stats.bootstrap` with `method in {'percentile','basic','bca'}` (BCa
  default) -- covers ProUCL percentile/BCA bootstrap.
- **scikit-posthocs** (MIT; v0.14.0, 2026-05) -- Generalized ESD (Rosner) +
  Grubbs + Tietjen-Moore. (Dixon's Q is NOT included.)
- **lifelines** (MIT) -- Kaplan-Meier incl. `fit_left_censoring` (non-detects are
  left-censored; Helsel's flip-to-right-censoring convention applies).
- numpy/pandas -- percentiles + moments.

Rejected: **censoredsummarystats** (PyPI; Apache-2.0; v0.2.14, 2024-05) is
summary-stats-only, not a UCL engine, low maturity. **scikit-survival** has KM but
is GPL-3.

### C.3 EXACTLY which ProUCL methods need HAND-CODING (with formula source)

This applies to BOTH the TS path and the Python path (no maintained lib provides
these):

- **Chebyshev UCL** -- trivial:
  `mean + sqrt((1/alpha) - 1) * SE_mean`. Source: ProUCL guidance (EPA ProUCL
  software page). NOTE ProUCL 5.x de-emphasizes Chebyshev.
- **Land's H-UCL (lognormal)** -- no maintained Python/JS impl; needs the Land H
  critical-value tables (scipy/jStat have no H-statistic). Formula source:
  Land (1971, 1975), as used by USEPA Superfund guidance; ProUCL 5.1 Technical
  Guide (EPA, Oct 2015). Reference implementation: EnvStats `elnormAlt`
  `ci.method='land'` (GPL -- READ the formula, do NOT copy code).
- **Gamma UCL, approximate + adjusted** -- hand-code. "Approximate gamma" =
  chi-square approximation on the estimated shape; "adjusted gamma" = Grice & Bain
  (1980) adjustment. Sources: ProUCL 5.1 Tech Guide; Grice & Bain (1980);
  Kulkarni & Powar (2010), Lifetime Data Analysis 16:431-447 (bias-corrected /
  K-P variant). Reference: EnvStats `egamma` `ci.method='chisq.approx'` /
  `'chisq.adj'` (GPL -- read formula only).
- **Bootstrap-t** -- NOT a scipy/JS preset; implement the t-pivot resampling loop
  manually (mean + SE per resample, t-style adjustment). Source: ProUCL 5.1 Tech
  Guide bootstrap section. (Percentile/basic/BCA come from `scipy.stats.bootstrap`
  in the Python path, or are hand-coded in the TS path.)
- **ProUCL gamma GOF critical values** -- to match ProUCL EXACTLY for gamma AD/KS,
  port the ProUCL simulated critical-value tables (EnvStats array
  `ProUCL.Crit.Vals.for.KS.Test.for.Gamma`). Hand-code/port the table.
- **Dixon's Q test** -- not in scikit-posthocs or scipy; hand-code from Dixon
  critical-value tables if required.
- **ROS (robust + gamma)** -- no first-class maintained Python equivalent to
  NADA2; port from Helsel (2011) / NADA `cenros`, or (parity case) shell out to R.

### C.4 The R fallback (highest fidelity; NOT recommended here -- no runtime)

R **EnvStats** (CRAN; GPL >= 3; v3.1.0, 2025-04-24) is the closest open-source
ProUCL replica: `enorm` (Student's-t), `elnormAlt` ci.method='land' (Land H),
`egamma` chisq.approx/chisq.adj (approx/adjusted gamma), `gofTest`
test='proucl.ad.gamma'/'proucl.ks.gamma' + shapiro/anderson/ks, `rosnerTest`
(Rosner ESD). **NADA / NADA2** (CRAN; GPL) add KM (`cenfit`), ROS (`cenros`), MLE
(`cenmle`). This is the least-custom-code, highest-fidelity route -- but
**R IS NOT INSTALLED** (`where Rscript` fails) and the owner does not readily have
it. So R is a documented option, not the plan.

### C.5 Installed-runtime facts (from the integration report)

- System `python.exe` = Python 3.13.12 with scipy 1.17.0 / numpy 2.4.2 /
  pandas 2.3.3 importable. `scripts/catalog-overnight/.venv` = Python 3.13.12 with
  scipy 1.17.1 / numpy 2.4.6 / pandas 3.0.3. Root `.venv` = Python 3.11.9 WITHOUT
  scipy/numpy/pandas. statsmodels not found anywhere. So scipy-class stats are
  available locally but matter ONLY for a LOCAL-ONLY route.
- No JS stats lib currently (package.json: 64 deps, recharts only).

### C.6 Licensing caveat (load-bearing)

EnvStats and scikit-survival are GPL. Reading EnvStats GPL source to RE-DERIVE
formulas is fine; do NOT copy GPL code into the (non-GPL) dashboard. Safe
permissive deps: scipy (BSD), scikit-posthocs (MIT), lifelines (MIT), jStat (MIT),
simple-statistics (ISC).

---

## D. UI -- Surfacing the BASIS in the SELECTION STATS panel

The redesign ties to the existing matrix-map right panel (`MatrixMapRightPanel`),
computing over `filteredRows`, recomputing live as filters change. The panel must
SHOW the calculation basis, not just a number -- that is what makes it credible to
a ProUCL user.

### D.1 Headline block (always visible)

- **Recommended UCL95: <value> <unit>** with a one-line basis string mirroring
  ProUCL: "Recommended: 95% <method> because distribution=<best-fit>, n=<N>,
  skew (sigma-hat)=<value>." Example: "Recommended: 95% adjusted-gamma UCL because
  distribution=gamma (k-hat=0.34), n=42."
- A small caution chip when sigma-hat > 1 ("high skew -- lognormal/H-UCL
  discouraged; gamma/Chebyshev preferred") and when n < 8-10 ("small n -- UCLs
  unreliable").
- Per (substance + unit) header so the user always knows the bucket. If multiple
  units exist for a substance, show a unit selector / one block per unit (NEVER a
  cross-unit aggregate).

### D.2 Descriptive strip (always visible)

n; detects / nondetects (detection frequency %); min; max; mean; median; SD; CV;
skewness; P90; P95; sigma-hat. This is the standard ProUCL summary set (B.6).

### D.3 Expandable "All UCL methods" table

Collapsed by default; expands to a table of every computed UCL (Student's-t,
Chebyshev 95/97.5/99%, gamma approx + adjusted, Land H, bootstrap percentile /
bootstrap-t / BCA, and KM variants when censored), each with its value, the
confidence level, and a flag marking which one is the recommended pick. This lets
a regulatory scientist audit the recommendation against the alternatives, exactly
as they would read ProUCL's full output table.

### D.4 Distribution-fit + outlier results (expandable)

- GOF: per-distribution test names, statistics, p-values, the user alpha
  (defaulting to v5.2's normal 1% / gamma 5% / lognormal 10%), and accept/reject
  with the "either test passes" rule shown.
- Best-fit verdict and testing order (normal -> gamma -> lognormal).
- Outliers: Dixon (n <= 25) or Rosner/ESD (n > 25) candidates listed and FLAGGED
  for HITL review -- never auto-removed; a note states disposition is a
  professional judgment.

### D.5 Censored-handling toggle

A control selecting the non-detect estimator: Kaplan-Meier (default
recommendation), ROS, or documented DL substitution (DL / DL2) -- with the chosen
method named in the basis string and a warning when %ND > ~70-80% ("switch to
nonparametric proportion-based methods"). The toggle must make clear that raw
detection-limit values are NOT being used as point values.

### D.6 Method/alpha controls (advanced, collapsed)

Let the user override the recommended method and the GOF alpha to reproduce a
specific ProUCL run, while the default always shows the auto-recommended pick.

---

## E. Phased Plan

Effort is rough dev-days. "Autonomous-safe" = AI can build + gate it without new
owner spec. "Needs owner spec" = blocked on a section-F answer.

### Phase 1 -- Descriptive stats + Student's-t + Chebyshev UCL (ships on Vercel)

- Build `src/lib/matrix-map/stats.ts`: per (substance + unit) bucketing; full
  descriptive set (B.6); Student's-t UCL; Chebyshev 95/97.5/99% UCL; sigma-hat.
- Wire into the panel: headline UCL + basis string + descriptive strip + the
  per-unit grouping (D.1, D.2). Censored handling in Phase 1 = documented DL
  substitution placeholder (KM lands in Phase 3), clearly labeled.
- Add simple-statistics OR jStat (or hand-write); pure client-JS; runs on Vercel.
- **Autonomous-safe.** Effort ~2-3 days. **Ships on Vercel immediately.**

### Phase 2 -- Distribution fit + recommended-UCL logic + bootstrap

- GOF: Shapiro-Wilk + Lilliefors (normal/lognormal), gamma AD/KS (B.3); accept-if-
  either rule; v5.2 default alphas. Best-fit verdict + testing order.
- Recommended-UCL decision logic (B.2) wired to drive the headline basis string.
- Bootstrap UCLs: percentile + BCA + bootstrap-t (hand-code bootstrap-t; B.1/C.3),
  in a Web Worker.
- "All methods" table + GOF panel (D.3, D.4).
- **Mostly autonomous-safe**; the lognormal Chebyshev-by-sigma band cutoffs
  (B.2.4) are flagged "verify before hardcoding" -- **needs owner confirmation**
  of the exact v5.2 thresholds (section F) before they are baked into the
  recommendation. Effort ~4-6 days.

### Phase 3 -- Gamma / Land-H + outlier tests + censored (KM)

- Gamma approximate + adjusted UCL (C.3); Land H-UCL with H critical-value tables
  (C.3) -- hand-coded from ProUCL 5.1 Tech Guide / Land (1971,1975); reference
  EnvStats formulas (do not copy GPL code).
- Outlier tests: Dixon (n <= 25) + Rosner/ESD (n > 25), flag-only (D.4).
- Censored: Kaplan-Meier UCLs (KM(t), KM(%), KM(Chebyshev), KM(BCA)); censored-
  handling toggle (D.5). KM is hand-coded in TS (lifelines is Python-only and
  local-only).
- Optional: port ProUCL gamma GOF critical-value tables for exact parity (C.3).
- **Needs owner spec** for censored-default + whether exact-parity tables are in
  scope. Effort ~6-9 days (Land H tables + KM + ROS are the heavy items).

### Phase 4 (optional) -- LOCAL-ONLY Python "advanced stats" parity mode

- scipy/scikit-posthocs/lifelines-backed route behind `LOCAL_ENGINE_ENABLED`
  (A.5), reusing spawn_extraction.ts pattern; desktop-only; for owner's own
  regulatory-defensible runs. Client-JS remains the Vercel default.
- **Needs owner go/no-go** (section F). Effort ~4-6 days.

---

## F. Open Questions for the Owner

1. **Default UCLM method.** Should the panel's default be ProUCL's auto-
   recommended pick (distribution-driven decision logic, B.2), or a fixed method
   the owner prefers (e.g. always 95% Chebyshev, or 95% Student's-t)? The
   recommended-UCL logic is the credible-ProUCL behavior, but it is Phase 2 work.

2. **Exact v5.2 lognormal Chebyshev-by-sigma band cutoffs.** The band thresholds
   in B.2.4 (0.5 / 1.0 / 1.5 / 2.0 / 3.0 with the 50-60 small-n switch) are
   corroborated but flagged "verify before hardcoding" -- the full EPA Technical
   Guide PDF could not be fully fetched. Can the owner confirm the exact current
   5.2 thresholds (or provide the Tech Guide Ch. 2-3 table) before we bake them
   into the recommendation engine?

3. **GOF default alphas.** Adopt ProUCL v5.2 defaults (normal 1%, gamma 5%,
   lognormal 10%) as the panel defaults? (Recommended, to match ProUCL output.)

4. **Censored-handling default.** Default non-detect estimator: Kaplan-Meier
   (the ProUCL-preferred method) vs ROS vs a documented DL/2 substitution? KM is
   the credible default but is Phase 3. Until Phase 3 ships, Phase 1/2 use a
   clearly-labeled DL-substitution placeholder -- is that acceptable interim
   behavior?

5. **Local-only Python "advanced stats" mode.** Do you want an optional desktop-
   only scipy-backed parity mode (Phase 4) alongside the always-on client-JS core,
   or is the client-JS engine sufficient for the demo and near-term use? (The
   client-JS core is the only Vercel-viable path either way.)

6. **Exact-parity scope.** Is bit-for-bit ProUCL parity required (port ProUCL's
   simulated gamma GOF critical-value tables + Land H tables), or is a
   "ProUCL-equivalent, methods-and-basis-shown" engine sufficient? Exact parity
   adds significant Phase 3 effort and is the main driver of whether the R/Python
   fallback is ever needed.

---

## G. Source ledger (carry-through, not invented)

**ProUCL:** standalone Windows GUI freeware, C#/.NET 4.0, ProUCLInstall.msi, NO
API/CLI/library. Authoritative pages: EPA ProUCL software
(https://www.epa.gov/land-research/proucl-software); ProUCL 5.1 Technical Guide
(https://www.epa.gov/sites/default/files/2016-05/documents/proucl_5.1_tech-guide.pdf);
censored-data Table 9-1, EPA/600/R-06/022, March 2006, Singh/Maichle/Lee
(https://www.environmentalrestoration.wiki/images/4/4c/Singh_EPA-2006-Computation.pdf);
v5.0 Tech Guide
(https://www.epa.gov/sites/default/files/2015-03/documents/proucl_v5.0_tech.pdf);
v5.1->5.2 change summary (Integral)
(https://www.integral-corp.com/resources/epa-revs-up-proucl-how-will-your-site-be-affected/);
GOF/outlier overview (PMC4627007); Dixon-vs-Rosner split (ITRC GSMC-1).

**Libraries (license):** EnvStats R (GPL>=3); NADA/NADA2 R (GPL);
scipy.stats / scipy.stats.bootstrap (BSD); scikit-posthocs (MIT);
lifelines (MIT); censoredsummarystats (Apache-2.0, low maturity);
jStat (MIT); simple-statistics (ISC); scikit-survival (GPL-3).

**Formula sources for hand-coded methods:** Land (1971, 1975) + ProUCL 5.1 Tech
Guide (Land H-UCL); Grice & Bain (1980) + Kulkarni & Powar (2010) LDA 16:431-447 +
ProUCL 5.1 Tech Guide (approx/adjusted gamma); ProUCL 5.1 Tech Guide bootstrap
section (bootstrap-t); Rosner (1983) Technometrics (ESD); Helsel (2011) / NADA
cenros (ROS); EnvStats array `ProUCL.Crit.Vals.for.KS.Test.for.Gamma` (gamma GOF
critical values -- reference only, GPL).

**Codebase refs (verified where checked):**
src/lib/api-guards.ts:56 (`requireLocalEngine()` 503 -- VERIFIED);
src/app/api/engine-v2/projects/[id]/evaluate/route.ts:130 (503 gate),
:47-56,355-357 (env-var python paths);
src/lib/engine-v2/spawn_extraction.ts:32-71 (spawn template);
next.config.ts:18-33 (Vercel externalization); vercel.json:1-11 (no Python
runtime); src/components/matrix-options/MatrixMapRightPanel.tsx:113-156,172-175,849-863
(RPC fetch -> client filter -> filteredRows); src/stores/matrix-map/measurementStore.ts:7-28
(row fields value/unit/detection_limit/qualifier/censored -- VERIFIED);
package.json (no JS stats dep; recharts only).

---

*Authored 2026-06-05. Plain ASCII (code point <= 127). Synthesized from three
research reports (ProUCL methods, OSS libraries, stack integration); no values
invented. Band cutoffs flagged "verify before hardcoding" pending the current 5.2
Technical Guide. Pending owner answers in section F.*

---

## OWNER DECISIONS -- LOCKED (2026-06-05 evening)

1. **UCLM default = ProUCL recommended-logic** (auto-select the recommended UCL by best-fit
   distribution + n + skewness/sigma-hat), with ALL methods selectable (Student's-t, Chebyshev,
   gamma approx/adjusted, Land H, bootstrap percentile/BCA/bootstrap-t, KM). Panel shows the
   recommended value PROMINENTLY + the basis ("recommended: X because distribution=Y, n=Z, skew=...")
   + an expandable table of all methods.
2. **Censored (non-detect) handling = a runtime SELECTOR**, not a fixed default. Options: Kaplan-Meier
   (KM), Regression on Order Statistics (ROS), DL/2 substitution. Sensible initial selection = KM
   (ProUCL default for censored). User can switch and the stats recompute.
3. **Fidelity bar = BIT-FOR-BIT ProUCL v5.2 PARITY.** Implications (raises care/effort per phase):
   - Every formula, table, and cutoff must be verified against the ProUCL v5.2 Technical Guide
     BEFORE hardcoding: Land H-statistic tables (Land 1971/1975), gamma k-hat cutoffs (0.5 / 0.1),
     the lognormal Chebyshev band cutoffs (sigma-hat bands -- flagged "verify before hardcode"),
     GOF alphas (1%/5%/10%), Dixon/Rosner critical values, and THE RECOMMENDED-UCL DECISION TREE.
   - Build a VALIDATION SUITE that reproduces ProUCL's published example-dataset outputs (the
     Technical Guide worked examples) to prove parity. This is the regulatory-credibility gate.
4. **Local-only Python parity mode = YES** (future add-on). An engine-v2-style local Python service
   (scipy + scikit-posthocs + lifelines), gated like requireLocalEngine() (503 on cloud). Purpose:
   (a) independent validation/cross-check of the client-JS engine; (b) the escape hatch for a
   single filtered selection that is itself enormous (see Scaling Addendum). NOT on the demo path.

## SCALING ADDENDUM -- data is in Supabase and will grow large (owner raised 2026-06-05)

The owner correctly notes matrix_map data lives in Supabase and will become very large (small now).
This does NOT change the client-side TypeScript stats-engine recommendation. Why:

- **Stats are ALWAYS computed on a FILTERED SELECTION** (one substance + one unit + one medium +
  a spatial/sample selection), never the whole table. A single filtered selection stays bounded
  (hundreds-to-low-thousands of values) even when the TOTAL dataset is millions of rows -- you only
  ever view one parameter in one area at a time. So the stat INPUT is naturally bounded.
- **Refinement to the data-fetch layer (the real change growth requires):** push filtering
  SERVER-SIDE. The fetch_measurements RPC (currently fetch_measurements_for_samples) should accept
  filter params (substance_id, medium, maybe bbox) so the server returns ONLY the matching rows.
  Then the client pulls the bounded selection, not the whole table. This is a fetch-layer concern,
  separate from the stats engine, and is the scalability lever as data grows.
- **Vercel constraint is unchanged:** Python is local-only (requireLocalEngine 503s on cloud), so
  server-side STATS in Python is not viable on the demo path. Server-side FILTERING (in the
  Postgres RPC) IS viable and is the right scaling move. Server-side basic AGGREGATES (count/mean/
  percentiles via SQL) could pre-reduce huge selections, but the advanced ProUCL methods stay
  client-JS (or the local-only Python parity mode for validation).
- **Edge case** (one filtered selection itself enormous, e.g. millions of one substance): handled by
  (a) the local-only Python parity mode (#4), or (b) a future Postgres pre-aggregation/sampling
  step. Deferred -- not a near-term concern.
- **Net:** client-JS stats engine + server-side-scoped fetch = correct now AND scales. No rework
  from the Supabase-storage / growth reality.

## EXECUTION = MIGRATE TO A FRESH PLAN-MODE SESSION (owner directive 2026-06-05)
No code is written in the current (research/planning) session. Execution migrates to a FRESH session
that starts in PLAN MODE, reads this doc + the codebase + the docs, plans the implementation at the
file level, and exits plan mode for owner approval BEFORE touching code. See
FRESH_SESSION_PLAN_MATRIX_MAP_STATS_2026_06_05.md for the full handoff.
