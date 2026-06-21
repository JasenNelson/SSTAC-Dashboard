# AGY CODEX-REVIEW SKILL BUILD PACKET (2026-06-06)

Plain ASCII. For AGY: everything needed to build the codex-review workflow as your own
skill. The normative spec is AGY_ORCHESTRATION_HANDOFF_2026_06_06.md section 3 (+ rule
pack section 2, subagent plan section 9). This packet adds the materials the spec cannot
carry: real worked examples, a helper-script skeleton, pitfalls, and an acceptance test.

## 1. REAL WORKED EXAMPLES (study these on disk -- written by the prior reviewer loop)

In C:\projects\sstac-dashboard\ (repo root, gitignored .tmp_* scratch):
- .tmp_codex_plan_review_prompt.txt   -- a HOLISTIC review prompt: note the shape
  (artifact by absolute path, context block, numbered probe checklist, KNOWN/ACCEPTED
  list, the mandatory final VERDICT line instruction).
- .tmp_codex_plan_review_prompt2.txt  -- an ARGUMENT-ROUND prompt: quotes the prior
  finding verbatim, lays out counter-evidence, asks DEFEND/REVISE/WITHDRAW. Result:
  codex WITHDREW. This is the mutual-agreement pattern.
- .tmp_codex_plan_review_prompt4/5.txt -- fix-verification rounds: each states exactly
  which findings were accepted, how each was fixed, and asks codex to verify + rescan.
- .tmp_codex_plan_review_findings*.txt -- raw outputs: observe that codex streams its
  whole tool session; the verdict lives in the FINAL "codex" message block, often
  duplicated; earlier content is tool noise. Parse accordingly.

Outcome stats for calibration (24h of this loop on this repo): 5 PRs, 16 real findings
(stale-store paints, SSR hydration mismatch, 0/0-frequency misreport, null-substance
aggregation, two silently-reverted fixes, a missing-schema dependency...), 3 findings
successfully DISPUTED with measured evidence and withdrawn by codex. Both directions of
the protocol matter.

## 2. HELPER SCRIPT SKELETON (materialize as scripts/agy/codex-review.ps1 or your format)

  param(
    [Parameter(Mandatory)][string]$PromptFile,   # self-contained prompt, ends w/ VERDICT instruction
    [ValidateSet('spark','xhigh')][string]$Tier = 'spark',
    [string]$OutFile = ".tmp_codex_findings_$([guid]::NewGuid().ToString('N').Substring(0,8)).txt",
    [int]$TimeoutMin = 10
  )
  $cfg = if ($Tier -eq 'spark') { '-c', 'model="gpt-5.3-codex-spark"' }
         else                   { '-c', 'model_reasoning_effort=xhigh' }
  $p = Start-Process -FilePath 'codex' -ArgumentList (@('review') + $cfg + @('-')) `
        -RedirectStandardInput $PromptFile -RedirectStandardOutput $OutFile `
        -RedirectStandardError "$OutFile.err" -NoNewWindow -PassThru
  if (-not $p.WaitForExit($TimeoutMin * 60 * 1000)) { $p.Kill($true); 'TIMEOUT'; exit 3 }
  $txt = Get-Content $OutFile -Raw
  if ($txt -match 'usage limit')                          { 'QUOTA';        exit 4 }
  if ($txt -match 'Transport channel closed|Reconnecting'){ 'BACKEND-DOWN'; exit 5 }
  # verdict = look in the tail region only AFTER confirming no earlier finding blocks remain unread
  if     ($txt -match 'VERDICT:\s*GREEN') { 'GREEN'; exit 0 }
  elseif ($txt -match 'VERDICT:\s*RED')   { 'RED';   exit 1 }
  else                                    { 'INCONCLUSIVE'; exit 2 }

  Notes: keep the raw OutFile for the human/orchestrator; the skill must surface the FULL
  findings text on RED, never just the verdict. Run ONE review at a time (R10). The Spark
  model sometimes omits the literal VERDICT line and instead writes an unambiguous "no
  actionable defects" sentence -- treat that as GREEN only if the closing statement is
  categorical; otherwise INCONCLUSIVE -> re-prompt asking for the one-line verdict.

## 3. PITFALLS (each one cost the prior loop real time -- encode them)

P1  Stateless rounds: codex remembers NOTHING between invocations. Every round's prompt
    re-states the diff scope, history, accepted items, and disputes.
P2  Output > 30KB and full of tool-call noise + occasional UTF-8 mojibake: always file-
    capture; never rely on stdout; read the final codex block, but skim the findings list
    above it (a buried finding can sit above the tail).
P3  Missing VERDICT line (esp. Spark): re-prompt for a one-line verdict rather than
    guessing from tone.
P4  Findings can be WRONG: 3 of 16 were disproven (e.g. a float64 "underflow" that cannot
    occur for representable inputs -- disproven by measurement; a "missing migration" that
    lived in a sibling PR -- disproven by quoting it). Dispute with numbers and file:line,
    not assertions. But default posture is: fix + regression-test.
P5  Fix-then-rereview, never argue what you can cheaply fix. Each accepted finding gets a
    regression test in the SAME round-trip.
P6  Error signatures: 'usage limit' = quota window exhausted (stop, notify owner; resets on
    a multi-hour cycle). 'Transport channel closed' / 'Reconnecting N/5' = backend down
    (stop, notify). Do not retry-loop either.
P7  One codex consumer at a time on this machine; other Claude sessions also run codex --
    a concurrent run elsewhere is normal, but never kill codex/node processes by name.
P8  Review prompts reference files by ABSOLUTE PATH; codex has tool-use and reads the repo
    itself -- do not paste file contents into prompts.
P9  Scratch naming: .tmp_codex_*; never staged (path-scoped git add only, R4).

## 4. ACCEPTANCE TEST (prove the skill before any real brief)

1. In a scratch worktree, make a deliberate 2-defect diff: (a) a function that strips
   significant trailing zeros from integers when formatting (e.g. '100000' -> '1');
   (b) a comment claiming a constant is verified when it is not.
2. Run tier=spark with a proper prompt. EXPECT: RED with at least the formatting defect.
3. Fix it + add a regression test; run a verification round stating the fix. EXPECT: GREEN
   or a residual finding on (b).
4. Run tier=xhigh as the ship gate. EXPECT: explicit VERDICT line captured by the script.
5. Demonstrate one ARGUMENT round: dispute a deliberately-correct line codex flagged (or,
   if codex flags nothing extra, simulate by asking it to re-justify a finding) using the
   DEFEND/REVISE/WITHDRAW format from example prompt2.
6. Show the orchestrator: the round table (tier, round, findings, disposition, verdict),
   the raw findings files, and the script exit codes. PASS = all 6 steps evidenced.

## 5. WHAT STAYS WITH THE ORCHESTRATOR (do not bake into the skill)

Judgment on argue-vs-accept in ambiguous cases; scope rulings; standing-rule conflicts;
anything touching R3 (qa_status/verdicts/catalogs) or R8 (protected paths) -- those halt
and escalate. The skill is the mechanics; the orchestrator is the judgment.
