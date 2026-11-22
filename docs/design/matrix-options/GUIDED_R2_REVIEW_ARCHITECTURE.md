# Matrix Options Guided R2 Review -- Architecture Authority

**Lifecycle:** AUTHORITATIVE (architecture authority; NOT a status page).
**Written:** 2026-11-22, grounded in candidate `0ec2afe2ab7083d8b739c7985131560972d799e3`
(branch `feat/matrix-r2-guided-completion-20261120`).
**Current lane status, live database state and release progress:** `docs/MATRIX_OPTIONS_STATUS.md`
section 3.6. This document makes no live-state claim of its own; where it mentions production it
points there.
**ASCII:** plain ASCII only (L0 rule 1.1).

---

## 1. Maintenance rule (NON-NEGOTIABLE)

The Guided R2 review is an established reviewer -> Supabase -> administrator system. It is not a
page that can be re-created from its appearance.

- A content revision (new paper bytes, new release, new focus areas, new prompts, new section
  anchors, wording) changes CONTENT AND CONFIGURATION INSIDE this system: the release entry, the
  guided contract, the manifest identity, the pinned SQL target rows and the tests that pin them.
- A content revision does NOT authorize: rebuilding the page or its three-panel layout; replacing
  its storage (for example browser-only, file or in-memory persistence in production); bypassing
  Supabase, its SECURITY DEFINER RPCs, RLS or the activation row; disconnecting the administrator
  view or the scoped CSV export from reviewer data; dropping legacy v0.9.91 history or export; or
  weakening account-deletion behavior.
- Visual similarity is never functional parity. A change is complete only when every parity check
  in section 13 passes against the real routes, not a look-alike.
- Before any change, do the investigation in section 12.

If a change genuinely requires altering the architecture (not just content), stop and get an
explicit owner decision for that architectural change; do not fold it into a content update.

---

## 2. Product purpose and the accepted reviewer experience

Purpose: let signed-in reviewers read the private Phase 2 R2 review draft of the Matrix Options
Paper and give optional, structured feedback by focus area, by paper section and on the whole
paper; let them save, recover, revise and explicitly finish their review; and let authorized
administrators see exactly what was saved and finished, and export it as a scoped CSV.

Accepted experience (component `R2GuidedReview`, `src/components/matrix-options/paper/R2GuidedReview.tsx`):

- Header: "Matrix Options Paper" / "Phase 2 review draft", the optional-questions intro, a
  "How your feedback is used" disclosure and reader links (`src/lib/matrix-options/paper/r2-reader-links.ts`).
- Three panels (`data-testid="r2-workspace-layout"`):
  - LEFT, navigation rail (`id="r2-navigation-rail"`, "Review navigation"): six focus areas with
    Not visited / Visited / Reviewed on this page status and a "N of 6 marked reviewed" progress
    bar, plus "Whole-paper comments" and "My Review".
  - CENTER, the paper (`data-testid="r2-paper-scrollport"`): `PaperDocument` inside the reading
    frame with `ReaderWidthControl`; replaced by the My Review page in that view.
  - RIGHT, review rail (`id="r2-review-rail"`, "Review this section"): the area's orientation,
    "Key questions" (the area's prompts), the section comment field, "Earlier feedback" cards,
    "Mark area reviewed on this page" (which saves nothing) and "Next focus area" / "Go to My Review".
- Both side panels are collapsible and resizable ("Resize navigation panel", "Resize review
  panel", "Reset panel widths"); widths and reader width persist in `localStorage`.
- Below the `lg` breakpoint: a "Go to a focus area" picker and a fixed "Review this section"
  button that opens the editor in a dialog.
- Active area follows scrolling (`section[id^="sec-phase2-"]` in the scrollport).
- URL modes: `?mode=working-draft` (paper + review rail) and `?mode=my-review`
  (`src/lib/matrix-options/paper/url-state.ts`).

---

## 3. Routes and principal components

| Surface | Route | Principal code |
|---|---|---|
| Reviewer page | `/matrix-options/paper/publication/v/phase2-review-2026-11-fa356b89` | `src/app/(dashboard)/matrix-options/paper/publication/v/[documentVersion]/page.tsx` -> `R2GuidedReview` + `PaperDocument` |
| Reviewer state | `GET /api/matrix-options/paper/guided-r2/state` | `.../guided-r2/state/route.ts` |
| Earlier feedback (read-only) | `GET /api/matrix-options/paper/guided-r2/feedback` | `.../guided-r2/feedback/route.ts`, `src/lib/matrix-options/paper/guided-r2-feedback.ts` |
| Save one target | `PUT /api/matrix-options/paper/guided-r2/targets/[targetId]` | `.../guided-r2/targets/[targetId]/route.ts` |
| Finish review | `POST /api/matrix-options/paper/guided-r2/complete` | `.../guided-r2/complete/route.ts` |
| Admin page | `/admin/matrix-options-paper-reviews` (`?view=guided` for Guided R2; default is legacy) | `src/app/(dashboard)/admin/matrix-options-paper-reviews/page.tsx`, `GuidedAdminClient.tsx`, `AdminReviewsClient.tsx` |
| Admin CSV | `GET /api/matrix-options/paper/guided-r2/export[?userId=&status=]` | `.../guided-r2/export/route.ts`, `src/lib/matrix-options/paper/guided-r2-admin.ts` |
| Legacy reviewer read | `GET /api/matrix-options/paper/reviews` | `.../paper/reviews/route.ts` |
| Legacy write (refused) | `PUT /api/matrix-options/paper/reviews/[questionId]` | returns 403 `release_read_only` |
| Legacy admin CSV | `GET /api/matrix-options/paper/reviews/export` | `.../paper/reviews/export/route.ts` |

Shared libraries (`src/lib/matrix-options/paper/`): `guided-r2-contract.ts` (targets, schemas),
`guided-r2-manifest.ts` (identity), `guided-r2-digest.ts` (draft-set digest),
`guided-r2-route.ts` (route gates and outcome mapping), `guided-r2-transport.ts` (client
transport, production and preview), `guided-r2-save-queue.ts` (Save all),
`guided-r2-local-drafts.ts` (recovery), `guided-r2-admin.ts` and `guided-r2-admin-query.ts`
(admin rows and CSV), `releases.ts` (release identity), `private-release-assets.ts` (private paper
bytes), `r2-review-preview.ts` (focus areas and prompts).

Gating:
- Page: the navigation gate `resolveMatrixOptionsPaperReviewNavigationGate(MATRIX_OPTIONS_PAPER_WORKSPACE,
  MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION)` (`src/lib/matrix-options/navigation.ts`) must be
  `REVIEW_NAVIGATION` (an absent variable counts as enabled); the guided component renders only when
  the version is `PHASE2_R2_PAPER_VERSION` and `MATRIX_R2_GUIDED_REVIEW_UI === 'true'`. Otherwise
  the non-guided Revised Paper Workspace renders. The page fails closed
  (`PAPER_DOCUMENT_UNAVAILABLE`) unless the paper outline has the same number of `sec-phase2-*`
  anchors as `GUIDED_R2_SECTION_ANCHORS` and every one of them is in that set (order is not
  checked).
- Reviewer API routes: `guidedR2UiEnabled()` requires both the UI flag and `REVIEW_NAVIGATION`;
  otherwise 404.
- The admin guided view and the guided export are NOT behind the UI flag; they are behind the
  administrator check (sections 6 and 8; the RLS admin-read policy is in section 7).
- `src/middleware.ts` redirects unauthenticated requests under `/matrix-options/**` to `/login`.

---

## 4. Paper source and content binding

- Paper bytes: release `PHASE2_R2_RELEASE` in `src/lib/matrix-options/paper/releases.ts`
  (`documentVersion` `phase2-review-2026-11-fa356b89`, `delivery: 'private-storage'`, pinned
  `sha256` and `bytes`). Private-storage Markdown and figures are NOT in the repository; they are
  read with the signed-in reader's own Supabase session from the `matrix-paper-review-assets`
  bucket and verified (length, SHA-256, media type) before use (`private-release-assets.ts`). An
  anonymous session reads nothing. The page wraps the workspace in `PrivateReleaseSessionGate`.
- Identity (sent by the client with every reviewer request and checked by the state, feedback, save
  and complete routes; mismatch -> 409 `stale_manifest`. The admin export does not take a client
  identity: it binds to the current manifest server-side):
  - `documentVersion`;
  - `reviewManifestSha256` = `getReviewManifest(...)` hash, which includes the paper SHA-256
    (`review-manifest.ts`);
  - `guidedManifestSha256` = SHA-256 of the canonical JSON of schema version
    `matrix-paper-guided-r2-v1`, document version, paper SHA-256, review manifest SHA-256, focus
    areas, prompts, section anchors and targets (`guided-r2-manifest.ts`).
  - The same two hashes are pinned as literals in the guided SQL target and activation rows.
- Targets (`GUIDED_R2_TARGETS`, `guided-r2-contract.ts`), 23 in total:
  - 6 prompts from `PREVIEW_PROMPTS` (`r2-review-preview.ts`): `choice-prompt` (option id plus
    rationale) for `structure-approach`, `human-approach`, `common-rules`; `text-prompt` for
    `site-assignment`, `ecological-approach`, `work-sequence`;
  - 16 `section-comment` targets whose target id IS the paper section anchor
    (`GUIDED_R2_SECTION_ANCHORS`, `sec-phase2-about-this-paper` ... `sec-phase2-references`);
  - 1 `whole-paper-comment` target, id `whole-paper`.
- Focus areas (`PREVIEW_FOCUS_AREAS`, 6) map an area id to a label, a primary anchor, its section
  anchors and its prompt ids; `previewAreaForAnchor` maps a section anchor back to its area.
- Text limit: 20000 (client `maxLength` and counter, zod schema, SQL UTF-16 code-unit check ->
  `too_large`). Request body caps: save 80000, complete 4000, each enforced twice -> 413: first
  the `Content-Length` header (bytes), then the decoded body length (JavaScript UTF-16 code units).
  A null, empty or ASCII-space-only rationale or text is stored as NULL (SQL `btrim`; the preview
  service uses the same space-only rule); other whitespace such as tabs or newlines is kept.
- Earlier feedback shown in the review rail is read-only, from the legacy table
  `matrix_paper_review_responses` (predecessor concise release and R2's legacy guide), normalized
  by `guided-r2-feedback.ts`; any foreign or malformed row withholds the whole list (503).

Changing content therefore means changing, together and consistently: the release entry, the paper
outline anchors, `GUIDED_R2_SECTION_ANCHORS`, `PREVIEW_FOCUS_AREAS` / `PREVIEW_PROMPTS`, the
resulting manifest hashes, the SQL target and activation rows for the new identity (through the
reviewed Supabase write gate in `CLAUDE.md`), and the tests that pin them (section 14).

---

## 5. Reviewer editing behavior

- Per-field Save: enabled only when writable, not busy, not resuming after a page restore, dirty and
  not conflicted. Field status:
  Optional / Saved draft / Submitted / Changed since submit / Unsaved - save before finishing /
  Conflict - compare with saved response before saving.
- Character count `<n> / 20000` (announced politely when 1000 or fewer remain). Textareas resize
  vertically and have an "Expand editor" / "Collapse editor" toggle per target.
- Base revision: per tab, in memory, fixed when editing starts; every save sends it as
  `expectedRevision`. The server compares and swaps on `revision`.
- "Save all unsaved changes (N)" and "Save all and finish" use `guided-r2-save-queue.ts`: one target
  at a time in target order; a saved target is never resent in the same run; on 429 it waits for
  `Retry-After` (60 s window; at most 2 waits) and resumes with only the remaining targets; it stops
  on conflict, closed release, failure, cancel ("Stop saving") or a target edited during its own
  save; finish runs only when nothing is dirty or conflicted. The finish shares the rate budget.
- Conflict: a 409 `stale_revision` on a dirty field refreshes state and marks the field conflicted.
  The reviewer chooses "Keep my local response" (rebase onto the current server revision) or "Use
  saved response". An unresolved conflict is never sent.
- Draft recovery (`guided-r2-local-drafts.ts`): browser copies are kept per page instance under
  `mtwg-guided-r2-draft-v2:<userKey>:<documentVersion>:<guidedSha>:<reviewSha>:<kind>:<id>:<instanceId>`,
  so two tabs never overwrite or delete each other's copies. A reload adopts its own tab's
  predecessor instance first (sessionStorage), other instances only after they close or go silent;
  unsaved in-memory edits are never overwritten. Old copies are removed only for closed or silent
  instances older than 30 days. Sign-out or an account switch clears that user's copies. v1 keys
  are migrated once. BFCache restores hold edits until liveness and state are refreshed.
- Leave-page protection while any field is dirty: `beforeunload`, a confirm on same-origin link
  navigation, and a history guard that confirms client-side Back.
- Finish ("Finish review"): the client sends `draftSetDigest` (`guided-r2-digest.ts`, mirrored by
  SQL `matrix_guided_r2_draft_set_digest`) and its expected completion revision. Outcomes: `ok`
  (drafts copied to submitted, completion revision incremented), `noop_already_completed` (same
  digest), `draft_set_changed`, `stale_revision`. Unsaved edits block Finish. An empty review may be
  finished explicitly. Editing after finishing increments the entry revision and leaves the
  submitted values intact ("Changed since submit") until the reviewer finishes again.
- The My Review page lists every area and comment with return links, the unsaved-change alert, both
  Save all buttons, Finish review and "Last finished <time>".
- Read-only notice when the release is not writable: "Review responses are not open right now. The
  paper remains readable."

---

## 6. API routes and route-level auth responsibilities

Common helpers (`src/lib/matrix-options/paper/guided-r2-route.ts`). Responses built by
`guidedResponse`, and the export CSV, carry `Cache-Control: no-store`; a 429 from the shared route
rate limiter (`getAuthAndRateLimit`) is returned as that limiter builds it, without that header:
- `guidedAuth`: `getAuthAndRateLimit(request, 'default')`; no user or an anonymous user -> 401
  `unauthenticated`.
- `guidedReviewerGate`: RPC `matrix_guided_r2_reviewer_allowed`; false -> 403 `reviewer_not_allowed`;
  error -> 503 `persistence_unavailable`.
- `guidedSessionUnchanged`: re-reads the user; a different or anonymous user -> 409 `identity_changed`.
- Outcome mapping `guidedOutcomeStatus` (RPC outcome strings); RPC errors go through
  `guidedRpcErrorResponse` (a PostgreSQL permission error -> 403 `release_read_only`, otherwise 503).

Per route (order matters; payload validation happens before auth on writes):
- `state`: UI gate -> exact identity query (3 params, once each) -> auth -> admission -> activation
  status RPC + the caller's own `matrix_guided_r2_entries` / `matrix_guided_r2_completion` rows ->
  row validation (foreign or invalid -> 503) -> session check -> `{mode: 'writable'|'read-only', ...}`.
  `writable` exactly when the activation RPC returns true.
- `feedback`: same gates; read-only legacy rows.
- `targets/[targetId]` (PUT): body cap, strict schema, identity, known target, kind/field semantics,
  then auth, `expectedUserId`, admission, session, RPC `matrix_guided_r2_save`; returned row
  re-validated.
- `complete` (POST): same pattern with RPC `matrix_guided_r2_complete`.
- `export` (GET): administrator check `getPaperAdminAccess` (`src/lib/matrix-options/paper-admin-guard.ts`,
  `user_roles` role `admin` or `matrix_admin`); optional validated `userId` and `status` filters;
  CSV via the caller's own cookie client so RLS admin policies apply.

The routes are a defense layer, not the authority: authenticated callers can reach the RPCs through
PostgREST directly, so every write rule is enforced in the database (section 7). The former
`MATRIX_R2_GUIDED_REVIEW_WRITES` route flag was removed for that reason.

---

## 7. Supabase objects and the write boundary

Defined by `supabase/migrations/20261117003834_matrix_guided_r2_inactive_20261116.sql` (SQL1) and
`supabase/migrations/20261118000001_matrix_guided_r2_all_users_write_admission.sql` (SQL2). SQL2
requires SQL1 to be recorded in the migration ledger before it applies; SQL2's applied status and
production ledger version are recorded in `docs/MATRIX_OPTIONS_STATUS.md` section 3.6.

Tables (public, RLS enabled):
- `matrix_guided_r2_targets`: the 23 pinned targets per identity.
- `matrix_guided_r2_activation`: one row per identity, `enabled` default and seeded `false`. No
  migration sets it true.
- `matrix_guided_r2_entries`: per user and target: `revision`, `draft_*`, `submitted_*`,
  `submitted_revision`, `submitted_at`; validated by a trigger (known target, known choice, UTF-16
  length).
- `matrix_guided_r2_completion`: per user: `revision`, `submitted_set_digest`, `submitted_at`.
- `matrix_guided_r2_events`: `save` / `complete` events with payload digests and UTF-16 unit counts
  (no text). After SQL2 its trigger blocks UPDATE only, so events cannot be edited but can be removed
  by the account-deletion cascade; direct DELETE is denied by ACL.

RPCs (SECURITY DEFINER, EXECUTE granted to `authenticated` only):
- `matrix_guided_r2_activation_status`: boolean; requires a non-anonymous caller.
- `matrix_guided_r2_reviewer_allowed`: "all users" admission (no allowlist): the pinned identity, a
  non-anonymous JWT whose `sub` is `auth.uid()`, a live `auth.users` row (`deleted_at is null`) and
  an existing activation row. It does not itself require `enabled = true`.
- `matrix_guided_r2_save` and `matrix_guided_r2_complete`: check the activation row FIRST (not true
  -> `release_read_only`), re-read it `FOR SHARE` so a disable cannot finish ahead of an admitted
  write, then auth, admission, a `FOR SHARE` lock on the live user row, payload checks, a per-user
  advisory lock, the rate limit (24 events per rolling minute -> `rate_limited`), compare-and-swap on
  `revision` (`stale_revision`), the write and its event.

Privileges and RLS:
- No INSERT / UPDATE / DELETE for any API role on any guided table; all writes go through the RPCs.
  `authenticated` has SELECT on entries and completion only; anon and service_role have none.
- Policies: own-read on entries and completion (`auth.uid() = user_id`, non-anonymous JWT, and
  `matrix_guided_r2_reviewer_allowed(...)`); admin-read on both (non-anonymous JWT and
  `public.is_matrix_options_paper_admin()`, which checks `user_roles` for `admin` or `matrix_admin`
  and is created by the v0.9.91 activation SQL, `docs/apply-drafts/MATRIX_PAPER_REVIEW_V0991_ACTIVATION_2026_10_14.sql`).
  Targets, activation and events have no policies (no API read).

The activation row is the single write switch. Turning it on for an identity is a production
activation and is governed by `CLAUDE.md` (Supabase protocol) and section 15; it is never part of a
content or UI change.

---

## 8. Administrator view, CSV and the reviewer-to-admin data flow

- `/admin/matrix-options-paper-reviews`: server-side `getPaperAdminAccess` first (401 -> `/login`,
  otherwise -> `/dashboard`). `?view=guided` selects Guided R2; anything else, including no
  parameter, shows legacy v0.9.91 (preserved default). Navigation links "Guided R2" and "Legacy
  v0.9.91".
- Guided view: `fetchGuidedAdminState` (`guided-r2-admin-query.ts`) reads entries and completion
  with the administrator's own client (RLS admin policies), filtered to the current identity, keyset
  paged and validated; `normalizeGuidedAdminRows` (`guided-r2-admin.ts`) fails closed on any
  integrity problem and derives status `saved-draft` / `submitted` / `changed-since-submit` /
  `completion-only` ("Empty review completed"). Filters: reviewer user id and status.
  `GuidedAdminClient` renders the table "Guided R2 review responses" and "Export guided R2 CSV".
- CSV (`buildGuidedAdminCsv`, 23 columns from user id and identity through completion digest):
  UTF-8 BOM, CRLF, every cell quoted, formula-leading cells prefixed with `'`; the export route
  applies the same identity and the same optional filters.
- Data flow: reviewer edit -> `PUT targets/[id]` -> `matrix_guided_r2_save` -> `matrix_guided_r2_entries`
  (+ event); Finish -> `POST complete` -> `matrix_guided_r2_complete` -> submitted values +
  `matrix_guided_r2_completion` (+ event); administrator -> admin page / export -> RLS admin-read on
  the same two tables -> `normalizeGuidedAdminRows` -> table / CSV. There is no copy, cache or
  separate store between the reviewer's saved rows and what the administrator sees.

---

## 9. Legacy v0.9.91 read-only history and export

- Release `v0.9.91` (`V0991_PAPER_VERSION`); schema from the v0.9.91 activation SQL
  (`matrix_paper_review_questions`, `matrix_paper_review_responses`,
  `matrix_paper_review_response_events`, RPCs `matrix_paper_review_save_draft` /
  `matrix_paper_review_submit`). Its applied record is
  `docs/apply-drafts/MATRIX_PAPER_REVIEW_V0991_APPLIED_RECORD_2026_10_15.md`.
- Preserved reads: `GET /api/matrix-options/paper/reviews` (own rows), the admin page default legacy
  view (`AdminReviewsClient`, "Export CSV"), `GET /api/matrix-options/paper/reviews/export`
  (administrator, trusted v0.9.91 identity). The Guided R2 "Earlier feedback" cards read the same
  legacy table but for the Phase 2 predecessor and R2 legacy-guide rows, not v0.9.91 rows
  (section 4).
- Writes refused: `PUT /api/matrix-options/paper/reviews/[questionId]` returns 403
  `release_read_only`; no application code calls the legacy write RPCs. Keep it that way: legacy
  history and its export must survive every Guided R2 change unchanged.

---

## 10. Account deletion and retained data

- Hard deletion of an `auth.users` row cascades (`on delete cascade`, added by SQL2) to that user's
  `matrix_guided_r2_entries`, `matrix_guided_r2_completion` and `matrix_guided_r2_events`. The
  legacy v0.9.91 responses and events also cascade (v0.9.91 SQL). Not user-scoped and retained:
  guided targets and activation rows, legacy questions.
- Soft deletion (`deleted_at` set) retains rows, but admission fails, so that account can no longer
  read through the own-read policies or write through the RPCs.
- The reviewer-facing notice in `R2GuidedReview.tsx` states this (permanent deletion removes drafts,
  submissions, completion and events; soft deletion retains them; no research export is
  authorized). Keep the notice and the cascade consistent.

---

## 11. Relationship to the proven pre-R2 paper review and `/twg/review`

- The pre-R2 v0.9.91 Options Paper review established the pattern Guided R2 extends: per-user rows
  in Supabase written only by SECURITY DEFINER RPCs with compare-and-swap on `revision`, draft vs
  submitted values, an event table, a DB rate limit, own-read and paper-admin-read RLS, an
  administrator page and an administrator CSV. Guided R2 keeps that pattern and adds typed targets,
  manifest-bound identity, the activation row, live-user admission and per-instance draft recovery.
- `/twg/review` (`src/app/(dashboard)/twg/review/`, `TWGReviewClient.tsx`) is a separate, simpler
  working flow: form saves and submits through `POST /api/review/save` and `/api/review/submit` into
  `review_submissions` (one row per user, no revision), read by the administrator at
  `/admin/twg-synthesis`. It is the comparable working reviewer flow to check behavior against (save
  works, reload shows it, the administrator sees it), not a storage model to copy into Guided R2.
- The legacy `/matrix-options?view=TWG%20Review` portal (`TWGReviewPortal`) is reached only when the
  workspace gate is `LEGACY_TWG_REVIEW`.

---

## 12. Required pre-change investigation

Before changing the Guided R2 page, routes, SQL, admin view or export:
1. Read this document and `docs/MATRIX_OPTIONS_STATUS.md` section 3.6.
2. Read the current code of every surface in section 3 that the change touches, and the tests in
   section 14 that pin it.
3. Read the relevant Git history (`git log --oneline -- <paths>`; key commits in section 15),
   including why each behavior was added, before removing or replacing it.
4. Exercise a comparable working reviewer flow (the current Guided R2 behavior and `/twg/review`) to
   confirm what "working" means before claiming a change preserves it.
5. Classify the change: content/configuration inside this system (allowed with parity checks) or an
   architectural change (requires an explicit owner decision first; section 1).

---

## 13. Required parity checks

A change is complete only when each applicable check passes on the real surfaces (local tests plus
the preview in section 14, and the production smoke for persistence). Record the evidence.

1. Type into every target kind (choice with rationale, text prompt, section comment, whole-paper).
2. Character count updates; the 20000 limit holds.
3. Panels resize, collapse and reset; the editor expands and collapses.
4. Per-field Save stores the value; status becomes Saved draft.
5. Save all saves every dirty target once, paces on 429 and stops on conflict.
6. Reload recovers unsaved drafts in the same tab; a second tab does not clobber them.
7. Conflict path: a stale save shows the conflict; Keep my local response and Use saved response
   both work.
8. Finish review completes; repeating it with no change is a no-op; editing afterwards shows Changed
   since submit and finishing again bumps the completion revision.
9. My Review shows every area and comment with correct status and the unsaved-change guard.
10. Administrator visibility: `/admin/matrix-options-paper-reviews?view=guided` shows exactly the
    reviewer's saved and finished rows.
11. CSV: the scoped export matches the administrator view and the stored rows.
12. Legacy history: the default admin view and the legacy export are unchanged; legacy writes stay
    refused.
13. Deletion: hard delete cascades guided rows; soft delete retains them and blocks access.

---

## 14. Tests and preview evidence boundaries

Tests that pin this architecture (keep them; never delete a regression test to make a change pass):
- Routes: `src/app/api/matrix-options/paper/guided-r2/__tests__/routes.test.ts`;
  `src/app/api/matrix-options/paper/reviews/__tests__/` (including `zero-write-route.test.ts`);
  `.../reviews/export/__tests__/route.test.ts`; `.../preview-r2/__tests__/route.test.ts`.
- Admin: `src/app/(dashboard)/admin/matrix-options-paper-reviews/__tests__/`.
- Libraries: `src/lib/matrix-options/paper/__tests__/guided-r2-*.test.ts` (manifest, digest, feedback,
  save queue, local drafts, transport conformance and rate limit, preview service, admin, admin
  query, admin evidence, activation-policy SQL, SQL UTF-16), `review-activation-sql.test.ts`,
  `phase2-r2-release.private.test.ts`.
- Components: `src/components/matrix-options/paper/__tests__/R2GuidedReview*.test.tsx` (UI, Save all,
  two-tab conflict, identity, lifecycle).
- E2E: `e2e/matrix-options-paper-r2-preview-local.spec.ts` (loopback preview).
- Retained but NOT current evidence: `e2e/matrix-options-paper-guided-r2.spec.ts` (still written for
  the earlier invited / not-invited admission, for example "available only to invited reviewers";
  it does not pin the current all-users admission and needs migrating before it counts), and
  `e2e/matrix-options-paper-r2-fullstack.spec.ts` (the retired Docker journey; never run for this
  candidate; excluded from the default e2e config).

Previews:
- Accepted non-Docker preview: `scripts/matrix-options/run-r2-guided-preview.ps1 -SourceRoot <R2 source>`
  runs `next dev` on `127.0.0.1:49232` with `MATRIX_R2_REVIEW_PREVIEW=1` and a dead Supabase URL.
  Reviewer: `/r2-guided-fixture` (the real `R2GuidedReview` in `transportMode="preview"`, rendering
  the real paper and figures after byte and SHA-256 checks against the release). Administrator:
  `/r2-guided-admin-fixture` (the real `GuidedAdminClient`); CSV:
  `/api/matrix-options/paper/preview-r2?admin=csv` (the real CSV builder). Storage is the in-memory
  `createPreviewR2Service` with one anonymous session per browser; the routes answer only in
  development on a direct `127.0.0.1` host.
- What it proves: frontend interaction (typing, count, resize, Save, Save all, conflicts, reload
  recovery, Finish, My Review) and that the shared admin and CSV components render saved data.
- What it does NOT prove: real sign-in, RLS, the SECURITY DEFINER RPCs, the activation row,
  admission, the DB rate limit, private-storage delivery, the production page gate or account
  deletion. Production persistence remains a controlled authenticated smoke after merge and
  deployment and before permanent activation; it needs the bounded, owner-approved enabling of the
  activation row described in section 15.
- The Docker-based disposable full-stack preview (`scripts/matrix-options/r2-fullstack-preview.ps1`,
  `playwright.r2-fullstack.config.ts`) remains in the repository but is RETIRED as an owner preview
  route and is not required for page operation.

---

## 15. Activation and release boundaries

- Writes open for an identity only when its `matrix_guided_r2_activation` row is `true`. SQL1 seeds
  it `false`, SQL2 refuses to apply unless it is still `false`, and no migration sets it true.
- Any enabling of the row is a production activation under the Supabase write gate in `CLAUDE.md`
  (exact SQL drafted, codex-reviewed GREEN, flagged to and explicitly approved by the owner). No
  content, UI or documentation change authorizes it.
- The authenticated production persistence smoke cannot persist while the row is `false` (both write
  RPCs return `release_read_only`). The smoke therefore needs its own owner-approved, bounded
  enabling of the row under that gate, after merge and deployment, and that approval must state what
  happens afterwards (disable again, or keep). Permanent enabling follows only a GREEN smoke.
- `MATRIX_R2_GUIDED_REVIEW_UI` controls whether the guided component and reviewer routes are served;
  it is not a write switch.
- Current values (activation, applied migrations, row counts, deployment) live only in
  `docs/MATRIX_OPTIONS_STATUS.md` section 3.6.

Key history (`git log --oneline`):
- v0.9.91: `cb6dc48b` activation SQL draft; `e6d6cf8c` v0.9.91 paper frontend; `d5012d77` v0.9.91-only
  review writes and draft recovery flush; `ba01159f` (#802) private TWG review packages; `16272c90`
  (#806) review workspace UX correction.
- Guided R2: `1e2d9a33` R2 default with guided preview; `4d2d3ff2` inactive R2 guided review; `e7fc3b98` writes gated on live reviewer admission;
  `e9e95c1b` public role privilege assertion; `7265d226` reviewer-admin parity; `c9215488` legacy
  admin default and guided deletion parity; `93780ab9` Save all, recovery and conflicts; `95733518`
  disposable full-stack preview tooling; `0ec2afe2` completion status, handoff and archives.
