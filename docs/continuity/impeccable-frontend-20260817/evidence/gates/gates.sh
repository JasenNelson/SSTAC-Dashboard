#!/usr/bin/env bash
# Full SIX-gate suite per docs/GATE_MODE_SOP.md Phase 4.
# NEVER pipes a gate through tail -- in a pipeline $? is tail's exit status.
# Args: <worktree> <absolute-logdir> <pw-port> [e2e-only]
#
# Session-3 changes vs the session-2 runner:
#   1. G6 `npm run docs:gate` ADDED. The SOP names six gates; the session-2 runner ran five and
#      several tips were nevertheless reported "FULLY GREEN".
#   2. TREE_UNCHANGED now compares a CONTENT DIGEST, not a dirty-file COUNT. A count is not a
#      hash: a file can be rewritten during the run while the count is unchanged, so the old
#      check could report YES for a tree that had in fact moved.
#   3. Playwright PORT PREFLIGHT added before e2e. playwright.config.ts sets
#      reuseExistingServer:false, so any listener on the port fails the run before a single test
#      executes, and the error names the port rather than the cause.
WT="$1"
LOG="$2"
export PLAYWRIGHT_TEST_PORT="$3"
ONLY="$4"
mkdir -p "$LOG"
# Redirect FIRST. If cd fails after the redirect is set up, the failure is recorded in RESULT.txt;
# if it failed before, RESULT.txt would simply not exist, which a caller cannot distinguish from
# "the suite has not run yet" -- a missing file reads as pending, not as failed.
exec > "$LOG/RESULT.txt" 2>&1
if ! cd "$WT"; then
  echo "WORKTREE=$WT"
  echo "GATE_FAILED=SETUP exit=99 -- could not cd to the worktree; no gate ran"
  echo "GATES_HALTED_AT=SETUP"
  echo "SUITE_INCOMPLETE=YES"
  echo "=== GATES HALTED ==="
  exit 99
fi

# A digest of the FULL working-tree state: which paths are dirty AND what their content is,
# staged and unstaged. This is what makes "nothing changed during the run" checkable.
tree_digest() {
  {
    git status --porcelain
    git diff
    git diff --cached
    # UNTRACKED CONTENT. `git status --porcelain` lists an untracked file by NAME only, and
    # `git diff` does not see it at all, so an edit INSIDE an untracked file would leave the
    # digest unchanged. Untracked files are not inert here: a new test file or fixture is
    # untracked until staged and absolutely affects the unit gate. Hash their bytes as well.
    git ls-files --others --exclude-standard -z | sort -z | xargs -0 -r sha256sum 2>/dev/null
  } | sha256sum | cut -d' ' -f1
}

# SOP Phase 4: "Each gate must reach GREEN before the next gate starts." The session-2 runner
# recorded every exit code and carried on regardless, so a RED gate could sit in the middle of a
# report whose later lines all read green. halt_if_red stops the suite at the first failure and
# says which gate halted it, so a partial run can never be mistaken for a complete one.
GATES_HALTED_AT=""
halt_if_red() {
  local gate="$1" code="$2"
  if [ "$code" != "0" ]; then
    GATES_HALTED_AT="$gate"
    echo "GATE_FAILED=$gate exit=$code"
    echo "GATES_HALTED_AT=$gate"
    echo "SUITE_INCOMPLETE=YES -- gates after $gate did NOT run; this is NOT a green suite"
    END=$(git rev-parse HEAD)
    echo "END_HEAD=$END"
    echo "END_TREE_DIGEST=$(tree_digest)"
    echo "=== GATES HALTED ==="
    exit 1
  fi
}

FROZEN=$(git rev-parse HEAD)
DIRTY=$(git status --porcelain | wc -l)
FROZEN_DIGEST=$(tree_digest)
echo "WORKTREE=$WT"
echo "FROZEN_HEAD=$FROZEN"
echo "DIRTY_FILES_AT_START=$DIRTY"
echo "FROZEN_TREE_DIGEST=$FROZEN_DIGEST"
echo "PLAYWRIGHT_TEST_PORT=$3"
echo "MODE=${ONLY:-full}"

if [ "$ONLY" != "e2e-only" ]; then
  echo "=== G1 LINT ==="
  npm run lint > "$LOG/lint.log" 2>&1; LINT_EXIT=$?; echo "LINT_EXIT=$LINT_EXIT"
  echo "LINT_ERRORS=$(grep -oE '[0-9]+ errors?' "$LOG/lint.log" | tail -1)"
  halt_if_red G1_LINT "$LINT_EXIT"

  echo "=== G2 TSC ==="
  npx tsc --noEmit > "$LOG/tsc.log" 2>&1; TSC_EXIT=$?; echo "TSC_EXIT=$TSC_EXIT"
  echo "TSC_LOG_BYTES=$(wc -c < "$LOG/tsc.log")"
  halt_if_red G2_TSC "$TSC_EXIT"

  echo "=== G3 UNIT ==="
  npm run test:ci > "$LOG/unit.log" 2>&1; UNIT_EXIT=$?; echo "UNIT_EXIT=$UNIT_EXIT"
  # Vitest colourises the summary, so ANSI escapes sit BETWEEN "Tests" and the count and a
  # naive grep returns empty -- which silently degrades this gate back to exit-code-only
  # evidence, the exact defect class the build corroboration below exists to prevent.
  echo "UNIT_SUMMARY=$(sed 's/\x1b\[[0-9;]*m//g' "$LOG/unit.log" | grep -aE '^\s*Tests ' | tail -1)"
  echo "UNIT_FILES=$(sed 's/\x1b\[[0-9;]*m//g' "$LOG/unit.log" | grep -aE '^\s*Test Files ' | tail -1)"
  halt_if_red G3_UNIT "$UNIT_EXIT"

  echo "=== G4 BUILD ==="
  npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10 > "$LOG/build.log" 2>&1
  BUILD_EXIT=$?
  echo "BUILD_EXIT=$BUILD_EXIT"
  # CORROBORATE THE BUILD WITH A COUNT, not just an exit code. The wrapper's own stdout carries
  # only monitor ticks; the compiler output lands in a separate STDOUT_LOG the wrapper prints.
  BUILD_STDOUT=$(grep -oE 'STDOUT_LOG=.*' "$LOG/build.log" | head -1 | sed 's/^STDOUT_LOG=//' | tr -d '\r')
  if [ -n "$BUILD_STDOUT" ] && [ -f "$BUILD_STDOUT" ]; then
    cp "$BUILD_STDOUT" "$LOG/build-stdout.log" 2>/dev/null
    ROUTES=$(grep -c 'Route (app)' "$LOG/build-stdout.log")
    STATIC=$(grep -c 'Generating static pages' "$LOG/build-stdout.log")
    FIRSTLOAD=$(grep -c 'First Load JS' "$LOG/build-stdout.log")
    echo "BUILD_MARKERS route_table=$ROUTES static_pages=$STATIC first_load_js=$FIRSTLOAD"
    if [ "$ROUTES" -lt 1 ] || [ "$FIRSTLOAD" -lt 1 ]; then
      # Do NOT hard-code "exit 0" here. An earlier version did, and printed "exit 0 but no route
      # table" on a run whose exit code was 1 -- a gate report stating something false about the
      # gate it was reporting on.
      echo "BUILD_CORROBORATION=FAILED -- build exited $BUILD_EXIT and emitted no route table; do NOT quote this build as evidence"
      CORROB=1
    else
      echo "BUILD_CORROBORATION=OK"
      CORROB=0
    fi
  else
    echo "BUILD_CORROBORATION=UNAVAILABLE -- could not resolve STDOUT_LOG from the wrapper output"
    CORROB=1
  fi
  halt_if_red G4_BUILD "$BUILD_EXIT"
  # Recording a failed corroboration and then continuing is how "exit 0" gets quoted as a green
  # build. If the build cannot be corroborated it is not evidence, so stop here too.
  halt_if_red G4_BUILD_CORROBORATION "$CORROB"
fi

echo "=== G5 E2E PORT PREFLIGHT ==="
# reuseExistingServer:false means ANY listener on this port fails the suite before a test runs.
if [ -f "scripts/verify/gate-preflight.ps1" ]; then
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify/gate-preflight.ps1 \
    -Port "$PLAYWRIGHT_TEST_PORT" -Kill > "$LOG/preflight.log" 2>&1
  PREFLIGHT_EXIT=$?
  echo "PREFLIGHT_EXIT=$PREFLIGHT_EXIT"
  # The preflight exits non-zero when the port is BLOCKED. Running e2e anyway burns a full suite
  # and returns a port error that reads as an environment fault rather than as our own leftover
  # state, so halt here instead.
  halt_if_red G5_E2E_PREFLIGHT "$PREFLIGHT_EXIT"
else
  # The SOP names this script by path. If it is missing, the port was never checked, and an
  # unchecked port is how a whole e2e suite fails for a reason that reads as an environment
  # fault. Absence is a stop condition, not a note.
  echo "PREFLIGHT_EXIT=SKIPPED_SCRIPT_ABSENT"
  halt_if_red G5_E2E_PREFLIGHT_MISSING 1
fi

echo "=== G5 E2E ==="
E2E_AUTH_ENABLED=true npm run test:e2e -- --workers=2 > "$LOG/e2e.log" 2>&1; E2E_EXIT=$?; echo "E2E_EXIT=$E2E_EXIT"
# chromium-auth must APPEAR, or the authenticated project ran zero tests and still reported green.
# E2E_AUTH_ENABLED alone is not enough: a run missing the flag reports "N passed" having never
# executed the authenticated project at all. Recording a zero here and continuing reproduces that
# exact false green, so a zero HALTS.
AUTH_REFS=$(grep -c 'chromium-auth' "$LOG/e2e.log")
echo "E2E_CHROMIUM_AUTH_REFS=$AUTH_REFS"
echo "E2E_SUMMARY=$(grep -aoE '[0-9]+ passed \([0-9smh.]+\)' "$LOG/e2e.log" | tail -1)"
echo "E2E_FAILED_LINE=$(grep -aoE '[0-9]+ failed' "$LOG/e2e.log" | tail -1)"
# Halt AFTER recording all e2e evidence, so a halted run still carries what is needed to diagnose
# it. Order matters here: halting first would discard the summary on exactly the runs that need it.
halt_if_red G5_E2E "$E2E_EXIT"
halt_if_red G5_E2E_AUTH_PROJECT_ABSENT "$([ "$AUTH_REFS" -gt 0 ] && echo 0 || echo 1)"

echo "=== G6 DOCS GATE ==="
npm run docs:gate > "$LOG/docsgate.log" 2>&1; DOCS_GATE_EXIT=$?; echo "DOCS_GATE_EXIT=$DOCS_GATE_EXIT"
# Record the STATUS line itself, not just the exit code, so the evidence is readable.
echo "DOCS_GATE_STATUS=$(sed 's/\x1b\[[0-9;]*m//g' "$LOG/docsgate.log" | grep -aE 'STATUS:' | tail -1)"
halt_if_red G6_DOCS_GATE "$DOCS_GATE_EXIT"

# Only a FULL run has executed all six. In e2e-only mode G1-G4 were skipped, and printing YES
# there would be a false green of exactly the kind this runner exists to prevent: the marker a
# reader greps for to confirm completeness would confirm it for a run that skipped four gates.
if [ "$ONLY" != "e2e-only" ]; then
  echo "ALL_SIX_GATES_RAN=YES"
else
  echo "ALL_SIX_GATES_RAN=NO -- e2e-only mode: G1 lint, G2 tsc, G3 unit and G4 build did NOT run"
  echo "SUITE_INCOMPLETE=YES -- e2e-only is a focused re-run, NEVER push-gate evidence"
fi
END=$(git rev-parse HEAD)
ENDDIRTY=$(git status --porcelain | wc -l)
END_DIGEST=$(tree_digest)
echo "END_HEAD=$END"
echo "DIRTY_FILES_AT_END=$ENDDIRTY"
echo "END_TREE_DIGEST=$END_DIGEST"
# Compare the DIGEST, not the count. A gate result is only valid if nothing changed during it.
if [ "$FROZEN" = "$END" ] && [ "$FROZEN_DIGEST" = "$END_DIGEST" ]; then
  echo "TREE_UNCHANGED=YES"
  echo "=== GATES COMPLETE ==="
else
  # Recording NO and exiting 0 would leave a caller free to quote the gate results anyway. If the
  # tree moved during the run, every result above describes a tree that no longer exists, so this
  # exits non-zero like any other failed gate. This was the fourth field in this file that was
  # recorded and not enforced.
  echo "TREE_UNCHANGED=NO"
  echo "GATE_FAILED=TREE_MOVED_DURING_RUN exit=1"
  echo "SUITE_INCOMPLETE=YES -- the tree changed mid-run; these results describe a tree that no"
  echo "                       longer exists and MUST NOT be quoted as gate evidence"
  echo "=== GATES HALTED ==="
  exit 1
fi
