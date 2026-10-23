# Fresh session handoff -- 2026-10-22 -- Jermilova anonymous public viewer

Lane: BN-RRM Jermilova faithful anonymous viewer, served at `/Jermilova` on the SSTAC
deployment (`/Jermilova/` redirects there once). Other lanes keep their own latest handoffs (`FRESH_SESSION_HANDOFF_2026_10_15_*`).

## State

- Worktree `C:\Projects\SSTAC-Dashboard-worktrees\bn-rrm-jermilova-faithful-20261021`.
- Branch `feat/bn-rrm-jermilova-faithful-20261021`.
- Base: `origin/main` `d9c1bb31`.
- Earlier branch commits:
  - `05191386` faithful viewer (reuses the original components);
  - `b75e0b61` opt-in original dev server for parity;
  - `b1f564be` viewer CI job kept advisory;
  - `3c52f46c` deterministic fork patches;
  - `44e48f4f` no Playwright input-copying snapshot.
- Written before the production-delivery commit, and committed in it, on top of `44e48f4f`.
  It does not record that commit's SHA or the PR.
- The PR, its exact head SHA, review verdicts and the gate block are created after this commit
  and recorded in the PR body. Check `git log` and the PR before relying on them.
- Merging needs the owner's approval of that exact head.

## What the production-delivery commit does

1. **Parity spec corrections** (`viewers/jermilova-public/e2e/parity.spec.ts`). Product
   behavior is unchanged.
   - The node-count check is scoped to the shell sub-header status. Before, a page-wide
     `getByText('14 nodes')` also matched the ResultsPanel model badge, which failed P6 attempt 2.
   - Map readiness waits for the container to be attached: at 390 px the map is 0 px wide
     (measured on the clone). Desktop visibility is asserted.
   - Canvas reads wait until three consecutive samples agree.
   - The expanded rendered-edge count is 14, not 15. The original MeHg Ingested node has no
     source handle; the authenticated compare showed the original draws the same 14.
   - Pre-navigation spies, with installation flags, count every storage, IndexedDB and
     cookie write.
2. **Production mount (repository-contained; no Vercel or provider change).**
   - The viewer is built with `basePath: '/Jermilova'` and a fixed build id.
   - `verifiedFetch`:
     - canonicalises same-origin pack requests;
     - recognises URL and Request inputs by shape (so it works across realms);
     - normalises the method the way fetch does;
     - refuses any other same-origin path with a `bn-rrm` segment (encoded, different case,
       double slash, repeated base, the authenticated `/bn-rrm` route itself, undecodable);
     - fetches only `/Jermilova/bn-rrm/...`, after its manifest checks.
   - The viewer stylesheet excludes docs, tests, scripts and generated manifests from
     Tailwind's package scan.
   - The export audit only allows `.js`, `.css`, `.png` and font files under `_next/`.
   - The viewer's own `npm run build` (run through the repository's monitored build caller)
     builds and audits the export, and records a receipt that binds the viewer-source
     fingerprint (69 inputs, including the whole `scripts/` folder) to the exact export.
   - `scripts/publish-root-mirror.mjs` is a short filesystem publisher and verifier (no build,
     no process handling). `--write` requires the receipt to match the current inputs and the
     exact `out/` bytes, then publishes the mirror (`public/Jermilova/`) and
     `published-mirror.json` as one transaction, verified after staging and after promotion,
     with rollback. `--check` checks the committed mirror; `--check-export` runs the export
     audit and compares a fresh `out/` with the manifest.
   - `published-mirror.json` records:
     - every file's bytes and SHA-256;
     - the inline-script CSP hashes;
     - the fingerprint.
   - The root `next.config.ts` adds one rewrite (`/Jermilova` -> `/Jermilova/index.html`) and
     route headers from `src/lib/jermilova-public/route-config.ts`:
     - a CSP whose `script-src` allows the page's inline scripts by hash only;
     - `X-Frame-Options: DENY`, `nosniff`, a referrer policy and a permissions policy;
     - HSTS, the same value the middleware sets in production on matched routes (the guard
       test reads it from
       `src/middleware.ts`);
     - `X-Robots-Tag: noindex, nofollow` (conservative default);
     - `Cache-Control: no-store` on pack files, and `no-cache` on the page (`/Jermilova` and
       `/Jermilova/index.html`), so a fresh load never mixes old code with new pack files.
   - The middleware is untouched and never matches the mount.
3. **Guards.**
   - Required Unit Tests: `src/lib/jermilova-public/__tests__/publishedMirror.test.ts`, 13
     tests:
     - mirror bytes against the manifest, and the manifest's own consistency;
     - the viewer-source fingerprint;
     - the file-type allowlist;
     - pack files against `asset-manifest.json`;
     - the page's script references;
     - the CSP hashes against the committed page;
     - forbidden markers;
     - the route config, including `noindex` and the HSTS value, which must equal the one
       `src/middleware.ts` sets (found with the TypeScript parser; the extractor has its own
       test);
     - the middleware, with Next's own matcher (two-sided).
   - Required E2E: `e2e/jermilova-public.spec.ts` runs anonymously in chromium, firefox and
     webkit (the wrapper's `flags-off` leg). It checks:
     - one redirect, no login, and the headers;
     - the six tabs, each tab's content, and the 14-node model;
     - no Review or Case Studies;
     - no writes (spies), no cookies, no non-GET requests, and no unexpected paths.
   - Viewer job (`Jermilova Viewer Gates`), now aggregated into CI Status Check: closure
     pin, fork patches, viewer tsc and tests, a fresh export build and audit, and `--check` on
     the committed mirror. It makes no byte comparison: chunk names depend on the
     `node_modules` layout.
4. **Docs.** `viewers/jermilova-public/README.md` covers:
   - the mount and the shared-origin rationale;
   - the full anonymous publication scope;
   - the guards and their limits;
   - the republish and emergency unpublish procedures;
   - the fidelity facts.

## Evidence (local; under the gitignored `.tmp\bnrrm-public-viewer\faithful-r1\`)

- **Owner visual comparison** of the R3 local preview (preview-only R3, 2026-10-22), in the
  owner's words: "this looks much better now, like an actual clone, not like the previous
  version." This is favorable visual-fidelity evidence from the owner. It is separate from the
  automated proof below and from production proof.

### First final export (`p39-final-publish-20261022T185249Z`; superseded by p92)

- The self-building `--write` ran (async, with a process-tree kill on timeout and per-step
  logs under `.tmp\jermilova-publish-logs\`); `--check` and `--check-export` (with audit) were
  ok.
- Audit T1, T2 and T3 PASS (`audit.json`; T3 scans 46 text files; the export has 61 files;
  since p54 the mirror leaves out the two Next 404 pages and has 59).
- Fingerprint `e4a19cb4...` over 59 inputs. Superseded by p92 below (`54bd5a38...` over 69
  inputs).
- Compared with the p30 export, only the page chunk, `index.html` and `index.txt` changed: the
  `verifiedFetch` pass-through now forwards exactly the checked URL.
- **Layout independence was tried and rejected.** Next names chunks by hashing module paths,
  which differ between this worktree's `node_modules` junction and a real `node_modules` (CI).
  - `resolve.symlinks = false` alone did not cover Next's compiled React.
  - Also remapping Next's resolved aliases matched CI's chunk names, but duplicated bundled
    modules (+158 KB), so it was reverted (`p33`-`p38` folders).
  - The CI step that would have compared a rebuild byte for byte was removed. The viewer job
    now rebuilds, audits, and checks the committed mirror.

### Owner-directed simplification of the publisher (`p82`-`p93`)

- The owner stopped the publisher review loop (2026-10-22) because the process-supervising
  publisher had grown in scope with every review round. By owner direction:
  - `publish-root-mirror.mjs` is now a short filesystem publisher and verifier. The custom
    process runner, build spawning, taskkill/CIM/PID tracking, signal handling, heartbeat and
    stall watchdog were removed. Its only child process is the bounded export audit, in
    `--end-build` and `--check-export`.
  - The build and audit stay in the viewer's `npm run build`, run through the existing
    monitored caller (`npm run build:monitored -- -CommandText "npm --prefix
    viewers/jermilova-public run build" -Label jermilova-viewer-build`). The build calls
    `--begin-build` (fingerprint) and, after `next build`, `--end-build`: same fingerprint
    required, then the export audit between two snapshots of `out/`, then the receipt for
    exactly the audited bytes (review correction: an earlier draft hashed `out/` after a
    separate audit process).
  - `--write` also re-checks the fingerprint right before promotion (review correction).
  - `--write` publishes only an export whose receipt matches the current inputs and the exact
    `out/` bytes; staging, verification, promotion and rollback are unchanged.
  - The viewer CI job is aggregated into CI Status Check (workflow only; no branch-protection
    or provider change). CI Status Check is not itself a required branch-protection context
    (required today: Lint & TypeScript Check, Unit Tests, Production Build, E2E Tests), so
    GitHub does not block a merge on it until the owner adds it; the merge protocol (every CI
    check green) does.
  - Kept from the reviews: `verifiedFetch` method normalisation, repeated decoding and the
    registry pin; the 404 exclusion; exact-path staging; verification after staging and after
    promotion; fail-closed checks; page `no-cache`; the HSTS parser guard.
- The discarded publisher is kept, unedited, in
  `archive-process-runner-publisher-20261022T215402Z` (with sol round 4's findings). The
  evidence folders p42-p82 describe that discarded design and are kept as history; they do
  not describe the current publisher.
- `p83-simplified-publish-20261022T215616Z`: monitored viewer build exit 0 (logs in
  `build-logs`), then `--write`, `--check` and `--check-export` all exit 0; 59 files,
  5,198,982 bytes; fingerprint `97b0d7d1...` over 69 inputs; files and CSP hashes identical
  to p80; no new node process. `export-receipt.json` is the receipt that was used.
- `p84-simplified-proofs-20261022T215741Z\proofs.json` (publisher `600179c5...`): `--write`
  refuses with no receipt, with an unfinished build, after a source change, and after an
  `out/` change; `--end-build` refuses (and removes the receipt) when the inputs changed since
  `--begin-build`; `--check-export` refuses when `out/` changes during the audit. Mutants:
  without the source check the stale export is published; without the `out/` check
  (`d2-out-changed-mutant.json`, run from a copy outside the fingerprinted folders) the
  tampered byte is published; without the audit-snapshot check `--check-export` still fails,
  on the manifest comparison (defence in depth). Everything was restored and the baseline
  `--check` and `--check-export` pass.
  (`p84-simplified-proofs-20261022T215721Z` is an earlier attempt that stopped before changing
  anything: a helper name collided with a PowerShell alias.)
- Targeted review of the simplified design (one Opus reviewer and codex luna, one round)
  found two receipt gaps, corrected in one pass: `--end-build` now runs the audit itself
  between two `out/` snapshots (it used to hash `out/` after a separate audit process), and
  `--write` re-checks the fingerprint right before promotion. Also corrected: stale
  "advisory" wording, the CI condition layout and a 20-minute timeout on the viewer job, the
  temporary manifest gitignored, and the fingerprint's test-file exclusion narrowed to
  `lib/*.test.ts(x)` (the same files Tailwind skips; the input set is unchanged today).
- `p86-simplified-publish-20261022T220918Z`: monitored viewer build exit 0 (its log shows
  `--end-build` ran and wrote stage `audited`), then `--write`, `--check` and
  `--check-export` exit 0; publisher `33603485...`; 59 files, 5,198,982 bytes; fingerprint
  `ff14c7a3...` over 69 inputs; files and CSP hashes identical to p83; no new node process.
- `p87-endbuild-proof-20261022T221025Z\endbuild-proof.json`: `--end-build` with `out/`
  changing as its audit exits refuses and removes the receipt; with the snapshot check
  removed (a copy outside the fingerprinted folders, with the audit scripts beside it) the
  tampered export is marked `audited`. All restored.
- `p88-simplified-proofs-20261022T221044Z\proofs.json`: the p84 refusals re-run on the
  corrected publisher, with the same outcomes (the `out/` mutant there is again caught by the
  fingerprint first; the discriminating copy-based run is p84 `d2-out-changed-mutant.json`,
  whose check is unchanged).
- `p89-checks-20261022T221059Z`: root guard 13 of 13, viewer suite 74 of 74, root and viewer
  tsc exit 0, lint exit 0 (the one pre-existing `prefer-const` warning), required E2E spec 3
  browsers passed.
- Final review (one holistic round: Opus GREEN; gpt-5.6-sol xhigh one P2): a same-origin path
  with dot segments, such as `/Jermilova/bn-rrm/../../api/secret`, was normalised by URL
  resolution into a different route and passed through. Fixed: `verifiedFetch` refuses any
  same-origin path with a `.` or `..` segment (literal or encoded) or a backslash, before
  resolving it (tests added; the check removed -> the refusal test fails:
  `p91-checks-20261022T222650Z/m-dotseg.log`). The one exact-finding confirmation (sol) then
  found two bypasses of the same class (parser whitespace inside dot segments; URL or Request
  objects already normalised by construction) and returned RED; per the bounded process I
  stopped and reported. The owner chose the structural fix: `verifiedFetch` now refuses every
  same-origin request that is not a pack read or one of the viewer's own files
  (`/Jermilova`, `/Jermilova/index.txt`, `/Jermilova.txt`, `/Jermilova/_next/...`,
  `/favicon.ico`), the same set the required E2E spec allows. New test 'refuses every other
  same-origin path, however it is spelled or pre-normalised' (paths, a tab-in-dot-segment
  string, a pre-normalised URL and Request); with the allowlist removed it fails
  (`p93-checks-20261023T003025Z/m-allowlist.log`). One sol confirmation of exactly this fix
  follows.
- `p92-final-publish-20261023T002957Z`: monitored viewer build exit 0 (receipt `audited`),
  `--write`, `--check` and `--check-export` exit 0; 59 files, 5,199,612 bytes; fingerprint
  `54bd5a38...` over 69 inputs; against p90 the page chunk was replaced (`page-c504f8d6...` ->
  `page-1173a419...`) and `index.html` and `index.txt` changed, with new CSP hashes; no new node
  process.
- `p93-checks-20261023T003025Z`: root guard 13 of 13, viewer suite 75 of 75, root and viewer
  tsc exit 0, lint exit 0 (the one pre-existing warning), required E2E spec 3 browsers passed
  (it clicks through every tab, so the allowlist refuses nothing the page needs);
  `file-hashes-all.txt` hashes every changed and new file (83).
- `p90-final-publish-20261022T222622Z`: monitored viewer build exit 0 (receipt `audited`),
  `--write`, `--check` and `--check-export` exit 0; 59 files, 5,199,345 bytes; fingerprint
  `3ffa9736...` over 69 inputs; against p86 the page chunk was replaced (`page-1f12e8fa...` ->
  `page-c504f8d6...`) and `index.html` and `index.txt` changed, so the inline-script CSP hashes
  changed (the route reads them from `published-mirror.json`); no new node process.
- `p91-checks-20261022T222650Z`: root guard 13 of 13, viewer suite 74 of 74, root and viewer
  tsc exit 0, lint exit 0 (the one pre-existing warning), required E2E spec 3 browsers passed;
  `file-hashes-all.txt` hashes every changed and new file (83, mirror included).
- Not covered by a committed test: the receipt refusals of `--write` / `--end-build` and the
  fingerprint re-check right before promotion. The refusals are proven only by the gitignored
  runs above (p84, p87, p88); the pre-promotion re-check has no proof run.

### Historical: process-supervising publisher (`p42`-`p82`; design discarded, see above)

#### Publisher hardening, fingerprint, 404 pages and page caching after p39 (`p42`-`p81`)

- After internal and codex reviews, `runStep` in `publish-root-mirror.mjs` kills the step's
  process tree and fails, instead of waiting, when:
  - the step times out;
  - the step exited but another process still holds its output pipes (15 s, or the main
    timeout if that comes first);
  - the step's log cannot be written, including its final flush (the step settles only once
    the log stream has finished, bounded at 15 s, and a log stream that closed before it
    finished also fails the step);
  - the step left processes running after its output closed, on ANY outcome. A first
    lookup finds candidates; after a 1.5 s settle a second lookup, seeded with those
    candidates, decides. A child of a candidate that has since exited is still found; if an
    unrelated process now holds such a candidate's PID, only children created before that
    process count, so a still-running reuser's children are not followed. Anything still found is
    killed (Windows: by identity; POSIX: its process group) and fails the step, with a
    re-check reported.
- The kill is best effort; the proof is the step's output closing ("kill attempted (...) and
  its output closed"); otherwise "cleanup NOT verified" and to check for leftover node
  processes.
- Windows kill: the descendants are listed BEFORE anything is killed (while the step runs its
  tree is connected and its PID cannot be reused; after its exit the recorded exit bounds the
  walk: creation times consistent with the parent chain, direct children predating the
  exit); then, while the step runs, `taskkill /T`; then the listed descendants are killed by
  identity (PID and creation time) in one PowerShell call. The walk never starts from the
  step's PID after the step has been killed. A listing counts as failed if it
  errors, exits nonzero, or does not end with its completion line (it runs with
  `$ErrorActionPreference = 'Stop'`).
- POSIX: only ESRCH counts as "process group gone"; any other lookup error fails the step.
- Interrupts (SIGINT, SIGTERM, SIGHUP and, on Windows, SIGBREAK): running steps are killed,
  a bounded re-check is written to stderr, then the publisher exits.
- Limits, documented in the script: a process that reused a dead descendant's PID and has
  itself exited cannot be told apart; a descendant whose parent exited is found only through
  an earlier candidate; on Windows, closing the console ends the publisher after about 10 s,
  which can cut the interrupt re-check short.
- NOT exercised by a test: the POSIX paths, the interrupt handler, the leftover check after a
  failure that already killed the tree (the code path is shared with the tested nonzero-exit
  case), a log failure that arrives during the settle (`t-logfail` fails before the output
  closes), and the PID-reuse race itself (it cannot be induced on demand; the kill order is
  shown by the "listed before the kill" notes in `results7.json`).
- `p78-runstep-final-20261022T213425Z` re-runs every case and mutant below on the FINAL
  publisher (`sources.sha256`, checked from `viewers/jermilova-public`, pins `9fb4a9e6...`
  and the final `verifiedFetch.ts`; `SHA256SUMS` covers the result files): `results7.json`,
  `results-final.json`, `seed-reuse-*.json`, `listfail13.json`, the mutants
  `results-m-parse-no-completion-check.json`, `results-m-settle-zero.json` and
  `results-m-no-seeds.json`, `logflush2-final.json` (a final-flush EIO rejects a step that
  would otherwise succeed), and `log-edge-before.txt` / `log-edge-after.txt` (previous
  publisher `12d39009...` vs final): a log destroyed before it finished was accepted before
  and is now rejected; a final flush that never completes now rejects at about 15.7 s; no
  unhandled errors. The earlier two-sided flush evidence is p74 (`logflush2-before.json`
  on `563ab180...`, as inferred from p71 40 s later; that harness did not record the hash,
  and `logflush2-final.json`). The
  decode mutant (`p63` `m-single-decode.log`) ran on an earlier `verifiedFetch.ts` whose
  decode logic is unchanged in the final file (only the registry pin was added).
- `p66-runstep-r13-20261022T203351Z` (publisher `fba358d8...`, not kept; the same cases;
  `SHA256SUMS` covers its result files;
  earlier versions p42, p45, p48, p50, p53, p57, p60 and p63; p53's and p57's folder names
  are later than their runs, which were at 19:40-19:42Z and 19:52-19:53Z):
  - `results7.json`: success (about 0.8 s, including the leftover check); exit 3; timeout
    with a pipe-holding grandchild; descendant holding the pipes; timeout after exit; log
    failure; orphaned pipe holder -> "cleanup NOT verified" (the harness cleaned it up);
    detached no-pipe child -> killed.
  - `results-final.json`: the listing parser returns null without the completion line and
    on a nonzero exit; exit 3 with a detached child -> fails and the child is killed; a child
    exiting 2 s after the step is not counted; a survivor that starts a child and exits
    during the settle -> the child is found and killed.
  - `seed-reuse-final.json` / `seed-reuse-mutant.json` (pure test on a synthetic listing): a
    dead seed whose PID now belongs to an unrelated process -> the seed's own earlier child is
    kept and the reuser's child is not followed; with the reuse bound removed the reuser's
    child is followed.
  - `listfail10.json`: a failed listing gives "cleanup NOT verified".
  - Mutants from p63 (`SHA256SUMS` there): no completion-line check -> the partial listing is
    accepted; no settle -> the 2 s child fails the step; no seeds -> the survivor's child
    escapes (recorded with an earlier 1.2 s fixture argument); the original one-pass decode
    -> the double-encoding test fails. The decode loop itself has no security role: the
    "still encoded after four rounds" check is what refuses multi-layer encodings.
- The viewer-source fingerprint covers the whole `scripts/` folder. `prepare-assets.mjs`
  imports `path-safety.mjs`, and the checks and the audit decide what may be published, so a
  change to any of them needs a republish (each publisher edit above was republished).
- The mirror leaves out the export's Next 404 pages (`404.html`, `404/index.html`), first in
  `p54-final-publish-20261022T194304Z` (exactly those two files removed). The root app
  answers unknown paths with its own not-found page, and the mount CSP is hashed from
  `index.html` only, so `index.html` is now the only published page (asserted by the guard).
- `verifiedFetch` decodes a same-origin path repeatedly before its `bn-rrm` segment check and
  refuses a path still encoded after four rounds, so `/%2562n-rrm/...` is refused (tests for
  double, triple and five-layer encodings). Forms such as a trailing-dot segment are not
  special-cased (README); the preview server refuses segments ending in a dot or space.
- The preview server uses the production canonical URL (`/Jermilova/` redirects once to
  `/Jermilova`), and the parity spec now opens `/Jermilova`. The preview still sends no CSP;
  CSP evidence comes only from runs against `next start`.
- After the final codex round (gpt-5.6-sol, xhigh) two more fixes:
  - `verifiedFetch` also checks the registry's bytes: its SHA-256 is pinned
    (`REGISTRY_SHA256`), a unit test keeps the pin equal to the shipped file, and a test
    rejects a registry whose ids are intact but whose other bytes changed (two-sided:
    `p72-checks-20261022T205520Z\m-registry-hash.log`, the check removed -> that test
    fails).
  - The second sol round found that a failure of the log's final flush was ignored; fixed as
    described above (p74 `logflush2-*.json`). The third found that the post-kill listing
    could start from a killed step's PID; the descendants are now listed before the kill
    (above). It also found that the README offered a partial
    unpublish (removing only the mirror or the route hooks) that the required guards would
    fail; the README now gives only a full merge revert or a Vercel instant rollback.
  - The publisher records the export's exact bytes before the audit and refuses if they
    differ after it, so the staged bytes are identical to the bytes before and after the
    audit (the staged copy is verified against that list). A change reverted during the
    audit is not detectable. The inline-script CSP hashes are computed from a fresh read of
    `out/index.html`; a mismatch there fails closed, because the required unit guard
    recomputes them from the committed page. Fault injection on the final publisher
    (`p79-audit-snapshot-fault-20261022T213749Z\fault-injection.json`, which records the
    publisher hash `9fb4a9e6...`; earlier runs: p75 on `12d39009...`, and p70, which does not
    record its publisher; p71, 40 s later, ran `563ab180...`): a preload changed
    `out/index.txt` as the audit exited; the guarded publisher refused ("changed: index.txt")
    and left no mirror, staging or temporary manifest, with the manifest unchanged; with the
    guard removed, the tampered byte was published. Everything was restored afterwards.
- `p80-final-publish-20261022T213809Z\summary.json`: `--write` with the final publisher
  (sha256 `9fb4a9e6...`); every step passed the leftover check; `--check` and
  `--check-export` ok; 59 files, 5,198,982 bytes; fingerprint `5b8b1c41...` over 69 inputs;
  files and CSP hashes identical to p76 and so to p71. p71 (publisher `563ab180...`) was the export of the
  final viewer code: against p68 the page chunk was replaced (`page-18e9ae4f...` ->
  `page-1f12e8fa...`, the registry check), and `index.html` and `index.txt` changed, so the
  inline-script CSP hashes changed (the route reads them from `published-mirror.json`). No
  new node process (`node-processes-before.json`, `node-processes-after.json`). Earlier
  republishes: p44, p46, p49 and p51 (the unchanged 61-file export), p54, p58, p61, p64,
  p68, p71 and p76. p38, p39 and p44 hold no process snapshot.
- Page caching: the route sends `Cache-Control: no-cache` on `/Jermilova` and
  `/Jermilova/index.html` (pack files stay `no-store`; framework files have content-hashed
  names). The unit guard asserts that no other page-matching rule sets Cache-Control, the
  required E2E spec asserts the page header on the dev server, and the production-mode smoke
  the final-tip gates run asserts both page URLs on `next start`. That smoke script and the
  other gate tools are kept in `gate-tools-20261022T203500Z` (`SHA256SUMS`); the copies in
  the p10-p17 run folders are older and do not check the page. A page already open during a
  republish can still fetch new pack bytes with its old code; the integrity check then fails
  closed and a reload recovers.
- `p81-checks-20261022T213834Z`: root guard 13 of 13, viewer suite 74 of 74, root and viewer
  tsc exit 0, lint of the touched files exit 0 (one warning: `prefer-const` for `let stream`
  in `scripts/preview-server.js`, present at HEAD), and the required E2E spec in chromium,
  firefox and webkit (3 passed; the page loads, so the pinned registry hash matches the
  served file). Earlier check runs: p47, p52, p55, p59, p62, p65, p69, p72 (holds
  `m-registry-hash.log`) and p77.
- HSTS guard (`p52-checks-20261022T193023Z`): the test finds every
  `<x>.headers.set('Strict-Transport-Security', ...)` call in `src/middleware.ts` with the
  TypeScript parser, requires exactly one literal value, and asserts the mount uses it. The
  extractor's own test covers a commented-out call, a second call, a non-literal value and a
  `/*` inside a string; a raw-regex mutant fails it (`mutant-raw-regex.log`).
  `src/middleware.ts` is never mutated. Earlier HSTS evidence: p43, p47.

### Evidence on the final export (`p40-final-evidence-20261022T185319Z`)

- **Unit and static checks** (`exit-codes.json`): viewer suite 72 of 72; root guard 11 of 11;
  root and viewer tsc exit 0; lint exit 0. These predate p42-p81; see p81, and the final-tip
  gates re-run everything.
- **Anonymous parity** (`p66.json`): PASS. Checks:
  - six tabs and the node-count status;
  - canvas collapsed 7/0/6, mixed 7/2/8, expanded 7/14/14;
  - inspector, and every tab at 1440 and 390 px;
  - a reload restores the initial state;
  - zero writes, with all spies installed;
  - zero final storage and cookies;
  - no page errors, non-GET requests or unexpected paths.
- **Spy proof** (`probe-write-spies.json`, `scripts/probe-write-spies.cjs`): the probe runs
  the spec's own spy code against the served page. With all spies installed, it detected
  2 storage writes, 1 IndexedDB open and 1 cookie write.
- **Root E2E** (`focused-e2e-3-browsers.log`): 3 of 3 in chromium, firefox and webkit.
- **Recorded mutation proofs** (`p41-mutations-20261022T185427Z\mutations.json` plus
  per-guard logs). Each of the eleven mutants is caught (exit 1) by its targeted guards, and
  its log lists the failing tests. The unmutated baseline (e2e in chromium) passes all three
  guards. The mutants:
  - base-path mapping removed;
  - non-canonical refusal removed;
  - mirror byte appended;
  - forbidden marker added;
  - CSP hash tampered;
  - `claim-register.json` changed without a republish;
  - `scripts/prepare-assets.mjs` changed without a republish;
  - source map added to the mirror;
  - viewer source changed without a republish;
  - method normalisation reverted;
  - rewrite removed (fails the unit guard and the E2E spec: 404 instead of 200).
- **Production mode on the final export:** the root build, the `next start` smoke and the
  rendering checks are repeated in the gate phase. Results are in the PR body.

### Supporting evidence on earlier exports (same design)

- **Production mode** (`p17-prod-20261022T173336Z`; p15 export, before HSTS and the last
  `verifiedFetch` change):
  - the smoke PASSED, 34 of 34 probes:
    - one 308;
    - hash-only `script-src`, `noindex` and the frame and sniffing headers;
    - all 10 `_next` references and `index.txt`;
    - 20 pack files byte-verified and `no-store`;
    - `/bn-rrm` still redirects to `/login`;
  - the anonymous parity spec under the real CSP PASSED;
  - `probe-csp-map.json`: 0 CSP violations.
- **Tailwind scan isolation** (`p22-css-isolation-20261022T175823Z`):
  - With the exclusion, a README utility token left the CSS byte-identical
    (`css-build-A.txt` vs `css-build-B-readme-token.txt`).
  - The negative control (token present without the exclusion) was observed in this
    session. Its saved artifact (`build-C-negative-control.json`) records only the build
    itself.
  - An independent review reproduced both sides with the installed Tailwind scanner: 109 files
    are scanned with the exclusion, and 136 without.
- **Publish rollback fault injection** (`p27-publish-rollback-test-20261022T181816Z\rollback-state.json`;
  run on the rollback code before its last edits: rollback checks moved inside the guarded
  steps, the pre-rename target re-check, the async build steps):
  - with the manifest held open, the rename after promotion failed;
  - rollback left no mirror, staging or temp file, and the manifest was unchanged.
- **Two consecutive viewer builds byte-identical** (`p19-final-20261022T174857Z\reproducibility-build*.txt`;
  an earlier tree).

### Authenticated original vs clone

- PASSED on an earlier export: `p9d-auth-20261022T163300Z`, 4 passed, `diffs: []`, with
  identical canvas states.
- I infer, but have not proven, that the later changes are not visible in the UI. Those
  changes:
  - `verifiedFetch` hardening;
  - CSP hashes and headers;
  - the fingerprint;
  - the Tailwind scan exclusion (proven CSS-neutral for the README token; the final CSS is the
    p15 CSS).

  Only the clone side has been re-proven on the final export.
- The re-run on a later export did NOT complete:
  - `p12-parity-20261022T165345Z` and the single retry `p12b-auth-retry-20261022T165639Z` both
    failed in the established E2E login step (`setup`), so `original-auth` and `compare` did
    not run. The storageState was never written, and cleanup PASSED both times.
  - Before the retry, a mixed root `.next` was quarantined into `.tmp`. The retry still failed.
  - A credential-free probe (`p12c-dev-probe-*`): `/login` returned 200 (`dev.out.log`).
  - The login run's logs may contain the filled credential, so they were left unopened for the
    owner, per the standing rule.
  - Cause: not attributed.

### Failed tooling attempts (recorded; no product defect)

- `p9-parity`: an anonymous run failed at the old 15-edge expectation, which led to the
  14-edge correction.
- `p10-prod`, `p10b-prod` and `p10c-prod`: my scratch smoke script failed, not the product:
  - `p10-prod`: an `Invoke-WebRequest` redirect-handling error;
  - `p10b-prod`: a `$r`/`$R` case collision in my script left its own server running; I
    stopped that tree by identity;
  - `p10c-prod`: an over-strict check expecting a relative `/login` Location.
- `p20-final`: `--write` refused because inputs were newer than the build (the old mtime
  guard), and was rebuilt.

### Spent and preserved, never edited

- P6 attempt 1 `p6-20261022T011747Z` (receipt `D0D9E0B1...`).
- P6 attempt 2 `p6-20261022T020742Z` (receipt `50E8F3BD...`).
- Preview-only R1, R2 and R3.

### Production

NOT deployed at the time of writing. `vercel.json` disables deploys for `feat/*`. An
exact-SHA Vercel preview can be requested by pushing the same commit to a branch outside
`feat/*` and `fix/*`. Its result, if any, is in the PR body.

## Owner decisions

1. **Merge approval of the exact PR head.** The token is in the decision packet.
2. **Anonymous publication.** Merging makes the README's "What becomes anonymously reachable"
   list public for the first time:
   - the 19 Jermilova pack assets, including the `review/*` files, `training_data.json` and the
     `mineral_claims`, `oil_gas_claims` and `communities` layers;
   - the bundles, which embed original BN-RRM library source.
   - The route is `noindex` by default.
3. **Authenticated parity on the final export.** It is blocked at the E2E login. The owner can
   check the unopened logs at `p12-parity-20261022T165345Z\p67.*.log` and
   `p12b-auth-retry-20261022T165639Z\p67.*.log`.
4. **Shared origin.** The viewer shares the authenticated app's origin; the README gives the
   rationale. A separate origin would need a separate deployment or provider change.
5. **CI policy (decided by the owner, 2026-10-22).** The viewer job is aggregated into CI
   Status Check, so a PR touching any of the 35 pinned `src/` files must re-fork, re-pin and
   republish the viewer in the same PR. OPEN OWNER SETTING: CI Status Check is not a required
   branch-protection context (required today: Lint & TypeScript Check, Unit Tests, Production
   Build, E2E Tests). For GitHub itself to block such merges, add "CI Status Check" (or
   "Jermilova Viewer Gates") to the required contexts; not done here.
   - No CI job proves that the committed mirror was built from the committed source: the
     required jobs trust the manifest written by `--write`, so a hand-edited mirror with a
     regenerated manifest would pass them. A stronger option is to publish from a real
     (non-junction) `npm ci` `node_modules`, which reproduces CI's chunk names, and restore
     the `--check-export` byte comparison in CI. Not done in this PR.
   - The same holds for the root folders the viewer's stylesheet scans
     (`src/components/bn-rrm`, `src/lib/bn-rrm`): a change there can change a rebuilt CSS file
     without failing a required job. The pinned files are covered by the closure pin in the
     viewer job, which GitHub enforces only once CI Status Check is a required context.
6. **Still deferred:**
   - removal of the dead R3 components, including the interaction fields of
     `viewer-capabilities.ts` (`inspect-only`, forward-only, evidence controls off). They do not
     describe the shipped viewer, which keeps the original's in-memory what-if (owner
     decision). Besides those components, only `lib/loadJermilovaPack.test.ts` reads them, to
     waive the sum-to-one check for evidence-root beliefs (two sum to 0.999999); that waiver
     needs a rounding-based justification before the fields go;
   - an `npm ci` in the main checkout. The worktree's node_modules is a junction to the Codex
     lane store.

## After the merge

- Wait for the production deployment.
- `GET https://sstac-dashboard.vercel.app/api/health` must report the merge SHA.
- Read-only anonymous smoke of `/Jermilova/`:
  - one redirect, no login, and the headers, including the exact hash-only `script-src`,
    HSTS and `noindex`;
  - `Cache-Control: no-store` on `/Jermilova/bn-rrm/**`;
  - `Cache-Control: no-cache` on `/Jermilova`;
  - all 20 pack files byte- and SHA-256-equal to `published-mirror.json`;
  - the six tabs;
  - 14 nodes and the Detailed BN states;
  - the phone layout;
  - no forbidden actions and no writes.
- Then record the production result in a dated handoff.
- Rollback or unpublish: the README "Emergency unpublish" section (revert the merge commit, or
  promote the previous Vercel deployment; verify 404).

## Fidelity facts (inherited from the original; not changed)

- 14 of 15 edges are drawn: MeHg Ingested -> pTWI Exceedance has no handle.
- On a phone, the map is 0 px wide until the side panels are hidden.
- Guide mentions a Review tab.
- "20 nodes" shows briefly before the pack loads.
- The Results target defaults to 'low'.
- The Stamen basemap URL is dead.
- Light theme only.
- `/jermilova` (lowercase) returns 404.
