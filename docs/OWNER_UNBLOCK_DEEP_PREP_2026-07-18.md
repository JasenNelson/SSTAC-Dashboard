# Owner-Unblock DEEP PREP -- 2026-07-18 (friction-reduction; read-only/draft-only)

Companion to `OWNER_UNBLOCK_PACKET_2026-07-18.md` (merged in PR #685). This adds the exact
verification commands, checklists, and the #3 missing-input table so each owner action is one screen
of copy-paste. Nothing here was executed: no publish, no Supabase write, no secret inspection, no
catalog apply. origin/main = 4a1d734 at authoring.

---

## #7 IOCO publish -- postflight verification kit (owner publishes; AI verifies after)

**Owner action (unchanged):** app -> `/admin/matrix-map/publish` -> select DRA
`ea15e94a-b093-4cb4-bd4d-80ab9eae16d4` (the DRAFT ecological RA -- NOT the 2015 memo `c2284286`)
-> Publish -> reason -> Confirm.

**AI postflight (read-only, run AFTER the owner publishes) -- exact commands:**

1. Confirm the flag flipped (project-scoped MCP read):
   ```sql
   select id, public, title
   from matrix_map.dras
   where id = 'ea15e94a-b093-4cb4-bd4d-80ab9eae16d4';
   -- expect: public = true
   ```
2. Confirm the audit row was written by the in-app flow (the publish route logs to the audit table):
   ```sql
   select dra_id, action, created_at
   from matrix_map.service_role_audit
   where dra_id = 'ea15e94a-b093-4cb4-bd4d-80ab9eae16d4'
   order by created_at desc
   limit 3;
   ```
   (If the audit schema differs, fall back to the read-only dras check above as the source of truth.)
3. Confirm public visibility end-to-end: the public map should now surface this DRA's samples to a
   non-member/anon session (previously 0 public DRAs). AI verifies via the public samples RPC read,
   not by writing anything.

**One-screen owner checklist:**
- [ ] Logged in as an admin (admin JWT present; SQL Editor / service_role CANNOT do this flip -- the
      `flip_dra_public` RPC rejects `auth.uid() IS NULL`).
- [ ] Selected `ea15e94a...` "IOCO Shoreline ... DRAFT" (NOT `c2284286` 2015 memo).
- [ ] Publish -> entered a reason -> Confirm.
- [ ] Pinged a session; AI runs the 3 postflight reads above.

---

## #29 admin-tier E2E -- no-secret setup checklist (owner creates user + sets secrets; AI never touches secrets)

**What gates the admin-tier tests (verified on origin/main):**
- `playwright.config.ts` -> `hasAdminCreds = Boolean(E2E_ADMIN_EMAIL && E2E_ADMIN_PASSWORD)`.
- `e2e/admin.setup.ts` authenticates as that user; `setup.skip(!email || !password, ...)` and it
  FAILS with an explicit message if the creds do not match a **confirmed** admin user in CI Supabase.
- `e2e/admin-tier-rbac.spec.ts` skip-safe gate also requires `E2E_AUTH_ENABLED=true`.
- So: admin-tier e2e stays SKIPPED (green) until all three are present; once present it EXECUTES.

**Owner steps (no secret values in chat):**
1. Create/designate a dedicated Supabase auth user for CI (e.g. `sstac-e2e-admin@<yourdomain>`),
   **email-confirmed** (unconfirmed users fail `admin.setup.ts`).
2. Grant it admin -- exact placeholder SQL (now tracked at `sql_runbook/02_admin_user_grant.sql`):
   ```sql
   -- read-only check first (expect the user has no admin row yet):
   select ur.role from public.user_roles ur
     join auth.users u on u.id = ur.user_id
    where u.email = '<the e2e admin email>';
   -- grant (idempotent):
   insert into public.user_roles (user_id, role)
   select id, 'admin' from auth.users where email = '<same email>'
   on conflict do nothing;
   ```
3. Set the two GitHub repo secrets (values only in the GitHub UI / `gh secret set`, never in chat):
   `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`. (`E2E_AUTH_ENABLED=true` is already wired; `E2E_TEST_*`
   already exist.)

**Expected CI behavior after the above (what AI will confirm, names only):**
- Next PR run: `admin.setup.ts` no longer skips -> authenticates -> `admin-tier-rbac.spec.ts` tests
  EXECUTE instead of skip. AI verifies secret NAMES via `gh secret list` (never values) and confirms
  the admin-tier specs went from skipped to executed+green; if `admin.setup.ts` errors "Verify
  E2E_ADMIN_* match a confirmed user", the user is not confirmed or lacks the admin role -> re-do
  steps 1-2.

**One-screen owner checklist:**
- [ ] Created + email-confirmed the CI admin user.
- [ ] Ran the grant SQL (step 2) -- read-only check returned the admin role afterward.
- [ ] Set `E2E_ADMIN_EMAIL` + `E2E_ADMIN_PASSWORD` secrets.
- [ ] Pinged a session; AI confirms names + unskip on next PR.

---

## #3 SVI inhalation params -- precise missing-input table (metadata-only; no PDF opened)

The `vfpef_extract_hc.py` `PARAMETER_SLOTS` registry needs 8 HC-specific inhalation params. Split by
source:

| # | slot | source | in References? | status |
|---|---|---|---|---|
| 1 | hc_pqra_inhalation_rate_adult | HC PQRA v4.0 (2024) | v4.0 is an APPROVED catalog source (22 rows) | LIKELY derivable from v4.0 -- owner confirm |
| 2 | hc_pqra_inhalation_rate_child_or_toddler | HC PQRA v4.0 | same | LIKELY derivable -- owner confirm |
| 3 | hc_pqra_target_cancer_risk | HC PQRA v4.0 | same | LIKELY derivable -- owner confirm |
| 4 | hc_pqra_target_hazard_quotient | HC PQRA v4.0 | same | LIKELY derivable -- owner confirm |
| 5 | hc_pqra_vf_pef_methodology_statement | HC PQRA v4.0 | same | LIKELY derivable (text note) -- owner confirm |
| 6 | hc_svi_attenuation_factor_residential | HC SVI-2023 | NO HC SVI doc present | MISSING -- owner must place HC SVI-2023 |
| 7 | hc_svi_attenuation_factor_commercial | HC SVI-2023 | NO | MISSING |
| 8 | hc_svi_model_variant_statement | HC SVI-2023 | NO | MISSING |

**References folder vapour/inhalation PDFs present (filenames only -- content NOT opened):**
- `A Protocol for the Derivation of Soil Vapour Quality Guidelines for Protection of Human Exposures
  Via Inhalation of Vapours (en).pdf` (May 2016) -- BC/SABCS soil-vapour protocol; a CANDIDATE for
  slots 6-8 IF the owner accepts it in lieu of HC SVI-2023.
- `1557854883ARBCAGuidanceforVapourIntrusionAssessments...Apr2019FINAL.pdf` (ARBCA VI guidance)
- `SABCS 2006 Soil Vapour.pdf`
- `Soil-Vapour-Panel-Stage-1-FINAL-Oct-09.pdf`
- **No file named / dated as HC SVI-2023 is present.**

**Precise owner decision for #3 (the single blocking input):**
- Slots 1-5: confirm whether HC PQRA v4.0's already-extracted rows cover them (if yes, AI wires them
  with zero new sourcing); OR provide the HC PQRA doc page for vision-first extraction.
- Slots 6-8: **the real gap.** Either (a) place an HC SVI-2023 document in References, or (b) approve
  the 2016 "A Protocol ... Inhalation of Vapours" as the source (a policy call -- it is BC/SABCS, not
  HC), or (c) approve using CCME's default attenuation factors (0.03 residential / 0.01 commercial,
  already referenced) as the fallback with a documented deviation.

**AFTER the owner decides (AI, no apply):** run `.tmp/vfpef_extract_hc.py` on the confirmed source(s)
-> draft a batched `needs_review` catalog packet (pathway `human-health-inhalation`, which PR #678
already added to CATALOG_EVIDENCE_PATHWAYS). NO catalog `--apply`, NO `current_default` -- owner-gated.

---

## Non-action items (recorded, no work)
- The merged handoff/packet's "PROPOSED until merge" / "owner merges when green" wording is dated
  session-anchor context (authored pre-merge); the authoritative `docs-manifest.json` grade is
  correct. Not materially misleading -> no correction PR.
