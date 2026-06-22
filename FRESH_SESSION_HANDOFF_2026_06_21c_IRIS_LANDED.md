# SSTAC-Dashboard -- Session Handoff 2026-06-21c (US EPA IRIS 955 rows LANDED)

Supersedes the "HELD" status in FRESH_SESSION_HANDOFF_2026_06_21b. Main at close: b1fcf1a. Plain ASCII.

PR #380 (the 955 US EPA IRIS rows held in 21b) is now MERGED. This closes the IRIS lanes.

---

## Landed since 21b
- **PR #380 (b1fcf1a) MERGED** -- feat(matrix-options): promote 955 US EPA IRIS rows (680 oral RfD +
  275 chem-details). Owner-attested (J. Nelson). It was held on a CI EvidenceLibrary render timeout;
  landed after two fixes on the branch:
  1. **EvidenceLibrary test fixture (codex Option 1):** EvidenceLibrary.test.tsx now vi.mocks the
     catalog module with a compact representative fixture (evidenceLibraryFixture.ts). File 644s -> ~18s;
     all 58 tests pass UNCHANGED (no assertion weakened; diff was +mock only). Fresh CI Unit Tests
     7m19s (was a 27m timeout).
  2. **Evidence-note stamp (codex P2):** the IRIS promote scripts now stamp a superseding note when
     approving evidence, so approved/direct_source_verified rows no longer carry a "pending
     direct-source verification" note. Re-applied to repair all 955 rows.
- HH catalog now: 1161 approved / 416 needs_review / 1577 total.

## Full session (2026-06-21) PR ledger
#376 (17-row promote), #377 (test-infra tripwire), #378 (92 HC TRV v4.0), #379 (handoff),
#380 (955 US EPA IRIS), #381 (Map design), #382 (handoff). All merged.

## Follow-ups (tracked)
- **Evidence-note backport (data-quality):** the same "pending" note now superseded on the 955 IRIS
  rows STILL exists on ~26 earlier IRIS rows (apply-qa-promotion.mjs + promote-iris-carcinogen-rfd.mjs)
  and ~92 HC TRV v4.0 rows (#378). Backport the evidence-note stamp (buildEvidenceNoteStamp +
  stampEvidenceNotes + the already-done repair path) to those promote scripts and re-apply to repair.
- **EvidenceLibrary virtualization (codex Option 2; UI/perf PR):** the fixture fix bounded the TEST
  only. The LIVE Values table still renders every row (visibleValues.map, no cap) + defaultPolicyDecisions
  computes over the full library. At 1161+ approved rows, virtualize/paginate with accurate totals +
  cache/index the policy decisions. Avoid a blind .slice(0,50).
- **61 deferred dupe-candidate_group_id rows:** trimethylbenzenes / 1,1,1-TCA / RDX / short-chain PFAS
  (PFBA/PFDA/PFHxA) -- multiple IRIS RfD + RfC estimates per substance, excluded from #380. Need owner
  resolution of the canonical estimate per substance (or distinguishing suffixes) before promotion.
- **BC Protocol 28 2021-jan (355 rows):** BLOCKED -- source src-bc-protocol-28-2021-jan unpinned +
  rows pending_source_locator. Pin the source first.
- **Map-LOAD (owner-gated):** per the #381 design doc -- app-layer RPC/TS changes are autonomous; the
  Supabase data load (migration #373 apply + PATH_B chunk paste + --allow-undated ETL) is owner paste.

## Lessons (new this part)
- Local test:ci (CI=true + coverage) can PASS while GitHub CI times out on a render-heavy component
  test: the EvidenceLibrary full-catalog render is jsdom+coverage amplified (~5x). Bound such tests to
  a compact fixture (vi.mock the catalog data source) -- do NOT rely on per-test timeout bumps.
- A `git rebase` of a feature branch makes the next push a non-fast-forward; it needs
  `git push --force-with-lease` (a piped `git push ... | tail` can hide the rejection -- always confirm
  the remote tip advanced after a push).
- Promote scripts must stamp evidence_items[*].note (not just top-level provenance) when flipping
  evidence to approved, or the catalog ends with approved rows that read "pending verification".

## Session close
- Branches: docs branches deleted + pruned; #380 branch merged + deleted.
- Orphan check: report-only (owner runs parallel sessions).
