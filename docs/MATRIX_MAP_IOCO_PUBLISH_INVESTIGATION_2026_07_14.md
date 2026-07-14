# IOCO Shoreline DRA Publish -- Failure Investigation + Retry Steps (2026-07-14)

DRA: IOCO Shoreline, id `ea15e94a-b093-4cb4-bd4d-80ab9eae16d4`. Symptom: owner reported an
in-app publish, but the DB still shows `public=false` (verified read-only: public=false,
6 samples, 34 member-visible samples unchanged). Investigated read-only; no publish/write performed.

## What the code does (verified, origin/main)

- Publish page: `src/app/(dashboard)/admin/matrix-map/publish/page.tsx` (admin-gated) renders
  `DraPublishControl`. Publishing is a TWO-click flow: "Publish" opens a required-reason panel;
  only "Confirm publish" (disabled while the reason is empty) fires the request.
- Request -> `POST /api/matrix-map/admin/publish` -> `requireMatrixMapAdmin()` + CSRF + payload
  validation -> `matrix_map.flip_dra_public(p_dra_id, p_new_value, p_actor_id, p_reason)` under the
  caller's OWN authenticated JWT (never service-role).
- `flip_dra_public` is fail-closed: it RAISES (ERRCODE 42501) if the JWT sub is null (rules out
  service_role / SQL Editor / MCP), if actor_id != caller uid, if the caller lacks admin/matrix_admin,
  if the reason is empty, or if the DRA is not found / soft-deleted. It has ONE silent no-op branch:
  if the row's current `public` already equals the submitted value it does nothing (no error).
- A 2026-07-12 trigger (`enforce_dras_public_via_flip`) additionally blocks any direct
  `UPDATE matrix_map.dras.public` that is not the RPC's own SECURITY DEFINER execution.
- Error handling in the UI is fail-closed: `response.ok` is checked before showing success; every
  failure surfaces a red message. There is NO silent error-swallow and NO optimistic-update-masks-failure.

## The one real gap (fixed in this PR)

The route returned `{ ok: true, public: <submitted> }` -- it echoed the SUBMITTED value and never
read the DB back. So a silent non-persist (the no-op branch, or an out-of-band revert) would show
"Successfully published" while the DB never changed. THIS PR adds a read-only post-write read-back:
the route now re-selects `dras.public` and returns `verified: true|false|null`; the UI shows a loud
error (and keeps the retry panel open) when the DB does not confirm the change.

## Ranked hypotheses for the reported non-persist

1. **Most likely -- the write was attempted through a non-app channel (SQL Editor / MCP / service-role),
   which `flip_dra_public` correctly blocked.** The IOCO packet explicitly says publication needs an
   admin JWT via the in-app page, "NOT SQL Editor / not the pooler service role." Any non-browser
   channel lacks the JWT and hits the fail-closed guard (42501) -- write does not commit; DB stays false.
2. **A same-day (2026-07-13) publish-list selection/filter bug** (fixed in `ec05ee6` + `798f588`)
   could have targeted a hidden/stale DRA row, so nothing was submitted for IOCO (or a different DRA
   was flipped). These fixes are now merged; the retry should behave correctly.
3. **Only the first click happened** ("Publish" opened the reason panel) and "Confirm publish" was
   never clicked -- no request, no persisted state.
4. **Role/session mismatch -> explicit 403** that was seen-and-dismissed or misread; the UI does show
   a red error in this case.

No evidence of a swallowed client error or an optimistic-update masking a failure.

## Exact owner retry steps (in-app, audited admin JWT -- AI must NOT do this)

1. Sign in TO THE APP (not a separate SQL Editor / MCP session) as the account holding
   `admin` or `matrix_admin` in `user_roles`.
2. Go to `/admin/matrix-map/publish`. Use the filter to find "IOCO" (the 2026-07-13 fixes now
   auto-expand the matching group). Select the IOCO Shoreline row.
3. Click **Publish**, type a reason (required), click **Confirm publish**.
4. Watch the message box under the Detail panel: green = confirmed persisted (this PR now confirms
   via DB read-back); red = it failed and shows the exact reason (e.g. `forbidden`, `rpc_forbidden`).
5. Independently confirm (read-only) after: `select public from matrix_map.dras where id =
   'ea15e94a-b093-4cb4-bd4d-80ab9eae16d4';` (expect `true`) and the member-visible sample count
   rising by 6 (34 -> 40).

## Read-only DB checks to confirm hypothesis 1 (describe only; do not run as a write)

- `select * from matrix_map.dra_visibility_audit where dra_id =
  'ea15e94a-b093-4cb4-bd4d-80ab9eae16d4' order by changed_at desc;` -- EMPTY means `flip_dra_public`
  never successfully executed for this DRA (favors hypotheses 1/3/4).
- `select id, public, is_deleted from matrix_map.dras where id =
  'ea15e94a-b093-4cb4-bd4d-80ab9eae16d4';` -- if `is_deleted=true`, the RPC's not-found guard fires.
- Supabase log explorer around the attempt window, filtered for `flip_dra_public` / 42501, would show
  a blocked non-app call directly.

## Recommendation

Retry via the in-app publish page (steps above). The read-back hardening in this PR ensures any future
non-persist is surfaced immediately instead of masked by an unconfirmed success toast. No code bug was
found in the publish path itself; the fix closes the diagnostic (confirmation) gap.
