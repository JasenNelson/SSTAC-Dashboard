#!/usr/bin/env node
/**
 * scripts/diag-wt.mjs -- Windows Terminal (wt.exe) availability diagnostic.
 *
 * Owner-bug 3 (2026-05-16): clicking the per-row "[ ] external" button
 * jiggles the browser chrome but no Windows Terminal window appears. The
 * 2026-05-16 fix at 1ef70f2 added detached:true + windowsHide:false +
 * stdio:'ignore' for the wt.exe spawn, but the owner reports the bug
 * persists. The handoff lists three likely causes; the highest-probability
 * one is "wt.exe is not on the Node-inherited PATH". This probe verifies
 * that without re-spawning the full launch pipeline.
 *
 * How to run (no need to stop `npm run dev`):
 *   node scripts/diag-wt.mjs
 *
 * What it does:
 *   Preamble: prints process.env.PATH so we can see what Node inherits.
 *   Probe 1:  spawnSync('where', ['wt'])               -- shell-resolvable lookup.
 *   Probe 2:  spawnSync('wt.exe', ['--help'])          -- direct invocation.
 *   Probe 3:  spawnSync('cmd.exe', ['/c', 'where wt']) -- cmd-shell view of PATH.
 *
 * Each probe reports exit status + stdout + stderr. A PASS/FAIL summary
 * runs at the end so the operator does not have to read three blocks of
 * output to draw a conclusion. (The PATH preamble is informational and
 * is not pass/fail-scored; only the three probes are.)
 *
 * Owner runs this from a NEW PowerShell tab (so it inherits PATH the same
 * way `npm run dev` does -- both come from the user's interactive shell);
 * the output drives the BUG-3 fix path in a later session.
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

header('Probe 1: spawnSync("where", ["wt"])');
const probeWhere = spawnSync('where', ['wt'], { encoding: 'utf8' });
const passWhere = reportResult('where wt', probeWhere);

header('Probe 2: spawnSync("wt.exe", ["--help"])');
// wt.exe --help opens a help pop-up + writes nothing to stdout in some
// builds; we only care that the binary is reachable. Treat any non-error
// status as a soft PASS, since wt.exe sometimes exits 0 with no output.
const probeWt = spawnSync('wt.exe', ['--help'], { encoding: 'utf8' });
const passWt = reportResult('wt.exe --help', probeWt);

header('Probe 3: spawnSync("cmd.exe", ["/c", "where wt"])');
// cmd.exe shells through to its OWN PATH resolution; useful for spotting
// the case where the interactive shell has wt.exe on PATH but Node does
// not. If this PASSes while Probe 1 FAILs, the fix is in spawn options
// (e.g., shell out via cmd.exe /c start wt.exe ...).
const probeCmd = spawnSync('cmd.exe', ['/c', 'where wt'], { encoding: 'utf8' });
const passCmd = reportResult('cmd /c where wt', probeCmd);

header('SUMMARY');
const verdict = [
  ['Probe 1 (where wt)         ', passWhere],
  ['Probe 2 (wt.exe --help)    ', passWt],
  ['Probe 3 (cmd /c where wt)  ', passCmd],
];
for (const [label, ok] of verdict) {
  console.log(`${label}: ${ok ? 'PASS' : 'FAIL'}`);
}

console.log('\nInterpretation hints:');
console.log('- All PASS  : wt.exe is reachable from Node + cmd; BUG-3 is NOT a PATH issue.');
console.log('              Investigate spawnOverrides (handoff cause #2 / #3) or PTY race.');
console.log('- Probe 1 FAIL + Probe 3 PASS : wt.exe is on cmd PATH but not Node PATH.');
console.log('              Fix: spawn via cmd.exe /c start wt.exe ..., or use an absolute path.');
console.log('- All FAIL  : wt.exe is not installed (or PATH is empty).');
console.log('              Fix: install Windows Terminal from Microsoft Store, or use absolute path.');
console.log('- Mixed otherwise : capture the output verbatim and ship to next session.\n');

// Exit 0 so an automated runner does not treat this probe as a failure
// just because the binary was not found -- the human reads the summary.
process.exit(0);
