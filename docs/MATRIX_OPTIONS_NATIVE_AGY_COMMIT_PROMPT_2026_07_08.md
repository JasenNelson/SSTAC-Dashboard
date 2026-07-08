# Matrix Options Native AGY Commit Prompt - 2026-07-08

Paste this into a native AGY session rooted at `C:\tmp\sstac-mo-overnight-20260708`.

```text
You are AGY-primary executor for the SSTAC-Dashboard Matrix Options autonomous-run closeout.

Read and follow:
- docs/MATRIX_OPTIONS_AUTONOMOUS_DOCS_PR_MANIFEST_2026_07_08.md
- docs/MATRIX_OPTIONS_CANDIDATE_CODE_PR_MANIFEST_2026_07_08.md
- AGENTS.md

Do not use Claude. Do not ask the owner to run routine git, gh, test, or review commands.

Hard boundaries:
- Do not touch .mcp.json.
- Do not touch supabase/ or any Supabase config/tooling.
- Do not touch src/lib/engine-v2/** or src/app/api/engine-v2/**.
- Do not touch src/data/**.
- Do not mutate catalog values, qa_status, default_status, review statuses, or promotion/demotion data.
- Do not merge PRs.
- Never use git add ., git add -A, or git add -u.

Execution:
1. Verify the worktree base and status.
2. Create the docs-only preservation branch if needed:
   docs/matrix-options-autonomous-run-2026-07-08
3. Stage exactly the 23 docs files listed in docs/MATRIX_OPTIONS_AUTONOMOUS_DOCS_PR_MANIFEST_2026_07_08.md.
4. Verify `git diff --cached --name-only` returns exactly those 23 files and no forbidden paths.
5. Run:
   node scripts/verify/docs-gate.mjs --files <the exact 23 docs files>
6. Commit:
   Document Matrix Options autonomous run status
7. Push and open a PR titled:
   Document Matrix Options autonomous run status
8. Do not include candidate code patches in this docs-only PR.

Then, only after the docs PR exists:
9. Prepare candidate code PRs separately, following docs/MATRIX_OPTIONS_CANDIDATE_CODE_PR_MANIFEST_2026_07_08.md.
10. For the e2e candidate, run the focused Playwright test before committing.
11. For the HC extractor and dioxin probe candidates, run syntax/help/fail-closed checks; run full extraction/probe only if fitz and isolated output are available.

Stop conditions:
- Any command would touch a hard-boundary path.
- Git staged paths differ from the manifest.
- A test/gate fails with a content failure.
- A merge is required.
- You cannot push/open PR due auth/network.
```
