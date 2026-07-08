# Matrix Options Autonomous Closeout - 2026-07-08

## Verdict

Substantial autonomous progress was made, but no commit or PR was created from this Codex sandbox.

Reason: the safe worktree lives under `C:\tmp`, but its git index is owned by
`C:\Projects\SSTAC-Dashboard\.git\worktrees\...`; sandbox writes to that index are denied. The owner explicitly
does not want repeated approval prompts, so the correct behavior is to stop before commit/push and leave the
work in a native-AGY-ready state.

## Worktree

```text
C:\tmp\sstac-mo-overnight-20260708
```

Baseline:

```text
3285998
```

## Ready Docs Preservation PR

Use the manifest:

```text
docs/MATRIX_OPTIONS_AUTONOMOUS_DOCS_PR_MANIFEST_2026_07_08.md
```

It stages only Matrix Options autonomous-run docs plus `docs/_meta/docs-manifest.json`.

Useful included packets:

- #545 readiness packet.
- Phase C source preflight.
- Backlog execution map.
- Organomercury decision packet.
- PCB alias packet.
- Cyanide speciation packet.
- Inhalation schema packet.
- Ontario MECP ingestion packet.
- UI/runtime backlog packet.
- HC TRV helper and extractor portability packets.
- Native AGY execution and commit prompts.

Verification performed in Codex sandbox:

- Generated docs: ASCII-clean.
- Added manifest lines: ASCII-clean.
- `git diff --check`: passed.
- Forbidden path status check: no changes under `.mcp.json`, `supabase/`, `src/lib/engine-v2/`,
  `src/app/api/engine-v2/`, `src/data/`, or `matrix_research/reference_catalog/`.

## Candidate Code PRs

Do not bundle these with the docs PR.

### Candidate 1 - E2E auth visibility

File:

```text
e2e/matrix-options.spec.ts
```

Status: candidate only.

Reason: adds a simple assertion that `/matrix-options` either redirects to `/login` or shows Matrix Options.
This is safe conceptually, but the focused Playwright run did not execute in this worktree because
`node_modules` is absent. Run the focused e2e check before commit.

### Candidate 2 - HC TRV extractor portability

Files:

```text
scripts/matrix-options/hc_trv_v4_extract.py
scripts/matrix-options/hc_trv_v4_table4_devito_tef_extract.py
```

Status: good candidate for a narrow tooling PR.

Verified in Codex sandbox:

- `git diff --check`: passed.
- in-memory Python compile: passed.
- `--help`: passed for both scripts.
- missing `--pdf-path`: fail-closed with explicit path error.

Additional recommended check before commit:

- run extraction with the real HC TRV PDF in an environment with PyMuPDF installed, or explicitly accept this as
  a portability-only patch verified by syntax/help/fail-closed checks.

### Candidate 3 - Dioxin TDI probe portability

File:

```text
scripts/matrix-options/probe_dioxin_tdi.py
```

Status: good candidate for a narrow tooling PR, or bundle with Candidate 2 if review scope stays tooling-only.

Verified in Codex sandbox:

- `git diff --check`: passed.
- in-memory Python compile: passed.
- `--help`: passed.
- missing `--pdf-path`: fail-closed with explicit path error.
- not-a-file `--pdf-path C:\tmp`: fail-closed with explicit file-type error.

## PR #545

#545 remains the priority owner action from the Matrix Options lane. The readiness packet indicates it is
merge-ready based on local PR worktree evidence:

```text
docs/MATRIX_OPTIONS_PR545_READINESS_2026_07_08.md
```

This sandbox did not perform a fresh GitHub state refresh because network access is restricted. Refresh PR state
from native AGY or an unrestricted shell before merge.

## Organomercury

Do not implement yet.

`phenylmercuric_acetate` has approved IRIS RfD rows and the owner-approved `organomercury` class direction, but
the selectable library entry also needs `abs_dermal`. That value is load-bearing in direct-contact math and was
left as TBD in older decision docs. See:

```text
docs/MATRIX_OPTIONS_ORGANOMERCURY_PACKET_2026_07_08.md
```

## Native AGY Route

Use this prompt from a native AGY session:

```text
docs/MATRIX_OPTIONS_NATIVE_AGY_COMMIT_PROMPT_2026_07_08.md
```

That path avoids Codex sandbox index-write restrictions and should not require the repeated approval prompts
that occurred here.

## Not Touched

- Supabase.
- Gate2B.
- engine-v2.
- `.mcp.json`.
- catalogs and review/default statuses.
- PR merges.
- primary checkout dirty files.

## Next Recommended Action

1. Native AGY creates the docs-only preservation PR from the manifest.
2. Owner merges #545 if still green.
3. Native AGY or Codex prepares the HC TRV/probe portability tooling PR after the focused checks above.
4. Owner decides `phenylmercuric_acetate` `abs_dermal`; then organomercury can become a small code-only PR.

Claude-token spend risk for next step: low if native AGY executes the manifest; medium if Codex sandbox is used
again because staging/push may re-trigger approvals.

AGY delegation opportunity: yes. Native AGY is the correct executor for the docs preservation PR and candidate
tooling PRs.
