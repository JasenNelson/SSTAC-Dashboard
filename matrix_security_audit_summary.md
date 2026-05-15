# Matrix Options Phase — Security & Logic Audit Summary

**Date:** 2026-05-15
**Auditor:** Claude (Opus 4.7), red-team posture, internal Opus adversarial review (Codex CLI tokens exhausted this session)
**Scope:** Four target files in `C:\Projects\SSTAC-Dashboard`:

- `src/components/TWGReviewPortal.tsx`
- `src/components/DerivationSimulator.tsx`
- `src/app/(dashboard)/admin/matrix-review/page.tsx`
- `src/app/(dashboard)/admin/matrix-review/MatrixReviewClient.tsx`

**Verification anchor:** Live Supabase project `qyrhsieynzfgyuqzznap` was queried for the actual `matrix_reviews` schema, constraints, RLS policies, and the grant set on `get_users_with_emails`. Findings below reflect the verified live state, not the partial repo migrations.

---

## Severity legend

- **CRITICAL** — directly exploitable; ship-blocker.
- **HIGH** — broken under realistic conditions; ship-blocker.
- **MEDIUM** — exploitable under edge conditions OR data-integrity hazard.
- **LOW** — hardening, robustness, UX correctness.

---

## Findings

### CRITICAL-1 — Email enumeration via `get_users_with_emails` RPC (DB-side, OUT OF FILE SCOPE — flagged not fixed)

**Where:** Postgres function `public.get_users_with_emails`.

**Verified state (live DB):**

```text
security_definer: true
grants: {=X/postgres, postgres=X/postgres, anon=X/postgres,
         authenticated=X/postgres, service_role=X/postgres}
```

The function returns `(id, email, created_at, last_sign_in)` for every confirmed user in `auth.users`. With `SECURITY DEFINER` it runs as `postgres` and bypasses RLS on `auth.users`.

The first proacl entry `=X/postgres` is the empty-grantee form, which grants EXECUTE to `PUBLIC` — meaning every role inherits the privilege. The explicit `anon=X/postgres` and `authenticated=X/postgres` entries are **redundant**, not additive; revoking just those two would leave PUBLIC unchanged and the function still callable. The remediation SQL below revokes `PUBLIC` first, which is the load-bearing step.

Since the anon key ships in browser JS, **anyone on the internet** can `POST /rest/v1/rpc/get_users_with_emails` with the public anon key and exfiltrate the full user-email roster.

**Why this is real:** the function is currently called by `page.tsx:52` to label review rows with the submitting user's email. The admin page benefits from it because the page is admin-gated. The grant on the function itself is not.

**Status:** Out of file scope (DB grant change requires migration; not in the four target files).

**Recommended migration:**

```sql
REVOKE EXECUTE ON FUNCTION public.get_users_with_emails() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_users_with_emails() TO service_role;

-- Then add an admin-gated wrapper or move the lookup behind a server action that
-- verifies admin role before invoking the SECURITY DEFINER function via
-- service_role (server-only client).
```

The `twg-synthesis` admin page (`src/app/(dashboard)/admin/twg-synthesis/page.tsx:48`) calls the same RPC and benefits from the same fix.

---

### HIGH-1 — `upsert(..., { onConflict: 'user_id' })` would have crashed at runtime (CAUGHT AND REVERTED before commit)

**Where:** Earlier draft of `TWGReviewPortal.tsx:handleSubmit`. Never landed.

**What happened:** Initial remediation added `onConflict: 'user_id'` to the upsert. Live-DB verification revealed the `matrix_reviews` table has only `PRIMARY KEY (id)` and a FK to `auth.users(id)` — there is no `UNIQUE (user_id)` constraint. PostgREST/Postgres requires the conflict target to be backed by a unique or exclusion index; the upsert would have thrown `42P10: no unique or exclusion constraint matching the ON CONFLICT specification` on every Submit Review click.

**Status:** Reverted to a verified, schema-correct select→update/insert pattern (see HIGH-2 fix).

**Why this matters as a finding:** the repo's `database_schema.sql` does not contain the `matrix_reviews` table at all, so static analysis off the repo cannot tell you whether onConflict is safe. Future audits **must** query the live DB before any `onConflict` is added.

**Recommended migration (separate from this audit):**

```sql
-- Dedupe first (keep the most recently updated row per user):
DELETE FROM matrix_reviews a
USING matrix_reviews b
WHERE a.user_id = b.user_id
  AND a.updated_at < b.updated_at;

ALTER TABLE matrix_reviews
  ADD CONSTRAINT matrix_reviews_user_id_unique UNIQUE (user_id);
```

After adding the unique constraint, the application code can be re-simplified to a single `upsert(..., { onConflict: 'user_id' })` call (a TOCTOU-safe atomic write).

---

### HIGH-2 — Duplicate-row creation on every Submit Review click (FIXED)

**Where:** `TWGReviewPortal.tsx:handleSubmit` (pre-patch lines 49-72).

**Vulnerability:** Original code called `supabase.from('matrix_reviews').upsert({ user_id, ... })` with no `id`. Without `onConflict`, PostgREST's `upsert` falls back to the primary key (`id`) for conflict detection. The client never supplies `id`, so every Submit Review inserts a fresh row — the table accumulates one row per click. The UI banner says "Reviews can be saved and updated at any time. Submitting simply flags your review as ready for author consideration," which clearly intends one row per user.

**Impact:**

- Data integrity: admin view in `MatrixReviewClient` lists every duplicate as a separate review, inflating "Total Reviews" / "Submitted" counts.
- Audit/HITL trail: no way to tell which row is the canonical submission.

**Fix:** Replaced `upsert` with an explicit lookup + branch:

```ts
const { data: existing } = await supabase
  .from('matrix_reviews')
  .select('id')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();

const writeResult = existing
  ? await supabase.from('matrix_reviews')
      .update({ status: 'SUBMITTED', poll_data: {}, comments_data: comments })
      .eq('id', existing.id)
  : await supabase.from('matrix_reviews')
      .insert({ user_id: user.id, status: 'SUBMITTED', poll_data: {}, comments_data: comments });
```

The `update` path deliberately omits `user_id` from the payload — even with RLS USING `auth.uid() = user_id` gating the write, not sending a client-controlled identity column is defense-in-depth.

There is a residual single-user TOCTOU between the SELECT and the INSERT branch. It is mitigated by the new `isSubmitting` button-disable guard (MED-3) and is fully closed by adding `UNIQUE(user_id)` per HIGH-1.

---

### HIGH-3 — Verified-auth check uses `getSession()` instead of `getUser()` (FIXED)

**Where:** `TWGReviewPortal.tsx:handleSubmit` (pre-patch line 51).

**Vulnerability:** `supabase.auth.getSession()` reads from local storage / cookies and **does not** revalidate against the Supabase auth server. The Supabase docs explicitly call this out: use `getUser()` whenever the response will be used to authorize a write. A stale or tampered local cookie can satisfy the `if (!session)` check; the eventual DB write is then gated only by RLS.

**Impact:** Belt-and-suspenders bypass; the RLS WITH CHECK is the real gate, but client-side hardening should still revalidate.

**Fix:** Replaced with `const { data: { user }, error: authError } = await supabase.auth.getUser();` and propagated `authError` into the early-return branch.

---

### HIGH-4 — Likely privilege escalation via `user_roles` policies (DB-side, FLAGGED — verify role binding)

**Where:** `public.user_roles` table policies.

**Verified state:**

```text
"Allow admins to manage"          cmd=ALL    qual=true   with_check=null
"Allow trigger inserts on user_roles"  cmd=INSERT  with_check=true
"Allow system function inserts"   cmd=INSERT  with_check=(auth.uid() IS NULL)
"Allow all authenticated users to read"  cmd=SELECT  qual=true
"Allow admin role management"     cmd=INSERT  with_check=(EXISTS admin row)
```

The `roles` column was not included in the verification query. Postgres RLS policies default to role `public` (all roles) when no `TO` clause is set. If `"Allow admins to manage"` (`cmd=ALL, qual=true, with_check=null`) applies to `public`, every authenticated user can INSERT a row `(user_id=auth.uid(), role='admin')` into `user_roles` and instantly bypass the admin gate in `matrix-review/page.tsx:35` and `twg-synthesis/page.tsx`.

Similarly, `"Allow trigger inserts on user_roles"` with `with_check=true` and no role restriction is an unconditional INSERT door.

**Status:** Cannot confirm exploitability without the `roles` column. Owner must verify.

**Verification query:**

```sql
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'user_roles';
```

If any of the permissive policies (`qual=true` or `with_check=true`) list role `public` or `authenticated`, the admin gate on `matrix-review/page.tsx` is bypassable end-to-end.

---

### CRITICAL-2 — Prototype pollution via tampered localStorage draft (FIXED, ROUND 2)

**Where:** `TWGReviewPortal.tsx` — `useEffect` localStorage restore, `useState` initial value, and `handleCommentChange` setter.

**Vulnerability:** Round-1 patch restored localStorage drafts into a plain `{}` map keyed by user-controlled strings. A draft tampered with key `"__proto__"` and a string value bypassed the round-1 type guard (the value was a string) and assigned to `comments['__proto__']`. Whether or not this mutates `Object.prototype` (depends on engine), it definitely makes every subsequent `comments[anyKey] || ''` lookup walk the prototype chain and return the polluted value, silently shadowing other comments. A malicious co-tenant on the same origin (e.g., via any XSS surface) could plant such a draft and corrupt every reviewer's session.

**Fix:**

- All user-controlled key maps (`comments` state, the restore sanitization map, the disambiguation `counts` and `seen` maps) are now built with `Object.create(null)` via a `makeBareRecord<T>()` helper. Object lookups on null-prototype objects do not walk to `Object.prototype`.
- A `RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype'])` filter is applied at three boundaries: the localStorage restore loop, the `handleCommentChange` setter, and the outbound `buildCommentsPayload()` (so even if a reserved key sneaks through, it never reaches the DB or admin view).
- The localStorage storage key was bumped from `twg-matrix-review-draft-v1` to `-v2` because the internal key scheme changed (heading-text → idx-stable). Old v1 drafts are intentionally discarded on first mount; the v1 keying scheme itself was the attack surface.

**Verification:** New unit test `disambiguates duplicate H2 headings in the payload and rejects prototype-pollution keys` types into a `## __proto__` section and asserts (a) the payload does not contain `"__proto__"`, and (b) `({}).polluted === undefined` (prototype unchanged).

---

### HIGH-5 — Duplicate `## Heading` text silently collapsed two textareas into one comment slot (FIXED, ROUND 2)

**Where:** `TWGReviewPortal.tsx` — `headings` useMemo, `scrollToHeading`, textarea bindings.

**Vulnerability:** Round-1 left `headings: string[]` from the regex. With two `## Conclusions` sections, both textareas keyed `comments['Conclusions']` and the second silently overwrote the first on every keystroke. `scrollToHeading('Conclusions')` matched the first H2 by `textContent`, so the TOC entry for the second section always scrolled to the first. Pure data-loss bug, caught by round-2 adversarial review.

**Fix:**

- `headings` is now `HeadingEntry[]` with stable internal `storageKey: 'h::${idx}'` and a user-facing `displayLabel` that appends `(#n)` only when the heading text is duplicated in the same draft.
- `comments` state is keyed by `storageKey`, not heading text — so two `## Conclusions` sections have independent state.
- `scrollToHeading(idx)` queries `contentRef.current?.querySelectorAll('h2')[idx]`. The ref is now scoped to the MathRenderer wrapper, so the page-chrome H2 (`"Final Master Draft"`) cannot shift indices.
- The outbound DB payload is built by `buildCommentsPayload()` which maps storage keys to display labels (`'Conclusions (#1)'`, `'Conclusions (#2)'`), so the admin view shows distinct, attribution-correct section headers.
- Textarea `placeholder` also uses `h.displayLabel` so duplicate sections are visually distinguishable.

**Verification:** Same new unit test exercises two `## Conclusions` headings; asserts payload contains `'Conclusions (#1)'` and `'Conclusions (#2)'` with the correct independent values.

---

### HIGH-6 — Admin view rendered JSONB via `String(comment)` with no type guard (FIXED, ROUND 2)

**Where:** `MatrixReviewClient.tsx:225-230`.

**Vulnerability:** Round-1 audit classified this LOW and "not fixed," reasoning that the only writer is the patched `handleSubmit` which always sends `Record<string, string>`. Round-2 adversarial review challenged that reasoning: `comments_data` is `jsonb` with no CHECK constraint; any future write path or out-of-band insert (psql, direct REST, a future feature) can land a non-string value. `String({})` rendered as the literal `"[object Object]"` and `String([1,2])` as `"1,2"`. Not exploitable as XSS (React escapes), but a real data-presentation defect at the rendering boundary.

**Fix:**

- New `renderJsonValue(v: unknown): string` helper in `MatrixReviewClient.tsx` returns the string itself for strings, `String(v)` only for primitive number/boolean, `JSON.stringify(v)` for objects/arrays, and the empty string for null/undefined (so the row is dropped, matching the prior `if (!comment) return null` intent).
- `RESERVED_KEYS` filter applied to `Object.entries(review.comments_data)` so a tampered row can't render under the section name `__proto__`.

---

### MEDIUM-1 — `handleSave` lied to the user; did not persist anything (FIXED)

**Where:** `TWGReviewPortal.tsx:handleSave` (pre-patch lines 45-47).

**Vulnerability:** The Save Draft button showed `alert('Progress saved to local storage.')` but performed no write. Reviewers entering long comments and clicking Save lost work on tab close. The amber notice in the UI ("Reviews can be saved and updated at any time") reinforced the false promise.

**Fix:** Save now actually writes the comments map to `localStorage` under key `twg-matrix-review-draft-v1`, and a `useEffect` on mount restores it (with a `typeof v === 'string'` and `slice(0, MAX_CHARS)` sanitization in case the storage was tampered with). On successful Submit, the draft is removed from `localStorage` so the next review starts clean.

The sanitization step also defends against a tampered/oversized payload in localStorage (e.g., a previous session exceeding MAX_CHARS), which would otherwise re-render a textarea with content longer than the maxLength cap.

---

### MEDIUM-2 — `handleCommentChange` only relied on `maxLength` attribute (FIXED)

**Where:** `TWGReviewPortal.tsx:handleCommentChange`.

**Vulnerability:** HTML `maxLength` is enforceable only on typed input; programmatic `value` writes (paste of pre-edited text, dev-tools, accessibility tooling, automation) can exceed `MAX_CHARS`. The setState had no clamp.

**Fix:** Explicit `value.length > MAX_CHARS ? value.slice(0, MAX_CHARS) : value` clamp in the state setter. The server-side cap should still be enforced via a Postgres CHECK constraint or trigger on `comments_data` size — flagged as a follow-up below.

---

### MEDIUM-3 — Double-click race on Submit Review could create duplicate rows (FIXED)

**Where:** `TWGReviewPortal.tsx:handleSubmit`.

**Vulnerability:** Rapid double-click on Submit would launch two parallel `handleSubmit` flows. With the new select→insert/update pattern (HIGH-2), both could SELECT no-row and both INSERT, creating duplicates.

**Fix:** Added `isSubmitting` state, an early-return guard at the top of `handleSubmit`, a `try/finally` to clear the flag, and a `disabled={isSubmitting}` on the Submit button with a "Submitting..." label.

This is the load-bearing mitigation for the single-user TOCTOU until a `UNIQUE(user_id)` constraint lands (HIGH-1).

---

### MEDIUM-4 — `DerivationSimulator` NaN/Infinity propagation (FIXED)

**Where:** `DerivationSimulator.tsx` math `useEffect`, `handleRiskChange`, and three slider `onChange` handlers.

**Vulnerability:**

- All sliders parsed with `parseFloat(e.target.value)` or `parseInt(e.target.value)` (no radix). If a value ever returned `NaN`, every downstream computation propagated `NaN` and `(NaN).toFixed(4)` rendered the literal string `"NaN"` in the hero metric.
- `Math.log10(targetRisk)` would return `-Infinity` if `targetRisk` were 0 or negative; the slider min is `1e-6` so it can't happen via the UI today, but any future programmatic setter could trigger it.
- BSAF and HumanHealth formulas divide by user-controlled values. Sliders mins keep denominators positive today (`lipidFraction >= 1`, `bsafModifier >= 0.1`, `consumptionRate >= 10`), but the math has no explicit zero/negative guard.

**Fix:**

- Output guard: `setCalculatedStandard(Number.isFinite(rawStandard) ? rawStandard.toFixed(4) : '0.0000')`.
- Denominator guards: explicit `denom > 0` and `consumptionRate > 0` branches.
- `logRisk = targetRisk > 0 ? Math.log10(targetRisk) : -6` fallback.
- `handleRiskChange` early-returns on non-finite parsed value and verifies `Math.pow` output is finite and positive before setting state.
- New `handleSliderNumber(setter, fallback, parser?)` helper wraps `parseFloat`/`parseInt(..., 10)` with `Number.isFinite` fallback. Applied to all four numeric sliders (TOC, lipid fraction, BSAF modifier, consumption rate).
- `parseInt(e.target.value)` was missing the radix argument (lint hazard and a real correctness bug on strings starting with `0`); now `parseInt(v, 10)`.

**Threat-vector relevance:** the user's directive called out "zero-division, negative inputs, or React state race conditions during rapid tab switching." Confirmed analysis:

- Zero-division: cannot happen via the current slider UI; guarded anyway for any future input source.
- Negative inputs: cannot happen via the current slider UI (mins are positive); guarded for `targetRisk` against the `Math.log10` edge case.
- React rapid tab-switching race: examined. The `useEffect` is synchronous (no async work), all setState calls are batched, and React 18 commits effects in order. No race exists. Each pathway formula only uses its own state slice, and the effect re-fires when `activePathway` changes, recomputing from current state. **No fix required.** Flagged as a verified non-finding.
- React 18 strict-mode double-invoke of effects in dev mode is benign here because the compute is idempotent (no I/O, no external state mutation).
- ReDoS in `headings` regex `/^##\s+(.*)$/gm`: the pattern has no nested quantifiers and no alternation with overlap; linear in input length. **Not ReDoS-prone.**

---

### LOW-1 — JSONB shape not enforced at the DB boundary (PARTIALLY ADDRESSED, RECOMMENDED MIGRATION)

**Where:** Postgres `matrix_reviews.comments_data` / `poll_data` columns; `MatrixReviewClient.tsx` render path.

**Status:** The application-side render guard was promoted to HIGH-6 and fixed in round 2. The DB-side CHECK constraints below are still recommended so corrupt rows can never be written in the first place.

**Recommended migration (optional):**

```sql
ALTER TABLE matrix_reviews
  ADD CONSTRAINT matrix_reviews_comments_data_is_object
  CHECK (comments_data IS NULL OR jsonb_typeof(comments_data) = 'object');

ALTER TABLE matrix_reviews
  ADD CONSTRAINT matrix_reviews_poll_data_is_object
  CHECK (poll_data IS NULL OR jsonb_typeof(poll_data) = 'object');

ALTER TABLE matrix_reviews
  ADD CONSTRAINT matrix_reviews_status_enum
  CHECK (status IN ('IN_PROGRESS', 'SUBMITTED'));
```

---

### LOW-2 — `MatrixReviewClient.tsx` declares `user` prop but never uses it (NOT FIXED)

**Where:** `MatrixReviewClient.tsx:27` destructures `{ user: _user, reviews }`. The interface requires `user: User` and `page.tsx:86` passes it.

**Decision:** Not a security issue. Removing the prop touches the parent and the interface. The `_user`-rename pattern signals intent to keep the slot for future use. Left as-is.

---

### LOW-3 — `page.tsx` cookies adapter is `get`-only by design, with a known refresh trade-off (DOCUMENTED, NOT FIXED)

**Analysis:** The cookies adapter only implements `get`. This matches the sibling `twg-synthesis/page.tsx:13-17` pattern. In Next.js 14+ server components, cookies cannot be mutated during render — that is why the adapter only supplies `get`. Token refresh is handled in `middleware.ts:16-21` which does provide `set`/`remove`, running on every dashboard request via the matcher.

**Known trade-off (raised by round-2 adversarial review):** if an access token expires mid-render, `getUser()` cannot persist the rotated refresh token from the server-component path. The middleware refresh on the next navigation will recover the session, but the in-flight `getUser()` may return `null` and the page will `redirect('/login')`. That is the documented behaviour for this Supabase SSR pattern; tightening it would require restructuring page rendering through a `route handler` or `server action` boundary. Not in scope for this audit, and the round-1 "NOT A DEFECT" label has been softened to acknowledge the consequence.

---

### LOW-4 — `for (let el of Array.from(elements))` style (NOT FIXED)

**Where:** `TWGReviewPortal.tsx:scrollToHeading`. `let` should be `const`. Cosmetic.

---

## Files modified

```
src/components/TWGReviewPortal.tsx
src/components/DerivationSimulator.tsx
src/components/__tests__/TWGReviewPortal.test.tsx
src/app/(dashboard)/admin/matrix-review/MatrixReviewClient.tsx   (round 2)
```

## Files audited but not modified

```
src/app/(dashboard)/admin/matrix-review/page.tsx
```

`page.tsx` already uses `getUser()` (verified auth), a proper admin-role check via `user_roles`, and `redirect('/login')` / `redirect('/dashboard')` on failure. The remaining concerns are DB-side (CRITICAL-1, HIGH-4) and the documented `get`-only cookies-adapter trade-off (LOW-3).

---

## Verification

- `npx vitest run src/components/__tests__/TWGReviewPortal.test.tsx` → **4 tests pass** after round 2:
  1. Insert path on first submit (asserts `lookup.eq('user_id', 'test-user-123')`).
  2. Update path on re-submit (asserts payload omits `user_id`, and `update.eq('id', existing_row_id)`).
  3. Rejection when `getUser()` returns no user.
  4. **(New, round 2)** Duplicate H2 headings produce disambiguated payload keys, `__proto__` heading is excluded from the payload, and `Object.prototype` is not mutated.
- `npx tsc --noEmit` → no new errors introduced by these patches (pre-existing `vitest.config.ts` error unrelated).
- Adversarial Opus subagent review, round 1: YELLOW (1 BLOCKER + 4 IMPORTANT + 4 NIT).
- Adversarial Opus subagent review, round 2: pending — to be run against this updated summary plus the round-2 patches before the loop terminates per the standing `feedback_codex_review_loop` rule.

---

## Adversarial review trail

Codex CLI tokens were exhausted this session, so the pre-commit gate was run via an internal Claude Opus adversarial subagent per the standing `feedback_codex_unavailable_fallback` rule. The subagent's findings and the dispositions appear in the session transcript.

---

## DB-side follow-ups for the owner (out of file scope, ranked)

1. **CRITICAL-1** — `REVOKE EXECUTE ON FUNCTION get_users_with_emails FROM PUBLIC, anon, authenticated;` and gate it behind a server action.
2. **HIGH-4** — Verify the `roles` column on every `user_roles` policy; tighten any `qual=true`/`with_check=true` policy to admin-only.
3. **HIGH-1 follow-up** — Dedupe existing duplicate matrix_reviews rows, then add `UNIQUE(user_id)` so the app can revert to single-call upsert.
4. **LOW-1** — Add CHECK constraints for `comments_data`/`poll_data` jsonb shape and `status` enum.
