# Dead Code Sweep Report -- SSTAC Dashboard (2026-06-05)

## RECOMMENDATIONS ONLY -- no deletions performed

Per L0 (`C:\Projects\CLAUDE.md`) rule 1.4 (no mass deletions; no auto-deletion of
project artifacts) and the dashboard rule "never delete regression tests": this report
RECOMMENDS, it does not DELETE. Nothing in this document was removed from the tree. The
owner approves every individual removal, in its own reviewable PR, before any file or
export is deleted. Where a finding is "dead" only by static reference count, that is a
starting point for owner judgment, not a license to delete.

This report synthesizes three read-only sweeps (broken-imports, unreferenced-files,
dead-exports-deps) run against `SSTAC-Dashboard-worktrees/p1-review-status-2026-06-05`
(origin/main + the PR #255 5-file diff).

---

## 1. Findings table (grouped by class)

### Class A -- Broken imports / unresolved references

| path | finding | evidence | confidence | recommended action |
|---|---|---|---|---|
| (whole 5-file PR #255 diff) | ZERO broken imports, unresolved refs, missing assets, invalid routes, or broken re-exports | Full build succeeds; `tsc` clean; `review-submission-status.test.ts` 6/6 pass; `@/` alias resolves via tsconfig (baseUrl=`.`, paths `@/*`->`./src/*`); `src/types/index.ts` correctly re-exports `ReviewSubmissionStatus` + `REVIEW_SUBMISSION_STATUSES` from `./database.ts` | HIGH | NONE -- no action; class is clean |

### Class B -- Unreferenced modules (zero runtime callers)

| path | finding | evidence | confidence | recommended action |
|---|---|---|---|---|
| `src/lib/db/queries.ts` | Data-access layer; functions (`getUserRoles`, `getTags`, `getAnnouncements`, `getMilestones`, `getDocuments`, `getDiscussions`, ...) defined but historically never invoked at runtime | grep found no `from '@/lib/db'` / `from '@/lib/db/queries'` / direct-call sites (pre-#255) | HIGH on origin/main; CHANGED by PR #255 (see Section 2) | HOLD -- do NOT remove; #255 made this layer partially live (now imported by a regression test and its literals were just fixed). Re-evaluate as a separate, deliberate decision |
| `src/lib/db/index.ts` | Barrel re-exporting `queries.ts`; itself unreferenced | No importers of the barrel | HIGH (but tied to `queries.ts` decision) | HOLD with `queries.ts`; same coupled decision |
| `src/lib/api/client.ts` | `ApiClient`, `getApiClient()`, `ApiClientError`; only consumer is `polls.ts` | No non-test importers of `@/lib/api` (pre-#255) | HIGH on origin/main; CHANGED by PR #255 (see Section 2) | HOLD -- #255 fixed its literals and a test now imports it. Re-evaluate separately |
| `src/lib/api/polls.ts` | Poll ops (`getPollWithUserVote`, `submitPollVote`, `getRankingPollWithUserVote`, `submitRankingVote`, `getWordcloudResults`, `submitWordcloudWord`); internally calls `getApiClient()` | Zero external runtime callers | HIGH | RECOMMEND removal candidate IF the api/client layer is retired -- but coupled to the client.ts decision below; do not split |
| `src/lib/api/index.ts` | Barrel re-exporting `client` + `polls`; unreferenced | No importers of the barrel | HIGH (tied to client/polls decision) | HOLD with the api layer decision |

### Class C -- Dead exported types

| path | finding | evidence | confidence | recommended action |
|---|---|---|---|---|
| `src/types/api.ts:79-111` | 18 request/response interfaces declared but never instantiated/used: `GetDocumentRequest`, `GetDocumentResponse`, `DeleteDocumentResponse`, `GetTagsRequest`, `GetTagsResponse`, `CreateTagRequest`, `CreateTagResponse`, `GetAnnouncementsRequest`, `GetAnnouncementsResponse`, `GetRegulatorySubmissionsRequest`, `GetRegulatoryAssessmentsRequest`, `GetMatchingDetailRequest`, `GetMatchingDetailResponse`, `RunAssessmentEngineRequest`, `RunAssessmentEngineResponse`, `GetMatrixDataRequest`, `GetMatrixDataResponse` | Appear only in export statements, never at usage sites (orphaned from endpoints that were planned but not implemented) | HIGH | RECOMMEND removal candidate -- but these describe the same planned-API surface that `api/client.ts` + `polls.ts` belong to; bundle the type cleanup with the api-layer decision (Section 2), not before it |
| `src/types/index.ts:130-193` | Re-exports of the dead `api.ts` types | Re-export only; no downstream use | HIGH (tied to `api.ts` decision) | Remove the re-exports in lockstep with `api.ts` cleanup |

### Class D -- Unused dependencies

| path | finding | evidence | confidence | recommended action |
|---|---|---|---|---|
| `package.json:51` (`html2canvas`) | Listed in dependencies; zero imports anywhere (no static, no dynamic) in `src/`, `next.config`, middleware | grep clean across all import forms | HIGH | RECOMMEND removal candidate -- safe, self-contained `npm uninstall html2canvas` PR. Do NOT confuse with `html-to-image` (ALIVE, see Class E) |

### Class E -- Verified ALIVE (do NOT touch -- documented to prevent re-flagging)

| path | finding | evidence | confidence | recommended action |
|---|---|---|---|---|
| `html-to-image` (dep) | ALIVE via dynamic `await import()` in `matrix-map/MatrixMap.tsx` + `bn-rrm/map/SiteMap.tsx` | dynamic-import call sites confirmed | HIGH | KEEP |
| `katex`, `leaflet`, `leaflet.markercluster`, `docx`, `gray-matter`, `tus-js-client`, `jsonwebtoken` | ALIVE; confirmed imports | grep confirmed | HIGH | KEEP |
| `ws`, `better-sqlite3`, `node-pty` | ALIVE; sidecar / dev-only; webpack-externalized per `next.config.ts:18-34` | externals config + `scripts/agentic-os-pty-server.mjs` | HIGH | KEEP -- never remove from deps |
| `src/lib/matrix-options/provenance/types.ts:254-259` (`EvidenceLibraryViewMode`, incl. `'source-leads'`) | `'source-leads'` is dead in UI tabs but LOAD-BEARING for saved-view migration | `coerceViewMode` (`saved-views-sync.ts:65-87`) remaps `'source-leads'` -> `'sources'` for persisted user views | HIGH | KEEP -- removal would break loading of saved views persisted as `'source-leads'` |
| `status-helpers.ts` (6 fns), `provenance/library.ts` `EvidenceLibraryAudit`, `__*_FOR_TEST` helpers | ALIVE; usages confirmed | 15+ usages each / test-dir usage | HIGH | KEEP |

---

## 2. Suggested PR batches (small, reviewable)

Each batch is independently reviewable. Order is least-coupled first.

**Batch 1 -- drop `html2canvas` dependency (lowest risk).**
`npm uninstall html2canvas`; update `package.json` + lockfile only. Self-contained,
no source changes. 4 gates + confirm `html-to-image` untouched.

**Batch 2 -- DEFERRED / FLAGGED: the `api/client.ts` + `api/polls.ts` + `api/index.ts`
data layer and the matching `src/types/api.ts` dead types.**
This was a clean "remove the orphaned api layer + its 18 dead types" batch as of
origin/main. It is NO LONGER a simple removal:

> FLAG -- PR #255 (OPEN, not yet merged) makes this layer PARTIALLY LIVE AGAIN. Its
> diff touches `src/lib/api/client.ts` and `src/lib/db/queries.ts`, fixes their status
> literals (`IN_PROGRESS` | `SUBMITTED` to match the DB CHECK constraint), and ADDS a
> regression test `src/lib/db/__tests__/review-submission-status.test.ts` that IMPORTS
> from this layer (6/6 passing). Removing the layer would now also delete code that #255
> deliberately repaired and a brand-new regression test that exercises it -- which
> collides with the "never delete regression tests" rule. This is a DIFFERENT decision
> than it was pre-#255. Recommended: wait for #255 to merge, then ask the owner whether
> the api/db layer is intended to become live (keep + grow) or is a one-off used only by
> the new test (in which case the test's coverage intent must be preserved/retargeted
> before any removal). Do NOT bundle `queries.ts` / `client.ts` / `polls.ts` / barrels /
> `types/api.ts` into an automated cleanup until this is resolved.

**Batch 3 -- (conditional, only if Batch 2 resolves to "retire the layer") remove
`src/types/api.ts:79-111` dead types + their `src/types/index.ts:130-193` re-exports**,
in lockstep with the api-layer removal so types and code go together. Gate on owner
decision from Batch 2.

No other batches recommended. Class A is clean; Class E is alive.

---

## 3. Explicitly-excluded scopes (and why)

- **engine-v2 (`engine_v2/**`, engine-v2 libs):** out of this lane; a separate
  active workstream. Not swept; not reported.
- **regulatory-review front-end (`src/app/(dashboard)/regulatory-review/**`):** owned
  by a parallel session lane; touching it risks workstream conflict (L0 rule 1.6).
- **`src/middleware.ts`:** Tier-1 protected (auth gating; a change breaks all protected
  routes). Excluded from sweep by instruction.
- **Tests (`**/__tests__/**`, `*.test.ts`):** never swept for deletion. "Never delete
  regression tests" is a standing rule; tests are evidence of intent, not dead code.

---

## 4. What was NOT swept (honest coverage statement)

This sweep was a static reference-count pass over libs, types, and dependencies on the
PR #255 surface plus origin/main. It did NOT cover:

- **API route-handler reachability** (`src/app/api/**/route.ts`): whether each route is
  actually called by a client or is an orphaned endpoint was not analyzed. Route files
  are framework entry points and can be "unreferenced" by grep yet live.
- **CSS / Tailwind:** no unused-class, dead-stylesheet, or `globals.css` rule analysis.
- **`public/` assets inventory:** images, fonts, static files were not inventoried for
  orphans; asset references were only checked within the 5-file PR diff.
- **Dynamic / string-driven / config-driven loading beyond what grep surfaced:** the
  unreferenced-files findings assume no string-built import paths. High confidence, but
  not a runtime-coverage proof.
- **Dead branches inside live files** (e.g., unreachable conditionals): not in scope;
  this was a module/export/dependency sweep, not a per-line liveness audit.

Treat "not swept" as unknown, not as "clean." A follow-up sweep is warranted for route
reachability and `public/` asset inventory before any broader cleanup claim.

---

*Read-only synthesis. No files deleted. Owner approval required per removal. L0:
`C:\Projects\CLAUDE.md` rules 1.4 + 1.10. Generated 2026-06-05.*
