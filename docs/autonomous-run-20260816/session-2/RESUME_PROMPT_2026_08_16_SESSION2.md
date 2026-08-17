# RESUME PROMPT -- autonomous UI/UX run, session 2 checkpoint, 2026-08-16 ~18:00

Paste into a fresh session. This is self-contained; you do not need the previous conversation.

Governing contract: `docs/AUTONOMOUS_RUN_CONTRACT_2026_08_16.md`.
Review pipeline: the `/codex-review` SKILL. **Read it before invoking codex.** Do not copy an
invocation line from any doc.

---

## 0. OWNER CORRECTIONS -- these override older docs

1. **MERGE**: the inherited "owner merges, never merge" wording is WRONG. Correct rule: the OWNER
   APPROVES the exact reviewed SHA, and then an authorized executor (you) may perform the merge.
   Never self-approve.
2. **COMMIT PROTOCOL**: the full `/codex-review` pipeline, no shortcuts. GREEN must be OBSERVED --
   a grepped `VERDICT:` token -- never inferred from a positive-sounding body, on every
   perspective (targeted / strategic / holistic) and BOTH tiers (grind, then the luna gate).
3. **TOKEN EFFICIENCY**: delegate. Sonnet subagents for reading large reviewer outputs and for
   mechanical authoring; do not page 1 MB codex transcripts into the main context.
4. A parallel codex session is working in
   `C:\Projects\SSTAC-Dashboard-worktrees\l3-census-tool-20260816` (wiki-KB / graphify /
   autolearning). Do not touch that worktree.

## 1. BRANCH / GATE STATE (measured 2026-08-16 ~17:55)

| Branch | Local | Remote | Committed this session | Gates |
|---|---|---|---|---|
| `feat/section-b-wave0-20260815` | d6d4fa0f | d6d4fa0f **in sync** | no | green, INHERITED from prior session (not re-run) |
| `feat/mo-batch2-20260816` | f0f56330 | 6612fe6b STALE | no | green (g3-batch2, prior session) |
| `feat/section-b-wavea-20260816` | c41f1463 | f73a357b STALE | no | **GREEN this session** (g5-wavea-tip) |
| `feat/deferred-triage-20260816` | 3d03c869 + **6 dirty** | 8a0627f7 STALE | no | lint/tsc/unit green; e2e has 2 PRE-EXISTING failures |
| `feat/theme-cookie-20260816` | **3a5eb26f** | **3a5eb26f PUSHED** | **YES** | **FULLY GREEN** (g7-theme-committed) |
| `feat/audit-p0-20260816` (NEW) | 3d03c869 + **6 dirty** | none | no | **FULLY GREEN** (g5-p0-pre) |
| `docs/ui-ux-autonomous-run-20260816` | aebe40b4 | in sync | no | docs only |

**PUSHED: `feat/theme-cookie-20260816` only** (fast-forward 0117e8e0..3a5eb26f, no force). PR #787's
body was replaced with `BODY_theme_cookie_787.md` and is live. The other three feature branches
are still local-only with stale remotes.

Verify any of this with `git rev-parse <branch>` vs `git rev-parse origin/<branch>` before
trusting it.

### Gate evidence locations
Scratchpad root:
`C:\Users\jasen\AppData\Local\Temp\claude\C--Projects-SSTAC-Dashboard-worktrees-triage-20260816\88224782-37b1-4ba9-a570-5a2948a009e7\scratchpad\`

- `g7-theme-committed/RESULT.txt` -- theme tip 3a5eb26f: lint 0 err, tsc clean, unit **6843
  passed**, build exit 0 + `BUILD_CORROBORATION=OK`, e2e exit 0 **208 passed / 0 failed** of 346,
  25 chromium-auth refs, `TREE_UNCHANGED=YES`. `theme-flash.spec.ts` proven to EXECUTE: run
  directly across all projects = 48 tests, 48 passed (16 x chromium+firefox+webkit).
- `g5-p0-pre/RESULT.txt` -- P0 branch: lint 0 err, tsc clean, unit **6827 passed** (exactly +7 vs
  triage, corroborating the 7 new tests), build corroborated, e2e **167 passed / 0 failed**.
- `g5-wavea-tip/RESULT.txt` -- waveA: unit 6813 passed, e2e 165 passed / 0 failed.
- `gates.sh` -- the gate runner. `scan_caps.py` -- the print-clipping scanner.

## 2. REVIEW LEDGER

### theme pair (#782 wave0 + #787 theme-cookie)
- **Leg 1a: GREEN at round 8.** Rounds 1-7 each found a real defect.
- **Leg 1b: GREEN.** Its P1 (the missing PR body that the holistic GREEN was conditioned on) is
  CLOSED. It re-verified every figure in the body against the raw logs -- gate table, the
  48-tests/48-passed claim, and the route table (136 dynamic lines minus legend minus Middleware
  = 134 rows) -- and found no overclaim. It confirmed the "measured on next dev, not production"
  caveat survived rather than being quietly dropped.
- **This pair is COMPLETE and PUSHED.** Remaining caveats it recorded: `#782` still has no Leg 2
  this session, and production-build cache headers remain unmeasured.
- **Leg 2 luna gate tier: targeted GREEN, strategic GREEN, holistic GREEN.**
  Stated honestly: targeted and holistic verdicts came from explicit VERDICT-CLOSURE rounds after
  luna omitted the mandatory verdict line (documented quirk). The holistic GREEN is CONDITIONAL on
  the residual + rollback disclosures now written into `BODY_theme_cookie_787.md`.
- **GAP: `#782` / wave0 has had NO Leg 2 review of any kind this session, and its gate evidence is
  inherited, not re-run.** Decide whether that is acceptable before merging it.

### batch-2 stack (batch2 -> waveA -> triage)
- **Leg 1a: rounds 1-10 ALL RED**, each finding something real, several introduced by the
  previous round's repair. **Round 10's findings are APPLIED** (see below). **Round 11 is OWED**
  before committing this delta -- do not commit on the assumption the streak broke.

  Round 10's three findings, all in one class -- numbers asserted in comments that nothing checks:
  1. The drift test's docstring cited the declaration and both call sites by line (~297/~1426/
     ~1450); THIS DIFF shifted them to 305/1436/1460. Self-invalidated in the same commit, while
     five hundred lines away the same diff DELETED a line citation on the grounds that "a number
     nobody verifies is decoration". Fixed by removing the numbers and saying "roughly eleven
     hundred lines apart" instead.
  2. A MatrixDashboard comment said ":1783 IS an aria-valuemin" in the present tense -- true at
     HEAD, false in the working tree the comment ships in, and at the commit that WROTE the
     citation line 1783 was a bare `);`. Fixed by naming the element, not the line.
  3. The backlog's method clause said "three // lines mention max-h-" (it is four) and never
     stated that a line whose only token is `max-h-none` is discarded -- so a literal reproducer
     lands on 53, not the documented 52. Both stated now.
- **Leg 2 luna: targeted RED (round 2, 3 P2s -- ALL FIXED, see below), strategic GREEN,
  holistic NOT RUN.**
- **The holistic on this stack is the single biggest outstanding review item.** Prompt is staged at
  `<scratchpad>/luna-holistic.txt`.

### P0 branch (`feat/audit-p0-20260816`)
- **No Leg 1 and no Leg 2 at all.** Gates are green. Needs the full pipeline before commit.

## 3. UNCOMMITTED WORK -- what is in the dirty trees

### `triage-20260816` (6 files)
Modified: `e2e/ssd-workbench.spec.ts`, `src/components/MatrixDashboard.tsx`,
`src/components/matrix-options/EvidenceLibrary.tsx`
Untracked: `docs/PRINT_CLIPPING_BACKLOG_2026_08_16.md`,
`src/components/__tests__/demotedDocumentTabsDrift.test.ts`,
`src/components/__tests__/printCapSweep.test.ts`

What it does:
- `print:max-h-none print:overflow-visible` on the EvidenceLibrary cross-pathway audit list (found
  by luna: it wraps rows rendering `entry.value` / `entry.unit` and had no print reset).
- `print:overflow-visible print:whitespace-normal print:text-clip` on `{row.substance_label}`
  INSIDE that list -- de-clipping only the list would have fixed how MANY rows print while still
  clipping WHICH substance each row is about.
- The notice and the slice now share `MAX_AUDIT_ROWS_SHOWN` instead of two copies of `50`.
- `printCapSweep.test.ts` -- source-text class contract over the two value-bearing components.
- `demotedDocumentTabsDrift.test.ts` -- one `DEMOTED_DOCUMENT_TABS` member per `demoteLeadingH1`
  call site, plus exact membership and a no-duplicates assertion.
- The runtime print sweep in `e2e/ssd-workbench.spec.ts` gained an EXISTENCE half.
- Two `MatrixDashboard.tsx` comments corrected -- their line citations were WRONG WHEN WRITTEN, not
  stale (`git show f0f56330` puts the call sites at 1426/1450 on the very commit that cited
  1421/1445), plus a false "kept beside the call sites so they cannot drift" safety claim removed.

Commit message staged at `<scratchpad>/commit-msgs/triage.txt`.

### `p0-audit-20260816` (6 files) -- branched off triage@3d03c869
The three remaining audit P0s plus one of the same class:
- **P0-1** `MatrixMapRightPanel` -- `censored` is `boolean | null` and a two-state ternary rendered
  `null` (UNKNOWN) as the word "Detected". Now an `unknown` badge.
- **P0-2** `SsdWorkbench` -- exclusions table rendered `.slice(0, 8)` while the tile above reported
  the true total. Cap removed.
- **P0-4** `TWGReviewPortal` -- comments clipped at 5000 chars silently. `maxLength` REMOVED
  (the browser truncated pastes before `onChange`, so a warning built on the handler would have
  been unreachable code that looked like a safeguard), limit enforced in `handleCommentChange`,
  `role="alert"` naming the characters dropped.
- **Also**: the PRIMARY matrix-map measurement table was capped `max-h-[68vh]/[42vh]` via `cn()`
  with no print reset.
- 7 regression tests, each falsified two-sided. Commit message at `<scratchpad>/commit-msgs/p0.txt`.

**REBASE NOTE:** this branch is based on triage@3d03c869. Once triage commits, rebase it.
MEASURED: the rebase should be CLEAN. The P0 branch's six changed files and the triage delta's six
changed files INTERSECT IN NOTHING. The apparent overlap on `SsdWorkbench.tsx` /
`SsdWorkbench.test.tsx` is against triage's COMMITTED history, which the P0 branch already
contains (`f06a3ad7` is an ancestor of it) -- not against the new delta.

## 4. WHAT I FIXED FROM THE LAST REVIEW ROUNDS (do not redo)

- Leg 1b's blocker: **there was no PR body for #787 at all**, and the holistic GREEN was
  conditional on disclosing the residual there. Written:
  `<triage worktree>/.tmp/mission-control/pr-bodies-20260816/BODY_theme_cookie_787.md`.
  It discloses the P2 label-lag residual, the one-year cookie surviving a revert, and the missing
  `Vary: Cookie` forward-looking note.
- luna's three guard P2s, all falsified after fixing:
  - `ALLOWED_CAPS.some()` -> `.every()` (a `.some()` exemption widens itself).
  - drift guard: no-duplicates assertion + compare call sites to UNIQUE members.
  - sweep: zero-height now gates ONLY the count, not the offender check (a container collapsed by
    an ancestor has `clientHeight 0` with `scrollHeight > 0` -- maximally clipped, and the early
    `return` had hidden it).

## 5. IMMEDIATE NEXT STEPS, in order

1. Run Leg 1a round 11 on the triage delta. Rounds 1-10 each found something real; round 10's
   fixes are in the tree, tsc is clean, the two guard specs pass, and the scan still reproduces
   49 / 84 / 52.
2. If GREEN: commit triage (path-scoped, message staged), then run the luna **holistic** on the
   batch-2 stack -- the last un-run Leg 2 mode there.
3. Re-gate the triage tip SOLO (see trap 1 below). Its 2 e2e failures are PRE-EXISTING -- proven by
   control runs on wave0 (a branch with none of this work) and on the triage stack under webkit.
   **Do not record the triage tip as e2e-green; say 2 pre-existing failures.**
4. Rebase `feat/audit-p0-20260816` onto the new triage tip, then run the FULL pipeline on it
   (Leg 1a + 1b + Leg 2 x3) -- it has had none.
5. Push the remaining branches. theme-cookie is DONE. **No force-with-lease is needed** anywhere --
   all are fast-forwards, and wave0 is already in sync and needs no push.
6. Update PR bodies from `<scratchpad>/pr-bodies-20260816/` (5 files, all ASCII-checked) and open
   the P0 PR.
7. Owner-gated: merge approval per PR, on the exact reviewed SHA.

## 6. OPEN OWNER DECISIONS

1. **AGY is unusable here.** `tooling/agy/Invoke-AgyAutonomousWorker.ps1:125` HARD-CODES
   `ExpectedAgyVersion must be exactly '1.1.8'`; installed CLI is 1.1.13. The owner approved
   passing `-ExpectedAgyVersion 1.1.13`, but the controller rejects any other value by design, so
   the flag cannot fix it. Real options: edit that tracked controller (it has its own
   `npm run test:agy-tooling` suite), install AGY 1.1.8, or leave AGY out. NOT decided.
2. **Print-clipping backlog** -- `docs/PRINT_CLIPPING_BACKLOG_2026_08_16.md` records 49 un-reset
   vertical cap lines and 84 horizontal clip lines repo-wide, of which **9 vertical + 5 horizontal
   are verified high-severity and OPEN**, including `PolicySearchPanel` regulatory text and BN-RRM
   validation output. Needs triage, and an architecture call: repo-wide print rule vs
   per-container utilities. The latter decision could collapse ~14 items into one change.
3. **Four node processes from the PREVIOUS session** are bound to the triage worktree (PIDs 88864,
   94436, 69408, 5156; started 13:38; live `cmd` parents; no listening ports). The orphan sweep
   classifies them as neither orphaned nor suspicious, so they were NOT killed. They are a
   candidate cause of a `.next` quarantine collision on the triage build -- see trap 1.
4. **`#782` has no Leg 2 review this session** and inherited gate evidence.

## 7. TRAPS HIT THIS SESSION -- do not repeat

1. **Never run Playwright in a worktree while that worktree's monitored gate build runs.** The
   build QUARANTINES `.next`; a live dev server makes the move fail. It produced `BUILD_EXIT=1`
   plus **70 e2e failures** on the theme branch -- the exact signature of a real regression. The
   tell is `Cannot find module ...\.next\server\pages\_app.js`. Re-run solo it was 208 passed / 0
   failed.
2. **Never edit a shell script while it is executing.** bash reads incrementally; editing
   `gates.sh` mid-run garbled the unread tail (`line 78: unexpected EOF`) and lost that run's
   summary lines.
3. **Never write backslash escapes through a bash heredoc into Python.** Hit again this session
   (`'\\'` -> unterminated string literal). Use Write/Edit.
4. **codex/luna omits the `VERDICT:` line routinely.** No verdict = INCONCLUSIVE. Budget a short
   verdict-closure round; do not infer from a positive body.
5. **codex can hang on a NESTED codex MCP call** (`mcp: codex/codex started`, 8+ min). Add "do the
   review yourself, do not delegate" to every prompt. Kill by harness task id, never by image name.
6. **A vitest summary grep must strip ANSI** or it silently returns empty and degrades the unit
   gate to exit-code-only evidence.
7. **A JSX `{/* comment */}` inside `{cond && (` is a parse error**, and the source-text tests pass
   on a file that does not compile. Run `tsc` after every JSX comment insertion.

## 8. THE DURABLE LESSON FROM THIS SESSION

Nine consecutive Leg 1a rounds on one delta each found a real defect, and several were introduced
BY the previous round's repair. Two shapes dominated:

- **Guards weaker than they look.** A `.some()` exemption widens itself. An absence filter that
  also gates detection hides the worst case. See memory `dashboard-guards-weaker-than-they-look`.
- **Comments claiming more than the mechanism delivers.** A helper's docstring claimed "there is
  no silent-pass path left"; three constructed inputs falsified it. The version that passed states
  its INPUT DOMAIN instead. A guarantee quantifying over all inputs is a claim about a parser you
  did not write.

Budget for this: a fix to a guard is new code and needs its own falsification, not the confidence
of the fix it replaces.
