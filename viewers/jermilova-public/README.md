# Jermilova public viewer (anonymous, read-only)

A faithful, anonymous, read-only clone of the authenticated `/bn-rrm` page with the
Jermilova 2025 Mackenzie mercury pack selected. It reuses the original BN-RRM components;
only deletion-only forks remove write, export, identify and pack-selection actions
(`forked/`, pinned by `forked/FORK_PATCHES/` and `src-closure.json`).

Tabs, in source order: Guide, Conceptual, Detailed BN, CPT, Map, Data. There is no Review,
Case Studies, pack selector, Supabase access, server API call, or browser-storage write.

The original's in-memory what-if is kept (owner decision): a visitor can set evidence on a
node, reset it, and switch Results between forward and backward inference, exactly as in the
authenticated page. Nothing is saved; a reload restores the initial state.
`viewer-capabilities.ts` is still used for its pack, model, map and evidence-node ids, but its
interaction fields (`interactionMode: 'inspect-only'`, `resultModes: ['forward']`,
`evidenceControlsEnabled: false`) do not describe this viewer. They are read only by the
superseded preview components under `components/` (not mounted, not in the bundle) and by one
loader test, `lib/loadJermilovaPack.test.ts`, which uses them to waive the sum-to-one check for
evidence-root beliefs (two of them sum to 0.999999). Their removal, and a rounding-based
justification for that waiver, belong to the deferred cleanup of the superseded components.

## How it is served in production

The root app serves this package's static export as public files. Nothing builds the viewer
during the root (Vercel) build.

| Piece | Where |
|---|---|
| Export, built with `basePath: '/Jermilova'` and a fixed build id | `next.config.ts`, `lib/publicBasePath.ts` |
| Committed exact mirror of the audited export | `../../public/Jermilova/` |
| Per-file manifest of the mirror (path, bytes, SHA-256), plus the SHA-256 of each inline script in `index.html` | `published-mirror.json` |
| Rewrite `/Jermilova` -> `/Jermilova/index.html`, and the route headers | `../../src/lib/jermilova-public/route-config.ts`, wired in the root `next.config.ts` |

The route headers are:

- a CSP whose `script-src` allows the page's inline scripts by hash only, with no
  `'unsafe-inline'` for scripts;
- `X-Frame-Options: DENY`, `nosniff`, a referrer policy, a permissions policy, and the same
  `Strict-Transport-Security` value the middleware sets in production elsewhere (a guard test
  reads it from `src/middleware.ts`);
- `X-Robots-Tag: noindex, nofollow`, a conservative default (public but not indexed;
  removing it is an owner decision);
- `Cache-Control: no-store` on the pack files, and `no-cache` on the page, so a fresh load
  always gets the current page (whose framework files have content-hashed names) with the
  current pack files. A page already open during a republish can fetch new pack bytes with
  its old code; the integrity check then fails closed and a reload recovers.

**Shared origin.** The viewer runs on the same origin as the authenticated app. Its scripts
are the original BN-RRM component code that already runs for signed-in users at `/bn-rrm`,
minus the deleted write and export paths, and every inline script is pinned by hash. It reads
no URL parameters, hash or user-entered text into the page; map popups render the
hash-verified pack data. The page therefore adds no script capability that signed-in users'
browsers do not already run on this origin. A separate origin would be stronger isolation,
but it needs a separate deployment or provider change.

Request flow on the production origin:

- `/Jermilova/` is redirected once (308) to `/Jermilova`, because the root app uses
  `trailingSlash: false`.
- `/Jermilova` is rewritten to the export's `index.html`.
- `/Jermilova/_next/**` and `/Jermilova/bn-rrm/**` are plain public files.
- `src/middleware.ts` never matches `/Jermilova/**`, so there is no login redirect and no
  Supabase call.
- The original stores fetch `/bn-rrm/...`. `lib/verifiedFetch.ts` checks every response
  byte for byte: pack files against `asset-manifest.json` (bytes and SHA-256) and the
  registry against its pinned SHA-256 plus its structure; GET only; no query strings. It then
  fetches exactly `/Jermilova/bn-rrm/...`, and it refuses any other same-origin spelling of
  a pack path that has a `bn-rrm` segment after decoding (encoded at any depth, different
  case, doubled slash, repeated base path). Every other same-origin request is refused unless
  it is one of the viewer's own files (`/Jermilova`, `/Jermilova/index.txt`, `/Jermilova.txt`,
  `/Jermilova/_next/...`, `/favicon.ico`), however it was spelled: dot segments, parser
  whitespace, or an already-normalised URL or Request object. A raw path with a `.` or `..`
  segment (literal or encoded) or a backslash is refused before it is resolved. So the wrapper
  never sends a request to the authenticated app's own routes. Other forms, such as a segment `bn-rrm.` with a trailing dot, are not
  special-cased: the production host (Linux) answers them with 404, and the preview server
  refuses segments ending in a dot or space.
- The client router would fetch an RSC payload at `/Jermilova.txt`. The page has no client
  navigation, so nothing requests it; a request would 404, and the router falls back to a
  full page load.

### What becomes anonymously reachable

These are all served without login. The route asks search engines not to index it
(`X-Robots-Tag: noindex, nofollow`); that is a request to crawlers, not access control.

1. The one-pack `pack-registry.json`.
2. The 19 approved Jermilova pack assets. They sit behind the `/bn-rrm` login on the
   authenticated app today:
   - `pack.json`, `runtime/learned-model.json`, `training_data.json`;
   - `review/model_overview.json`, `review/decisions.json`, `review/provenance_registry.json`,
     `review/site_reports.json`;
   - 12 map layers: `gsl_basins`, `gbs_basins`, `advisory_lakes`, `commercial_fisheries`,
     `historic_mines`, `large_mines`, `mineral_claims` (claim owner names), `oil_gas_claims`
     (company names), `hydro_facilities`, `communities` (population counts),
     `climate_stations`, `thaw_slumps`.
3. The page itself (`index.html`, `index.txt`). The export's Next 404 pages are not
   published; unknown paths get the root app's own not-found page. That page is served with
   the mount's CSP, so its inline scripts are blocked (console CSP errors there are expected;
   the page is static).
4. The JavaScript bundles, which embed the reused original BN-RRM library source. That
   includes legacy demo model ids such as `sed_cu`, `tox_amphipod`, `bnrrm-landis-causal`
   and `sulfide_binding`. The same source is already public in this public repository.

## Guards, and what they do not prove

- **Required CI (root Unit Tests):** `src/lib/jermilova-public/__tests__/publishedMirror.test.ts`
  checks that:
  - the committed mirror equals `published-mirror.json` byte for byte (no missing, extra or
    duplicate entries; file count and total bytes consistent);
  - the viewer-source fingerprint recorded at publish time equals one recomputed from this
    package. The fingerprint covers its source, config, data, `src-closure.json` and the whole
    `scripts/` folder (asset preparation and every check the publish relies on), with line
    endings normalised. A change to those inputs merged without a republish fails here.
    `--write` publishes only an export whose build receipt matches the current inputs and
    the exact export bytes;
  - pack files equal `asset-manifest.json`, and the registry offers only Jermilova;
  - `index.html` is the only published page, and it loads only `/Jermilova/_next/` files that
    exist;
  - the CSP's script hashes equal the committed page's inline scripts;
  - the bundle carries no forbidden markers (Supabase, review, write, export, other packs,
    `/api/`);
  - the rewrite and headers are as specified;
  - Next's own matcher semantics confirm the login middleware never matches the mount and
    still matches `/bn-rrm/**`.
- **Required CI (E2E):** `e2e/jermilova-public.spec.ts` loads `/Jermilova/` anonymously in
  chromium, firefox and webkit on the e2e dev server. It checks:
  - exactly one redirect, no login, and the security headers;
  - the six tabs and the 14-node model;
  - no Review or Case Studies;
  - no storage writes and no non-GET requests.
- **CI (Jermilova Viewer Gates, aggregated into CI Status Check):**
  - closure pin, fork patches, viewer tsc and tests;
  - a fresh `npm run build` from the current source (prepare, checks, build, export audit);
  - `publish-root-mirror.mjs --check` on the committed mirror.
  CI Status Check fails whenever this job does not succeed, so a PR that changes a pinned
  `src/` file must re-fork, re-pin and republish the viewer in the same PR. GitHub enforces it only if "CI Status Check" (or "Jermilova Viewer Gates") is a required
  branch-protection context; today the required contexts are Lint & TypeScript Check, Unit
  Tests, Production Build and E2E Tests (checked 2026-10-22). Adding one is an owner setting.
- **Local parity (`e2e/parity.spec.ts`, `playwright.config.ts`):** the anonymous clone against
  the authenticated original. It runs the original through the repository's E2E auth setup,
  with env files read in place. Only this local spec counts browser console errors, which is
  how Chrome reports CSP violations. Those can only appear when the spec runs against the
  root app after a production build (`next start`), which sends the mount's headers. The
  viewer preview server (`scripts/preview-server.js`) sends no CSP (it uses the same canonical
  URL as production: `/Jermilova/` redirects once to `/Jermilova`), so a run against it checks
  rendering and behaviour only. The required E2E checks page errors, request paths and methods, not console
  output.

**Limits:**

- The required unit and E2E guards prove the served bytes are complete, consistent, free of
  forbidden markers, correctly routed, and published after the latest viewer-package change;
  the viewer job rebuilds and audits the export from the current source.
- No CI job compares a rebuild with the committed bytes. Next names chunks by hashing module
  paths, and those differ between a real `node_modules` (CI) and a linked one (this
  worktree's junction to a shared store). A byte comparison only holds on the same layout:
  locally, `--check-export` after a rebuild. The viewer job proves that the current source
  builds and passes the audit.
- Two attempts to make the build layout-independent were rejected:
  - `resolve.symlinks = false`;
  - remapping Next's resolved aliases.

  The second changed module identity enough to duplicate bundled modules (the export grew by
  about 158 KB).
- Tailwind's package scan excludes this package's current docs, tests under `lib/`, `e2e/`,
  `scripts/`, the test configs and the generated manifest (`app/globals.css`), so editing them
  cannot change the stylesheet. The exclusion is a list, not an allowlist: a new
  non-gitignored file added elsewhere in the package (for example a new docs folder) would be
  scanned without being fingerprinted. Add it to the list. The package's own `.gitignore`,
  which also decides what Tailwind skips, is not fingerprinted either.
- The root app's stylesheet (`src/app/globals.css`, Tailwind auto-detection) also scans the
  committed mirror under `public/Jermilova/`, so a republish can in principle change the
  authenticated app's CSS. The viewer's classes come from the BN-RRM components the root app
  already uses, so nothing changes today; excluding the mirror would mean editing the root
  stylesheet, which the viewer imports (and pins).
- Some build inputs are outside the fingerprint:
  - the whole `src/components/bn-rrm` and `src/lib/bn-rrm` directories that Tailwind scans
    for class names;
  - the root dependency versions (`package-lock.json`, Next).
  A change there can alter what a rebuild would produce without failing a required job.
  Pinned `src/` files are covered by the closure pin in the viewer job, which GitHub enforces
  only once CI Status Check is a required context (see above). Production keeps serving the
  previous audited export until a republish.
- The bundle-marker check authenticates two pinned files from the Next package
  (`node_modules/next/dist/lib/is-api-route.js` and its ESM copy; pins in
  `scripts/audit-export-core.mjs`). Upgrading Next therefore fails the required Unit Tests
  until those pins are reviewed and updated, and the viewer is rebuilt and republished.

## Republish after an intended change

1. Change the viewer, or re-fork and re-pin after an intended `src/` change. The procedure is
   in the `viewer-jermilova` job comment in `.github/workflows/ci.yml`.
2. Move the previous `../../public/Jermilova/` aside, to somewhere outside `public/` (for
   example the gitignored `.tmp/`), or delete it; it is generated output. A copy left under
   `public/` would be served anonymously without the mount's headers.
3. Build and audit the export with the viewer's own build, through the repository's
   monitored build caller (from the repository root):

   `npm run build:monitored -- -CommandText "npm --prefix viewers/jermilova-public run build" -Label jermilova-viewer-build -TimeoutSeconds 600 -PollSeconds 10`

   `npm run build` runs `prepare-assets`, records the viewer-source fingerprint
   (`publish-root-mirror.mjs --begin-build`), runs the closure and fork-patch checks and
   `next build`, and ends with `--end-build`: it refuses if the inputs changed during the build,
   runs the export audit (T1, T2 and T3 must PASS) between two snapshots of `out/`, and only
   then writes the build receipt for exactly the audited bytes. The receipt
   (`.export-receipt.json`, gitignored) binds the inputs to that export.
4. From this directory, run `node scripts/publish-root-mirror.mjs --write`. It is a short
   filesystem step (no build, no process handling). It requires the receipt to match the
   current inputs and the exact bytes in `out/`, then publishes the mirror (the export minus its
   Next 404 pages) and `published-mirror.json` (file hashes, inline-script CSP hashes,
   fingerprint) as one transaction, verified after staging and after promotion, with rollback
   on any failure.
5. Run the parity check, review the mirror diff, and commit `public/Jermilova/` together with
   `published-mirror.json`.

## Emergency unpublish

1. Either revert the merge commit on `main` as a whole and let Vercel deploy it, or have an
   owner promote the previous production deployment in Vercel (instant rollback). Do not
   remove only `public/Jermilova/` or the route hooks: the required guards
   (`src/lib/jermilova-public/__tests__/publishedMirror.test.ts`,
   `e2e/jermilova-public.spec.ts`) expect the mount, so a partial removal cannot pass required
   CI. A revert removes the mount, its guards and its configuration together. Use
   `git revert -m 1 <merge commit>`. An instant rollback only changes what Vercel serves:
   `main` still contains the mount, so the next production deployment serves `/Jermilova`
   again until the revert lands.
2. Verify `https://sstac-dashboard.vercel.app/Jermilova` and
   `/Jermilova/bn-rrm/pack-registry.json` return 404 anonymously.
3. Copies already downloaded, or cached by browsers or proxies, cannot be recalled. The pack
   files are `no-store` and the page is `no-cache`. The framework files use the host's default
   cache policy.
4. The route is `noindex`. If the header was removed and pages were indexed, request removal
   through the search engines' removal tools.

## Fidelity facts (inherited from the original page; not changed here)

- The original draws 14 of the model's 15 edges when expanded. Its node component for MeHg
  Ingested renders only a target handle, so MeHg Ingested -> pTWI Exceedance has no drawn
  arrow. The model, inference and inspector still use all 15 edges. An authenticated parity
  run on the previous export (2026-10-22) found no differences in the compared tab text,
  shell text and canvas states; screenshots are captured but not diffed. The re-run on the
  final export was blocked at the E2E login step.
- At phone width (390 px), the map area of the Map tab is 0 px wide because both fixed side
  panels stay open. Hiding the panels with the header toggles gives the map the full width.
  This was measured on the clone; the layout is the original SiteMap layout, reused.
- Guide mentions a Review tab. Collapsed groups show the original placeholder Low/Medium/High
  bar. "20 nodes" shows briefly before the pack loads. The Results target defaults to 'low'.
  The Stamen terrain basemap URL is dead. Light theme only.
- `/jermilova` (lowercase) is not an alias; it returns 404.
