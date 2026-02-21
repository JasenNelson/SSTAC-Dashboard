# Chat + Search Enhancement Plan (v1.1)

**Date:** 2026-02-21
**Status:** v1.1 — Decisions locked after Claude + Codex review
**Primary Repo:** `C:\Projects\SSTAC-Dashboard`

---

## Delta from v1.0

| # | Change | Reason |
|---|--------|--------|
| 1 | Mode naming: `fast`/`thinking` renamed to **`fast`/`deep`** throughout | Avoids confusion with Claude extended thinking; Ollama models don't have native "thinking" mode — this is just larger/slower model selection |
| 2 | Explicit model selector **deferred to Phase B** | Fast/deep toggle is sufficient for MVP; reduces Phase A scope |
| 3 | Chat API is **stateless** — client sends trimmed history, server stores nothing | Simpler implementation, no session cleanup, no DB schema changes |
| 4 | **Safety section expanded** — assistant is retrieval/synthesis only, never adequacy determination | CLAUDE.md three-tier constraint compliance; prevents TIER_2/TIER_3 violations |
| 5 | **Indigenous/TIER_3 hard-stop** requirement added | Constitutional obligation — Section 35, DRIPA/UNDRIP |
| 6 | New `/assistant/*` routes **must use `requireAdmin()` + `requireLocalEngine()`** | Consistent with LOCAL_ENGINE_ROUTING_PLAN Phase 2 pattern |
| 7 | Phase A split into **A1/A2/A3** sub-phases with effort estimates | Original "1-2 weeks" was too vague for 6 deliverables |
| 8 | **Search result gap analysis** added — identifies which fields are new vs already returned | Prevents re-implementing existing functionality |
| 9 | **API contract tightened** — SSE event types, history format, citation schema specified | v1.0 contract was underspecified for implementation |
| 10 | **Risk table expanded** — tier violations, Indigenous content, Ollama availability, context overflow, two-DB dependency, submission search performance | v1.0 missed critical safety and operational risks |
| 11 | **System prompt template** requirement added as non-negotiable pre-implementation step | Tier constraints and citation format must be enforced in prompt, not just documentation |

---

## 1) Purpose

Add a right-panel assistant experience on regulatory-review submission pages that supports:

1. `Policy Search` (richer than current results)
2. `Submission Search` (richer context from uploaded submission content)
3. `Chat Assistant` grounded in policy + submission evidence

The first implementation target is **local-only (Ollama)**. A second phase will prepare a cloud/live-user backend.

**Relationship to existing code:** `SearchPanel.tsx` already provides a two-tab segmented control (Policy / Submission) with working search UI and API routes. This plan **extends** that to three tabs — it does not replace existing functionality.

## 2) Goals and Non-Goals

### Goals

1. Preserve existing search workflows while adding a chat mode.
2. Improve search usefulness via genuinely new metadata fields (gap analysis in Section 3).
3. Provide model/mode controls that are understandable (`fast` vs `deep`) and map to available Ollama models.
4. Return source-grounded answers with citations.
5. Gate all new routes behind `requireAdmin()` + `requireLocalEngine()` consistent with LOCAL_ENGINE_ROUTING_PLAN.

### Non-Goals (Phase A)

1. External-user production deployment.
2. Multi-tenant cloud inference architecture.
3. Full analytics/cost telemetry stack for paid APIs.
4. **The assistant MUST NOT provide adequacy determinations.** It is a retrieval/synthesis tool, not an evaluator. See Section 7 for enforcement details.
5. Explicit model dropdown UI (deferred to Phase B).

## 3) User Experience (Right Panel)

Extend the existing `SearchPanel.tsx` two-tab segmented control to three tabs:

1. `Policy` (existing — no behavior change)
2. `Submission` (existing — no behavior change)
3. `Assistant` (new — only visible when `isLocalEngineClient()` returns true)

### Assistant Mode UI

1. Conversation thread with streaming responses.
2. Input box + optional prompt templates.
3. Mode selector:
   - `Fast` — smaller/faster model, triage and quick grounded Q&A
   - `Deep` — larger/slower model, thorough synthesis and cross-evidence analysis
4. Citation drawer in each assistant response.
5. Connection status indicator — shows whether Ollama is reachable.

### Search Result Upgrades — Gap Analysis

#### Policy search (`/api/regulatory-review/search`)

**Already returned (no work needed):** `id`, `originalText`, `plainLanguage`, `discretionTier`, `topicCategory`, `subCategory`, `sourceDocument`, `sourceSection`, `sourcePage`, `keywords`, `reviewQuestion`

**Genuinely new fields to add (requires schema verification):**

| Field | Source Column (verify in schema) | Notes |
|-------|----------------------------------|-------|
| `citationLabel` | `citation_label` | Short reference label |
| `code` | `code` | CSAP policy code |
| `title` | `title` | Policy title |
| `issuingBody` | `issuing_body` | Regulatory body |
| `jurisdiction` | `jurisdiction` | Provincial/federal |
| `matchExplanation` | computed | FTS rank score or match reason |

> **Action required before implementation:** Verify these columns exist in `policy_statements` table via `schema_v2.sql` + `schema_v3_2_extensions.sql`. If absent, defer to Phase B.

#### Submission search (`/api/regulatory-review/submission-search`)

**Already returned (no work needed):** `assessmentId`, `csapId`, `location`, `pageReference`, `excerpt`, `evidenceType`, `confidence`, `specDescription`, `matchReasons`

**Genuinely new field to add:**

| Field | Source | Notes |
|-------|--------|-------|
| `sourcePath` | `evidence_found` JSON → derive from `location` | Original document file path |

> **Performance note:** The current implementation does a full in-memory JSON scan of all assessment `evidence_found` blobs (submission-search/route.ts lines 102-143). Acceptable for <1K assessments. Phase B should add a denormalized search table or FTS index.

## 4) Technical Options

### Option A: Search + Chat orchestration in Next.js API routes (recommended for local MVP)

- Keep UI in app.
- Add assistant route(s) under `src/app/api/regulatory-review/assistant/*`.
- Call local Ollama from server route.
- Perform retrieval in route, then compose grounded prompt.

**Technical specifics:**
- **Streaming:** Use Next.js App Router `ReadableStream` with `TransformStream` for SSE streaming to the client.
- **Ollama API:** Target `http://localhost:11434/api/chat` (streaming) and `http://localhost:11434/api/tags` (model discovery).
- **Retrieval strategy:** Before calling Ollama, retrieve context from both databases (policy DB `rraa_v3_2.db` for regulatory context, submission DB `regulatory-review.db` for evidence). Compose a grounded prompt with retrieved passages + user query.

Pros: Fastest path, low integration overhead.
Cons: Not ideal long-term for heavy inference load.

### Option B: Separate local assistant service (Python/Node)

- Next.js calls localhost assistant service.
- Service handles retrieval, prompts, model routing.

Pros: Better separation and future portability.
Cons: More setup/ops complexity now.

### Decision

Use **Option A for Phase A**, then evolve toward Option B/Cloud service when external users are enabled.

## 5) Proposed API Surface (Phase A)

### New Routes

All new routes require `requireAdmin()` + `requireLocalEngine()` guards.

#### 1. `POST /api/regulatory-review/assistant/chat`

**Input:**

```typescript
{
  submissionId: string;          // required — scopes retrieval context
  query: string;                 // required — user's question
  scope: "policy" | "submission" | "hybrid";
    // "policy"     = retrieve from rraa_v3_2.db only
    // "submission"  = retrieve from regulatory-review.db evidence only
    // "hybrid"      = retrieve from both (DEFAULT)
  mode: "fast" | "deep";        // maps to model selection via registry
  history?: Array<{             // previous turns — client manages state
    role: "user" | "assistant";
    content: string;
  }>;
  // Capped at last 10 turns server-side to respect context window.
  // No server-side session storage.
}
```

**Output (SSE stream):**

```typescript
// Server-Sent Events, one per line:
event: delta
data: { "text": "incremental token text" }

event: citation
data: {
  "type": "policy" | "submission",
  "id": "AUTH-1" | "assessment-42",       // policy ID or assessment ID
  "text": "verbatim excerpt used",
  "source": "CSR 375/96 s.11(1)"          // optional source reference
}

event: meta
data: {
  "model": "mistral-nemo:latest",
  "mode": "fast",
  "retrievalCount": 8,                    // passages used for grounding
  "durationMs": 3420
}

event: done
data: {}

event: error
data: { "message": "Ollama connection refused" }
```

#### 2. `GET /api/regulatory-review/assistant/models`

- Calls `http://localhost:11434/api/tags` to discover running Ollama models.
- Cross-references against the model registry (Section 6) for capability mapping.

**Response:**

```typescript
{
  models: Array<{
    name: string;               // e.g., "mistral-nemo:latest"
    size: string;               // e.g., "12B"
    capabilities: ("fast" | "deep")[];
  }>;
  error?: string;               // e.g., "Ollama not running at localhost:11434"
  // Returns 200 with empty models[] + error string if Ollama unreachable.
  // UI handles gracefully — does NOT return 503.
}
```

### Existing Endpoint Enhancements

#### `GET /api/regulatory-review/search` (policy search)

Add only genuinely new columns (pending schema verification):
- `citationLabel`, `code`, `title`, `issuingBody`, `jurisdiction`
- `matchExplanation` (FTS rank score, computed)

No changes to existing returned fields.

#### `GET /api/regulatory-review/submission-search`

Add `sourcePath` field only. All other fields already returned.

## 6) Model Routing Strategy

Maintain a typed model registry at `src/lib/ollama/model-registry.ts`:

```typescript
export const MODEL_REGISTRY = {
  fast: {
    default: 'mistral-nemo:latest',    // 12B, tested in V2 pilot
    allowed: ['mistral-nemo:latest', 'qwen2.5:14b', 'llama3.1:8b'],
  },
  deep: {
    default: 'qwen3:14b',             // largest tested local model
    allowed: ['qwen3:14b', 'mistral-nemo:latest'],
  },
} as const;

export type Mode = keyof typeof MODEL_REGISTRY;
```

**Routing rules:**

1. User selects `fast` or `deep` mode via UI toggle.
2. Server uses `MODEL_REGISTRY[mode].default` model.
3. If default model not available in Ollama, try next in `allowed` list.
4. If no allowed model available, return error event: `"No compatible model found for mode '{mode}'. Available models: [list]"`.

**Phase B addition:** Explicit model dropdown in UI, allowing user to select any model compatible with the chosen mode.

> **Note on "deep" vs "thinking":** The `deep` mode uses a larger/slower Ollama model for more thorough analysis. It does NOT use extended thinking or chain-of-thought features (Ollama models don't support this natively). The UI tooltip should read: "Uses a larger model for more thorough analysis."

## 7) Grounding and Safety Requirements

### Retrieval-First Design

1. Assistant responses must prefer retrieved evidence over free-form speculation.
2. Always include citations when claims are made (emitted as `citation` SSE events).
3. If retrieval is empty or weak, assistant must state uncertainty clearly — not fabricate.
4. Keep role-based access and existing route guards in place.

### Adequacy Determination Prohibition (CRITICAL)

5. **The assistant MUST NOT provide adequacy determinations for any policy.** It may:
   - Summarize policy requirements
   - Retrieve and present evidence from the submission
   - Explain what a reviewer should look for
   - Highlight potential gaps or areas of concern
   - It CANNOT say a policy is "adequate" or "inadequate"

6. **Indigenous/TIER_3 hard-stop.** If the user's query contains Indigenous-related terms (indigenous, first nation, aboriginal, treaty, metis, inuit, undrip, dripa, section 35, duty to consult, honour of the crown, traditional territory, traditional knowledge, TEK, consent, reconciliation), the assistant must respond with:
   > "This matter involves Indigenous consultation rights and is classified as TIER_3_STATUTORY. It requires determination by a Statutory Decision Maker. I cannot provide analysis on this topic."
   No further synthesis or retrieval-based response on that topic.

7. **Tier-awareness in responses.** When the assistant retrieves TIER_2_PROFESSIONAL policies as context, it should note: "This policy requires professional judgment — AI assessment is limited to flagging, not determination."

### System Prompt Template (Non-Negotiable Pre-Implementation)

A version-controlled system prompt template must be created at `src/lib/ollama/prompts.ts` before any Ollama integration begins. It must include:

- Role definition: "You are a regulatory research assistant for BC contaminated sites. You retrieve and summarize regulatory requirements — you do not evaluate adequacy."
- Citation format instructions
- TIER_2/TIER_3 constraint language
- Indigenous content hard-stop trigger
- Grounding instruction: "Base your answers only on the retrieved passages below. If the passages do not contain relevant information, say so."

### Retrieval Budget

- **Per query:** Top 5 policy matches + top 5 submission evidence matches (for `hybrid` scope)
- **Total prompt budget:** ~4K tokens for retrieved context + user query + system prompt
- **History cap:** Last 10 turns, trimmed server-side before prompt assembly

## 8) Phased Delivery Plan

### Phase A1: Search Enrichment (2-3 days)

1. Verify which new columns exist in `policy_statements` schema.
2. Add verified new columns to `/search` response payload.
3. Update `PolicyResultCard` in `PolicySearch.tsx` to display new fields.
4. Add `sourcePath` to `/submission-search` response.

### Phase A2: Assistant Backend (3-4 days)

1. Create `src/lib/ollama/model-registry.ts` with model registry.
2. Create `src/lib/ollama/prompts.ts` with system prompt template (safety constraints).
3. Create `src/lib/ollama/client.ts` — Ollama HTTP client with streaming support.
4. Create `src/app/api/regulatory-review/assistant/chat/route.ts`:
   - `requireAdmin()` + `requireLocalEngine()` guards
   - Retrieval from both DBs based on `scope`
   - Prompt assembly with retrieved context
   - SSE streaming response from Ollama
   - Indigenous keyword detection → hard-stop
5. Create `src/app/api/regulatory-review/assistant/models/route.ts`:
   - `requireAdmin()` + `requireLocalEngine()` guards
   - Ollama model discovery + capability mapping
6. Test via curl/Postman — working streaming API before UI work.

### Phase A3: Assistant UI (3-4 days)

1. Add `Assistant` tab to `SearchPanel.tsx` segmented control (gated by `isLocalEngineClient()`).
2. Create `AssistantPanel.tsx`:
   - Chat thread with streaming token display
   - Fast/deep mode toggle
   - Scope selector (policy/submission/hybrid)
   - Connection status indicator (Ollama reachable?)
3. Create `CitationDrawer.tsx` — renders inline citations from SSE `citation` events.
4. Wire SSE consumption with `EventSource` or `fetch` + `ReadableStream` reader.

**Phase A total: ~2 weeks realistic**

### Phase B: Hardening (~1 week)

1. Explicit model dropdown UI (was deferred from Phase A).
2. Prompt versioning controls.
3. Better citation rendering + click-to-navigate to source policy/evidence.
4. Error handling, retries, timeout controls.
5. Submission search performance: add denormalized search table or FTS index.
6. Targeted UX polish and QA.

### Phase C: Live-User Readiness (2-3 weeks, deferred)

1. Replace local-only dependencies with cloud-compatible architecture.
2. Provider abstraction for non-Ollama inference (cloud API support).
3. Rate limits, audit logs, cost telemetry, abuse controls.
4. Deployment/runbooks.

> **No implementation detail for Phase C at this time.** Scope will be defined when Phase B is complete.

### Branch Strategy

Create `feature/chat-assistant` from `fix/reg-review-hitl-ui-recovery` HEAD. Merge back after Phase A complete.

## 9) Risks and Mitigations

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| 1 | **Tier constraint violation** — assistant provides adequacy determinations for TIER_2/TIER_3 | Critical | System prompt enforcement + Indigenous keyword detection hard-stop + post-response scan for "adequate"/"inadequate" as determination language |
| 2 | **Indigenous content** — assistant evaluates TIER_3 matter | Critical | Keyword detection in query (same trigger list as CLAUDE.md Section 7.6) triggers hard-stop response; no synthesis attempted |
| 3 | **Hallucinations** — model fabricates evidence or citations | High | Retrieval-first prompting + mandatory citations + grounding instruction in system prompt |
| 4 | **Ollama not running** | Medium | `/assistant/models` returns empty list with error string; chat route returns SSE error event "Start Ollama"; UI shows connection status indicator |
| 5 | **Context window overflow** | Medium | Cap retrieved passages (5 per scope). Cap history to 10 turns. Total prompt budget ~4K tokens context. Ollama models with <8K context get fewer passages. |
| 6 | **Two-DB dependency** | Medium | Assistant route opens both `rraa_v3_2.db` and `regulatory-review.db`. If either fails, degrade to single-scope retrieval with notice to user |
| 7 | **Submission search performance** | Medium | Current full-JSON-scan is O(N) over all assessments. Fine for <1K assessments. Phase B adds search index. |
| 8 | **Model quality variance** | Medium | Mode defaults + model registry with tested models only. Phase B adds explicit model selection. |
| 9 | **Latency in deep mode** | Low | Stream tokens immediately; show mode-specific expectation ("Deep mode may take 30-60 seconds") |
| 10 | **Scope creep vs current roadmap** | Low | Phase A isolated from current gating work. New routes slot into existing guard pattern. No conflict with Phase 3 (see Section 13). |

## 10) Acceptance Criteria (Phase A)

1. User can switch among `Policy`, `Submission`, `Assistant` in right panel.
2. `Assistant` tab only visible when `isLocalEngineClient()` is true.
3. Assistant supports `fast`/`deep` toggle and displays chosen model name.
4. Assistant answers include citations to policy/submission evidence when available.
5. Policy and submission search results include verified new metadata fields.
6. No regression in existing regulatory-review workflows.
7. **Assistant never outputs adequacy determinations** ("adequate"/"inadequate" as judgments).
8. **Assistant returns TIER_3 hard-stop notice** when query contains Indigenous-related terms.
9. When Ollama is unreachable, Assistant tab shows "Ollama required — not connected" message, not a crash.

## 11) Collaborative Workflow (Codex + Claude)

1. Claude drafts v1.1 with decisions locked. **(DONE)**
2. Codex reviews v1.1 for final approval.
3. Claude creates implementation branch and starts Phase A1.
4. Small commits per sub-phase, Codex spot-checks.

## 12) Open Questions (Remaining)

| # | Question | Status | Notes |
|---|----------|--------|-------|
| 1 | **Which new policy columns actually exist in the schema?** | Must verify before A1 | Check `citation_label`, `code`, `title`, `issuing_body`, `jurisdiction` in `schema_v2.sql` + `schema_v3_2_extensions.sql`. If absent, defer those fields to Phase B. |
| 2 | **Retrieval ranking method** — how to score/rank retrieved passages for prompt assembly? | Decide during A2 | Options: FTS rank score, keyword overlap count, or simple "first N matches." Start with FTS rank, iterate. |
| 3 | **Post-response adequacy scan** — keyword filter or model-level constraint? | Decide during A2 | Keyword scan for "adequate"/"inadequate" as post-processing is fragile. System prompt constraint is primary defense. May add regex post-filter as belt-and-suspenders. |
| 4 | **Ollama base URL** — hardcoded or env var? | Decide during A2 | Recommend env var `OLLAMA_BASE_URL` defaulting to `http://localhost:11434`. Allows future remote Ollama. |

## 13) Phase 3 (UI Gating) Conflict Analysis

**Result: No conflict.**

1. Phase 3 gates engine-dependent UI components (ReviewWizard, RunEngineButton, FileManagement, ProcessLauncher). The chat/search work touches **different components** (SearchPanel, PolicySearch, SubmissionSearch + new AssistantPanel).

2. The new `/assistant/chat` and `/assistant/models` routes use `requireAdmin()` + `requireLocalEngine()` — same guard pattern as all other local-only routes in Phase 2. This is additive, not conflicting.

3. The Assistant tab in `SearchPanel.tsx` is gated by `isLocalEngineClient()` — consistent with Phase 3's conditional rendering pattern.

4. The existing search routes (`/search`, `/submission-search`) already have `requireAdmin()` from Phase 2. No Phase 3 changes needed.

**Coordination needed:** Add the two new `/assistant/*` routes to the route table in `LOCAL_ENGINE_ROUTING_PLAN.md` Section 1.6 when implementation begins.

---

*v1.0: 2026-02-21 — Initial draft*
*v1.1: 2026-02-21 — Decisions locked after Claude + Codex review. Mode naming, safety constraints, API contract, phasing revised.*
