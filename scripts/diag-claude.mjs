#!/usr/bin/env node
/**
 * scripts/diag-claude.mjs -- Claude CLI availability diagnostic.
 *
 * Owner-bug 2026-05-16: clicking a Pattern A skill button (e.g. /safe-exit)
 * in the Agentic OS admin page returns HTTP 500 with `spawn_failed`. Per
 * route.ts:233-238, 500 spawn_failed is only emitted when the spawn 'error'
 * event fires before 'spawn' -- typically ENOENT (executable not found on
 * the Node-inherited PATH) or EACCES.
 *
 * This probe is the sister of diag-wt.mjs (BUG-3). It verifies whether
 * the `claude` CLI is reachable from the same env Node would see in your
 * dev server, WITHOUT re-spawning the full launch pipeline.
 *
 * How to run (no need to stop `npm run dev`):
 *   node scripts/diag-claude.mjs
 *
 * What it does:
 *   Preamble: prints process.env.PATH so we can see what Node inherits.
 *   Probe 1:  spawnSync('where', ['claude'])              -- shell-resolvable lookup.
 *   Probe 2:  spawnSync('claude', ['--version'])          -- direct invocation.
 *   Probe 3:  spawnSync('cmd.exe', ['/c', 'where claude']) -- cmd-shell view of PATH.
 *
 * Each probe reports exit status + stdout + stderr. A PASS/FAIL summary
 * runs at the end so the operator does not have to read three blocks of
 * output to draw a conclusion. (The PATH preamble is informational and
 * is not pass/fail-scored; only the three probes are.)
 *
 * Owner runs this from a NEW PowerShell tab (so it inherits PATH the same
 * way `npm run dev` does -- both come from the user's interactive shell);
 * the output drives the /safe-exit 500 fix path.
 *
 * Interpretation hints at the bottom mirror diag-wt.mjs's structure. If
 * all PASS, the 500 has a different cause than PATH (check the route's
 * response body via DevTools Network -> response). If Probe 2 FAILs but
 * Probes 1 + 3 PASS, claude is on the cmd-shell PATH but not the Node-
 * inherited PATH -- same shape as BUG-3 cause #1, fix with a cmd.exe
 * shim or absolute path. If all FAIL, claude CLI is not installed.
 */

import { spawnSync } from 'node:child_process';

const sep = '-'.repeat(72);

function header(title) {
  console.log(`\n${sep}\n${title}\n${sep}`);
}

function reportResult(label, result) {
  const { status, signal, error, stdout, stderr } = result;
  console.log(`status: ${status}`);
  if (signal) console.log(`signal: ${signal}`);
  if (error) console.log(`error : ${error.code ?? ''} ${error.message}`);
  const so = (stdout ?? '').toString().trim();
  const se = (stderr ?? '').toString().trim();
  if (so) console.log(`stdout:\n${so}`);
  if (se) console.log(`stderr:\n${se}`);
  console.log(`-> ${label}: ${status === 0 ? 'PASS' : 'FAIL'}`);
  return status === 0;
}

header('process.env.PATH (what Node inherits)');
console.log(process.env.PATH ?? '(PATH is empty)');

header('Probe 1: spawnSync("where", ["claude"])');
const probeWhere = spawnSync('where', ['claude'], { encoding: 'utf8' });
const passWhere = reportResult('where claude', probeWhere);

header('Probe 2: spawnSync("claude", ["--version"])');
// claude --version writes the version string to stdout and exits 0 in
// healthy installs. We treat exit 0 as PASS. Any error code (e.g. claude
// is a directory, claude.cmd shim is broken, claude is on PATH but
// missing its node runtime) gets surfaced via the status/stderr block.
const probeClaude = spawnSync('claude', ['--version'], { encoding: 'utf8' });
const passClaude = reportResult('claude --version', probeClaude);

header('Probe 3: spawnSync("cmd.exe", ["/c", "where claude"])');
// cmd.exe shells through to its OWN PATH resolution; useful for spotting
// the case where the interactive shell has claude on PATH but Node does
// not. If this PASSes while Probe 1 FAILs, the fix is in spawn options
// (e.g., shell out via cmd.exe /c claude ..., or use an absolute path
// resolved via where-then-spawn).
const probeCmd = spawnSync('cmd.exe', ['/c', 'where claude'], { encoding: 'utf8' });
const passCmd = reportResult('cmd /c where claude', probeCmd);

header('SUMMARY');
const verdict = [
  ['Probe 1 (where claude)         ', passWhere],
  ['Probe 2 (claude --version)     ', passClaude],
  ['Probe 3 (cmd /c where claude)  ', passCmd],
];
for (const [label, ok] of verdict) {
  console.log(`${label}: ${ok ? 'PASS' : 'FAIL'}`);
}

console.log('\nInterpretation hints:');
console.log('- All PASS  : claude is reachable from Node + cmd; the /safe-exit 500');
console.log('              has a different cause (check the 500 response body via');
console.log('              DevTools Network -> /api/agentic-os/launch -> Response).');
console.log('- Probe 1 PASS + Probe 2 FAIL : Node-spawned `where` finds claude on');
console.log('              the Node-inherited PATH, but a direct spawn of `claude`');
console.log('              fails. The resolved target is reachable but not directly');
console.log('              invokable by child_process.spawn -- typically a `.cmd`');
console.log('              shim that Node-on-Windows cannot launch without');
console.log('              `shell:true` or a cmd.exe wrapper. Fix: route the launch');
console.log('              through `cmd.exe /c claude ...` (same shape as BUG-3 fix),');
console.log('              OR resolve the absolute path of the underlying .exe and');
console.log('              spawn that directly.');
console.log('- Probe 1 FAIL + Probe 3 PASS : claude is on the cmd shell PATH (via a');
console.log('              path entry that cmd resolves but Node does not -- e.g. an');
console.log('              AppExecutionAlias or reparse point). Fix: spawn via');
console.log('              cmd.exe /c claude ..., or use an absolute path resolved');
console.log('              via Probe 3\'s output.');
console.log('- All FAIL  : claude CLI is not installed (or PATH is empty).');
console.log('              Fix: install Claude Code CLI and restart the dev');
console.log('              server so npm run dev inherits the updated PATH.');
console.log('- Mixed otherwise : capture the output verbatim and ship to next session.\n');

// Exit 0 so an automated runner does not treat this probe as a failure
// just because the binary was not found -- the human reads the summary.
process.exit(0);
