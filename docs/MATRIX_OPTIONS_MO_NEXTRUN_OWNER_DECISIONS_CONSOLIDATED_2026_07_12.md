# mo-nextrun-2026-07-12 -- Consolidated Owner-Decision Packet

Single batched list of EVERY owner-gated action produced by the fresh run (Lanes 1-4). All prep is
PREP-ONLY and shipped in PR #619; nothing below was applied. Each item points to its detailed packet
(which carries the exact SQL / script / paste-ready approval sentence). Nothing here is urgent or
time-boxed; work them in any order. Recommended sequencing is by blast-radius (cheap/mechanical first).

## A. Catalog (Lane 1) -- packet: docs/MATRIX_OPTIONS_LANE1_OWNER_DECISION_PACKET_2026_07_12.md
Rule: AI dry-ran; owner runs promote-*.mjs --apply (or gives inline attestation). NOTE the catalog
counts were union-corrected (parameter_values + human_health_trv_values + eco_values = 1779 rows).
1. **D1 dioxin-TEQ** -- READY. Attest the HC v4.0 p.42 locator, then `promote-hc-dioxin-teq.mjs --apply`
   + the coupled tripwire edit in the SAME commit, then tsc/lint/test:ci. (Cheapest -- 1 row, script
   ready, provisional-TDI qualifier preserved.) The EXACT tripwire edit (embedded here so it survives a
   fresh checkout -- do NOT apply it until AFTER --apply flips the row, or the set-equality guard trips)
   in `src/lib/matrix-options/provenance/__tests__/catalog.test.ts`: add the import
   `import { HC_DIOXIN_TEQ_PROMOTION_VALUE_IDS } from '../../../../../scripts/matrix-options/promote-hc-dioxin-teq.mjs';`
   (beside the other promote-*.mjs imports, ~line 33), and add `...HC_DIOXIN_TEQ_PROMOTION_VALUE_IDS,`
   into the `sanctionedPromotionIds` Set (after `...IRIS_PFDA_DUPE_CG_CANONICAL_VALUE_IDS,`, ~line 693).
2. **cadmium + methylmercury** current_default CONFIRM (HC-policy-preference over lower approved IRIS
   alternatives; no value at risk). Confirm-only.
3. **41 IRIS needs_review alternates** -- per-group reject/retain/set-default ruling (8 substances).
4. **copper + sodium_ion** Protocol-28 rows -- rule among HC 0.426 (approved) / P28 0.09 / P28-water
   0.141 for copper; base 34.3 vs water 21.2 for sodium_ion.
5. **D3 PCB Option A** ruling -- closes total_pcbs_aroclor_1254 default + pcbs_non_coplanar alias +
   disposition of all needs_review PCB rows (incl the current_default starter rows).
6. **D2 benzo_a_pyrene** anchor + ADAF scenario + disposition of the needs_review BaP starter/P28 rows.
7. **357 P28 verify-vs-primary sweep** (union count: 351 in human_health_trv_values + 6 in
   parameter_values.json) -- per-value, against each row's PRIMARY cited source (not the Protocol-28
   compilation PDF). Worklist: docs/MATRIX_OPTIONS_P28_VERIFY_WORKLIST_2026_07_12.md (357 rows).
8. **Ambiguities to reconcile** -- the completion-status "15 conflicts" (verified union = 33 subs / 62
   groups / 157 rows) and the untraceable "20 supersede-or-reject" list.

## B. Matrix Map data writes (Lane 2)
9. **T31 STEP-2 apply** -- packet: docs/MATRIX_OPTIONS_T31_STEP1_REPORT_2026_07_12.md section 9.
   TWO-GATE sequence (do NOT collapse): (a) owner authorizes STEP-2; (b) regenerate the 25-batch SQL +
   manifest and run codex-review to GREEN on those EXACT freshly-regenerated artifacts; (c) **STOP and
   present the exact artifacts (batch filenames, +4178 undated events / +5752 measurement counts, codex
   verdict) for the owner's approval of THAT specific reviewed operation** -- the repo Supabase gate
   requires approval of the exact write, not a generic pre-approval; (d) only then apply_live_load.py.
   The paste-ready STEP-2 sentence in the report is the (c) approval, given AFTER the exact artifacts
   exist. (STEP-1 already done; no apply until (c).)
10. **T32 waterbody UPDATE** -- packet: docs/MATRIX_OPTIONS_T32_WATERBODY_OWNER_PACKET_2026_07_12.md.
    codex-review the exact 39-row UPDATE, then apply verify-before-commit (Marine 268 / Freshwater 22).

## C. E2E enablement (Lane 3) -- packet: docs/MATRIX_OPTIONS_T40_ADMIN_TIER_OWNER_GATE_2026_07_12.md
11. **Enable authenticated E2E** (optional) -- set GH secrets E2E_TEST_EMAIL / E2E_TEST_PASSWORD
    (sstac-e2e-reviewer) + repo variable E2E_AUTH_ENABLED=true. Turns on the member-authenticated
    coverage the new specs added.
12. **Admin-tier E2E** (optional follow-up) -- create an admin-role test user + storageState to unlock
    admin-side positive coverage (no admin fixture exists today).

## D. DRA map (Lane 4) -- packet: docs/design/matrix-map/DRA_EXPANSION_LOCATORS_AND_IOCO_PACKET_2026_07_12.md
13. **Publish IOCO Shoreline** (ea15e94a) -- coordinate-safe (all 6 samples surveyed/high-tier); flip
    via matrix_map.flip_dra_public (admin JWT). Note the source is a DRAFT ERA. This is a Supabase
    data write, so the repo gate applies to EVERY execution path: BEFORE the flip is run (by an agent
    OR by the owner in an admin session), `/codex-review` GREEN on the EXACT operation -- the literal
    `flip_dra_public` call with dra_id `ea15e94a-b093-4cb4-bd4d-80ab9eae16d4` and payload -- PLUS
    explicit owner approval (the paste-ready sentence). Reviewing this packet is NOT a substitute for
    exact-operation review of the literal call that mutates production visibility.
14. **Coordinate-extraction lane** (deferred) -- all 4 centroid-DRA source PDFs are located (full paths
    in the packet, section 2a). The OCR/table-extraction + coordinate WRITE is a separate owner-gated,
    checkpoint-bound follow-on lane (AGY drafts the extraction harness; orchestrator runs; write held).

## E. Inhalation (Lane 5) -- PARKED
15. Needs the owner's section-7 approval sentence + a VF/PEF anchor decision before any wiring (input
    fields already reserved fail-closed, PR #610). Not started this run.

---
Nothing above is applied. PR #619 holds all four lanes' prep (CI fully green through the Lane-3 tip
3628324; the Lane-4 tip 2c11979 CI must be confirmed before merge). When you approve any item, the
next session (or this one, if resumed) executes it through its gate.
