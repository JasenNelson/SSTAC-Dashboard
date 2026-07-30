# FRESH SESSION HANDOFF -- 2026-07-30: F2 merged, cookie hotfix merged, D2 STILL BLOCKED

Plain ASCII. Root continuity anchor for the F2 cluster-identity program. Supersedes
`FRESH_SESSION_HANDOFF_2026_07_27_OPTION_C_RESTACK_CORRECTION.md` as the newest dated root handoff.

## READ THIS FIRST: what is and is NOT done

| Item | State |
|---|---|
| F2 cluster-identity change (PR #756) | **MERGED** as `e8daa2b83e24458ff06e7b03c7159234240cca01` |
| Cookie-adapter hotfix (PR #758) | **MERGED** as `79e9353df278428603773e98ee3254f3fa627f7c` |
| Production deployment | READY on `79e9353d` (`dpl_5owuHHz6uKVYJNKF9QitndqK5VKa`) |
| Option C SQL | **UNAPPLIED** |
| **D2 (live SQL apply)** | **BLOCKED** -- owner-gated, NOT authorized, NOT executed |
| Owner authenticated production retest | **OUTSTANDING** -- D2 cannot resume until it passes |

**DO NOT describe D2 as complete, authorized, or merely pending paperwork.** It is blocked on an
owner decision AND an outstanding production retest.

## The F2 change, in one paragraph

Coordinate-cluster identity was CIRCULAR on the admin write path: the page derived a cluster key in
TypeScript and posted it to `upsert_site_aggregate_candidate`, which then selected samples BY THAT
SAME KEY, so the server had nothing independent to check. F2 makes SQL the sole authority -- a
live-preview RPC returns the SQL-derived key and representative pair, the upsert derives the key
from that pair BEFORE sample selection and raises `UE412` pre-commit on disagreement, and both
representative pairs route through one parser (`parseServerClusterIdentity`). The pinned SQL is
`docs/design/matrix-map/OPTION_C_PHASE2_SITE_AGGREGATE_PUBLICATIONS_DRAFT_2026_07_24.sql`,
126552 bytes, SHA-256 `E57B1E5EBD22BF3D15F577E759840C021AFC348BDF472887BCCF61199990DB72`.

## What happened after the F2 merge, and why it matters

The attended release check found the admin page crashing to the GLOBAL error boundary. **It was not
F2 and not the missing RPC.** A pre-existing unguarded Supabase cookie adapter (introduced by
`b84a7b44` / PR #711, 2026-07-20) threw "Cookies can only be modified in a Server Action or Route
Handler" when an auth token refresh landed mid-render. PR #758 fixed it.

**Two consequences a fresh session must not lose:**

1. **Applying D2 would NOT have fixed that crash, and could have concealed it.** The trigger is
   refresh timing, not RPC existence; a post-apply visit with no refresh due renders normally.
2. **The correct pre-D2 appearance of `/admin/matrix-map/site-aggregates` is the page rendering its
   own chrome with a bounded "Failed to load aggregate preview" banner** -- NOT a populated table,
   and NOT a full-viewport warning icon. Read the retest with that in mind.

## Supabase contact, stated with precise scope

- **Hotfix lane: NO Supabase contact.**
- **Earlier F2/release work: approved READ-ONLY preflight and verification queries occurred**
  (catalog/capability probes over a `readonly=True` session; the Option C table and all five
  functions were confirmed ABSENT).
- **Entire F2 program: NO Supabase write, migration, `apply_migration` call, or D2 execution.**

Do not compress this into "no Supabase contact occurred" -- that is false.

## Next actions, in order

1. **Owner:** authenticated production retest of `/admin/matrix-map/site-aggregates` on the current
   deployment. Pass = page chrome plus the bounded banner. Fail = full-viewport unstyled warning icon.
2. **Owner:** if the retest passes, decide D2 per
   `docs/design/matrix-map/OPTION_C_PREAPPLY_RUNBOOK_2026_07_26.md`. Section 0b's prerequisite (F2
   merged) is now satisfied; section 0.1's release-order constraint is the remaining open decision.
3. **Backlog (not blocking):** see `docs/NEXT_STEPS.md` 2026-07-30 entries -- two remaining
   unguarded cookie adapters, the `/admin` middleware-matcher question, and the AGY 1.1.8
   documentation drift.

## Authoritative pointers

- Runbook / D2 procedure: `docs/design/matrix-map/OPTION_C_PREAPPLY_RUNBOOK_2026_07_26.md`
- Cookie-adapter lesson: `docs/LESSONS.md` (2026-07-30 entry)
- Gate discipline: `docs/GATE_MODE_SOP.md`
- Merge governance (corrected 2026-07-30): `AGENTS.md` MERGE protocol
- Deferred items: `docs/NEXT_STEPS.md`
