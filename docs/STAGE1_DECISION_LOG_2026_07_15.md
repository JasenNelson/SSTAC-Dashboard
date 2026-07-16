# Stage 1 Owner Decision Log -- 2026-07-15 (append-only)

Companion to `STAGE1_DECISION_PACKET_2026_07_15.md`. Records owner rulings as they are made.
Every PRODUCTION-WRITE ruling still requires a SEPARATE exact-operation approval before any write.
Orchestrator verified each load-bearing value against the cited source before presenting.

| # | Row | Ruling | Owner decision | Write authorized | Status |
|---|---|---|---|---|---|
| 1 | #9 | Cadmium + methylmercury current_default | CONFIRM HC defaults (cadmium 0.0008 / MeHg 0.0002) as HC-policy-preference over lower IRIS alternatives (Cd IRIS-water 0.0005 / MeHg IRIS 0.0001) | confirm-only, NO value change | RULED -- no write needed |
| 2 | #7 | IOCO Shoreline publish | YES -- publish (make public, +6 samples, 4th public DRA) | PRODUCTION-WRITE: matrix_map.dras ea15e94a-b093-4cb4-bd4d-80ab9eae16d4 public false->true, executed in-app via flip_dra_public (separate exact-op) | RULED -- pending in-app flip |
| 3 | #8 | IOCO admin-JWT publish-retry blocker | COLLAPSED -- AGY framing stale: the post-write read-back already shipped in PR #642 (merged). Remaining action = the ruling-2 in-app flip (owner admin JWT); #659 CSRF fix cleared the 403. | none (mechanism only) | RESOLVED via #642 + #659 |
| 4 | #12 | D2 benzo_a_pyrene cancer-slope anchor | KEEP EPA 2.0 anchor (embedded lifetime ADAF). HC 1.289 stays tagged; eligible for default ONLY after ADAF multi-bin wiring (row #16/#22) lands + is verified (flipping now would underestimate early-life risk ~10x) | confirm-only, NO value change | RULED -- no write needed |
| 5 | #13 | D3 PCB canonical key | OPTION A + RELABEL. Make the fully-wired Total-PCBs row canonical BUT rename/relabel key+displayName away from `aroclor_1254` -> "Total PCBs" with provenance notes (SF 2.0 = EPA high-risk total-PCB; FCV 0.014 = NRWQC total-PCB; RfD 2.0e-5 = IRIS Aroclor-1254 surrogate). Adopt Decision-2 convention: total-PCB default; Aroclor/congener-specific as explicit NON-ADDITIVE alternatives; dioxin-like via TEQ (row #23). Verified current vs EPA IRIS + CalEPA HHRA Note 8. | PRODUCTION-WRITE: substanceLibrary.ts relabel + alias/deprecate stub + eco_values.json/human_health_trv_values.json catalog-row migration -- STAGED behind ruling 6 QP check; SEPARATE exact-operation approval required before any write | RULED -- write staged (gated on #15) |
| 6 | #15 | PCB re-key QP protectiveness check | DO NOT ATTEST now. Catalog-row re-key BLOCKED pending a dedicated QP protectiveness packet (site congener profile vs FCV 0.014/logKow 6.5 EqP benchmark + the more-protective non-coplanar RfD basis). AUTHORIZED: draft the QP sign-off packet ONLY. | NO migration write authorized. AGY may DRAFT the QP packet (no write). | RULED -- packet-draft authorized; migration blocked |
| 7 | #16 | ADAF multi-bin exposure-weighting API | BUILD the multi-bin `{ageBin,exposureFraction}[]` API in computeBaPeq (EPA default ADAF bins). Unblocks cumulative UI (#22) + makes HC 1.289 anchor-eligible later. | CODE (Stage 2, AGY writes + methodology spec, codex-gated). No data write. | RULED -- build authorized (Stage 2) |
| 8 | #17 | IRIS 41 needs_review alternates | PER-GROUP disposition; RE-VERIFY counts against live catalog FIRST, then dispose per-group (reject-superseded vs retain-option per substance), author promote/reject script after. | PRODUCTION-WRITE deferred until per-group ruling. Stage 2: AGY drafts inventory script, orchestrator runs it, then owner disposes. | RULED -- verify-first, no write yet |
| 9 | #18 | Copper oral RfD default | PROMOTE HC 0.426 to current_default (matches wired value + HC-default hierarchy from ruling 1), DISPOSE P28 0.09/0.141 + the needs_review starter. (Noted: P28 0.09 is more protective; owner chose HC hierarchy.) | PRODUCTION-WRITE: set pv-hc-copper-* current_default + reject P28 rows -- Stage 2 Lane B via T32 fail-closed template + separate exact-op approval. | RULED -- write staged (Stage 2 Lane B) |
| 10 | #19 | Catalog-count reconciliation | ADOPT live-verified count (13 subs / 31 groups / 85 rows) as arbitration ground truth; PARK the untraceable "20 supersede-or-reject" as UNVERIFIED until located/re-derived. | confirm/clarify, NO write | RULED -- no write needed |

## Stage 1 summary (all 10 ruled 2026-07-15)
- No-write confirms: #9 (Cd/MeHg HC defaults), #12 (keep EPA 2.0 BaP anchor), #19 (adopt live count).
- IOCO: #7 publish YES (in-app flip pending, separate exact-op); #8 resolved via #642+#659.
- PCB: #13 Option A + relabel to Total PCBs (write staged behind #15 QP packet, not attested).
- Build (Stage 2 code, AGY writes, codex-gated): #16 multi-bin ADAF API (unblocks #22).
- Verify-first: #17 IRIS per-group (inventory script first); #15 QP packet draft authorized.
- Catalog PRODUCTION-WRITE staged (Stage 2 Lane B, fail-closed template, separate exact-op approval): #18 copper HC 0.426.


## Verification corrections applied to the packet before presenting (orchestrator, vs AGY draft)
- S1: AGY rationale "most protective" was WRONG -- corrected to HC-policy-preference over lower approved IRIS alternatives (values confirmed in MATRIX_OPTIONS_LANE1_OWNER_DECISION_PACKET_2026_07_12.md).
- S9 (copper): AGY "confirm-only" was WRONG -- currently wired value is 0.04 (unsupportable), HC 0.426 row is only available_option; a ruling to adopt HC 0.426 is a PRODUCTION-WRITE (promote + dispose P28 0.09/0.141). Values confirmed (Deep Library Audit + HITL 0701 retriage).
- S4 (BaP): source doc (FOLLOWUP C2) already records "keep EPA 2.0 anchor" as its Option B and leans that way; presented by substance not AGY's re-lettered options.
