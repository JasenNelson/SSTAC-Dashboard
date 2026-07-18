-- ============================================================================
-- BATCH 2: Admin user grant. Grants your demo login the 'admin' role so /admin
--   is reachable.
-- Idempotent: safe to run even if already applied (ON CONFLICT DO NOTHING). Run
--   after BATCH 1 (needs user_roles to exist).
-- Needed-if: STEP 0 probe 1g returns admin_count = 0.
-- ACTION REQUIRED: replace YOUR_DEMO_EMAIL@example.com with your demo account
--   email before running.
-- Source: DEMO_BLOCKER_RESOLUTION_KIT_2026_06_04.md Remedy C (verbatim).
-- ============================================================================

insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'YOUR_DEMO_EMAIL@example.com'
on conflict do nothing;
