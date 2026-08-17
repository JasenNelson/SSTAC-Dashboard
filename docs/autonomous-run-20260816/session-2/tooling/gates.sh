#!/usr/bin/env bash
# Full gate suite. NEVER pipes a gate through tail -- in a pipeline $? is tail's exit status.
# Args: <worktree> <absolute-logdir> <pw-port> [e2e-only]
WT="$1"
LOG="$2"
export PLAYWRIGHT_TEST_PORT="$3"
ONLY="$4"
mkdir -p "$LOG"
cd "$WT" || exit 99
exec > "$LOG/RESULT.txt" 2>&1

FROZEN=$(git rev-parse HEAD)
DIRTY=$(git status --porcelain | wc -l)
echo "WORKTREE=$WT"
echo "FROZEN_HEAD=$FROZEN"
echo "DIRTY_FILES_AT_START=$DIRTY"
echo "PLAYWRIGHT_TEST_PORT=$3"
echo "MODE=${ONLY:-full}"

if [ "$ONLY" != "e2e-only" ]; then
  echo "=== LINT ==="
  npm run lint > "$LOG/lint.log" 2>&1; echo "LINT_EXIT=$?"
  echo "LINT_ERRORS=$(grep -oE '[0-9]+ errors?' "$LOG/lint.log" | tail -1)"
  echo "=== TSC ==="
  npx tsc --noEmit > "$LOG/tsc.log" 2>&1; echo "TSC_EXIT=$?"
  echo "TSC_LOG_BYTES=$(wc -c < "$LOG/tsc.log")"
  echo "=== UNIT ==="
  npm run test:ci > "$LOG/unit.log" 2>&1; echo "UNIT_EXIT=$?"
  # Vitest colourises the summary, so ANSI escapes sit BETWEEN "Tests" and the count and a
  # naive grep returns empty -- which silently degrades this gate back to exit-code-only
  # evidence, the exact defect class the build corroboration above exists to prevent.
  echo "UNIT_SUMMARY=$(sed 's/\x1b\[[0-9;]*m//g' "$LOG/unit.log" | grep -aE '^\s*Tests ' | tail -1)"
  echo "UNIT_FILES=$(sed 's/\x1b\[[0-9;]*m//g' "$LOG/unit.log" | grep -aE '^\s*Test Files ' | tail -1)"

  echo "=== BUILD ==="
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
    else
      echo "BUILD_CORROBORATION=OK"
    fi
  else
    echo "BUILD_CORROBORATION=UNAVAILABLE -- could not resolve STDOUT_LOG from the wrapper output"
  fi
fi

echo "=== E2E ==="
E2E_AUTH_ENABLED=true npm run test:e2e -- --workers=2 > "$LOG/e2e.log" 2>&1; echo "E2E_EXIT=$?"
# chromium-auth must APPEAR, or the authenticated project ran zero tests and still reported green.
echo "E2E_CHROMIUM_AUTH_REFS=$(grep -c 'chromium-auth' "$LOG/e2e.log")"
echo "E2E_SUMMARY=$(grep -aoE '[0-9]+ passed \([0-9smh.]+\)' "$LOG/e2e.log" | tail -1)"
echo "E2E_FAILED_LINE=$(grep -aoE '[0-9]+ failed' "$LOG/e2e.log" | tail -1)"

END=$(git rev-parse HEAD)
ENDDIRTY=$(git status --porcelain | wc -l)
echo "END_HEAD=$END"
echo "DIRTY_FILES_AT_END=$ENDDIRTY"
echo "TREE_UNCHANGED=$([ "$FROZEN" = "$END" ] && [ "$DIRTY" = "$ENDDIRTY" ] && echo YES || echo NO)"
echo "=== GATES COMPLETE ==="
