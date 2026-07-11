# Matrix Options -- finalization status (2026-07-10)

Lifecycle: REFERENCE. This is a Matrix-Options-scoped status map to reduce drift across the ~80 dated
`docs/MATRIX_OPTIONS_*` snapshots. It does NOT claim global project status -- `docs/INDEX.md` remains the
canonical current-status entrypoint (docs manifest `current_status_claims_policy`). Values/metrics are
NOT restated here; see the manifest `facts`.

## Where Matrix Options stands (engineering)
- **Calculation engine: SHIPPED + hardened.** Direct-contact, eco (EqP + Food/BSAF), human-health
  food-web, cumulative (TEQ / BaP-eq / PCB reducers), and the inhalation fail-closed scaffold all live
  on main with unit tests. The provenance / default-policy guard subsystem is strong and test-enforced
  (AI never promotes defaults; blocked values are not quoted as benchmarks).
- **Fail-closed rendering contract:** all calculators withhold a `blocked` result from the headline
  standard (show `--`). The last gap (Eco-Direct EqP) was fixed 2026-07-10 (PR #587); a regression test
  guards it. HHFoodWeb / EcoFoodBSAF already guarded `blocked`; HHDirectContact has no `blocked` concept.
- **Unit coverage: strong** across `src/lib/matrix-options/**` and the calculator components.
- **Accessibility:** login-page screen-reader announcement + decorative-icon hiding shipped (#583) with
  a regression test (#588). SubstanceCombobox already implements the full ARIA combobox pattern.

## Open lanes (as of 2026-07-10)
### Owner-gated (highest remaining value)
- **Authenticated E2E proof (U2 / Lane 1):** the authed Matrix Options / RBAC / cyanide e2e specs
  `test.skip` in CI without a login session, so their CI guarantee is the unit layer only. The auth
  fixture is landed + skip-safe (#580); proving it needs a dedicated E2E user password + the two GH
  secrets `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` (currently absent) -- an OWNER-performed Supabase/secret
  write. The user `sstac-e2e-reviewer` (role `member`) already exists. This is the single biggest lever
  on MO end-to-end confidence.
- **Standing auth-E2E enablement model:** decide only AFTER an authenticated-green proof.
- **Phase C RPF/TEF verification:** three `rpfTable.ts` schemes are `needs_review` (`hc-pqra-v3`,
  `epa-2010-draft`, `who-1998-pah`); verification is vision-first + owner-gated (source PDFs / BC 5-PAH
  subset pin). `who-1998-pah` stays fail-closed until the subset is pinned.
- **Cumulative A3b per-congener/PAH input UI:** the deliverable grid; gated behind Phase C.

### Autonomous (mostly complete / mature)
- The calculator UX, e2e determinism, and unit coverage lanes are largely already-good; recent PRs
  (#584 deterministic e2e wait, #587 EqP fail-closed, #588 a11y guard) closed the genuine gaps found.

## Authoritative recent handoffs (read these for detail)
- `FRESH_SESSION_HANDOFF_2026_07_10_REV3_RUN.md` (root) -- the most recent run closeout.
- `docs/INDEX.md` -- canonical current-status entrypoint + docs manifest.
