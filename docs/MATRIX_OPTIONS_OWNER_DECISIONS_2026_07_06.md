# Matrix Options -- Owner Decision Packet (2026-07-06)

Status: DECISION-NEEDED items teed up for owner judgment. Nothing in this doc has been applied
autonomously. Values / defaults are only mutated on explicit inline owner approval (dashboard rule:
AI never promotes, demotes, or re-ranks defaults, nor mutates catalog values, without HITL action).

Context: this session shipped four provenance-integrity PRs (#522 zinc/mn tension flags, #523 handoff,
#524 CAS/name-mismatch guard, #525 cross-source divergence extension -- all MERGED). It then
RE-GROUNDED the three owner-gated lanes from the 2026-07-01 / 2026-07-05 planning docs against the
CURRENT catalog. Headline: intervening sessions (the 2026-07-04 sweeps + the 2026-07-05 apply) already
completed ~90% of what those docs framed as pending. The genuinely-open items are few and precise, and
are listed below. All catalog-state claims here were verified by reading
`matrix_research/reference_catalog/human_health_trv_values.json` on the post-#522 main tip.

---

## Lane 1 -- inorganic / metal cohort: DONE (2 policy decisions remain)

The 2026-07-01 HITL doc (Group 4) framed "add `'inorganic'` to `ContaminantClass`" as a one-line
unblock for a ~37-substance cohort. Re-grounding finding: **that enum change and the entire cohort
wiring it unblocked are already merged.**
- `src/lib/matrix-options/types.ts:12` already has `| 'inorganic'`.
- `src/lib/matrix-options/substanceLibrary.ts` carries 25 `contaminantClass: 'inorganic'` entries;
  every substance named in Group 3b's "clean", "backfill", "do-not-conflate", and "cyanide-dedup"
  sub-cohorts has its own wired `key:` entry (metal salts wired as OWN keys, not backfilled into the
  parent element -- e.g. `mercuric_chloride_hgcl2` stays separate from `mercury_inorganic`;
  `nickel_chloride` / `nickel_soluble_salts` / `nickel_sulfate` stay separate from `nickel`).
- `FRAME_DEFAULT_PROFILES` (frameDefaults.ts) is NOT a substance-value layer -- it seeds only receptor
  exposure factors (BW, IR, EF, ...) per regulatory frame; no substance appears there and none should.
  The earlier plan's premise that the cohort needed frame-default seeding was incorrect.

### DECISION-NEEDED (2 substances, policy calls -- not build gaps)
Only two of the named cohort are unwired, both pre-declared HITL-deferred:
1. **`pcbs_non_coplanar`** -- PCB congener-grouping policy. Blocked on the same call as
   `total_pcbs_aroclor_1254` (see Lane 3 + `docs/MATRIX_OPTIONS_PCB_KEY_CONSOLIDATION_DECISION_2026_07_02.md`,
   which recommends Option A: keep `total_pcbs_aroclor_1254` canonical, alias congener-specific keys,
   never additive). RECOMMENDATION: fold `pcbs_non_coplanar` into that single PCB-policy decision
   rather than treating it as a separate wiring task.
2. **`phenylmercuric_acetate`** -- no clean `ContaminantClass` fit (sits between `methyl-Hg`,
   `divalent-metal`, and `mercury_inorganic`). RECOMMENDATION: owner picks the class (or approves a
   new `organomercury` class); then it is mechanical to wire.
   - RESOLVED 2026-07-11d (verified in code): `phenylmercuric_acetate` is now wired as its own
     entry in `src/lib/matrix-options/substanceLibrary.ts` with `contaminantClass: 'organic'`
     (pragmatic bucket, documented in the entry's `notes` as NOT elemental/organic mercury since no
     `organomercury` class exists in the closed `ContaminantClass` union), `abs_dermal: 0.1`
     (organic-class default), and `rfd_oral_mg_per_kg_bw_per_day: 0.00008` (US EPA IRIS, CASRN
     62-38-4, qa_status=approved). No open class decision remains for this substance.

RECOMMENDATION: mark Group 3b / Group 4 CLOSED in the HITL-decisions doc and re-file these two under a
narrow "PCB + organomercury policy" ticket.

---

## Lane 2 -- HC TRV v4.0 catalog re-verification (OPEN; correctness-critical)

This is the one lane with substantive open engineering work. Problem (per `docs/NEXT_STEPS.md`
2026-07-04): the catalog's HC values were extracted from a canada.ca page that is now dead, so no HC
value in the library is currently re-verifiable against a live cited source. The chlorobenzene
mis-file scare showed this class of error is real.

Good news: the tooling to close this already exists on main (shipped via #518):
- `scripts/matrix-options/hc_trv_v4_extract.py` -- extracts HC TRV v4.0 Table 1 from the PDF.
- `scripts/matrix-options/hc-trv-v4-crosscheck.mjs` -- compares extracted values against the catalog
  (the check #522 hardened; it already flags value/`value_text` mismatches and adult-vs-sensitive /
  from-birth ambiguities).
- `scripts/matrix-options/data/hc_trv_v4_table1_extracted.json` -- the extracted reference table.

### PROPOSED PLAN (for owner review; no values changed until approved)
1. Confirm the canonical HC TRV v4.0 PDF source (the 2025 edition) and its stable locator (Zotero key
   or the `G:\...\References` path), since the web page is dead. -- owner-supplied source pointer.
2. Re-run `hc_trv_v4_extract.py` against that PDF to refresh `hc_trv_v4_table1_extracted.json`
   (orchestrator runs; AGY can author any script changes needed).
3. Run `hc-trv-v4-crosscheck.mjs` catalog-wide; triage the AMBIGUOUS / mismatch rows it reports.
4. For each HC-sourced row, stamp the exact PDF locator (page/table) into its evidence item so the
   value is re-verifiable going forward, and resolve any route/endpoint mis-map (the chlorobenzene
   class). Any VALUE change is owner-attested per row, never bulk.
5. Deliverable: a per-row HC v4.0 verification ledger + a short repair PR for confirmed mis-maps.

RECOMMENDATION: schedule this as its own focused lane; it is the highest-value correctness work
remaining. It needs the owner to first supply the canonical PDF source pointer (step 1).

---

## Lane 3 -- current_default Phase 2: 18 of 20 applied; 2 open + 2 to confirm

The 2026-07-05 recency proposal (default = most-protective approved value UNLESS outdated, then the
newer authority wins; HC TRV v4.0 = 2025) proposed 20 picks. Re-grounding finding: **18 are already
applied and match the proposal.** Verified current state below.

### Already applied, matches proposal -- NO action (18)
barium 0.19, carbon_tetrachloride 0.00071, chromium_trivalent 0.3, dichloroethylene_1_1 0.003,
ethylbenzene 0.022, manganese 0.025, tetrachloroethylene 0.0047, toluene 0.0097, xylenes 0.013
(all HC v4.0); chlorobenzene 0.43 (HC v4.0, via #520 -- CONFIRMED current_default, NOT pending);
dichloromethane rfd 0.006 + sf 0.0033, trichloroethylene rfd 0.0005 + sf 0.052 (US EPA IRIS 2011);
zinc rfd 0.3 (US EPA IRIS); arsenic_inorganic sf 32 (US EPA IRIS 2025); cadmium 0.0008 + methylmercury
0.0002 (HC v4.0 -- see confirm-after-fact below).

### DECISION-NEEDED (2)
1. **`dichlorobenzene_1_2` (rfd_oral)** -- CORRECTED 2026-07-06: NOT an inconsistency; already decided.
   An earlier draft of this doc flagged the IRIS-0.09 default as a stale artifact that the recency rule
   should overturn to HC 0.43. That framing was WRONG -- it trusted the "HC v4.0 (2025)" label as the
   assessment vintage. The `substanceLibrary.ts` provenance note (human-verified 2026-07-04) shows:
   (a) the HC 0.43 value is HC's **1996** assessment (NTP 1985b chronic gavage), the "2025" being only
   the TRV-table publication date; and (b) the IRIS **0.09** current_default was **deliberately set by
   the owner on 2026-07-05** "per the conflict rule (more protective than the Health Canada value)".
   So it is HC-1996 vs IRIS-1989 -- no generational gap -- and the recency rule's "newer wins" trigger
   (which fires only when the most-protective value is genuinely outdated) does NOT apply; most-
   protective (IRIS 0.09) stands. RESOLUTION: KEEP IRIS 0.09; no change. Lesson recorded: a TRV-table
   publication date is not the assessment vintage -- check the underlying assessment year before
   applying "newer wins".
2. **`total_pcbs_aroclor_1254` (rfd_oral)** -- no current_default set (HC 0.00001 vs EPA 0.00002, both
   `available_option`). Correctly pending on the PCB-policy decision (Lane 1 item 1). RECOMMENDATION:
   resolve with the single PCB-policy call; do not auto-apply.

### CONFIRM-AFTER-THE-FACT (2) -- picks look right, but the hold step was bypassed
`cadmium` (current_default HC v4.0 0.0008) and `methylmercury` (current_default HC v4.0 sensitive
0.0002) were FLAGGED for owner hold in the 2026-07-05 proposal (cadmium route-split; methylmercury
IRIS reassessment in progress) but a later apply set their current_default to the proposal's own
recommended pick anyway. Both picks are defensible (methylmercury 0.0002 is the most-protective
sensitive-population value; cadmium 0.0008 is the HC v4.0 value). RECOMMENDATION: owner confirms these
two after the fact, or directs a change. No urgency -- both are internally consistent.

### HELD -- correctly untouched (1); SF question RESOLVED 2026-07-06
`benzo_a_pyrene` -- no current_default on any rfd/sf row (all `available_option`), pending HC-2016a
verification. Confirmed correct.
- UPDATE (A2 verification, see `MATRIX_OPTIONS_A2_VERIFICATION_RESULTS_2026_07_06.md`): the oral-SF
  "discrepancy" is NOT a data error. The catalog's EPA `2.0 (mg/kg-d)^-1` is the current IRIS
  LIFETIME slope factor with ADAFs baked in; IRIS separately lists `1.0` (adult-only). HC v4.0 =
  `1.289`. So the remaining owner decision is only (a) which current_default (HC 1.289 vs an EPA
  scenario), and (b) TAG each EPA sf row with its scenario (adult-only 1.0 vs lifetime-with-ADAF 2.0)
  so the two IRIS numbers are not conflated. Also feeds the cumulative-PAH ADAF handling (do not
  double-apply ADAFs if anchoring on the 2.0 figure).

---

## Summary of what the owner actually needs to decide

| # | Lane | Item | Recommendation |
|---|------|------|----------------|
| 1 | 1+3 | PCB policy (`total_pcbs_aroclor_1254` default + `pcbs_non_coplanar` wiring) | Adopt Option A (PCB-consolidation doc); one decision closes both |
| 2 | 1 | `phenylmercuric_acetate` ContaminantClass | RESOLVED 2026-07-11d: wired as `organic` (pragmatic bucket) in substanceLibrary.ts; no action needed |
| 3 | 3 | `dichlorobenzene_1_2` default | RESOLVED 2026-07-06: keep IRIS 0.09 (owner's 07-05 more-protective call; HC 0.43 is 1996-vintage despite the 2025 table label). No action. |
| 4 | 3 | Confirm cadmium 0.0008 + methylmercury 0.0002 defaults (applied despite hold flag) | Confirm or redirect; low urgency |
| 5 | 2 | HC v4.0 catalog re-verification | Owner supplies canonical PDF source pointer -> run the existing #518 tooling as a focused lane |

Nothing above is applied. On inline owner approval of any item, the dry-run -> before/after -> apply
flow (promote-*.mjs / default set) runs per the dashboard attestation rule.
