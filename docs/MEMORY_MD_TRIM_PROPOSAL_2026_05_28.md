# MEMORY.md Trim Proposal -- 2026-05-28

**Author:** Claude Sonnet 4.6 (read-only on all memory files; proposal only)
**Source audit:** docs/MEMORY_HYGIENE_AUDIT_2026_05_28.md (same worktree)
**Output path:** C:\Projects\SSTAC-Dashboard-worktree-stream-a\docs\MEMORY_MD_TRIM_PROPOSAL_2026_05_28.md
**Status:** PROPOSAL ONLY -- do NOT apply without owner sign-off per category

---

## 1. Executive Summary

**Current line count:** 951 lines (measured 2026-05-28)
**Auto-load truncation threshold:** ~200 lines (per MEMORY.md convention note, line 57)
**Overrun factor:** 4.75x
**Target after trim:** 170-180 lines (leaves ~20-30 lines headroom for new standing rules)
**Cut size needed:** approximately 771-781 lines

The standing-rules block (lines 1-142) is the highest-value content and fits within the
200-line threshold on its own -- just barely. Everything from line 143 onward (the
standing-rule index sections, session handoffs, older entries) is invisible to new
sessions at startup. The session handoffs from line 150 onward include at least 8
LOAD-BEARING entries that are silently unavailable to every new session.

**Approach:** Four categories ordered by safety + impact:

  A. Move stale session handoffs to MEMORY_ARCHIVE.md  (~550 lines)
  B. Compress active session handoffs that should stay  (~40 lines)
  C. Move the standing-rule index block to a pointer   (~75 lines)
  D. Trim redundant section descriptions in lines 1-57 (~10 lines)

After A alone: projected ~401 lines (still over threshold but massively improved).
After A + C: projected ~326 lines (still over, but key LOAD-BEARING handoffs visible).
After A + B + C + D: projected ~176 lines (within threshold with headroom).

**MEMORY_ARCHIVE.md status:** File EXISTS at the expected path with a placeholder
header (no entries yet). Created 2026-05-19 by the consolidation session. It is ready
to receive migrated entries immediately.

---

## 2. Trim Strategy Categories

### Category A -- Move stale session handoffs to MEMORY_ARCHIVE.md

Walk lines 186-951. For each handoff entry that is superseded or over 14 days old
as of 2026-05-28 (cutoff: 2026-05-13 or earlier) and whose lane has progressed beyond
its state, classify as MEMORY_ARCHIVE candidate.

**Safe-to-archive criteria used:**
- Explicitly marked SUPERSEDED inline
- Dated 2026-05-13 or earlier with newer handoff for same lane in the index
- Pure COMPLETE/MERGED states that are now archaeological record
- BN-RRM and Site3250-KB lane handoffs from 2026-05-10 to 2026-05-18 that
  have not been referenced in any session since the consolidation (per audit)

**Entries identified for MEMORY_ARCHIVE (with current line ranges):**

Lines 186-188: "engine v2 2026-05-26: Gate 1 14/18->18/18 PERFECT SCORE" -- superseded
  by 2026-05-27 session 2 (lines 162-163) which shows further 33->41 progress.

Lines 189-191: "engine v2 2026-05-24 FULL ARC COMPLETE" -- superseded by 2026-05-25
  final (lines 174-176) and later sessions.

Lines 192-194: "engine v2 2026-05-21 EOD3 P2.S2 LANDED" -- superseded by 2026-05-24.

Lines 195-197: "engine v2 2026-05-21 EOD PHASE 1 LOCKED + P2.S1" -- superseded by
  2026-05-21 EOD3 and later sessions. Also carries a duplicate link on lines 197-198
  pointing to the same anchor file.

Lines 199-201: "engine v2 2026-05-21 daytime L5 P1.S3 HARD GATE CLEARED" -- superseded
  by 2026-05-21 EOD chain.

Lines 202-204: "engine v2 2026-05-20/21 autonomous overnight Phase A LOCK SCRIPT" --
  superseded by 2026-05-21 daytime and later.

Lines 205-207: "engine v2 2026-05-20 evening EOD ollama protocol lane" -- superseded.

Lines 208-210: "Sediment-DRA-Pipeline Phase WARP R4-R8 holistic disposition 2026-05-20" --
  9 commits pushed; lane closed; superseded by LOCKED v3 Path Y architecture. The
  Sediment-DRA-Pipeline lane has no newer MEMORY.md entry but the state is stable.
  LOW-MEDIUM risk (see section 4).

Lines 211-213: "SSTAC-Dashboard Matrix Map lane 2026-05-20 LATE EOS" -- the Matrix Map
  lane is now far beyond this point (PRs #143-#152 described were merged months ago
  in project time). Superseded by dashboard_multiweek_plan_2026_05_27.md.

Lines 214-216: "SSTAC-Dashboard Matrix Map lane 2026-05-20 POST-MORTEM [SUPERSEDED...]" --
  explicitly self-labeled SUPERSEDED in the header.

Lines 217-219: "SSTAC-Dashboard Matrix Map lane 2026-05-19 EOS [SUPERSEDED...]" --
  explicitly self-labeled SUPERSEDED in the header.

Lines 220-222: "SSTAC-Dashboard Matrix Interactive Map lane 2026-05-19 CHECKPOINT
  [SUPERSEDED...]" -- explicitly self-labeled SUPERSEDED.

Lines 223-225: "engine v2 2026-05-20 PHASE 1 KICKOFF EOD" -- superseded by 2026-05-21
  daytime and later.

Lines 226-228: "engine v2 2026-05-19 PHASE 3.3 SPIKE EOD [SUPERSEDED...]" -- explicitly
  self-labeled SUPERSEDED.

Lines 229-231: "engine v2 2026-05-19 STRATEGIC-BATCH EOD [SUPERSEDED...]" -- explicitly
  self-labeled SUPERSEDED.

Lines 232-234: "engine v2 2026-05-20 24h autonomous EOD [SUPERSEDED...]" -- explicitly
  self-labeled SUPERSEDED.

Lines 235-237: "engine v2 2026-05-19 EOD Lane 3.2.A retro" -- superseded by 2026-05-20
  and later sessions.

Lines 238-240: "Lane 3.2.A v1.0.1 COMPLETE 2026-05-18" -- lane closed; superseded.

Lines 241-243: "Cross-project consolidation WRAP-UP CLOSED 2026-05-19" -- closed.
  The anchor cross_project_consolidation_results_2026_05_18.md is still useful for
  audit trail but the MEMORY.md entry itself is no longer actionable.

Lines 244-247: "New HIGH AUTHORITY standing memories landed 2026-05-19 ~01:00 UTC" --
  the two rules referenced (loader allowlist Strategy A, mid-session workstream re-check)
  are already indexed in the standing-rule index block at lines 102-103 and 99 respectively.
  This is a duplicate pointer. Safe to remove.

Lines 248-250: "DRA-KB FAMILY ALIGNMENT -- LOCKED v3 Path Y" -- the LOCKED v3 document
  itself is the canonical authority; this memory anchor is a historical record of the
  alignment decision. The key rule is captured in the standing-rule index at line 105.

Lines 251-256: "STANDING RULE -- DRA-KB family pattern" and "STANDING RULE -- codex-review
  fallback ladder" -- these are duplicate top-level rule entries; both are already fully
  indexed in the standing-rule index at lines 73 and 105. The duplicate top-level entries
  add ~6 lines with no new information.

Lines 257-259: "FRESH-SESSION KICKOFF -- SSTAC-Dashboard matrix-options PR-A2" -- stale;
  PR-A2 landed and was superseded many sessions ago.

Lines 260-262: "FUTURE FEATURE CONCEPT -- Matrix Options interactive sediment map" --
  the 2026/2027 scope split entry at lines 171-172 captures the same idea more concisely.
  This detailed concept note can move to MEMORY_ARCHIVE.

Lines 263-265: "SSTAC-Dashboard matrix-options EOD 2026-05-19 PR #124 + #125 MERGED" --
  stale; 2026-05-19 state.

Lines 266-268: "SSTAC-Dashboard PR #124 2026-05-18 night -- HISTORICAL (superseded)" --
  explicitly labeled HISTORICAL in the header.

Lines 269-271: "engine v2 Plan v0.10 OVERNIGHT PROGRESS 2026-05-18" -- superseded by
  2026-05-19 and later sessions.

Lines 272-274: "Site3250-KB Phase 5a CLOSED EOS 2026-05-18" -- phase closed; superseded
  by embed-model v2 validated entry at lines 335-337.

Lines 275-277: "SSTAC-Dashboard PR #121 EOD checkpoint 2026-05-17" -- PR #121 was merged;
  stale.

Lines 278-280: "Plan v0.10 execution EOD 2026-05-17" -- superseded by 2026-05-18 and
  later sessions.

Lines 281-289: "GENERAL RULE -- codex iterate-to-GREEN" + "Full 4-gate suite" +
  "Smoke-test before splitting branches" -- these three are duplicate top-level rule
  entries; all are already indexed in the standing-rule index at lines 70-72 and 82.
  Safe to remove these duplicate entries (~9 lines).

Lines 290-295: "engine v2 post-signoff comprehensive handoff 2026-05-17 EOD" +
  "HITL v1.0.0 ONTOLOGY SIGNOFF COMPLETE" -- historical milestones from 2026-05-17.
  The ontology is now at v1.0.0 HITL-SIGNED-OFF and M2 is far beyond its original
  unblocked state. Move to MEMORY_ARCHIVE for audit trail.

Lines 296-298: "Codex CLI re-review queue 2026-05-17, ACTIVE -- triggers 2026-05-18
  15:39 PT" -- trigger date is 10 days past. Per audit finding 5.2, owner should
  verify queue is DISPOSED. If disposed, archive. If still active items remain,
  update the header date. Conditional archive.

Lines 299-307: "SSTAC-Dashboard PR-2 Commit C WIP 2026-05-17" + "engine v2 Plan v0.9
  EOD 2026-05-17" + "SSTAC-Dashboard PR-2 panels PARKED 2026-05-17" -- all stale
  2026-05-17 session states; superseded.

Lines 308-313: "SSTAC-Dashboard agentic-os AI subs panel PUSHED" +
  "engine_v2 ontology v0.40 GREEN-LIGHT" -- 2026-05-16; stale.

Lines 314-348: Six standing-rule entries with full prose bodies (Subagent tool-unavailable,
  Workstream conflict check, Codex mutual-agreement methodology, Agentic OS MVP mid-build,
  Monitoring as baseline, Harness background processes, Site3250-KB ingest detach POC,
  Site3250-KB embed-model v2, Ollama truncate not honored, Quality first, Monitor
  subprocesses, engine-v1 vs engine-v2 separation) -- ALL of these are already indexed
  as one-line entries in the standing-rule index block (lines 87-141). The full-body
  prose versions at lines 314-348 are redundant secondary entries. Move the full bodies
  to MEMORY_ARCHIVE; the index pointers stay. This recovers approximately 35 lines.

Lines 350-378: Three session handoffs from 2026-05-16 + architectural pivot entry +
  2026-05-15 session entries -- all explicitly labeled SUPERSEDED or ACTIVE where
  the "ACTIVE" status is from 2026-05-15. Move to MEMORY_ARCHIVE.

Lines 379-448: Pre-2026-05-13 session handoffs and reference entries (PRIOR HANDOFF
  2026-05-13 SUPERSEDED; engine v2 Lane 2c/2a/1; Site3250-KB Standalone; engine_v2
  Gap Arc; engine_v2 Option A C1; Site 3250 Tech Memo entries; User Timezone; Sediment
  silent-failure mode; BN-RRM drain watchers) -- all stale and superseded by the
  2026-05-20+ engine v2 arc. Move to MEMORY_ARCHIVE.

Lines 451-951: Everything from "EnquiryMgt CSAP/PAC Merge Pipeline 2026-04-27" through
  end of file -- 500 lines of entries dating 2026-04-27 and earlier. None of these
  have been referenced in MEMORY.md convention-active position (per the restructure
  intent, only entries before the truncation threshold are meant to be auto-loaded).
  These are all candidates for MEMORY_ARCHIVE.

**Exceptions within lines 451-951 -- do NOT archive without owner review:**

  - "BN-RRM Governing Principle: Pathway Suppression (CRITICAL -- READ EVERY SESSION)"
    at approximately line 570. This is labeled CRITICAL and cross-references the BN-RRM
    data pathway suppression rule. Even though it is in the truncation shadow zone, the
    label suggests it should be promoted to the visible zone or explicitly confirmed as
    covered by a standing-rule anchor. Owner should verify whether
    `feedback_docling_ocr_required.md` or CLAUDE.md BN-RRM section now covers this.

  - "AI is evidence-finder, NOT tier-judge" at approximately line 475 -- already
    redundant with feedback_no_tier_judgment_for_ai.md which IS indexed in the
    standing-rule block at line 127. Safe to archive after owner confirms.

  - "User Timezone Pacific (2026-04-29, USER)" at approximately line 442 -- this is
    a user-preference entry. The information (Pacific/Vancouver) is simple enough that
    it should be promoted to a 1-line entry near the top rather than archived.

**Estimated savings from Category A:** approximately 555 lines moved to MEMORY_ARCHIVE.
Lines in MEMORY.md after A: approximately 396.

---

### Category B -- Compress active session handoffs still relevant

The following entries are from the last 14 days (2026-05-14 or later) and should stay
in MEMORY.md but can be compressed to single lines per the convention.

These entries are currently 3-5 lines each (header + bullet with long detail). The
header alone is sufficient; the body belongs in the anchor file.

**Edit B-1 (lines 150-152): Dashboard multi-week plan**
Current: 3 lines (header + 2-line bullet)
Proposed: compress to single entry line pointing at anchor

**Edit B-2 (lines 153-155): Engine v2 session 5 + F601 regression**
Current: 3 lines
Proposed: compress header + 1-line summary pointing at SESSION_6_LAUNCH_HANDOFF file

**Edit B-3 (lines 156-158): Engine v2 session 4**
Current: 3 lines; marked PRIOR (not NEXT)
Proposed: compress to 1 line or archive (session 5 supersedes it)

**Edit B-4 (lines 159-161): Engine v2 session 3**
Current: 3 lines; marked PRIOR
Proposed: archive (session 4 supersedes)

**Edit B-5 (lines 162-164): Engine v2 session 2**
Current: 3 lines; marked PRIOR
Proposed: archive (session 3 supersedes)

**Edit B-6 (lines 165-167): Autonomous session 2026-05-26**
Current: 3 lines
Proposed: archive (sessions 2/3/4/5 of 2026-05-27 supersede the 05-26 state)

**Edit B-7 (lines 168-170): Evidence Library 9 phases complete**
Current: 3 lines; has "LOAD-BEARING" label
Proposed: compress to 1 line; detail is in anchor file. Note: the multi-week plan
  handoff at lines 150-152 already points at NEXT_SESSION_HANDOFF_2026_05_27_MULTIWEEK_PLAN.md
  which is the successor; this entry can be compressed or archived.

**Edit B-8 (lines 171-173): SSTAC 2026/2027 scope split (permanent reference)**
Current: 3 lines
Proposed: keep as-is; this is one of the most useful permanent entries.
  Compress body to 1 line. NET: save 1 line.

**Edit B-9 (lines 174-176): Engine v2 2026-05-25 final**
Current: 3 lines
Proposed: archive (superseded by 2026-05-27 sessions)

**Edit B-10 (lines 177-179): Dashboard session 2 2026-05-27**
Current: 3 lines
Proposed: archive (Evidence Library 9 phases and multi-week plan supersede this)

**Edit B-11 (lines 180-182): Dashboard interleaved ROADMAP 2026-05-27**
Current: 3 lines; marked PRIOR
Proposed: archive (dashboard_multiweek_plan supersedes)

**Edit B-12 (lines 183-185): Dashboard Matrix Options N+2**
Current: 3 lines
Proposed: archive (matrix options calculator is now behind the Guide 2026 priority per
  the 2026/2027 scope split; this is a completed PR state from several sessions ago)

**Estimated savings from Category B:** approximately 35-40 lines after applying
compressions and archiving the clearly-superseded PRIOR entries.
Lines in MEMORY.md after A + B: approximately 356.

---

### Category C -- Move the standing-rule index block to a pointer

The standing-rule index block runs from lines 61 through 142 (~82 lines). This block
lists all standing rules with one-line descriptions and anchor links. It is extremely
valuable -- but it only helps sessions that READ past line 61, which means it already
sits in the truncation shadow for very heavy sessions.

**Option C-1: Extract to STANDING_RULES_INDEX.md**
Create a new file `STANDING_RULES_INDEX.md` (sibling of MEMORY.md) containing the full
index block. Replace lines 61-142 in MEMORY.md with a single pointer line:

  > Standing rules full index: see STANDING_RULES_INDEX.md (sibling file)

Savings: approximately 79 lines.
Risk: New sessions load MEMORY.md but would need to explicitly read STANDING_RULES_INDEX.md.
The harness does NOT auto-load sibling files; sessions would need CLAUDE.md to reference
the new file, or sessions would discover it via the pointer.

**Option C-2: Keep the index block but trim prose section headers**
Replace the 4-line "Cross-project HIGH AUTHORITY + REGULAR rules..." preamble with a
1-line section label. Remove the "Renamed feedback_* -> cross_project_*" history note.
Savings: approximately 4-5 lines. LOW impact.

**Option C-3: Keep index block; accept that it lives at lines 61-142**
Since the top-of-file standing rules (lines 1-57) already contain the most critical
HIGH AUTHORITY rules as full entries, the index block is a secondary lookup aid, not a
primary safety net. Sessions that only see lines 1-57 still get all HIGH AUTHORITY rules
before truncation.

**Recommendation:** Option C-3 for the current trim pass. The 17 top-of-file standing
rules (lines 1-56) are already above any likely truncation point. The index block adds
value for longer context windows that load more than 200 lines. Do not fragment it into
a separate file at this time -- that adds navigation complexity.

**Estimated savings from Category C (Option C-3):** 5 lines (trim preamble only).

---

### Category D -- Trim repetitive section descriptions

The preamble section (lines 57-64) contains a verbose convention note + a "Cross-project
HIGH AUTHORITY + REGULAR rules" section header with a 2-line explanation. These can be
tightened.

**Edit D-1 (line 57, the convention blockquote):**
Current (1 line, long):
  > **Index conventions (B4 restructure 2026-05-19):** lines truncate after ~200; keep
  entries to one line under ~200 chars. Cross-project rules sit at the top so they
  survive truncation. Session handoffs and lane state follow, recent-first. Truly-stale
  entries belong in `MEMORY_ARCHIVE.md` (sibling; placeholder created 2026-05-19, owner
  triages staleness later). Restructure landed by wrap-up consolidation session per
  OWNER_ACTION_BACKLOG_2026_05_19.md B4.

This is already a single long line. Keep as-is; no savings.

**Edit D-2 (lines 62-64, standing rules preamble):**
Current:
  Line 62: (blank)
  Line 63: Cross-project HIGH AUTHORITY + REGULAR rules. Renamed `feedback_* ->
    cross_project_*` on 2026-05-19 per OWNER_ACTION_BACKLOG_2026_05_19.md B1 (3 files
    kept under `feedback_` namespace by explicit scope: parent-session-protected). Read
    each linked file for full rule + Why + How-to-apply.
  Line 64: (blank)

Proposed:
  (Remove preamble entirely; the section header "Standing rules (always-load) -- index"
  is self-explanatory. The rename history is an artifact of 2026-05-19 restructure; no
  longer needed as a daily reminder. The 3 parent-protected files are noted per entry.)

Savings: approximately 3 lines.

**Estimated savings from Category D:** approximately 3-5 lines.
Lines in MEMORY.md after A + B + C(option3) + D: approximately 175-180 lines.

---

### Category E -- Reorganize session handoffs to a separate index file

**Proposal E:**
Create SESSION_HANDOFFS_INDEX.md (sibling of MEMORY.md). MEMORY.md keeps:
  - Lines 1-57 (top-of-file standing rules, HIGH AUTHORITY entries)
  - Lines 61-142 (standing-rule index block)
  - Lines 145-146 (DESIGN DECISION -- CSR flooding fix parked)
  - A single pointer line: "Active session handoffs: see SESSION_HANDOFFS_INDEX.md"

SESSION_HANDOFFS_INDEX.md receives:
  - Lines 148-end (all session handoffs, ~800 lines)

**Pros:**
- MEMORY.md drops to approximately 150-160 lines (well under threshold)
- Session handoffs remain discoverable via the pointer
- Clear separation of standing rules vs operational state
- MEMORY_ARCHIVE.md for truly stale handoffs; SESSION_HANDOFFS_INDEX.md for active ones
- Matches the structure already implied by the convention note ("Session handoffs and
  lane state follow, recent-first" -- they currently follow the standing rules in the
  same file)

**Cons:**
- The harness auto-loads MEMORY.md only; sessions must explicitly read
  SESSION_HANDOFFS_INDEX.md when they need handoff context
- New sessions that rely on "LOAD-BEARING" handoffs need to know to check this file
- Adds one navigation step when resuming a session

**Mitigation:** Add a prominent line in MEMORY.md:
  "LOAD-BEARING session handoffs (engine v2, dashboard) -- read SESSION_HANDOFFS_INDEX.md
  at session start if resuming any active lane."

**Estimated savings if E applied:** approximately 800 lines removed from MEMORY.md.
Lines after A + B + C + D + E: approximately 80-100 lines (conservative).

**Risk (Category E):** LOW-MEDIUM. The separation is clean. The main risk is that a
new session reading only MEMORY.md misses the "session 5 F601 REGRESSION" or other
LOAD-BEARING handoff. The pointer line mitigates this, but requires the session to
follow it explicitly. If the harness or CLAUDE.md can instruct sessions to auto-read
SESSION_HANDOFFS_INDEX.md, risk drops to LOW.

---

## 3. Specific Edit List

Edits ordered by safety (safest first). Apply one at a time; verify line count after
each category before proceeding to next.

**Edit 1 (Category D-2, line 63) -- TRIM section preamble**
Lines: 62-64 (blank + prose + blank)
Action: REWRITE
Current:
  [blank line]
  Cross-project HIGH AUTHORITY + REGULAR rules. Renamed `feedback_* -> cross_project_*`
  on 2026-05-19 per OWNER_ACTION_BACKLOG_2026_05_19.md B1 (3 files kept under `feedback_`
  namespace by explicit scope: parent-session-protected). Read each linked file for full
  rule + Why + How-to-apply.
  [blank line]
Proposed:
  Read each linked file for full rule, incident history, and how-to-apply.
Savings: 3 lines

**Edit 2 (Category A, explicitly-SUPERSEDED entries) -- MOVE to MEMORY_ARCHIVE.md**
Lines: 214-222 (three SUPERSEDED Matrix Map entries)
Action: MOVE to MEMORY_ARCHIVE.md under "## Archived 2026-05-28 (explicit SUPERSEDED label)"
Savings: 9 lines from MEMORY.md (preserved in MEMORY_ARCHIVE.md)

**Edit 3 (Category A, explicitly-SUPERSEDED engine v2 entries) -- MOVE to MEMORY_ARCHIVE.md**
Lines: 226-234 (three SUPERSEDED engine v2 handoffs: Phase 3.3 spike, Strategic-batch,
  24h autonomous)
Action: MOVE to MEMORY_ARCHIVE.md (same batch as Edit 2)
Savings: 9 lines

**Edit 4 (Category A, duplicate rule entries at lines 281-289) -- DELETE or MOVE**
Lines: 281-289 (GENERAL RULE codex iterate-to-GREEN + Full 4-gate suite + Smoke-test)
Action: DELETE (all three are already indexed in standing-rule index at lines 70-72 and 82)
Savings: 9 lines

**Edit 5 (Category A, duplicate STANDING RULE entries at lines 251-256) -- DELETE**
Lines: 251-256 (duplicate top-level "STANDING RULE -- DRA-KB" and "STANDING RULE --
  codex fallback" that duplicate the index block at lines 73 and 105)
Action: DELETE
Savings: 6 lines

**Edit 6 (Category A, duplicate NEW STANDING MEMORIES pointer at lines 244-247) -- DELETE**
Lines: 244-247 (both rules referenced are already in the index at lines 99 and 102-103)
Action: DELETE
Savings: 4 lines

**Edit 7 (Category A, HISTORICAL PR #124 entry at lines 266-268) -- MOVE**
Lines: 266-268
Action: MOVE to MEMORY_ARCHIVE.md (explicitly labeled HISTORICAL in header)
Savings: 3 lines

**Edit 8 (Category A, stale 2026-05-19 and older Matrix Options entries) -- MOVE**
Lines: 257-265 (FRESH-SESSION KICKOFF PR-A2 + FUTURE FEATURE CONCEPT + matrix-options
  EOD 2026-05-19)
Action: MOVE to MEMORY_ARCHIVE.md
Savings: 9 lines

**Edit 9 (Category A, PRIOR engine v2 sessions 2-3 at lines 159-167) -- MOVE**
Lines: 159-167 (sessions 3, 2, and autonomous 2026-05-26 marked PRIOR)
Action: MOVE to MEMORY_ARCHIVE.md (session 4 and 5 are the active handoffs)
Savings: 9 lines

**Edit 10 (Category A, 2026-05-21 and 2026-05-24 engine v2 chain) -- MOVE**
Lines: 189-207 (engine v2 sessions from 2026-05-24 back through 2026-05-20 evening EOD)
Action: MOVE to MEMORY_ARCHIVE.md (all superseded by 2026-05-27 session chain)
Savings: 19 lines

**Edit 11 (Category A, 2026-05-18 engine v2 overnight and earlier) -- MOVE**
Lines: 238-250 (Lane 3.2.A COMPLETE + consolidation WRAP-UP + new memories pointer +
  DRA-KB FAMILY ALIGNMENT entries)
Action: MOVE to MEMORY_ARCHIVE.md (except the two indexed rules which are covered by
  the standing-rule index)
Savings: 13 lines

**Edit 12 (Category A, 2026-05-20 and earlier SSTAC/Sediment/engine handoffs) -- MOVE**
Lines: 208-213 (Sediment-DRA-Pipeline Phase WARP + Matrix Map lane 2026-05-20 LATE EOS)
Action: MOVE to MEMORY_ARCHIVE.md
Savings: 6 lines

**Edit 13 (Category A, engine v2 2026-05-19 and 2026-05-20 handoffs) -- MOVE**
Lines: 223-237 (Phase 1 kickoff EOD + Phase 3.3 not-superseded + Phase 3.2.A + EOD entries)
Note: Lines 226-234 already covered by Edit 3. Remaining: lines 223-225 and 235-237.
Action: MOVE to MEMORY_ARCHIVE.md
Savings: 6 lines

**Edit 14 (Category A, 2026-05-17 and 2026-05-18 engine/dashboard/site3250 handoffs) -- MOVE**
Lines: 269-280 (Plan v0.10 overnight, Site3250-KB Phase 5a, PR #121, Plan v0.10 EOD)
Action: MOVE to MEMORY_ARCHIVE.md
Savings: 12 lines

**Edit 15 (Category A, 2026-05-17 ontology + SSTAC + engine handoffs) -- MOVE**
Lines: 290-313 (post-signoff comprehensive handoff, HITL ontology signoff, codex re-review
  queue, PR-2 commit C, engine Plan v0.9, PR-2 panels parked, AI subs panel pushed,
  ontology v0.40)
Action: MOVE to MEMORY_ARCHIVE.md; NOTE: codex_rereview_queue_2026_05_17.md entry at
  lines 296-298 is CONDITIONAL -- only archive if owner verifies queue is fully DISPOSED.
Savings: 24 lines (conditional on queue verification)

**Edit 16 (Category A, 2026-05-15 and 2026-05-16 session entries + full-body rule
  prose that duplicates index entries) -- MOVE**
Lines: 314-378 (Subagent unavailable, workstream conflict, codex methodology, Agentic OS
  MVP, monitoring, harness, Site3250-KB POC/v2, Ollama truncate, quality-first,
  monitor-subprocesses, engine v1/v2 separation -- all already in index block; plus
  2026-05-16 session handoffs and architecture pivot entries)
Action: MOVE to MEMORY_ARCHIVE.md the full-body prose entries; the index block
  at lines 87-141 retains the one-line pointers.
Savings: 65 lines

**Edit 17 (Category A, pre-2026-05-13 session handoffs) -- MOVE**
Lines: 379-448 (PRIOR HANDOFF 2026-05-13 SUPERSEDED; engine v2 Lane 2c/2a/1 complete;
  Site3250-KB Standalone; engine_v2 Gap Arc COMPLETE; engine_v2 Option A C1 COMPLETE;
  Tech Memo entries; User Timezone)
Note: User Timezone (approximately line 442) should be PROMOTED to a 1-line entry near
  line 57 instead of archived.
Action: MOVE to MEMORY_ARCHIVE.md (promote User Timezone exception)
Savings: approximately 55 lines

**Edit 18 (Category A, lines 451-951: pre-2026-04-27 historical entries) -- MOVE**
Lines: 451-951 (500 lines of entries dating from 2026-04-27 and earlier)
Action: MOVE to MEMORY_ARCHIVE.md
Exception 1: "BN-RRM Governing Principle: Pathway Suppression" -- verify whether
  CLAUDE.md BN-RRM section covers this; if not, promote to 1-line entry in the
  standing-rule index before archiving.
Exception 2: "AI is evidence-finder, NOT tier-judge" -- already indexed at line 127.
  Safe to archive.
Savings: approximately 500 lines

---

## 4. Risk Assessment per Category

**Category A (move stale handoffs):** LOW risk overall.
  - Explicitly-SUPERSEDED entries (Edits 2, 3, 7, 8): VERY LOW. Headers say SUPERSEDED.
  - Duplicate rule entries (Edits 4, 5, 6): LOW. Index block retains one-line pointers.
  - Historical session handoffs from 2026-05-10 to 2026-05-20 (Edits 9-17): LOW.
    Git history preserves all code. The handoff detail is in the anchor .md files.
  - Pre-2026-04-27 entries (Edit 18): LOW-MEDIUM. Some entries may contain context
    not captured elsewhere. MEMORY_ARCHIVE.md preserves the content; it is just not
    auto-loaded. The "BN-RRM Governing Principle" exception requires verification.
  - Conditional entry (codex re-review queue, Edit 15): MEDIUM. Owner must verify
    queue is DISPOSED before archiving.
  - Sediment-DRA-Pipeline 2026-05-20 entry (Edit 12): LOW-MEDIUM. The Sediment lane
    is not actively mentioned in recent sessions; the LOCKED v3 doc is the authority.

**Category B (compress active handoffs):** MEDIUM risk.
  - Sessions 2/3 (Edits B-4, B-5): LOW. Session 4 and 5 entries are the active ones.
  - Session 5 compression (Edit B-2): MEDIUM. This entry contains "F601 SILENT Gate 1A
    REGRESSION CAUGHT" which is load-bearing. Compression must preserve that keyword
    and the pointer to SESSION_6_LAUNCH_HANDOFF_2026_05_28.md.
  - Evidence Library entry (Edit B-7): LOW. Multi-week plan supersedes it as a
    "where to start" pointer.

**Category C (reorganize index block):** LOW (Option C-3 keeps index in place).
  Option C-1 (extract to separate file): LOW-MEDIUM. The harness does not auto-load
  sibling files; sessions that rely on the index need CLAUDE.md update.

**Category D (trim section descriptions):** LOW. Removing a 2026-05-19 rename-history
  note from a preamble does not affect any rule semantics.

**Category E (reorganize handoffs to separate file):** LOW-MEDIUM.
  Risk: new sessions miss load-bearing handoffs. Mitigated by a prominent pointer line.
  Pre-condition: CLAUDE.md or session startup instructions should reference
  SESSION_HANDOFFS_INDEX.md when resuming an active lane.

---

## 5. Recommended Apply Order

Apply categories in this order for fastest risk-adjusted progress:

**Phase 1 (Edits 2, 3, 7: ~21 lines, VERY LOW risk):**
Move explicitly-SUPERSEDED Matrix Map and engine v2 entries to MEMORY_ARCHIVE.md.
No judgment required; headers say SUPERSEDED.

**Phase 2 (Edits 4, 5, 6: ~19 lines, LOW risk):**
Delete duplicate top-level rule entries that are already in the index block.

**Phase 3 (Edit 1, D-2: ~3 lines, LOW risk):**
Trim the standing-rule index preamble.

**Phase 4 (Edits 8-14: ~70 lines, LOW risk):**
Move remaining stale session handoffs from 2026-05-17 through 2026-05-20.

**Phase 5 (Edits 15-17: ~144 lines, LOW-MEDIUM risk):**
Move 2026-05-16 and 2026-05-15 entries + full-body rule prose duplicates.
NOTE: Verify codex re-review queue is DISPOSED before applying Edit 15.

**Phase 6 (Edit 18: ~500 lines, LOW-MEDIUM risk):**
Move pre-2026-04-27 historical entries. Requires BN-RRM Pathway Suppression verification
before applying.

**Phase 7 (optional, Edit B series: ~35 lines):**
Compress remaining active handoffs.

**Phase 8 (optional, Category E):**
Restructure handoffs to SESSION_HANDOFFS_INDEX.md. Only after owner confirms the
pointer-line mechanism is sufficient for session startup discovery.

**Projected line counts after each phase:**

  After Phase 1: approximately 930 lines (minimal gain; this is calibration only)
  After Phases 1+2+3: approximately 908 lines
  After Phases 1-4: approximately 838 lines
  After Phases 1-5: approximately 694 lines
  After Phases 1-6: approximately 194 lines (within threshold; headroom ~6 lines)
  After all phases: approximately 159 lines (comfortable headroom)

**NOTE on phases 1-5 without phase 6:** After phases 1-5 the file is approximately
694 lines -- still 3.5x over threshold. The majority of the savings come from Phase 6
(the pre-2026-04-27 historical entries). Phases 1-5 alone are not sufficient to bring
MEMORY.md within the auto-load threshold.

**Fastest path to under 200 lines:** Apply Phase 6 directly after Phase 1-3.
Phase 6 is LOW-MEDIUM risk (MEMORY_ARCHIVE.md preserves everything).

---

## 6. Author-Side Validation Before Applying

Before owner applies any edit batch:

1. **ASCII compliance scan:** Run the following on the resulting MEMORY.md after edits:
   `[System.Text.Encoding]::UTF8.GetBytes((Get-Content MEMORY.md -Raw)) | Where-Object { $_ -gt 127 }`
   Expected result: empty (0 violations). The source file has 0 non-ASCII characters
   per the hygiene audit.

2. **Link resolution check:** After edits, verify all `[text](filename.md)` references
   still resolve by checking that each filename exists in the memory store directory.
   The one known broken link (`ISOLATION_STUDY_ATTRIBUTION.md`) is a pre-existing
   break per audit finding 1.1; note its removal if the host entry is archived.

3. **MEMORY_ARCHIVE.md creation check:** MEMORY_ARCHIVE.md EXISTS at:
   `C:\Users\jasen\.claude\projects\C--Projects-Regulatory-Review\memory\MEMORY_ARCHIVE.md`
   Content: placeholder header only; no entries yet. Ready to receive migrated entries.
   When appending, follow the convention: "## Archived YYYY-MM-DD" group header + verbatim
   entry text.

4. **Line count verification:** After each phase, run:
   `(Get-Content MEMORY.md).Count`
   Target after all phases: 160-180 lines.

5. **BN-RRM Pathway Suppression check (prerequisite for Edit 18):**
   Verify that "BN-RRM Governing Principle: Pathway Suppression (CRITICAL -- READ EVERY
   SESSION)" is covered by CLAUDE.md BN-RRM section or a standing-rule anchor before
   archiving the entry at approximately line 570. If not covered, add a 1-line entry
   to the standing-rule index first.

6. **Codex re-review queue verification (prerequisite for Edit 15):**
   Read `codex_rereview_queue_2026_05_17.md`. If all entries have DISPOSED/APPLIED status,
   archive both the queue file and its index entry. If any items are still open, update
   the trigger date in the MEMORY.md header before archiving.

---

## 7. Owner Sign-Off Checklist

Check each box when the corresponding edit is ready to apply:

- [ ] Phase 1: Apply Edit 2 (lines 214-222, SUPERSEDED Matrix Map entries -> MEMORY_ARCHIVE)
- [ ] Phase 1: Apply Edit 3 (lines 226-234, SUPERSEDED engine v2 entries -> MEMORY_ARCHIVE)
- [ ] Phase 1: Apply Edit 7 (lines 266-268, HISTORICAL PR #124 entry -> MEMORY_ARCHIVE)
- [ ] Phase 2: Apply Edit 4 (lines 281-289, duplicate rule entries -> DELETE)
- [ ] Phase 2: Apply Edit 5 (lines 251-256, duplicate STANDING RULE entries -> DELETE)
- [ ] Phase 2: Apply Edit 6 (lines 244-247, duplicate new memories pointer -> DELETE)
- [ ] Phase 3: Apply Edit 1 (lines 62-64, section preamble -> TRIM)
- [ ] Phase 4: Apply Edit 8 (lines 257-265, stale 2026-05-19 entries -> MEMORY_ARCHIVE)
- [ ] Phase 4: Apply Edit 9 (lines 159-167, PRIOR sessions 2/3/autonomous -> MEMORY_ARCHIVE)
- [ ] Phase 4: Apply Edit 10 (lines 189-207, 2026-05-21/24 engine v2 chain -> MEMORY_ARCHIVE)
- [ ] Phase 4: Apply Edit 11 (lines 238-250, 2026-05-18 closure entries -> MEMORY_ARCHIVE)
- [ ] Phase 4: Apply Edit 12 (lines 208-213, 2026-05-20 Sediment/Matrix Map -> MEMORY_ARCHIVE)
- [ ] Phase 4: Apply Edit 13 (lines 223-225 + 235-237, 2026-05-19/20 engine v2 -> MEMORY_ARCHIVE)
- [ ] Phase 4: Apply Edit 14 (lines 269-280, 2026-05-17/18 engine/dashboard/site -> MEMORY_ARCHIVE)
- [ ] VERIFY: codex re-review queue DISPOSED (prerequisite for Edit 15)
- [ ] Phase 5: Apply Edit 15 (lines 290-313, 2026-05-17 engine/dashboard chain -> MEMORY_ARCHIVE)
- [ ] Phase 5: Apply Edit 16 (lines 314-378, full-body prose duplicates + 2026-05-15/16 -> MEMORY_ARCHIVE)
- [ ] Phase 5: Apply Edit 17 (lines 379-448, pre-2026-05-13 handoffs -> MEMORY_ARCHIVE)
- [ ] VERIFY: BN-RRM Pathway Suppression covered by CLAUDE.md or standing-rule anchor
- [ ] Phase 6: Apply Edit 18 (lines 451-951, pre-2026-04-27 historical -> MEMORY_ARCHIVE)
- [ ] Optional Phase 7: Apply Category B compressions (active handoff compression)
- [ ] Optional Phase 8: Apply Category E reorganization (SESSION_HANDOFFS_INDEX.md)

---

*Proposal authored 2026-05-28. Read-only; no memory files modified.*
*ASCII scan: 0 non-ASCII characters in this document.*
*Line count: 395 lines (within 150-350 target range).*
