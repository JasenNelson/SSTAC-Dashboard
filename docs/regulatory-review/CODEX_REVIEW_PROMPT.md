# Codex Review Prompt — Local Engine Routing Plan v3.1

Copy the text below into Codex for review.

---

## Prompt

Review the updated plan at `docs/regulatory-review/LOCAL_ENGINE_ROUTING_PLAN.md` (v3.1). This incorporates your previous review findings (all 15 tracked in Appendix A) plus two new updates:

1. **Pro plan baseline:** Cost analysis now treats Supabase Pro ($25/mo) + Vercel Pro ($20/mo) as existing sunk costs. All Part 3 costs are incremental.

2. **Two-model AI stack:** Haiku has been removed from the recommended path (tested and fails for regulatory complexity). Replaced with:
   - **Fast model** (Sonnet, GPT-4o-mini, or Gemini Flash) — high-throughput triage, normalization, applicability screening
   - **Thinking model** (Opus, o3, Gemini Pro) — complex policy reasoning, cross-evidence synthesis, final narrative
   - Escalation pattern with confidence gating + acceptance gates + recall guardrails

**Focus this review on the v3.1 changes:**

1. **Two-model architecture (Section 3.3, Stage 4d):**
   - Is the fast model → thinking model escalation pattern sound?
   - Are the acceptance gates (recall ≥95%, grounding ≥90%, quality ≥80%, calibration ±10%) reasonable thresholds?
   - Is the cost-per-submission estimate realistic for each scenario?
   - Any risks in using different provider models (Claude + GPT + Gemini) in the same pipeline?

2. **Cost framing (Section 3.4):**
   - Are the incremental cost tables accurate given Pro plan baselines?
   - Is the volume projection (5-100 submissions/month) realistic for the use case?
   - Any hidden costs missing (egress, API rate limits, cold start penalties)?

3. **Previously addressed findings (Appendix A):**
   - Spot-check that the 15 original findings are properly resolved in the plan text
   - Flag any that appear addressed in the tracker but not actually fixed in the plan body

**Key files for context (same as previous review):**
- Plan: `docs/regulatory-review/LOCAL_ENGINE_ROUTING_PLAN.md`
- Architecture: `next.config.ts`, `src/middleware.ts`, `src/lib/sqlite/client.ts`
- API routes: `src/app/api/regulatory-review/` (all subdirectories)
- Components: `src/app/(dashboard)/regulatory-review/components/`
- Page: `src/app/(dashboard)/regulatory-review/[submissionId]/page.tsx`

Provide specific, actionable feedback. Note which findings from v3.0 you consider properly resolved vs still open.
