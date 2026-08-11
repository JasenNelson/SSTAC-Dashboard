# Archive -- 2026-08-09 Wiki recovery

Historical import. Nothing in this folder is current authority.

## Contents

### FRESH_SESSION_HANDOFF_2026_08_07b_VERIFICATION_AND_REPINNED_CAPTURE.md

- **Source path (repo-relative):** `FRESH_SESSION_HANDOFF_2026_08_07b_VERIFICATION_AND_REPINNED_CAPTURE.md`
  -- i.e. the repository ROOT of the primary checkout.
- **Source path (absolute, as read):** `C:\Projects\sstac-dashboard\FRESH_SESSION_HANDOFF_2026_08_07b_VERIFICATION_AND_REPINNED_CAPTURE.md`
- **Originating commit:** The source was untracked. No source-path commit provenance was available or supplied. Import provenance is the recorded SHA-256. Do not cite a commit for it, and do not
  infer that any prior commit contained these bytes.
- **Import type:** BYTE-IDENTICAL HISTORICAL IMPORT. The file was copied verbatim. No line was
  edited, reflowed, corrected, or re-dated on import, including statements that are now known to be
  stale.
- **Source SHA-256:** `de844ac914bcdbbe22e7720d5c9c7985899ef0eadd887599925e3e1e2884a416`
  (14724 bytes). Hashed before the copy and re-hashed at the destination after the copy; the two
  were required to be equal, and were.
- **Archive creation date:** 2026-08-09
- **THE ORIGINAL REMAINS UNTRACKED AND UNTOUCHED.** The primary-checkout file was not edited,
  moved, deleted, staged, or otherwise disturbed by this import. It is still reported as `??` by
  `git status` in the primary checkout. This archive holds a COPY, not a relocation.

**Replacement:** the current session-to-session continuity anchor is
`FRESH_SESSION_HANDOFF_2026_08_09_SSTAC_CURRENT.md`, registered in
`docs/_meta/docs-manifest.json` as `continuity.current_handoff`. For the material this archived
file used to carry, read that anchor's section "3. Where current facts actually live" and section
"4. Wiki / Graphify lane".

## Why this file was archived rather than adopted

Its filename says `2026_08_07b` while its own status block is dated 2026-08-09, and its section 1a
hazard is written as a live imperative ("do not pop that stash before 05:30") although its own
section 0 records that the hazard has lapsed. Adopting an internally time-inconsistent document as
the canonical anchor would recreate the drift the anchor exists to prevent. It is preserved because
it carries durable evidence the replacement cites rather than restates: the L0 1.4 incident record
(a visitor session ran `git stash` + `git reset --hard` in the primary checkout), a re-probed
verified-facts list, and the "age is not parentage" process-baseline correction.

## Reading rule

Treat every claim in this folder as a dated claim list tied to its authoring date, never as live
status. Current facts live in `docs/_meta/docs-manifest.json` under `facts`; current routing lives
in `docs/INDEX.md`.
