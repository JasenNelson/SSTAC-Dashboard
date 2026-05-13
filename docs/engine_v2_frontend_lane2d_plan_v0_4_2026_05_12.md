# engine_v2 frontend Lane 2d (v1 feature port, corrected framing) plan v0.5 -- 2026-05-12

Status: REVISED for adversarial-review Round 2 outcomes. v0.5 addresses 3
BLOCKERs and 6 IMPORTANTs surfaced by the v0.4 review. The framing
correction from v0.3 -> v0.4 stands unchanged; v0.5 is implementation-
surface accuracy and a small reshuffle of phase boundaries.

## v0.4 -> v0.5 changes (round-2 review)

**BLOCKERs fixed:**

- **BLOCKER 1 -- indexer wiring relocated.** Phase B's indexer was wired
  into `src/app/api/engine-v2/projects/[id]/evaluate/route.ts`, but that
  route spawns a detached Python process and returns 200 immediately with
  status='running'. It has NO completion path. Completion is detected by
  `src/app/api/engine-v2/projects/[id]/evaluation-status/route.ts` (POST,
  polled by client) which calls `importEvalResult` on terminal-transition.
  Phase B allowlist now edits `src/lib/engine-v2/eval_result_import.ts`
  (the indexer is invoked from inside `importEvalResult` after the
  per-policy results land); evaluation-status route is the trigger
  surface and gets a single one-line edit only if needed. ED-2d4-13,
  Phase B EXIT GATE, and Phase B smoke instructions updated.

- **BLOCKER 2 -- `searchPolicies` signature + sync/async fixed.** v0.4
  cited `policy_kb.searchPolicies(query, 3)`; actual signature is
  `searchPolicies(rawQuery: string, options: SearchPoliciesOptions = {})`
  and is synchronous. v0.5 specifies the call as
  `policy_kb.searchPolicies(query, { limit: 3 })` and declares
  `retrievePolicyMatches` SYNCHRONOUS to match the underlying. The
  chat retrieval contract becomes:
  `retrieveSubmissionChunks` is `async` (Supabase),
  `retrievePolicyMatches` is sync (better-sqlite3), and the route awaits
  the former while calling the latter directly.

- **BLOCKER 3 -- chunk_id alignment claim corrected.** v0.4 ED-2d4-6
  asserted alignment to `evidence_slices.evidence_slice_id`. Reality
  (`src/lib/engine-v2/evidence_slices.ts:10-25`): the slice map is keyed
  by `evidence_item_id` (the dict key, always present); the inner
  `source.chunk_id` field is `string | null` -- explicitly nullable.
  v0.5 uses the slice-map KEY (`evidence_item_id`) as the primary
  identifier on `v2_submission_chunks` and the join key for
  `v2_chunk_policy_citations`. `source.chunk_id` is stored as optional
  metadata for cross-reference but is NOT the join key. Migration column
  renamed `chunk_id` -> `evidence_item_id`; nullable `source_chunk_id`
  column added for the optional engine cross-reference. ED-2d4-6, both
  migrations, indexer, inverse-index population, and Phase E linking
  semantics all updated.

**IMPORTANTs addressed:**

- **IMPORTANT 1 -- Phase A context provider explicit.** Added
  `src/components/engine-v2/side-panel/SidePanelContext.tsx` to Phase A's
  NEW files allowlist as the stable contract Phase E reaches into for
  `pendingHighlight` state. Phase A file count rises from 10 to 11.

- **IMPORTANT 2 -- Phase C / D parallelization corrected.**
  `submission_search.ts` was in both Phase C and Phase D's surface; v0.5
  moves it to Phase B (shipped alongside the migration + indexer) so
  Phase C (UI) and Phase D (chat retrieval) both import the shared lib
  rather than duplicating tsvector query code. Phase D is now SEQUENTIAL
  after Phase C because both edit child files of the side-panel tree and
  the orchestrator must single-thread the AskAiTab vs SubmissionSearchTab
  mount adjustments. Parallelization section + per-phase sequencing
  updated.

- **IMPORTANT 3 -- indexer error surfacing.** v0.4's "indexer failure is
  logged but non-blocking" produced a silent failure mode that's
  indistinguishable from a real empty-result state. v0.5 adds an
  `indexing_status` side table `v2_submission_chunks_indexing_status
  (evaluation_id PK, status, error_message, started_at, completed_at)`.
  UI renders "Search unavailable: indexing failed (retry)" CTA when
  status='error'; SubmissionSearchTab + AskAiTab both honor it. Phase B
  acceptance criteria + Phase C/D UI behavior updated.

- **IMPORTANT 4 -- `/api/tags` caching.** Added a 30-second TTL
  in-memory cache for the Ollama tags probe in a new helper
  `src/lib/engine-v2/ollama_tags_cache.ts` (Phase D allowlist). Chat
  route + chat/models route both consume the cache, eliminating
  per-request tags probes under heavy use. ED-2d4-3 updated.

- **IMPORTANT 5 -- output passthrough regression guard.** Added a
  Phase D test that stubs the Ollama response to contain a procedural
  phrase ("this requires SDM determination") and asserts the SSE delta
  stream passes it through unchanged. Proves no banned-phrase
  post-filter exists. Test name pinned. Phase D acceptance criteria
  updated.

- **IMPORTANT 6 -- Phase B logging wording fixed.** Reworded the
  codex pre-emption item from "No PII / source-text logging beyond
  chunk_id + counts" to clarify that source text legitimately lives in
  `v2_submission_chunks.content` by design; the prohibition is against
  echoing content fields into application logs / stderr / telemetry.

**MINORs addressed:**

- **MINOR -- `gemma4:e4b` tag string.** Owner has previously confirmed
  this exact tag string in `ollama ps` output. v0.5 retains it as the
  fast-mode default. If the owner's local tag string drifts in a future
  Ollama release, `chat-model-registry.ts` is owner-editable.

- **MINOR -- keyword list shown in full.** Phase B section now lists
  the full proposed `indigenous_flagged` keyword set explicitly
  (`submission_indigenous_keywords.ts` body), not just the omission of
  `consent`.

- **MINOR -- length.** v0.5 retains the "Owner directive" + framing
  sections in-line; subagents read the plan before implementation, so
  the framing context is load-bearing. If subagent context budget
  pressure surfaces, a v0.6 appendix-extraction pass can collapse those
  sections.

---

Original v0.4 status (preserved for context):

Status: DRAFT for adversarial review. SUPERSEDES v0.3
(`docs/engine_v2_frontend_lane2d_plan_2026_05_13.md`) framing entirely. The
delta is not a bugfix on v0.3 -- it is a re-architecture of the AI surface
to match the owner's standing rule (memory anchor
`feedback_no_tier_judgment_for_ai`, 2026-05-12): the AI in engine_v2 is an
**evidence-finder for the human reviewer**, not a tier-judge. v0.3 baked
tier-based AI gatekeeping (Indigenous hard-stop, TIER_2/3 prompt rules,
banned-phrase classifier on chat output) into the chat assistant. v0.4
removes all of it. Tier judgments stay where they belong: in HITL hands,
backed by Lane 2b DB triggers and tier-aware human gates routing TIER_2 to
QP and TIER_3 to SDM. The AI helps reviewers find and synthesize evidence;
it does not refuse, redact, or auto-classify.

v0.3 -> v0.4 changes (re-architecture, not adjustments):

- **Framing correction (highest authority).** AI scope is strictly
  evidence-finding plus relevance/priority filtering via embeddings,
  metadata, and graph structure. AI does NOT think about tiers. Source:
  owner directive 2026-05-12, captured verbatim in this plan's
  "Owner directive" section. Memory anchor
  `feedback_no_tier_judgment_for_ai` is the standing rule; v0.4 enforces it.
- **Removed: Indigenous keyword hard-stop in chat.** No `detectIndigenousContent`
  -> `INDIGENOUS_HARD_STOP` short-circuit on the chat route. Indigenous
  content surfaces as evidence like any other pathway-relevant technical
  content (Indigenous uses of media -- traditional gardens, hunting,
  fishing, medicines -- are real exposure pathways for contaminated
  sites). The UI renders a neutral content-type metadata badge
  ("Indigenous uses content") to help the reviewer spot relevant
  pathway evidence faster. The AI does not refuse, redact, or speak in
  procedural / consultation language. Section 35 / DRIPA / Honour of
  the Crown procedural considerations are HITL + in-person consultation
  scope, not this app's scope.
- **Removed: TIER_2 / TIER_3 prompt rules and banned-phrase classifier on
  chat output.** No more "you must not say adequate" or "you must not
  analyze TIER_3" prompt language. Two simple mode-prompt scaffolds
  (fast, thinking) establish evidence-finder scope. Owner can edit the
  scaffolds in `chat-prompts.ts` without a code refactor.
- **Removed: history-rotation Indigenous detector.** Was a v0.3
  defense-in-depth around the now-removed hard-stop. Not needed.
- **Replaced: Module shape.** L2d-1 (policy search) is RELOCATED from the
  project-detail page into a tertiary tab inside a new side panel on the
  evaluation page. The side panel hosts three tabs: Ask AI, Search
  submission, Search policies. New phases A-E supersede v0.3 modules
  L2d-1/2/3.
- **Added: Submission FTS surface.** New `v2_submission_chunks` Supabase
  Postgres table (tsvector + GIN index) populated at extraction/evaluation
  completion. Indigenous-content metadata flag is computed deterministically
  at INSERT time and rendered as a UI badge; it does not change AI behavior.
- **Added: Bidirectional citation linking.** New `v2_chunk_policy_citations`
  inverse-index table joins evaluation evidence_packet entries back to the
  submission chunks they cite, so search results can show
  "policies citing this chunk".
- **Added: Two-mode chat (fast / thinking).** Mode-to-model registry plus
  mode-to-prompt mapping; user-editable scaffolding files. Defaults
  selected for clean VRAM fit on the owner's local Ollama instance:
  `gemma4:e4b` (~3-4 GB) for fast, `qwen2.5:14b-instruct-q4_K_M`
  (~11 GB) for thinking. `gemma4:26b` is intentionally NOT recommended
  because it spills to CPU and runs slowly. Fast-mode alternatives noted
  for owner reference: `qwen3.5:9b` (~6 GB), `mistral-nemo:latest`
  (~7 GB). Registry degrades gracefully via the `/api/tags` discovery
  probe.
- **Removed: docx / CSV / MD / HTML multi-format export from this lane.**
  Lane 2b's `ExportMemoButton` remains the canonical document-of-record
  path. Lightweight ad-hoc exports are not part of the v0.4 surface.
  Track in Lane 2e backlog if owner asks.
- **Removed: chat audit logging (`v2_chat_logs`).** Confirmed PARKED per
  owner Q2 lock from v0.3. Chat is reviewer scratchpad, not regulatory
  record. Revisit in Lane 2e if needed.
- **Locale-locked dates** continue via inline `toLocaleString('en-US', ...)`
  per ED-2d4 EDs below (carrying ED-2d-10 spirit from v0.3).

---

## Owner directive (verbatim, 2026-05-12, HIGHEST AUTHORITY)

"AI doesn't need to think about tiers 1,2,3 - that's for the HITL to use
professional judgment and legal discretion, not the AI. This AI-assisted
system is supposed to find ALL relevant evidence from submission content
and provide that to the HITL for judgment. The AI-assisted system also
help the HITL with a synthesis based on objective relevant evidence. The
main time when the AI uses some form of decision making is related to
relevance and priority since there's too much information so filters are
needed to understand what and how much evidence should go to the HITL, so
we're heavily relying on embeddings, metadata, and graph architecture to
help in this to reduce the probabilistic reasoning and rely more on
pattern matching and semantic similarity."

Implications for the v0.4 chat surface:

1. The AI surfaces evidence with verbatim citations.
2. The HITL judges adequacy, compliance, sufficiency, and tier.
3. The AI does NOT auto-classify, auto-elevate, or auto-redact based on
   regulatory keywords.
4. Indigenous content surfaces as technically relevant pathway evidence
   like any other pathway content. Indigenous uses of media
   (traditional gardens, hunting, fishing, medicines, etc.) are real
   exposure pathways for contaminated sites; the AI treats them as
   routine pathway-relevant content. A neutral UI metadata badge
   ("Indigenous uses content") helps the reviewer spot pathway-relevant
   content faster. The AI never speaks in procedural / consultation /
   regulatory-restraint language; those considerations are HITL +
   in-person consultation scope, explicitly out of this app's scope.
5. System prompts are user-editable scaffolding, not hardcoded final
   regulatory voice. Owner supplies the final voice later by editing
   `chat-prompts.ts`.

---

## Lane 2d v0.4 architecture

### Top-level layout

A right-side collapsible side panel mounts on
`src/app/(dashboard)/dashboard/engine-v2/[projectId]/evaluation/[evalId]/page.tsx`.
Three tabs, priority order:

1. **Ask AI.** Fast / thinking mode selector. SSE streaming. Submission-
   scoped RAG (with policy KB retrieval as a secondary axis when the
   question mentions a policy ID or fires the policy keyword retriever).
   Verbatim chunk citations clickable to peek panel and per-policy row
   highlight.
2. **Search submission.** FTS over `v2_submission_chunks` (Postgres
   tsvector + GIN). Result snippets with section/page breadcrumbs,
   Indigenous-content metadata badge, and a "policies citing this"
   inverse-index badge.
3. **Search policies.** Houses the existing `PolicySearchPanel` component
   (relocated from the project-detail page). Demoted to tertiary tab
   because Ask AI plus Search submission are the higher-value
   reviewer-facing surfaces.

### Side-panel shell

- Collapsed: thin vertical rail on the right edge of the evaluation page
  with a "Search and Ask" label, a magnifier icon, and a chat icon
  (icons + label, never icon-only per accessibility guideline).
- Expanded: resizable split pane. Default ~35% of viewport width. Drag
  handle on the left edge of the panel. Min width 320px, max 60% of
  viewport. On viewports narrower than 1200px (e.g., laptop secondary
  monitors), falls back to a full-height drawer overlay instead of a
  split-pane reflow.
- Keyboard: Cmd+K (Ctrl+K on Windows) opens the panel and focuses the
  omni-input on the active tab. Cmd+J (Ctrl+J on Windows) toggles open/
  closed. Esc closes the panel without dismounting (state preserved).
- Tab navigation: arrow keys between tabs when the tab strip has focus.
  `role="tablist"` / `role="tab"` / `aria-selected` / `aria-expanded` on
  the collapse toggle. Labels (not icon-only) for screen readers.
- Persistent state per (user, evaluation_id) in `localStorage`:
  - `open` (boolean)
  - `activeTab` (`ask` | `search-sub` | `search-pol`)
  - `lastQueryPerTab` (record of last query string per tab)
  - `width` (global, not per evaluation)
  - `chatMode` (`fast` | `thinking`, per evaluation)

### Two-mode chat (Ask AI)

Both modes route through one SSE endpoint with a query-param mode
selector. The mode picks the system prompt and the model. Both selections
live in user-editable scaffolding files; no code refactor is required for
prompt iteration.

**Fast mode (default).**

- Default model: `gemma4:e4b` (~3-4 GB VRAM; "effective 4B"; small,
  fast, fits owner's Ollama instance without CPU spill; already
  loaded). Alternatives for owner reference: `qwen3.5:9b` (~6 GB),
  `mistral-nemo:latest` (~7 GB).
- NOT recommended: `gemma4:26b` -- spills to CPU and runs slowly.
- Temperature: 0.3.
- System prompt skeleton (in `chat-prompts.ts`, owner-editable):
  "You are an evidence-finder for the human reviewer. Find and cite
  relevant chunks from the structured submission to support the
  reviewer's professional judgment. Be terse. Verbatim citations only
  (chunk_id, section, page). Surface Indigenous-uses content
  (traditional gardens, hunting, fishing, medicines, and similar) as
  technically relevant evidence for contamination pathway assessment,
  like any other pathway evidence. Never propose adequacy, compliance,
  or regulatory determinations -- the reviewer holds those. Never speak
  in procedural / consultation language; that scope belongs to the
  reviewer and the in-person consultation process."

**Thinking mode (opt-in).**

- Default model: `qwen2.5:14b-instruct-q4_K_M` (~11 GB VRAM; proven on
  engine S4 path; fits VRAM cleanly; already loaded).
- NOT recommended: `gemma4:26b` -- spills to CPU and runs slowly.
- Temperature: 0.5.
- System prompt skeleton (in `chat-prompts.ts`, owner-editable):
  "You are a synthesis assistant for the human reviewer. Find evidence
  in the structured submission, then synthesize across cited chunks to
  help the reviewer see relationships between pathway-relevant
  content. Be thorough. Verbatim citations only (chunk_id, section,
  page). Surface Indigenous-uses content (traditional gardens, hunting,
  fishing, medicines, and similar) as technically relevant pathway
  evidence, like any other pathway evidence. Never propose adequacy,
  compliance, or regulatory determinations -- the reviewer holds
  those. Never speak in procedural / consultation language; that scope
  belongs to the reviewer and the in-person consultation process."

**Mode selector.** Segmented control in the chat UI ("Fast" / "Thinking"),
persisted in `localStorage` per evaluation.

**No tier rules.** Neither prompt contains "you must not say adequate" /
"TIER_2 cannot..." / "Indigenous matters require SDM" / "I cannot provide
analysis" rules. Reviewer-facing context comes from the cited chunks plus
the UI metadata flags rendered in the chat citation list.

**System prompts source of truth:** `src/lib/engine-v2/chat-prompts.ts`
exports named string constants `FAST_MODE_PROMPT` and `THINKING_MODE_PROMPT`.
Owner edits the file directly. The chat route imports these by name and
includes them as the first `system` message.

**Model selection source of truth:** `src/lib/engine-v2/chat-model-registry.ts`
exports `MODE_TO_MODEL` as a plain object:

```ts
export const MODE_TO_MODEL = {
  fast: {
    default: 'gemma4:e4b',
    fallbacks: ['qwen3.5:9b', 'mistral-nemo:latest'],
    temperature: 0.3,
  },
  thinking: {
    default: 'qwen2.5:14b-instruct-q4_K_M',
    fallbacks: ['qwen3.5:9b', 'mistral-nemo:latest'],
    temperature: 0.5,
  },
} as const;
```

The route's mode resolver: try `default`, then walk `fallbacks` against
the live `/api/tags` list, then surface a clean `error` SSE event if
nothing resolves. Note: `gemma4:26b` is intentionally NOT in any
fallback chain because it spills to CPU and runs slowly on the owner's
hardware. Owner can edit this registry freely; the route resolves at
request time.

### NO tier-based AI safety rails (explicit non-inclusion list)

Items present in v0.3 that v0.4 omits entirely:

- No banned-phrase classifier on chat output (e.g., the
  `s4/banned_phrases.yaml` port).
- No Indigenous keyword detector with hard-stop short-circuit
  (`detectIndigenousContent` + `INDIGENOUS_HARD_STOP`).
- No history-rotation Indigenous detector.
- No TIER_2 / TIER_3 prompt rules in system messages.
- No refusal logic ("I cannot provide analysis on this topic").
- No "No PASS for TIER_2" / "Adequacy=null for TIER_3" output filter.

Indigenous content surfaces as evidence like any other pathway-relevant
content. Indigenous uses of media (traditional gardens, hunting, fishing,
medicines, and similar) are real exposure pathways for contaminated
sites; the AI treats them as routine pathway-relevant technical content.
The UI renders a neutral content-type metadata badge ("Indigenous uses
content") next to flagged chunks to help the reviewer spot
pathway-relevant content faster. The badge is a content-type signal,
NOT a procedural gate. Additional regulatory / consultation / SDM
considerations exist but are explicitly out of this app's scope -- the
HITL plus the in-person Indigenous consultation process handle those.

The constitutional protection of TIER_2 / TIER_3 is preserved at the
HITL judgment write path: Lane 2b's `v2_judgments` DB CHECK
constraint already enforces tier-verdict compatibility (TIER_2 cannot
write ADEQUATE; TIER_3 can only write OBSERVATION_ONLY). The AI never
writes a judgment row -- only the HITL does, and that write goes
through the constraint. v0.4 does not weaken this.

### Submission search backend

**Table: `v2_submission_chunks`** (Supabase Postgres):

```
id                 uuid PRIMARY KEY DEFAULT gen_random_uuid()
evaluation_id      uuid NOT NULL REFERENCES v2_evaluations(id) ON DELETE CASCADE
evidence_item_id   text NOT NULL  -- the evidence_slices map KEY (always present)
source_chunk_id    text NULL      -- optional engine-internal cross-reference from EvidenceSliceSource.chunk_id; NOT used as a join key
doc_section        text NOT NULL
page_num           int  NULL
content            text NOT NULL
content_tsv        tsvector NOT NULL
indigenous_flagged boolean NOT NULL DEFAULT false
created_at         timestamptz NOT NULL DEFAULT now()
UNIQUE (evaluation_id, evidence_item_id)
```

Indexes:

- GIN on `content_tsv`.
- B-tree on `(evaluation_id, evidence_item_id)` for ownership probes and
  alignment lookups (this is the join key used by Phase E
  bidirectional linking).
- B-tree on `(evaluation_id, indigenous_flagged)` for badge-filtered
  queries (Lane 2e if needed; included in this migration for
  forward-compatibility).

`content_tsv` is computed at INSERT (generated column or trigger):
`to_tsvector('english', content)`. The migration uses a stored
generated column for stability:

```sql
content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED
```

**`indigenous_flagged` semantics.** Computed at INSERT time by a
deterministic case-insensitive keyword scan over `content`. The keyword
list is the same one previously co-located with
`src/lib/ollama/prompts.ts:INDIGENOUS_KEYWORDS`, EXCEPT that the broad
false-positive-prone token `consent` is omitted (it has too many non-
Indigenous regulatory uses to be useful as a metadata flag). The token
`reconciliation` stays because in regulatory context it is more
narrowly Indigenous-related; if owner reports false positives, drop it
in a follow-up. The keyword list lives in
`src/lib/engine-v2/submission_indigenous_keywords.ts` and is used by
the indexing helper, NOT by the chat route. The chat route never reads
this list.

**Population timing.** Two candidates:

1. At `/api/engine-v2/projects/[id]/extract` completion, after Docling
   chunks land. Pro: chunks available regardless of whether evaluation
   has run. Con: no `evaluation_id` yet -- would require a different
   ownership key.
2. At `/api/engine-v2/projects/[id]/evaluate` completion, after the
   engine emits per-policy results plus the chunks.sqlite snapshot.
   Pro: `evaluation_id` is the natural FK. Con: chat unavailable
   for projects extracted but not evaluated.

v0.4 selects option 2 (evaluate completion). Rationale: chat needs
`evidence_slice_id` alignment with `v2_per_policy_results.evidence_packet`
entries, which only exists after evaluation. Pre-evaluation submission
exploration is a Lane 2e candidate.

**Inverse index table: `v2_chunk_policy_citations`** (Supabase Postgres):

```
evidence_item_id  text NOT NULL  -- joins to v2_submission_chunks (evaluation_id, evidence_item_id)
evaluation_id     uuid NOT NULL REFERENCES v2_evaluations(id) ON DELETE CASCADE
policy_id         text NOT NULL
PRIMARY KEY (evidence_item_id, evaluation_id, policy_id)
```

Populated at evaluation completion (from inside `importEvalResult` --
see BLOCKER-1 wiring) by walking each
`v2_per_policy_results.evidence_packet` entry and collecting the
evidence_item_ids it references. Only submission-side citations count;
policy-text citations (where the AI cited the policy itself, not a
chunk) are excluded. Phase 2.7 corpus-side filter (already in engine_v2
retriever) provides the policy-vs-submission separation.

**Indexing status side table: `v2_submission_chunks_indexing_status`**
(Supabase Postgres; per IMPORTANT 3 round-2 fix):

```
evaluation_id   uuid PRIMARY KEY REFERENCES v2_evaluations(id) ON DELETE CASCADE
status          text NOT NULL CHECK (status IN ('pending','running','complete','error'))
error_message   text NULL
started_at      timestamptz NULL
completed_at    timestamptz NULL
updated_at      timestamptz NOT NULL DEFAULT now()
```

The indexer writes this row on each transition: `pending` -> `running`
when work starts; `complete` on success; `error` with message on
failure. The SubmissionSearchTab and AskAiTab fetch this status when
their tab opens (one cheap row read per evaluation) and render a
disabled state plus a "Search unavailable: indexing failed
(`<error_message>`); retry indexing" CTA when `status='error'`. The
retry CTA calls a new POST `/api/engine-v2/evaluations/[evalId]/reindex`
route that re-runs the indexer (admin-only, CSRF-gated). This
prevents the silent-failure trap that v0.4 had.

### Backend surface (new routes)

All routes: Next.js `runtime = 'nodejs'` (engine and Postgres require it).
All routes: `requireAdminForApi` + `requireLocalEngine` gates. POST routes
additionally call `checkCsrf`. Every route does an ownership probe via a
Supabase JOIN through `v2_evaluations` -> `v2_projects` -> `auth.uid()`
before any data read.

```
GET  /api/engine-v2/evaluations/[evalId]/submission/search?q=...&limit=...
       -> { query, count, results: [{ chunk_id, snippet, section,
                                       page, indigenous_flagged,
                                       cited_by_count }] }

GET  /api/engine-v2/evaluations/[evalId]/submission/chunk/[chunkId]
       -> { chunk_id, section, page, content, indigenous_flagged,
            cited_by: [{ policy_id }] }
       (single chunk verbatim for peek panel)

GET  /api/engine-v2/evaluations/[evalId]/chunk-citations?chunkId=...
       -> { chunk_id, policy_ids: string[] }
       (used by the citation pill hover/click to highlight per-policy rows)

POST /api/engine-v2/evaluations/[evalId]/chat (SSE)
       -> submission-RAG chat with body { mode: 'fast'|'thinking',
                                          query, history? }
          - System prompt loaded from chat-prompts.ts per mode
          - Model selected from chat-model-registry.ts per mode
          - NO banned-phrase post-filter
          - NO Indigenous redaction
          - Emits citation, delta, meta, done, error events

GET  /api/engine-v2/evaluations/[evalId]/chat/models
       -> { fast: { model_id, available }, thinking: {...} }
          (used by the mode selector to grey-out unavailable modes)
```

The chat route reuses retrieval over `v2_submission_chunks` (primary
axis) plus `v2_per_policy_results.evidence_packet` (secondary axis, only
when the query mentions a policy_id pattern or the embeddings axis -- if
present in Lane 2e -- says the question is policy-grounded). For v0.4,
secondary axis is keyword-driven: if `query` matches `/^[A-Z]+[-_][A-Z0-9-_.]+$/`
or contains a known policy_id substring, the route also runs
`policy_kb.searchPolicies(query, 3)` and appends those to citations.

### Component decomposition

```
src/components/engine-v2/side-panel/
  EvaluationSidePanel.tsx          // shell, tab strip, collapse, resize, keymap
  AskAiTab.tsx                     // chat UI + mode selector + omni-input + citations list
  SubmissionSearchTab.tsx          // search input + results + breadcrumbs + Indigenous + cited-by badges
  PolicySearchTab.tsx              // thin wrapper around the relocated PolicySearchPanel
  CitationRenderer.tsx             // shared chunk-citation pill + click handler + keyboard activation
  PeekPanel.tsx                    // chunk detail overlay (right-edge slide-in)
  useSidePanelState.ts             // localStorage state hook (per-eval keys, global width)
  side-panel-keymap.ts             // Cmd+K / Cmd+J / Esc / arrow nav handlers
  __tests__/                       // colocated vitest test files (see per-phase allowlist)

src/lib/engine-v2/
  chat-prompts.ts                  // FAST_MODE_PROMPT, THINKING_MODE_PROMPT (owner-editable)
  chat-model-registry.ts           // MODE_TO_MODEL (owner-editable)
  submission_indigenous_keywords.ts // deterministic keyword list for INSERT-time flag
  submission_search.ts             // ts_rank query builder + ts_headline snippet helper
  chat_retrieval.ts                // shared RAG retriever (submission chunks; policy axis secondary)
  submission_chunks_indexing.ts    // upsert helpers called from evaluate route on completion
  __tests__/                       // colocated vitest test files

supabase/migrations/
  20260513_v2_submission_chunks.sql       // table + indexes + RLS
  20260513_v2_chunk_policy_citations.sql  // inverse index table + RLS
```

`PolicySearchPanel.tsx` is RELOCATED but NOT rewritten. Its props /
behavior survive; only its mount site changes.

### Module breakdown (phases A through E)

| Phase | Scope | File count | Budget |
|---|---|---|---|
| A | Side-panel shell + tab strip + keymap + state hook + SidePanelContext provider + relocate PolicySearchPanel mount from project-detail page into the Search policies tab on the evaluation page | 11 | 3-4h |
| B | Migrations for `v2_submission_chunks` + `v2_chunk_policy_citations` + indexing-status side table; indexer wired into `importEvalResult`; shared `submission_search.ts` lib; reindex route | 10 | 1-1.5d |
| C | Search submission tab: API + UI; consumes Phase B's shared search lib; indexing-status route + UI surface; renders Indigenous and cited-by badges | 8 | 4-5h |
| D | Ask AI tab: SSE chat route + AssistantPanel; mode selector; chat-prompts.ts + chat-model-registry.ts scaffolding; `ollama_tags_cache.ts` (30s TTL); output passthrough regression test; AbortSignal.timeout teardown | 12 | 1d |
| E | Bidirectional citation linking via SidePanelContext: chunk citation in chat or search results scrolls + highlights per-policy row; peek panel shows chunk text + "policies citing this" list | 4 | 4-6h |

Total: ~3 days clock-time with adversarial loops.

---

## Engineering Decisions (cross-cutting)

### ED-2d4-1: AI is evidence-finder, not tier judge

Source: memory anchor `feedback_no_tier_judgment_for_ai` (2026-05-12);
strengthens `feedback_ai_scope_evidence_only` (2026-05-09). The chat
prompts establish evidence-finder scope. No tier rules, no refusal
logic, no auto-classification. Tier protection lives in Lane 2b's DB
CHECK constraint on the judgment write path, not in the chat surface.

### ED-2d4-2: System prompts are user-editable scaffolding

`src/lib/engine-v2/chat-prompts.ts` exports two simple string constants
(`FAST_MODE_PROMPT`, `THINKING_MODE_PROMPT`). Owner edits the file
directly; no code refactor needed for prompt iteration. The chat route
imports them by name. Prompts in this plan are skeletons -- owner
supplies final regulatory voice later.

### ED-2d4-3: Two modes (fast / thinking) via mode->model registry, with cached tags probe

`src/lib/engine-v2/chat-model-registry.ts` exports `MODE_TO_MODEL` as a
plain object (default + fallbacks + temperature per mode). User-editable.
Route resolves at request time against the cached `/api/tags` Ollama
response.

**Tags caching (added in v0.5 per IMPORTANT 4):** v0.4 hit `/api/tags`
on every chat send and every /chat/models GET, which is wasteful under
heavy use. v0.5 adds a 30-second TTL in-memory cache in
`src/lib/engine-v2/ollama_tags_cache.ts`:

```ts
type CachedTags = { tags: string[]; expiresAt: number };
let cached: CachedTags | null = null;

export async function getOllamaTags(): Promise<string[]> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.tags;
  const resp = await fetch(`${getOllamaBaseUrl()}/api/tags`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });
  if (!resp.ok) return cached?.tags ?? [];
  const data = await resp.json();
  const tags = (data.models ?? []).map((m: { name: string }) => m.name);
  cached = { tags, expiresAt: now + 30_000 };
  return tags;
}
```

Both the POST chat route and the GET /chat/models route consume the
cache. Tests stub the helper so cache behavior is verified.

### ED-2d4-4: Indigenous content surfaces with content-type metadata badge

`indigenous_flagged` is a content-type relevance signal (pathway-uses
content: gardens, hunting, fishing, medicines, etc.), computed
deterministically at INSERT time and rendered as a neutral badge
("Indigenous uses content") on chunks in search results, chat
citations, and the peek panel. It is a content-type signal, NOT a
procedural-gate framing. The chat route does not run the Indigenous
detector. The chat prompt does not contain Indigenous procedural
rules (no "SDM required", no "professional judgment required" voice).
Additional regulatory / consultation / SDM considerations are HITL +
in-person consultation scope, explicitly out of this app's scope --
the AI does not speak in procedural / consultation voice. Constitutional
protection remains via Lane 2b's `v2_judgments` CHECK constraint on
TIER_3 (only OBSERVATION_ONLY allowed), which is HITL-write-path, not
AI behavior.

### ED-2d4-5: Submission FTS lives in Supabase Postgres, not chunks.sqlite

`v2_submission_chunks` is a Postgres table with tsvector + GIN. Reasons:

1. Cleaner ownership boundary -- Supabase RLS handles cross-owner
   isolation, matching the rest of the engine_v2 surface.
2. No cross-filesystem coupling -- the chat / search routes do not
   reach into `C:/Projects/Regulatory-Review/engine/data/chunks.sqlite`
   the way Lane 2d v0.3's policy_kb does for `rraa_v3_2.db`.
3. Decouples chat reliability from the engine's chunk store schema.
4. Postgres tsvector handles English content well. Limitation:
   phrase-query support is less elegant than SQLite FTS5
   (`MATCH '"acute toxicity"'` is straightforward in FTS5; in tsvector
   it requires `phraseto_tsquery`). For v0.4 we accept this trade-off
   and document it. Phrase-query enhancement is a Lane 2e candidate.

### ED-2d4-6: Join key is `evidence_item_id` (the slice-map key); `source.chunk_id` is optional metadata

**Corrected in v0.5 per BLOCKER 3.** v0.4 asserted alignment to a
field named `evidence_slice_id`. That field does not exist on
`EvidenceSliceSource`. Reality (`src/lib/engine-v2/evidence_slices.ts`,
lines 10-25):

- `EvidenceSliceMap = Record<string, EvidenceSlice>`. The KEY of the
  map is the identifier the engine uses to reference slices from
  per-policy `evidence_packet` entries. This identifier is the
  `evidence_item_id`. It is ALWAYS present (it is the dict key).
- `EvidenceSliceSource.chunk_id: string | null`. This is the engine's
  internal cross-reference to its chunk store. It is OFTEN NULL.
  Joining on this field would lose a large fraction of evidence.

**v0.5 rule:** `v2_submission_chunks.evidence_item_id` is the join
key. It is populated from the slice-map key during indexing and is
always present. `v2_chunk_policy_citations.evidence_item_id`
references it. Phase E bidirectional linking joins on this key.

`v2_submission_chunks.source_chunk_id` is OPTIONAL metadata,
populated from `source.chunk_id` when present. It is stored for
cross-reference to the engine's internal chunk store but is NOT used
for joining and is NOT used as a deduplication key. UI does not
render it directly.

Phase B test asserts:
- Every evidence_slices entry produces exactly one
  `v2_submission_chunks` row keyed by the map key.
- The inverse-index walks evidence_packet entries and collects
  evidence_item_ids; every collected id resolves to a row in
  `v2_submission_chunks` (no orphan citations).
- A fixture where many slices have `source.chunk_id = null` still
  produces complete linking (proves the v0.4 design would have
  failed).

### ED-2d4-7: Auth and CSRF on every route

`requireAdminForApi` + `requireLocalEngine` on every Lane 2d v0.4 route.
POST routes additionally call `checkCsrf`. Ownership probe via Supabase
JOIN through `v2_evaluations` -> `v2_projects` -> `auth.uid()` before
any read. RLS on the new tables matches Lane 2a/2b RLS posture
(owner-only read; service-role write from the indexer).

### ED-2d4-8: SSE teardown uses AbortSignal.timeout, NOT raw setTimeout

Idle timeout 60s and connect timeout 10s both use `AbortSignal.timeout`.
A single `try/finally` around the reader loop calls `reader.cancel()` +
`controller.close()` on any throw. `request.signal` is propagated to the
Ollama `fetch` so client disconnect cancels upstream. If any
`setTimeout` pattern is introduced, it MUST be paired with a
`clearTimeout` in the happy-stream-complete path -- otherwise timer leaks
on every successful stream. Lane 2d v0.3 carried this ED forward from
the Lane 2c retro; v0.4 retains it.

### ED-2d4-9: localStorage-backed panel state per (user, evaluation_id)

No server state for chat history. The panel persists open/closed,
active tab, last query per tab, chat mode, and global width in
`localStorage`. Per-eval keys are scoped by `evaluation_id`; width is
global. `v2_chat_logs` PARKED per owner Q2 (v0.3 lock); v0.4 retains
PARKED.

### ED-2d4-10: Resizable split pane, drawer fallback under 1200px

Default panel width ~35% of viewport. Drag handle on the left edge.
Min 320px, max 60% of viewport. Below 1200px viewport width, the panel
falls back to a full-height drawer overlay (the main content does not
reflow). Reflow on every viewport-resize tick is expensive; the breakpoint
check fires on a debounced (150ms) ResizeObserver callback. Width is
persisted globally in `localStorage` and applied on mount.

### ED-2d4-11: Plain ASCII everywhere

All TSX, TS, MD, and emitted strings are ASCII-only. No smart quotes, no
em dashes, no unicode arrows. The fixture for the Indigenous keyword
list contains the diacritic-bearing `metis` source token as an explicit
fold-test input; production identifiers stay ASCII.

### ED-2d4-12: Mount contract on evaluation page + SidePanelContext

Phase A is the only phase that adds the side-panel mount to
`src/app/(dashboard)/dashboard/engine-v2/[projectId]/evaluation/[evalId]/page.tsx`
AND the only phase that creates `SidePanelContext.tsx` (the React
context provider that exposes `pendingHighlight`, `setPendingHighlight`,
`openPeek`, `closePeek`, `peekChunk` to descendants). Phases C, D, E
populate the tabs via internal state and CONSUME the context provider
via the `useSidePanel()` hook -- they do NOT edit the evaluation page
again. Phase E specifically depends on the SidePanelContext being in
place from Phase A (BLOCKER-precursor surface). This avoids the
v0.3-style multi-phase contention on a single page file. If a later
phase needs to wire new props on the panel, the orchestrator approves
a single isolated edit; no parallel work crosses that file.

### ED-2d4-13: Indexing is idempotent, surfaces failures, and runs inside `importEvalResult`

**Corrected in v0.5 per BLOCKER 1.** v0.4 stated "the evaluate route's
completion path"; the evaluate route has no completion path -- it
spawns a detached Python process and returns 200 immediately with
status='running'. Completion is detected by the polled
`evaluation-status` route, which calls `importEvalResult` on the
terminal transition. The indexer therefore lives INSIDE
`importEvalResult` (in `src/lib/engine-v2/eval_result_import.ts`),
invoked after the per-policy results land and the evidence_slices map
is parsed.

Idempotency: On re-evaluation of the same project (a new evaluation_id
is created per run), no prior rows exist for that evaluation_id and
the indexer inserts fresh rows in a single transaction. On a retry of
the SAME evaluation_id (e.g., via the reindex CTA from IMPORTANT 3),
the indexer performs `DELETE WHERE evaluation_id = $1` on both
`v2_submission_chunks` and `v2_chunk_policy_citations`, then bulk
INSERTs, all inside one transaction. The status side table is
updated alongside.

Failure surfacing (corrected in v0.5 per IMPORTANT 3): indexer errors
do NOT block the import (so the evaluation result still lands in
`v2_evaluations` + `v2_per_policy_results`), but they DO write
`v2_submission_chunks_indexing_status.status = 'error'` with the
error message. The Search submission and Ask AI tabs read this
status and render an "indexing failed; retry" CTA instead of an
empty result. A POST `/api/engine-v2/evaluations/[evalId]/reindex`
route re-runs the indexer on demand.

### ED-2d4-14: Discovery / accessibility

- Labels, never icon-only, on the collapsed rail and tab strip.
- `aria-expanded` on the collapse toggle, `aria-selected` on the tabs.
- Arrow-key navigation between tabs when the tab strip has focus.
- Cmd+K opens + focuses the omni-input; Esc closes (state preserved).
- First-launch tooltip on the rail is a Lane 2e polish candidate; v0.4
  ships without it.

---

## Phase A: Side-panel shell + tab strip + PolicySearchPanel relocation

### Goal

Build the side-panel chrome (collapse, resize, tabs, keymap, state hook)
and move `PolicySearchPanel` from the project-detail page into the
panel's Search policies tab. No new data wiring. The Ask AI and Search
submission tabs render empty placeholder states. This unblocks
parallel work on Phase B (backend) without touching the dashboard chrome.

### File allowlist (EXCLUSIVE)

- NEW `src/components/engine-v2/side-panel/EvaluationSidePanel.tsx`
- NEW `src/components/engine-v2/side-panel/SidePanelContext.tsx`
  (added in v0.5 per IMPORTANT 1; React context provider exposing
  `{ pendingHighlight, setPendingHighlight, openPeek, closePeek,
  peekChunk }`. This is the stable contract Phase E reaches into; without
  it, Phase E would need to re-edit the evaluation page in violation of
  ED-2d4-12. The provider wraps `EvaluationSidePanel`'s children AND
  is also consumed by the per-policy results table via a hook so the
  highlight propagates cross-pane.)
- NEW `src/components/engine-v2/side-panel/AskAiTab.tsx` (placeholder body)
- NEW `src/components/engine-v2/side-panel/SubmissionSearchTab.tsx` (placeholder body)
- NEW `src/components/engine-v2/side-panel/PolicySearchTab.tsx`
- NEW `src/components/engine-v2/side-panel/useSidePanelState.ts`
- NEW `src/components/engine-v2/side-panel/side-panel-keymap.ts`
- NEW `src/components/engine-v2/side-panel/__tests__/EvaluationSidePanel.test.tsx`
- NEW `src/components/engine-v2/side-panel/__tests__/useSidePanelState.test.ts`
- EDIT `src/app/(dashboard)/dashboard/engine-v2/[projectId]/evaluation/[evalId]/page.tsx`
  (mount `<SidePanelProvider><EvaluationSidePanel evaluationId={evalId}
  projectId={projectId} /></SidePanelProvider>` as a sibling of the
  existing content; document the mount region with a comment per
  ED-2d4-12; this is the ONLY phase that edits this page)
- EDIT `src/app/(dashboard)/dashboard/engine-v2/[projectId]/ProjectDetailClient.tsx`
  (remove the existing `<PolicySearchPanel projectId={...} />` mount; the
  component now lives inside the side panel on the evaluation page)

Total: 11 files.

### Acceptance criteria

- The panel opens via Cmd+K and Cmd+J; closes via Esc; collapses to a
  rail via the collapse button.
- The rail is keyboard-focusable and announces "Search and Ask side
  panel; press Enter to expand" to screen readers.
- Tab strip switches between Ask AI, Search submission, Search
  policies. Arrow keys navigate the tab strip when focused.
- Ask AI and Search submission tabs show clear placeholder copy: "Ask
  AI is coming in Phase D" and "Submission search is coming in
  Phase C", respectively.
- Search policies tab renders the existing PolicySearchPanel; typing
  "arsenic" still returns results (no regression on the L2d-1 API).
- localStorage round-trips: refresh the page, the panel state (open,
  active tab, last query per tab, width) is restored.
- Drawer fallback at viewport < 1200px: the panel is a slide-in
  overlay; the main content does not reflow.
- Project-detail page no longer mounts PolicySearchPanel (verified by
  the smoke test: navigate to the project detail page, confirm the
  panel is gone, navigate to an evaluation, confirm it appears in the
  Search policies tab).

### EXIT GATE (Phase A)

- `npx vitest run src/components/engine-v2/side-panel/__tests__/` GREEN.
- `npx tsc --noEmit` GREEN.
- `npx eslint src/components/engine-v2/side-panel/ src/app/\(dashboard\)/dashboard/engine-v2/` GREEN.
- Manual smoke: load an evaluation page; expand panel; switch tabs;
  type a search in the policies tab; confirm result rendered; refresh
  page; confirm state restored; resize browser below 1200px; confirm
  drawer fallback engages.

### Codex pre-emption checklist (Phase A)

- [ ] No data-fetching on initial mount of Ask AI / Search submission
      tabs (placeholders only).
- [ ] `aria-expanded` on the collapse toggle.
- [ ] `role="tablist"` / `role="tab"` / `aria-selected` on the tab strip.
- [ ] Cmd+K / Cmd+J / Esc handlers attached and detached cleanly
      (no orphan listeners on unmount).
- [ ] `localStorage` reads guarded against `undefined` for SSR; values
      validated with a Zod schema on parse to recover from corrupted
      state.
- [ ] Drawer fallback uses a debounced ResizeObserver (150ms),
      not a per-frame listener.
- [ ] PolicySearchPanel is mounted with the existing `projectId` prop;
      no new prop surface introduced.
- [ ] Plain ASCII in all strings.

---

## Phase B: Submission chunks table + inverse-index table + indexer

### Goal

Land the two new Supabase tables (`v2_submission_chunks` and
`v2_chunk_policy_citations`) with RLS, GIN/B-tree indexes, and a
post-evaluation indexing helper that the `/evaluate` route calls on
completion. Idempotent: re-evaluation replaces prior rows for that
`evaluation_id` inside a transaction.

### File allowlist (EXCLUSIVE)

- NEW `supabase/migrations/20260513_v2_submission_chunks.sql`
- NEW `supabase/migrations/20260513_v2_chunk_policy_citations.sql`
- NEW `supabase/migrations/20260513_v2_submission_chunks_indexing_status.sql`
  (added in v0.5 per IMPORTANT 3; status side table)
- NEW `src/lib/engine-v2/submission_indigenous_keywords.ts`
- NEW `src/lib/engine-v2/submission_chunks_indexing.ts`
- NEW `src/lib/engine-v2/__tests__/submission_chunks_indexing.test.ts`
- NEW `src/lib/engine-v2/submission_search.ts` (moved into Phase B in
  v0.5 per IMPORTANT 2; was originally in Phase C / Phase D; the shared
  tsvector query builder + `ts_headline` snippet helper; both Phase C
  UI and Phase D chat retrieval import from this lib so query semantics
  stay in one place)
- NEW `src/lib/engine-v2/__tests__/submission_search.test.ts` (moved
  into Phase B with the lib)
- NEW `src/app/api/engine-v2/evaluations/[evalId]/reindex/route.ts`
  (added in v0.5 per IMPORTANT 3; POST, admin + CSRF; re-runs the
  indexer on demand for the retry CTA)
- NEW `src/app/api/engine-v2/evaluations/[evalId]/reindex/__tests__/route.test.ts`
- EDIT `src/lib/engine-v2/eval_result_import.ts` (BLOCKER-1 wiring:
  call the indexer at the end of `importEvalResult` AFTER per-policy
  results land and evidence_slices is parsed; non-blocking on indexer
  error; status side table written on every transition; structured-log
  failures without echoing chunk content per IMPORTANT 6)

Total: 10 files.

### Migration shape (illustrative; final SQL produced by implementation phase)

```sql
-- 20260513_v2_submission_chunks.sql
CREATE TABLE v2_submission_chunks (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id      uuid NOT NULL REFERENCES v2_evaluations(id) ON DELETE CASCADE,
  evidence_item_id   text NOT NULL,        -- evidence_slices map key; join key
  source_chunk_id    text NULL,            -- optional engine cross-reference
  doc_section        text NOT NULL,
  page_num           int NULL,
  content            text NOT NULL,
  content_tsv        tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  indigenous_flagged boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evaluation_id, evidence_item_id)
);

CREATE INDEX v2_submission_chunks_tsv_idx ON v2_submission_chunks USING GIN (content_tsv);
CREATE INDEX v2_submission_chunks_eval_item_idx ON v2_submission_chunks (evaluation_id, evidence_item_id);
CREATE INDEX v2_submission_chunks_eval_flag_idx ON v2_submission_chunks (evaluation_id, indigenous_flagged);

ALTER TABLE v2_submission_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY v2_submission_chunks_owner_read
  ON v2_submission_chunks FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM v2_evaluations e
      JOIN v2_projects p ON p.id = e.project_id
      WHERE e.id = v2_submission_chunks.evaluation_id
        AND p.user_id = auth.uid()
    )
  );

-- Service-role writes only; no end-user INSERT/UPDATE/DELETE policy.
```

```sql
-- 20260513_v2_chunk_policy_citations.sql
CREATE TABLE v2_chunk_policy_citations (
  evidence_item_id  text NOT NULL,
  evaluation_id     uuid NOT NULL REFERENCES v2_evaluations(id) ON DELETE CASCADE,
  policy_id         text NOT NULL,
  PRIMARY KEY (evidence_item_id, evaluation_id, policy_id)
);

CREATE INDEX v2_chunk_policy_citations_eval_item_idx
  ON v2_chunk_policy_citations (evaluation_id, evidence_item_id);
CREATE INDEX v2_chunk_policy_citations_eval_policy_idx
  ON v2_chunk_policy_citations (evaluation_id, policy_id);

ALTER TABLE v2_chunk_policy_citations ENABLE ROW LEVEL SECURITY;

CREATE POLICY v2_chunk_policy_citations_owner_read
  ON v2_chunk_policy_citations FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM v2_evaluations e
      JOIN v2_projects p ON p.id = e.project_id
      WHERE e.id = v2_chunk_policy_citations.evaluation_id
        AND p.user_id = auth.uid()
    )
  );
```

```sql
-- 20260513_v2_submission_chunks_indexing_status.sql (per IMPORTANT 3)
CREATE TABLE v2_submission_chunks_indexing_status (
  evaluation_id  uuid PRIMARY KEY REFERENCES v2_evaluations(id) ON DELETE CASCADE,
  status         text NOT NULL CHECK (status IN ('pending','running','complete','error')),
  error_message  text NULL,
  started_at     timestamptz NULL,
  completed_at   timestamptz NULL,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE v2_submission_chunks_indexing_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY v2_submission_chunks_indexing_status_owner_read
  ON v2_submission_chunks_indexing_status FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM v2_evaluations e
      JOIN v2_projects p ON p.id = e.project_id
      WHERE e.id = v2_submission_chunks_indexing_status.evaluation_id
        AND p.user_id = auth.uid()
    )
  );
```

### Acceptance criteria

- All three migrations apply cleanly via `supabase db push` (or
  equivalent on the project's migration tool).
- RLS owner-read policy passes a smoke check on all three tables: a
  non-owner cannot `SELECT` rows for a foreign evaluation_id.
- Indexer is idempotent: running it twice for the same `evaluation_id`
  produces the same row count and content; transactional DELETE +
  bulk INSERT inside one transaction.
- Indexer iterates the evidence_slices MAP and uses the map KEY as
  `evidence_item_id` (always present); `source.chunk_id` (often null)
  is stored as optional `source_chunk_id` metadata only.
- `indigenous_flagged` is set deterministically against the keyword
  list (no false negatives on the test fixture's positive cases; no
  false positives on the test fixture's clearly-not-Indigenous text).
- importEvalResult still returns success even when the indexer throws
  (logged but non-blocking) AND
  `v2_submission_chunks_indexing_status.status = 'error'` is written
  with the error message so the UI can surface the failure.
- Inverse-index `v2_chunk_policy_citations` populated only from
  submission-side evidence_packet entries (no policy-text citations).
- All evidence_item_ids collected from evidence_packet entries
  resolve to a row in `v2_submission_chunks` (no orphan citations).
- Reindex route POST `/api/engine-v2/evaluations/[evalId]/reindex`
  is admin-only, CSRF-gated, and re-runs the indexer cleanly.
- `submission_search.ts` exports `buildSubmissionSearchQuery` and
  `renderSnippet` (shared by Phase C UI route and Phase D chat
  retrieval); both consumers import the same lib.

### Proposed `submission_indigenous_keywords.ts` body

The full keyword list (case-insensitive, deterministic substring match):

```ts
// Content-type relevance signal for the v2_submission_chunks.indigenous_flagged
// flag. This list is owner-editable. It is NOT consumed by the chat route or
// any AI prompt; only the indexer reads it at INSERT time.
//
// Excluded: 'consent' (too many non-Indigenous regulatory uses; high
// false-positive rate). 'reconciliation' is retained; if owner reports
// false-positive noise, drop it in a follow-up.
//
// Note: the diacritic-bearing token is included as a source string for
// the case-fold matcher; production identifiers and log lines stay ASCII.
export const INDIGENOUS_CONTENT_KEYWORDS = [
  'indigenous',
  'first nation',
  'first nations',
  'aboriginal',
  'treaty',
  'metis',
  'metis ',  // ensures word-boundary heuristic
  'inuit',
  'undrip',
  'dripa',
  'section 35',
  'duty to consult',
  'honour of the crown',
  'honor of the crown',
  'traditional territory',
  'traditional use',
  'traditional uses',
  'traditional knowledge',
  'traditional food',
  'traditional medicine',
  'traditional medicines',
  'country food',
  'country foods',
  'tek',
  'reconciliation',
] as const;
```

Owner can edit this file freely. If `tek` produces false positives
(short token), the matcher uses a word-boundary check so it does not
match substrings like `latek`. If `treaty` produces false positives
in non-Indigenous regulatory contexts, drop it in a follow-up; this
is a flag, not a gate, so false positives are conservative.

### EXIT GATE (Phase B)

- `npx vitest run src/lib/engine-v2/__tests__/submission_chunks_indexing.test.ts src/lib/engine-v2/__tests__/submission_search.test.ts src/app/api/engine-v2/evaluations/\[evalId\]/reindex/__tests__/route.test.ts` GREEN.
- `npx tsc --noEmit` GREEN.
- `npx eslint src/lib/engine-v2/submission_chunks_indexing.ts src/lib/engine-v2/submission_indigenous_keywords.ts src/lib/engine-v2/submission_search.ts src/lib/engine-v2/eval_result_import.ts src/app/api/engine-v2/evaluations/\[evalId\]/reindex/route.ts` GREEN.
- Manual smoke: trigger an evaluation; let it complete (status-poll
  fires `importEvalResult`); confirm `v2_submission_chunks` and
  `v2_chunk_policy_citations` rows are present for that
  `evaluation_id`; confirm
  `v2_submission_chunks_indexing_status.status = 'complete'`. Re-trigger
  reindex via the new POST route; confirm row counts stable. Simulate
  an indexer failure (e.g., temporary RLS misconfiguration); confirm
  `importEvalResult` still returns success AND
  `v2_submission_chunks_indexing_status.status = 'error'` with a
  message.

### Codex pre-emption checklist (Phase B)

- [ ] All three migrations include RLS owner-read policy AND
      service-role write access (no end-user INSERT policy).
- [ ] Generated column `content_tsv` uses `STORED`, not `VIRTUAL`
      (GIN index requires STORED on Postgres 12+).
- [ ] Indexer wraps DELETE + INSERT (across all three tables for the
      same evaluation_id) in a single transaction.
- [ ] Indexer uses the evidence_slices map KEY as `evidence_item_id`
      (always present); does NOT depend on `source.chunk_id` (often
      null) for the join key.
- [ ] Indexer wiring is INSIDE `importEvalResult`
      (`src/lib/engine-v2/eval_result_import.ts`), NOT inside the
      evaluate route (which has no completion path).
- [ ] Indexer does not throw into `importEvalResult`'s success path
      (caught + logged; status side table written to 'error' with
      message so UI can surface the failure).
- [ ] `submission_indigenous_keywords.ts` is the ONLY consumer of the
      keyword list (chat route does NOT import it).
- [ ] `consent` is omitted from the keyword list (false-positive risk).
- [ ] Inverse-index population excludes policy-text citations.
- [ ] Bulk INSERT uses `unnest`-style batching or row-set INSERT
      (avoid per-row roundtrips on large submissions).
- [ ] No source-text echoing in application logs / stderr / telemetry.
      Source text legitimately lives in `v2_submission_chunks.content`
      by design (that is the table's purpose); the prohibition is
      against echoing `content` fields into log lines, error messages,
      or metrics payloads. Log only counts, evidence_item_ids, and
      structured status transitions.
- [ ] Reindex route is admin + CSRF gated; ownership probe via JOIN.
- [ ] `submission_search.ts` exports are pure (no DB state); both
      Phase C and Phase D import from this lib without duplicating
      tsvector query code.
- [ ] Plain ASCII in migration comments.

---

## Phase C: Search submission tab

### Goal

Build the Search submission tab consuming Phase B's data. Render result
snippets with section/page breadcrumbs, Indigenous-content metadata
badge, and "policies citing this" inverse-index badge. Click on a
result opens the peek panel.

### File allowlist (EXCLUSIVE)

- NEW `src/app/api/engine-v2/evaluations/[evalId]/submission/search/route.ts`
- NEW `src/app/api/engine-v2/evaluations/[evalId]/submission/search/__tests__/route.test.ts`
- NEW `src/app/api/engine-v2/evaluations/[evalId]/submission/chunk/[chunkId]/route.ts`
- NEW `src/app/api/engine-v2/evaluations/[evalId]/submission/chunk/[chunkId]/__tests__/route.test.ts`
- NEW `src/app/api/engine-v2/evaluations/[evalId]/indexing-status/route.ts`
  (added in v0.5 per IMPORTANT 3; GET; returns the row from
  `v2_submission_chunks_indexing_status` for this evaluation_id)
- NEW `src/app/api/engine-v2/evaluations/[evalId]/indexing-status/__tests__/route.test.ts`

`submission_search.ts` (the shared tsvector query lib) is provided by
Phase B; Phase C imports it. Phase A ships `SubmissionSearchTab.tsx`
with an explicit `TODO(phase-c)` marker and a stable component
contract (props: `{ evaluationId }`). Phase C's allowlist adds an
EDIT entry for that single file:

- EDIT `src/components/engine-v2/side-panel/SubmissionSearchTab.tsx`
  (replace placeholder body with the working UI; consume the indexing
  status route on mount; render "Search unavailable: indexing failed"
  CTA when status='error', with a retry button that calls the
  reindex route)
- NEW `src/components/engine-v2/side-panel/__tests__/SubmissionSearchTab.test.tsx`

Total: 8 files (6 new + 1 edit + 1 new test).

### API flow (GET /api/engine-v2/evaluations/[evalId]/submission/search?q=...&limit=...)

1. `requireAdminForApi` -> 401/403.
2. `requireLocalEngine` -> 503 (note: although the data is in Supabase,
   keeping this guard prevents accidental Vercel exposure of admin
   evaluation surfaces while we converge to a single auth posture).
3. Ownership probe via Supabase JOIN.
4. Parse `q` (>= 2 chars) and `limit` (default 20, max 100).
5. Build `tsquery` from `q` via `plainto_tsquery('english', $q)` (safe,
   bind-parameterized, no injection surface).
6. `SELECT chunk_id, doc_section, page_num,
          ts_headline('english', content, query, 'MaxFragments=2,MaxWords=30') AS snippet,
          indigenous_flagged,
          (SELECT count(*) FROM v2_chunk_policy_citations c
            WHERE c.evaluation_id = chunks.evaluation_id
              AND c.chunk_id = chunks.chunk_id) AS cited_by_count
   FROM v2_submission_chunks chunks
   WHERE evaluation_id = $1 AND content_tsv @@ query
   ORDER BY ts_rank(content_tsv, query) DESC
   LIMIT $2`.
7. Return `{ query, count, results: [...] }`.

### API flow (GET /api/engine-v2/evaluations/[evalId]/submission/chunk/[chunkId])

1. Auth + ownership.
2. Validate `chunkId` against `^[A-Za-z0-9._-]{1,128}$`.
3. SELECT the chunk + joined cited-by list.
4. Return `{ chunk_id, section, page, content, indigenous_flagged, cited_by: [...] }`.

### UI shape (SubmissionSearchTab.tsx)

- Controlled text input + submit button.
- Debounced 250ms; clears on tab switch but preserves last query via
  the panel state hook.
- Results list: snippet (rendered as HTML from `ts_headline`, properly
  sanitized -- only `<mark>` permitted via an allowlist sanitizer);
  section + page breadcrumb; Indigenous badge if flagged; cited-by
  count badge.
- Click result -> open `PeekPanel` (overlay above the side panel)
  with full chunk text.
- ASCII-only.

### Acceptance criteria

- Search "arsenic" against a known evaluation returns at least one hit;
  snippet contains `<mark>` highlighting.
- Indigenous-flagged chunks render the badge.
- Cited-by count matches the inverse-index table for that chunk.
- Peek panel shows verbatim chunk text + policy list.
- Empty query returns 400, not 500.
- Cross-owner evaluation_id returns 404.
- Non-admin returns 403.

### EXIT GATE (Phase C)

- `npx vitest run src/app/api/engine-v2/evaluations/\[evalId\]/submission/ src/lib/engine-v2/__tests__/submission_search.test.ts src/components/engine-v2/side-panel/__tests__/SubmissionSearchTab.test.tsx` GREEN.
- `npx tsc --noEmit` GREEN.
- `npx eslint` on new paths GREEN.
- Manual smoke: open evaluation; switch to Search submission tab;
  query "arsenic"; click result; verify peek panel; verify
  Indigenous badge appears on flagged chunks; verify cited-by count
  matches expectation.

### Codex pre-emption checklist (Phase C)

- [ ] `plainto_tsquery` / `phraseto_tsquery` only -- no raw user input
      into `to_tsquery` (which has dangerous parser semantics).
- [ ] `ts_headline` snippet HTML sanitized with an allowlist that
      permits only `<mark>` -- no other tags rendered.
- [ ] `chunkId` regex-validated before query.
- [ ] Ownership probe runs BEFORE any SELECT on submission chunks.
- [ ] `limit` clamped to [1, 100].
- [ ] Empty/short query returns 400.
- [ ] No `indigenous_flagged` influence on result ordering (badge is
      visual only).
- [ ] Cited-by count is computed in the same query as the main SELECT
      (no N+1 fanout).
- [ ] Plain ASCII strings.

---

## Phase D: Ask AI tab (SSE chat with two modes)

### Goal

Build the SSE chat endpoint and AskAiTab UI. Submission-RAG primary
retrieval over `v2_submission_chunks`; policy-KB secondary axis when
the query looks policy-grounded. Mode selector (fast / thinking) drives
prompt + model selection from the scaffolding files. No tier rules.

### File allowlist (EXCLUSIVE)

- NEW `src/app/api/engine-v2/evaluations/[evalId]/chat/route.ts` (SSE)
- NEW `src/app/api/engine-v2/evaluations/[evalId]/chat/__tests__/route.test.ts`
- NEW `src/app/api/engine-v2/evaluations/[evalId]/chat/models/route.ts`
- NEW `src/app/api/engine-v2/evaluations/[evalId]/chat/models/__tests__/route.test.ts`
- NEW `src/lib/engine-v2/chat-prompts.ts`
- NEW `src/lib/engine-v2/chat-model-registry.ts`
- NEW `src/lib/engine-v2/chat_retrieval.ts`
- NEW `src/lib/engine-v2/__tests__/chat_retrieval.test.ts`
- NEW `src/lib/engine-v2/ollama_tags_cache.ts` (added in v0.5 per
  IMPORTANT 4; 30s TTL in-memory cache for `/api/tags` probe)
- NEW `src/lib/engine-v2/__tests__/ollama_tags_cache.test.ts`
- EDIT `src/components/engine-v2/side-panel/AskAiTab.tsx` (replace
  placeholder body; consume the indexing status route on mount;
  disable submit with the "indexing failed; retry" CTA when
  status='error')
- NEW `src/components/engine-v2/side-panel/__tests__/AskAiTab.test.tsx`

Total: 12 files.

### API flow (POST /api/engine-v2/evaluations/[evalId]/chat)

1. `requireAdminForApi`.
2. `requireLocalEngine` -> 503 with `{ error: 'local_engine_disabled' }`.
3. `checkCsrf` -> 415/403.
4. Zod-strict validate body:
   `{ query: string().min(1).max(4000), mode: enum(['fast','thinking']),
      history: array(history_turn).max(10).optional() }`.
   Extra keys rejected.
5. Ownership probe via JOIN -> 404.
6. Resolve model: call `getOllamaTags()` (cached helper from
   `ollama_tags_cache.ts`; 30s TTL; underlying probe uses
   `AbortSignal.timeout(5000)`); match against `MODE_TO_MODEL[mode]`
   default + fallbacks. If nothing resolves: emit `error` SSE and
   close.
7. Retrieve:
   - Submission axis (primary, async):
     `await chat_retrieval.retrieveSubmissionChunks(evaluationId, query, 6)`
     -- ts_rank-ordered top 6 via the shared `submission_search.ts`
     query builder.
   - Policy axis (secondary, conditional, synchronous): if `query`
     matches `/[A-Z]{2,}[-_][A-Z0-9-_.]{2,}/` (looks like a policy id)
     or `query.length >= 80` (longer queries benefit from policy KB
     anchoring): also call
     `chat_retrieval.retrievePolicyMatches(query, 3)` which internally
     calls `policy_kb.searchPolicies(query, { limit: 3 })` -- the
     existing options-object signature. `searchPolicies` is
     SYNCHRONOUS (better-sqlite3, no Promise). `retrievePolicyMatches`
     is therefore also declared synchronous; the route does NOT
     `await` it. Append to citation list with a `type: 'policy'`
     discriminator.
8. Load system prompt from `chat-prompts.ts` by mode.
9. Build `messages[]`:
   `[ {role:'system', content:FAST|THINKING}, ...history,
      {role:'user', content: contextPrompt(query, citations)} ]`.
10. Emit `citation` SSE events for each retrieved chunk + each retrieved
    policy.
11. POST to `${baseUrl}/api/chat` with `stream: true` and the resolved
    model + temperature; propagate `request.signal` as the fetch
    `signal`.
12. Read NDJSON, emit `delta` SSE events.
13. Emit `meta` (model, mode, retrievalCount, durationMs) + `done`.
14. `try/finally` on the reader loop calls `reader.cancel()` +
    `controller.close()` on any throw.
15. Idle timeout 60s and connect timeout 10s both via
    `AbortSignal.timeout`. NO raw `setTimeout`.

### API flow (GET /api/engine-v2/evaluations/[evalId]/chat/models)

1. Auth + ownership.
2. GET `${baseUrl}/api/tags`.
3. For each mode, resolve `default` against available; if missing, walk
   `fallbacks`.
4. Return `{ fast: { model_id, available }, thinking: { model_id, available } }`.

### chat_retrieval.ts contract

```ts
// Submission axis: async (Supabase fetch).
export async function retrieveSubmissionChunks(
  evaluationId: string,
  query: string,
  limit: number,
): Promise<SubmissionChunkCitation[]>

// Policy axis: SYNCHRONOUS to match the underlying better-sqlite3
// API in policy_kb.ts (see BLOCKER 2 round-2 fix). The route does
// not await this.
export function retrievePolicyMatches(
  query: string,
  limit: number,
): PolicyCitation[]
```

`retrieveSubmissionChunks` is async (Supabase). `retrievePolicyMatches`
internally calls `policy_kb.searchPolicies(query, { limit })` -- the
existing options-object signature -- and returns synchronously. Both
are unit-tested with a fake Supabase client + fake `better-sqlite3`
(already established pattern from Lane 2a/2c).

### AskAiTab.tsx shape

- Mode selector (segmented control: Fast / Thinking).
- Models status row: small `LocalEngineBadge`-style chip per mode
  showing model name + availability dot. Fetched once on mount via
  the chat/models route; refreshes when mode changes.
- Omni-input at bottom; submit on Enter (Shift+Enter for newline).
- Messages list above; user turns right-aligned, assistant turns
  left-aligned with citation pills inline at the cited positions.
- Citation pills: hover shows section+page; click opens peek panel +
  highlights the corresponding per-policy row (Phase E wires the
  highlight).
- Indigenous-flagged citations render a small badge next to the pill.
- Streaming state: visible cursor + cancel button (aborts the fetch,
  signal propagates upstream to Ollama).
- Error state: inline error message; no retry-on-error storm (manual
  resend).
- ASCII-only.

### Acceptance criteria

- Fast mode: query "arsenic exceedance in soil" returns at least one
  `citation` SSE event + non-empty `delta` stream + final `meta` +
  `done`. Latency to first token under ~3s on local mistral-nemo
  (best-effort).
- Thinking mode: same query, different model resolved; response is
  longer and more synthetic.
- Mode change in UI immediately picks up the new prompt + model on the
  next send (no in-flight cross-contamination).
- Indigenous-uses-content citation renders the neutral "Indigenous
  uses content" badge AND the chat proceeds normally (no hard-stop, no
  refusal, no procedural-gate language in the AI response voice).
- **Output passthrough regression guard (added v0.5 per IMPORTANT 5):**
  test stubs the Ollama response NDJSON to contain the phrase
  "this requires SDM determination" and asserts the SSE `delta`
  stream passes it through unchanged (byte-for-byte concatenated
  delta content includes that exact phrase). Test name:
  `chat route does NOT post-filter procedural phrases from Ollama output (regression guard for v0.3 banned-phrase classifier removal)`.
  Proves no banned-phrase post-filter exists.
- TIER_2 / TIER_3 policy citations render normally (no AI redaction,
  no prompt-side filtering).
- Cancel during streaming aborts the fetch and the upstream Ollama
  call (verified by Ollama server log showing client disconnect).
- Models route returns availability dots that match `ollama list`
  output.
- Cross-owner `evalId` returns 404.
- Non-admin returns 403.
- LOCAL_ENGINE_ENABLED=false returns 503.
- Idle stub stream (60s no token) emits `error` event with
  `stream_idle_timeout` code.

### EXIT GATE (Phase D)

- `npx vitest run src/app/api/engine-v2/evaluations/\[evalId\]/chat/ src/lib/engine-v2/__tests__/chat_retrieval.test.ts src/components/engine-v2/side-panel/__tests__/AskAiTab.test.tsx` GREEN.
- `npx tsc --noEmit` GREEN.
- `npx eslint` on new paths GREEN.
- Manual smoke (with Ollama running, `gemma4:e4b` and
  `qwen2.5:14b-instruct-q4_K_M` loaded): open evaluation; switch to
  Ask AI tab; send fast-mode query; verify streaming response with
  citation pills; switch to thinking mode; resend; verify different
  model resolved; click a citation pill; verify peek panel opens.
  Send a query about Indigenous-use pathways (e.g., "traditional
  gardens or fishing near the site"); verify the response proceeds
  normally with citations rendering an "Indigenous uses content"
  badge (NO hard-stop, NO procedural-gate language in the AI
  response).

### Codex pre-emption checklist (Phase D)

- [ ] NO `detectIndigenousContent` import anywhere in Phase D files.
- [ ] NO `INDIGENOUS_HARD_STOP` import anywhere in Phase D files.
- [ ] NO TIER_2 / TIER_3 strings in `FAST_MODE_PROMPT` or
      `THINKING_MODE_PROMPT`.
- [ ] NO banned-phrase output filter on the SSE delta stream.
- [ ] Prompts include explicit instructions for AI to avoid
      procedural / consultation / regulatory-restraint voice when
      Indigenous-uses content surfaces (treat as routine pathway
      evidence); snapshot test pins this language.
- [ ] `gemma4:26b` NOT present in `chat-model-registry.ts` defaults
      or fallbacks (CPU spillover; owner-flagged).
- [ ] `getOllamaTags()` cache helper (`ollama_tags_cache.ts`) used by
      both POST chat route and GET /chat/models route; no direct
      `${baseUrl}/api/tags` fetch in either route.
- [ ] Cache TTL is 30s; cache survives a failed probe (returns stale
      tags on transient error rather than empty).
- [ ] `policy_kb.searchPolicies` called with options object
      `{ limit: 3 }`, NOT positional integer (BLOCKER 2 regression
      guard).
- [ ] `retrievePolicyMatches` is SYNCHRONOUS; the route does NOT
      `await` it (BLOCKER 2 regression guard).
- [ ] Output passthrough regression test present and named exactly
      `chat route does NOT post-filter procedural phrases from Ollama output (regression guard for v0.3 banned-phrase classifier removal)`
      (IMPORTANT 5 regression guard).
- [ ] AskAiTab consumes the indexing status route and disables submit
      with a retry CTA when status='error' (IMPORTANT 3 surface).
- [ ] System prompt comes from `chat-prompts.ts` by name; no inline
      string in the route.
- [ ] Model comes from `chat-model-registry.ts` by name; no hardcoded
      model in the route.
- [ ] `AbortSignal.timeout` for idle (60s) + connect (10s); NO raw
      `setTimeout`.
- [ ] `request.signal` propagated to the Ollama fetch.
- [ ] `try/finally` on the reader loop with `reader.cancel()` +
      `controller.close()`.
- [ ] Zod-strict body (`.strict()`); extra keys rejected.
- [ ] History capped at 10 turns server-side regardless of client
      input.
- [ ] Ownership probe via JOIN before retrieval.
- [ ] CSRF on POST chat route; auth + ownership on GET models route.
- [ ] Mode selector state persisted via the panel state hook
      (`localStorage`); no server-side mode persistence.
- [ ] No chat history persisted server-side (`v2_chat_logs` PARKED).
- [ ] ASCII-only prompts, route strings, UI strings.

---

## Phase E: Bidirectional citation linking

### Goal

Click a chunk citation pill (from Ask AI or Search submission) -> open
peek panel + scroll-and-highlight the per-policy row(s) that cite this
chunk. Inverse: click an evidence_packet entry on a per-policy row ->
open peek panel for that chunk.

### File allowlist (EXCLUSIVE)

- NEW `src/components/engine-v2/side-panel/CitationRenderer.tsx`
- NEW `src/components/engine-v2/side-panel/PeekPanel.tsx`
- NEW `src/components/engine-v2/side-panel/__tests__/CitationRenderer.test.tsx`
- EDIT `src/components/engine-v2/PerPolicyResultsTable.tsx`
  (small additive: accept an optional `highlightChunkId` prop;
  add `data-chunk-id` attributes to evidence cells; expose a ref-based
  scroll-into-view helper)

Total: 4 files.

### Wiring

- `EvaluationSidePanel` owns a `pendingHighlight` state:
  `{ chunkId: string | null }`. When a citation pill is clicked,
  `setPendingHighlight({ chunkId })`.
- `EvaluationPage` reads `pendingHighlight` via a context provider
  (introduced in Phase A as a stable contract) and forwards it as
  the `highlightChunkId` prop on `PerPolicyResultsTable`.
- `PerPolicyResultsTable` (one-line edit) uses
  `useEffect([highlightChunkId])` to call `scrollIntoView` on the
  matching row and apply a 1.5s pulse animation. Animation is a CSS
  keyframe; no JS animation library.
- The peek panel opens on click and offers a "Close" button + Esc.

### Acceptance criteria

- Click a citation pill in Ask AI -> peek panel opens with chunk text
  AND the per-policy row that cites the chunk scrolls into view with a
  pulse highlight.
- Click an evidence_packet entry on a per-policy row -> peek panel
  opens showing the chunk verbatim.
- Multiple policies citing the same chunk: all rows highlighted (pulse
  on each).
- No infinite render loops (the `pendingHighlight` clears after the
  animation completes).
- ASCII-only.

### EXIT GATE (Phase E)

- `npx vitest run src/components/engine-v2/side-panel/__tests__/CitationRenderer.test.tsx` GREEN.
- `npx tsc --noEmit` GREEN.
- `npx eslint src/components/engine-v2/side-panel/ src/components/engine-v2/PerPolicyResultsTable.tsx` GREEN.
- Manual smoke: open evaluation; send Ask AI query; click a citation
  pill in the response; verify peek panel + per-policy row highlight;
  click an evidence_packet entry on a per-policy row; verify peek
  panel opens with that chunk.

### Codex pre-emption checklist (Phase E)

- [ ] `pendingHighlight` clears after animation (no permanent state
      that prevents re-firing on the same chunk).
- [ ] `useEffect` dependency array correct (no stale-closure pitfall).
- [ ] Pulse animation uses CSS keyframes (no per-frame React state
      updates).
- [ ] `PerPolicyResultsTable` edit is strictly additive (one prop, one
      effect, one CSS class); no existing behavior changes.
- [ ] Keyboard activation (Enter / Space) on citation pill works the
      same as click.
- [ ] Peek panel Esc closes without dismounting side panel.
- [ ] ASCII-only strings.

---

## Lane-level codex pre-emption checklist (rollup)

| Risk class | Lane 2d v0.4 control |
|---|---|
| AI-side tier gatekeeping | NO Indigenous detector, NO TIER prompt rules, NO output filter on chat route |
| Indigenous content erasure | Neutral "Indigenous uses content" UI badge surfaces flag; AI does not redact, refuse, or speak in procedural-gate voice |
| Procedural-language drift in AI voice | Prompts explicitly instruct AI to avoid procedural / consultation language; tests snapshot-pin |
| Constitutional tier protection | Preserved at Lane 2b DB CHECK on `v2_judgments` (HITL write path), not at AI surface |
| FTS injection | `plainto_tsquery` only; `chunkId` regex-validated; ownership probe before SELECT |
| SSE stream leaks | `try/finally` + reader cancel + `AbortSignal.timeout` for idle + connect |
| Ollama unavailable | Tags probe with 5s timeout; clean `error` SSE event; 503 on local engine disabled |
| Auth bypass | `requireAdminForApi` + `requireLocalEngine` on every route; `checkCsrf` on POST chat |
| Cross-owner data access | Ownership probe via Supabase JOIN before any read |
| Hydration mismatch | Inline `toLocaleString('en-US', ...)` for any timestamps |
| Banned-phrase classifier (REMOVED) | None present; explicit absence verified by checklist |
| Indigenous hard-stop (REMOVED) | None present; explicit absence verified by checklist |
| Chat history persistence (PARKED) | `v2_chat_logs` not introduced; client-side `localStorage` not persisted in panel state |
| ASCII discipline | Tests assert no smart quotes / em dashes / unicode arrows in prompts or UI strings |
| Indexer side effects | Indexer error never blocks `importEvalResult`; idempotent (DELETE + INSERT in tx); failures surface to UI via `v2_submission_chunks_indexing_status` (no silent failure mode) |
| chunk_id alignment drift | Phase B test asserts evidence_slices map-KEY -> `evidence_item_id` round-trip; nullable `source.chunk_id` stored as optional `source_chunk_id` metadata; orphan-citation test asserts every evidence_packet entry's id resolves to a row |
| `searchPolicies` signature drift | Phase D test asserts options-object call form `{ limit: N }`; type-check would catch positional integer; sync/async boundary documented in chat_retrieval contract |
| Indexer wiring drift | Phase B codex item pins indexer to `eval_result_import.ts`; evaluate route is NOT a wiring surface (no completion path) |
| Ollama tags probe spam | 30s TTL cache helper; tests assert cache hit / miss behavior |
| Banned-phrase post-filter regression | Output passthrough test stubs "this requires SDM determination" and asserts SSE delta passes it through unchanged |
| Mode-prompt drift | `chat-prompts.ts` exports plain strings; tests snapshot-pin the skeletons (so accidental edits surface in CI) |
| Mode-model drift | `chat-model-registry.ts` exports plain objects; tests snapshot-pin defaults |
| Polling regression | No new polling loops; SSE for chat; sync GETs for search |
| Subagent file collisions | Phase A is the only phase that edits the evaluation page; later phases scope edits inside the side-panel tree |
| Zod payload tightening | `.strict()` on all new request schemas |
| Plain ASCII | Enforced across all phases by lint convention + tests |

---

## Parallelization plan

**Corrected in v0.5 per IMPORTANT 2.** Phase C and Phase D were
nominally "disjoint" in v0.4 but BOTH implemented Postgres tsvector
queries against `v2_submission_chunks` -- duplicate code if run in
parallel. v0.5 moves `submission_search.ts` (the shared tsvector
query builder + snippet helper) into Phase B so both C and D import
it. Phase D is now SEQUENTIAL after Phase C because they both edit
child files of the side-panel tree and a single-threaded review +
commit cadence is safer than parallel rebases on the AskAiTab vs
SubmissionSearchTab boundaries.

- Phase A and Phase B have DISJOINT file allowlists (A: dashboard UI
  shell + component move; B: backend tables + indexer + shared
  submission_search lib). RUN PARALLEL.
- Phase C depends on B (consumes the chunks table + the shared
  submission_search lib) AND on A's `SubmissionSearchTab.tsx`
  placeholder. RUN AFTER both A and B GREEN.
- Phase D depends on B (submission_search lib for chat retrieval),
  on A's `AskAiTab.tsx` placeholder, AND on Phase C's mount surface
  (single-threaded SidePanel child edits). RUN SEQUENTIAL after C.
- Phase E depends on C and D (citation pills come from both). RUN
  LAST.

Suggested order:

1. Phase A + Phase B in PARALLEL (~3-4h and ~1d respectively; B is
   the long pole).
2. Phase C sequential after A+B merge (~4-5h).
3. Phase D sequential after C merge (~1d).
4. Phase E sequential after D merge (~4-6h).

Total wall-clock: ~3 days with adversarial loops (slightly longer
than v0.4 because Phase D is no longer parallel with Phase C, but
the trade-off is no merge churn on shared side-panel children and
no duplicate tsvector query code).

---

## EXIT GATE for Lane 2d v0.4 (cumulative)

Owner action (before subagents start):

1. Confirm `LOCAL_ENGINE_ENABLED=true` in `.env.local`.
2. Confirm Ollama is running with at least `gemma4:e4b` (fast) and
   `qwen2.5:14b-instruct-q4_K_M` (thinking) loaded. Alternatives per
   `chat-model-registry.ts` are acceptable. `gemma4:26b` is NOT a
   recommended default (CPU spillover, slow).
3. Confirm Supabase migrations from Phase B applied to the dev project.
4. Confirm at least one evaluation has completed since Phase B's
   indexer wired in (so `v2_submission_chunks` has rows to search).

After implementation:

1. All five phase EXIT GATEs met.
2. Cumulative `npx vitest run` GREEN (no regressions on existing
   Lane 2a/2b/2c suite).
3. `npx tsc --noEmit` GREEN.
4. `npx eslint` GREEN.
5. Smoke: open evaluation; expand side panel; verify all three tabs.
   Search policies tab: query "arsenic", see results. Search
   submission tab: query "arsenic", see results with "Indigenous uses
   content" badge on flagged chunks + cited-by counts. Ask AI tab:
   fast mode "what arsenic evidence is in this submission?", see
   streaming response with citations. Switch to thinking mode, resend,
   verify different model. Click a citation pill, verify peek panel +
   per-policy row highlight. Send an Indigenous-uses pathway query
   (e.g., traditional gardens, hunting, fishing, medicines), verify
   the response proceeds normally with citations carrying the neutral
   "Indigenous uses content" badge, NO hard-stop, and NO
   procedural-gate language in the AI response voice.
6. Confirm Lane 2b memo export still works (no regression).
7. Confirm Lane 2c evaluation history list still works.
8. Confirm project-detail page no longer mounts PolicySearchPanel.
9. Confirm `v2_submission_chunks_indexing_status` row exists for the
   evaluation with status='complete'. Force a status='error' (e.g.,
   manual UPDATE in psql) and confirm both the Search submission tab
   and the Ask AI tab render the "Search unavailable: indexing failed;
   retry" CTA; click retry; confirm reindex completes and the CTA
   clears.

---

## Out of scope for Lane 2d v0.4

- `v2_chat_logs` audit table (PARKED per owner Q2 lock).
- Cross-evaluation chat scope (LOCKED to this-eval-only).
- "Show uncited chunks only" filter (Lane 2e UX polish).
- First-launch tooltip / discoverability nudge (Lane 2e polish).
- Multi-format export (CSV / MD / HTML / docx) -- Lane 2b's
  `ExportMemoButton` remains the canonical export. Track ad-hoc
  exports as a Lane 2e backlog item if owner asks.
- BM25 engine fix (separate engine-v2 worktree workstream;
  owner-authorized separately).
- Pre-evaluation submission exploration (chunks indexed only at
  evaluate completion; Lane 2e candidate).
- Phrase-query / proximity-search FTS upgrades over Postgres tsvector
  (Lane 2e candidate).
- Embeddings axis for chat retrieval (Lane 2e candidate; currently
  keyword-driven secondary policy axis).

---

## Risks

- **Mode-prompt iteration churn.** Owner intends to edit
  `chat-prompts.ts` after seeing the system behave. Each edit invalidates
  the prompt snapshot test. Mitigation: snapshot tests are
  intentionally brittle so prompt changes surface in code review; the
  test refresh is one command (`vitest -u` on the prompt suite).
- **Model availability drift.** Owner has `gemma4:e4b` and
  `qwen2.5:14b-instruct-q4_K_M` loaded today; if those evict from the
  Ollama cache, the fallback chain (`qwen3.5:9b`, `mistral-nemo:latest`)
  resolves; if all fallbacks evict, the route emits a clean error SSE
  and the UI greys out the mode. `gemma4:26b` is intentionally absent
  from defaults and fallbacks because it spills to CPU on the owner's
  hardware. Mitigation: the `/chat/models` route exposes availability;
  UI reflects it.
- **Postgres tsvector phrase-query limits.** `plainto_tsquery` treats
  multi-word input as an AND of lexemes, not a phrase. Queries like
  `"acute toxicity"` lose phrase semantics. Mitigation: documented in
  ED-2d4-5 as accepted trade-off; phrase-query helper is a Lane 2e
  candidate.
- **Ollama instance contention.** Concurrent live evaluator + chat
  routes share the same local Ollama instance. The 10s connect timeout
  fails loudly if the queue is hot. Mitigation: surface a clean error;
  no auto-retry storm.
- **SSE behind reverse proxies.** Route is local-engine-only; not
  deployed to Vercel. Local Next.js node runtime handles SSE without
  intermediaries.
- **Indigenous false negatives in the metadata flag.** Without
  AI-side detection, a chunk that talks about reconciliation in
  Indigenous context but uses indirect language may not flag. This is
  acceptable -- the HITL is the final adjudicator and reads the
  underlying chunk. Mitigation: the keyword list is editable and can
  be tuned over time.
- **Indigenous false positives in the metadata flag.** A chunk that
  uses `treaty` in a non-Indigenous context (e.g., international
  treaty) will flag. The badge is non-punitive (HITL still reads the
  text and applies judgment); false positives are conservative.
- **Bidirectional linking on stale evaluations.** Re-evaluation
  replaces `v2_chunk_policy_citations` rows in a transaction; if a
  reviewer holds an Ask AI conversation referencing chunks that no
  longer exist post-re-eval, the citation pill click resolves to a
  "Chunk not found" peek panel state. Mitigation: peek panel handles
  the not-found case cleanly with a "this chunk was removed by a
  re-evaluation" message.

---

## Adversarial review cadence

Per standing memory `feedback_codex_review_pre_commit_loop` and
`feedback_codex_unavailable_fallback`. Codex MCP preferred; Opus
adversarial subagent fallback if codex 401/network errors persist
beyond two attempts per phase. Iterate review / fix / re-review until
green-light AND zero outstanding IMPORTANT/BLOCKER findings, then
commit.

Per-phase order:

1. Implementation subagent finishes phase.
2. Orchestrator attempts `mcp__codex__codex` review.
3. If 401 / network error after retry: spawn adversarial Opus
   subagent.
4. Iterate.
5. Commit.

---

## Confirmation of framing

Tier-based AI gatekeeping is FULLY ABSENT from this plan. Specifically:

- No `detectIndigenousContent` import in any v0.4 file.
- No `INDIGENOUS_HARD_STOP` import in any v0.4 file.
- No TIER_2 / TIER_3 strings in `FAST_MODE_PROMPT` or
  `THINKING_MODE_PROMPT`.
- No banned-phrase classifier on chat output.
- No history-rotation Indigenous detector.
- No "I cannot provide analysis" refusal logic.
- No "No PASS for TIER_2" / "Adequacy=null for TIER_3" output filter.

Constitutional tier protection is preserved at Lane 2b's `v2_judgments`
DB CHECK constraint (HITL write path), not at the AI surface. AI
surfaces evidence; HITL judges.

---

## Open questions for owner (NON-BLOCKING; v0.4 ships defaults)

1. **Keyword list for `indigenous_flagged`.** v0.4 omits `consent`
   (false-positive risk) and retains `reconciliation`. Owner OK with
   that, or different cuts?
2. **Default model per mode.** v0.4 picks `gemma4:e4b` for fast and
   `qwen2.5:14b-instruct-q4_K_M` for thinking. `gemma4:26b` is
   excluded from defaults and fallbacks due to CPU spillover. Owner
   OK, or different defaults?
3. **Pre-evaluation submission exploration.** v0.4 indexes chunks at
   evaluate completion. If owner wants chat / search to work before
   the first evaluation completes, Lane 2e folds that in. OK to defer?
4. **First-launch tooltip on the rail.** v0.4 ships without it.
   Discoverability via Cmd+K is the primary path. OK to defer?

If owner answers post-implementation, the deltas slot into Lane 2e
without re-architecting v0.4.
