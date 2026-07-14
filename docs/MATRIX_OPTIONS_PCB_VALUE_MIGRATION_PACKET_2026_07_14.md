# Matrix Options -- PCB (D3) Value-Migration Evidence Packet (2026-07-14)

## Context
Option A was ruled (`total_pcbs_aroclor_1254` canonical, `polychlorinated_biphenyls_total_pcbs` deprecated alias, non-additive) and the NOTES landed in the 2026-07-13d follow-up. The remaining step is migrating/re-keying the alias's OWNED catalog records, OR leaving them split. NO value migration is performed by this packet.

## EXACT alias-owned rows that a migration would touch (verified read-only from the catalog)
*   `pv-p28-polychlorinated_biphenyls_total_pcbs-hh-direct-rfd` : rfd_oral 0.00013, human-health-direct, BC Protocol 28 v3.0, default_status available_option, qa_status needs_review.
*   `pv-p28-polychlorinated_biphenyls_total_pcbs-hh-food-rfd` : rfd_oral 0.00013, human-health-food, BC Protocol 28 v3.0, available_option, needs_review.
*   `pv-eco-polychlorinated_biphenyls_total_pcbs-direct-fcv-nrwqc` : fcv_ug_per_L 0.014, eco-direct-eqp, US EPA NRWQC, available_option, qa_status approved.

## Load-bearing protectiveness caveat (from the PCB decision brief)
Pairing the shared 0.014 ug/L water FCV with logKow 6.5 in the EqP model yields a LESS-stringent sediment benchmark; any consolidation must be checked against the SITE congener profile before it is treated as protective. This check requires site-specific congener data the AI does not have -- it is a QP protectiveness judgment.

## Options

*   **Option A-migrate:** Re-key the 3 alias-owned rows to substance_key `total_pcbs_aroclor_1254` (or mark superseded), so the canonical key owns them.
    *   **Risk:** The aroclor row already carries an approved FCV 0.014 (same value) + full HH toxicity; the P28 0.00013 direct/food RfDs (needs_review) would become alternates under the canonical key. Must confirm no double-count vs the canonical row's own RfD (2.0e-5) and that the FCV is not duplicated.
    *   **Test plan:** catalog.test tripwire unaffected (no `current_default` change); librarySeedCurrentDefault unaffected; add a resolver test that `total_pcbs_aroclor_1254` resolves the intended FCV/RfD and the alias key no longer double-supplies.
*   **Option B-split (leave as-is):** Keep the 3 rows under the alias key with cross-reference notes (already done in #638). Lowest risk; the ambiguity persists in the catalog but the library alias notes make it explicit.

## Recommendation
Obtain the EqP/site-congener protectiveness check FIRST (owner/QP). Then Option A-migrate if protective, else Option B-split. Do NOT migrate values without that check + exact owner approval.

## Blast radius
PCB eco/HH resolution + EqP sediment benchmark (HIGH protectiveness sensitivity). Reversibility MEDIUM (PR) but protectiveness-sensitive.
**Exact stop boundary:** NO value migration / re-key / default change without the site-congener check AND exact owner approval.

## Approvals
Paste-ready approval line for A and B:
`[ ] APPROVED: Option A-migrate (re-key after site-congener protectiveness check)`
`[ ] APPROVED: Option B-split (leave as-is, ambiguity persists but library notes explicitly address it)`
