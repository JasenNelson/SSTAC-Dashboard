# Pre-Commit Checklist (Debugging)

This is a lightweight checklist for preparing a safe commit during incident/debug work.

For the full, repo-wide verification process, also see `docs/review-analysis/CODE_CHANGE_VERIFICATION_PROCESS.md`.

---

## 1) Confirm scope + files

- [ ] Identify the **intent** of the change (bugfix vs refactor vs docs-only).
- [ ] List the **files actually changed** (`git status` / `git diff`).
- [ ] If you touched poll-adjacent code, run docs gate to confirm required review:

```bash
npm run docs:gate -- --base origin/main --head HEAD
```

---

## 2) Manual testing (poll systems)

If the change is poll-adjacent, verify **all three** poll systems (single-choice, ranking, wordcloud):

### Single-choice polls
- [ ] Navigate to `/cew-polls/tiered-framework`
- [ ] Enter CEW code (e.g., `CEW2025`)
- [ ] Submit a single-choice response
- [ ] Verify submission succeeds and appears in results

### Ranking polls
- [ ] Navigate to `/cew-polls/prioritization`
- [ ] Enter CEW code (e.g., `CEW2025`)
- [ ] Submit a ranking response
- [ ] Verify submission succeeds and appears in results

### Wordcloud polls
- [ ] Navigate to `/cew-polls/prioritization` (wordcloud question)
- [ ] Enter CEW code (e.g., `CEW2025`)
- [ ] Submit a wordcloud response
- [ ] Verify submission succeeds and appears in results

---

## 3) Quality gates

Run the basics:

```bash
npm run lint
npm run build
```

Optional (but recommended when TypeScript changes are involved):

```bash
npx tsc --noEmit
```

---

## 4) Staging strategy

### Essential code changes

```bash
# Stage only what you intend to ship
# (examples)
# git add src/app/api/...
# git add src/components/...
```

### Documentation (optional)

```bash
git add docs/debugging/
```

### Diagnostic scripts (optional)

```bash
git add scripts/debug/
```

### Do NOT commit (review separately)

- `docs/AGENTS.md` (treat as authoritative; avoid incidental edits)
- `docs/PROJECT_STATUS.md` (avoid treating as canonical)
- Unrelated docs changes elsewhere

---

## 5) Verification before commit

```bash
# Check what will be committed
git diff --cached

# Verify no unexpected changes
git status
```

---

## 6) Commit message template (example)

```text
Fix <area>: <short summary>

- What changed and why
- What was verified (manual + lint/build)
- Any follow-ups or constraints
```

---

## Appendix: Historical example (CEW poll submission fix)

**What actually fixed the issue:**
1. Database: Dropped `poll_votes_user_id_check` constraint
2. Database: Fixed `ranking_votes` RLS policy to use `{public}` role
3. Code: Re-opened polling by restoring `CEWCodeInput` form

**Code changes made (example):**
- `src/app/api/polls/submit/route.ts` - Removed unnecessary logging (reverted)
- `src/components/PollWithResults.tsx` - Removed enhanced error display (reverted)
- `src/components/CEWCodeInput.tsx` - Restored input form (re-opened polling)
