# Matrix R2 parity candidate record - 2026-11-19

Lifecycle: REFERENCE. This is a dated local candidate record. Current lane status is
`docs/MATRIX_OPTIONS_STATUS.md` section 3.6; global project status remains `docs/INDEX.md`.

## Authority and custody

L2 Mission Control assigned the owner-approved Correction/Recovery batch to the existing
`codex/matrix-r2-public-privilege-fix-20261119` worktree. The base is remote main
`0bdccd6a78bbe44130d40b14f5e80925972ff176`. The existing local correction
`e9e95c1bd78d7c2cda93d0ef451d7d785d57a222` was preserved. The lane-specific recovery
packet is `.tmp/mission-control/matrix-r2-end-to-end-parity-20261119/`.

## Candidate scope

- Guided R2 authenticated administrator SELECT policies on entries and completion in the
  unapplied write-admission migration. Own-read policies, table grants, events, RPC admission,
  and disabled activation remain bounded.
- One admin destination with separate Guided R2 and Legacy v0.9.91 views. Guided R2 reads
  structured choices, rationales, text, revisions, timestamps and completion. Guided CSV
  exports those same fields. Legacy query, integrity checks and CSV are retained. The legacy
  view is the default until provider-backed guided connectivity is verified; a guided query
  failure retains a direct link back to legacy review.
- The unapplied admission migration adds validated auth.users ON DELETE CASCADE foreign keys
  for guided entries, completion and events. Soft deletion retains them; hard user deletion
  cascades through all three tables. The event trigger still blocks UPDATE but permits the
  cascade DELETE, and API roles gain no direct DELETE grant.
- Reviewer browser draft buffer keyed to account and both R2 manifests. Reload recovery is
  local only; it does not submit or save automatically. Revision conflict requires an explicit
  choice. Sign-out clears that account's local drafts. Page exit warns on unsaved work.
- Loopback-only, process-memory reviewer-to-admin preview. It contains no provider data and
  cannot prove live Supabase policy or production delivery.

## Verification and release boundary

Final scoped lint had zero errors (repository warnings remain), typecheck passed, 48 focused
unit/SQL tests passed, and the docs gate passed. The broad local suite with
`MATRIX_PAPER_PRIVATE_FIXTURE=skip` passed 509 files and 9343 tests; seven files were skipped
because the private fixture was not supplied. A loopback Playwright preview passed 4/4 and
proved choice with rationale, text answer, section comment, whole-paper comment, revision
conflict, explicit completion, reload, the administrator table and CSV, unsaved reload recovery,
and the client-route Back warning. The monitored clean build passed with exit 0 on the
corrected candidate. Independent targeted review identified
an account-switch race, feedback reload gap, the need to bind the legacy administrator helper's
source, a Back navigation gap, a stale status header, and preview parity gaps for cleared and
whitespace-only saved responses. Those findings were corrected with focused regression tests.
The exact final review verdict and local commit are carried in the
lane recovery packet and reported to Mission Control. No provider write, push, PR, merge,
deployment or activation was authorized in this batch.

The subsequent local correction to the unapplied migration and admin default is separately
tracked in the lane recovery packet. Its final review, gates and commit must be read there;
the results above refer to the preceding 7265d226 candidate and do not prove a provider apply.
