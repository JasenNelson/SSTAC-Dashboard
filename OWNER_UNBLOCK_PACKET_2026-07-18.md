# Owner Unblock Packet -- 2026-07-18

**Status:** The code-gated Top-50 is exhausted; these are the owner-only unblockers, three of them turnkey. origin/main = 73203c5 (all prior-session PRs #670-#682 merged; code-gated Top-50 backlog is essentially exhausted -- remaining path to completion is owner data + in-app actions).

---

## RECONCILIATION UPDATE -- 2026-07-18 (post-completion; origin/main now cdb0515)

Two of the three turnkey gates below are now DONE; the sections below are retained as the historical
record. Current state:

- **#7 IOCO publish -- COMPLETE.** Owner published it in-app; read-only Supabase postflight verified
  DRA `ea15e94a-b093-4cb4-bd4d-80ab9eae16d4` `public = true`, title matches the IOCO Shoreline DRA,
  `total_public_dras = 5`. No further action.
- **#29 admin E2E -- COMPLETE.** Repo-level secrets `E2E_ADMIN_EMAIL` + `E2E_ADMIN_PASSWORD` are set;
  the post-secret CI run (29657798271) proved admin-tier E2E EXECUTES + passes (`E2E_ADMIN_EMAIL: ***`,
  240 tests / 144 passed / 0 failed, up from 141 pre-secret). No further action.
- **#3 SVI inhalation -- the SOLE remaining gate.** Packet `docs/SVI_NEEDS_REVIEW_PACKET_2026-07-18.md`
  landed (PR #687 merged at cdb0515; refinements in PR #688). 4 slots are CCME-2014 primary-sourced
  (needs_review); **4 HC PQRA slots remain BLOCKED**. No valid local substitute exists -- the local
  `DQRA HC final draft Feb 2009` was vision-checked this session and REJECTED (it is a watermarked
  DRAFT and is the *Detailed* QRA, not the *Preliminary* QRA screening defaults the `hc_pqra_*` slots
  need). **Smallest exact owner action:** browser-download HC PQRA v3.0 (catalog `H129-114/2023E-PDF`,
  `https://publications.gc.ca/collections/collection_2023/sc-hc/H129-114-2023-eng.pdf` -- accept the
  archived-content notice), save into `G:\...\References\`, and AI vision-extracts the 4 slots in one
  pass (target cancer risk 1e-5, target HQ, adult 15.8 + toddler 9.3 inhalation rates). No catalog
  apply / current_default until owner review.

Frontier re-scan (from cdb0515): no autonomous-safe implementation lane remains (console.* clusters
are 2 tiny/borderline files; 5 TODOs; no stale-fact lane). The frontier is fully owner-gated on #3.

---

## PRIORITY 1 (turnkey) -- #7 IOCO publish

**Smallest exact action:**
Owner opens the app -> `/admin/matrix-map/publish` -> selects DRA `ea15e94a-b093-4cb4-bd4d-80ab9eae16d4` (the DRAFT ecological RA, NOT the 2015 memo `c2284286`) -> Publish -> enter reason -> Confirm.

**Why AI cannot:**
Needs an admin JWT via the audited in-app flow (not a SQL/curl write). Live verification 2026-07-18: `matrix_map.dras` id `ea15e94a-b093-4cb4-bd4d-80ab9eae16d4` has `public = false`. Title = "Detailed Ecological Risk Assessment for the IOCO Shoreline, 2225 Ioco Road, Port Moody, BC - DRAFT".

**AFTER:**
AI runs a read-only postflight (`select public from matrix_map.dras where id='ea15e94a-b093-4cb4-bd4d-80ab9eae16d4'` expect true). Unblocks: public map visibility for that DRA.

---

## PRIORITY 2 (turnkey) -- #29 admin-tier E2E

**Smallest exact action:**
(a) Owner creates (or designates) a Supabase auth user and grants `user_roles.role='admin'`.
Placeholder SQL from the 07-17 base packet:
```sql
-- Read-only check first -- confirm zero rows before the insert.
SELECT ur.role FROM public.user_roles ur
  JOIN auth.users u ON u.id = ur.user_id
 WHERE u.email = '<the new E2E admin user email, e.g. sstac-e2e-admin@fake.bc.ca>';

-- Only if the check above returned zero rows for role='admin':
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = '<same email>';
```
(b) Owner sets GitHub secrets `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD` (never paste values in chat). No code change needed.
```
gh secret set E2E_ADMIN_EMAIL --repo JasenNelson/SSTAC-Dashboard
gh secret set E2E_ADMIN_PASSWORD --repo JasenNelson/SSTAC-Dashboard
```

**Live verification 2026-07-18:**
GitHub secrets `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` are ABSENT. Only `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` exist. CI + Playwright already wire the E2E_ADMIN_* names.

**AFTER:**
AI verifies the secret NAMES via `gh secret list` and confirms the admin-tier e2e unskips on the next PR; prepares an unskip follow-up PR if needed.

---

## PRIORITY 3 (turnkey-ish) -- #3 SVI inhalation params

**Smallest exact action:**
Owner confirms whether the existing "A Protocol for the Derivation of Soil Vapour Quality Guidelines for Protection of Human Exposures Via Inhalation of Vapours (en).pdf" file holds the ~8 needed params, OR places the HC SVI-2023 doc in the References folder (`G:\My Drive\SABCS - Sediment Project\References\`).

**Live verification 2026-07-18:**
`G:\My Drive\SABCS - Sediment Project\References\` contains BC/SABCS vapour-intrusion PDFs including the LIKELY candidate "A Protocol for the Derivation of Soil Vapour Quality Guidelines for Protection of Human Exposures Via Inhalation of Vapours (en).pdf", plus ARBCA vapour-intrusion guidance, "SABCS 2006 Soil Vapour", and "Soil-Vapour-Panel-Stage-1-FINAL-Oct-09". There is NO confirmed HC SVI-2023 file. The EPA half of the catalog packet (37 rows) + the `human-health-inhalation` pathway support (PR #678) are already merged; only the ~8 HC/SVI inhalation param slots remain.

**AFTER:**
AI runs `.tmp/vfpef_extract_hc.py` (vision-first, read-only) and drafts a batched `needs_review` catalog packet (NO apply; owner-gated apply later).

---

## DEEPER OWNER-GATED SET (policy / data / attended -- one blocking input each)

- #10/11 DRA publish policy: Owner policy decision.
- #13 aroclor_1254 re-key: Owner-sourced site logKow data.
- #20 P28 verify sweep: Owner + verification.
- #24/25 attended OCR: Owner attends an OCR session.
- #37 T39 worked example: Owner supplies example.
- #38 T20 stats-tier design ruling: Owner decision.
- #39/40 reg-review Ollama verify: Ollama schedule-lock coordination.
- #45-47 stale worktree/dirty-checkout/root-scratch hygiene: Owner + careful -- destructive, do NOT auto-run.

---

**Footer:** This supersedes the 07-17 packet; nothing here requires AI code work until the owner acts; then the named AFTER-steps become AI-executable.
