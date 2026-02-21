/**
 * System prompt templates and safety constraints for the Ollama-backed assistant.
 *
 * NON-NEGOTIABLE: These prompts enforce RRAA three-tier discretion model constraints.
 * The assistant is retrieval/synthesis ONLY — it CANNOT make adequacy determinations.
 */

/** Indigenous/TIER_3 trigger keywords (from CLAUDE.md Section 7.6) */
const INDIGENOUS_KEYWORDS = [
  'indigenous',
  'first nation',
  'aboriginal',
  'treaty',
  'métis',
  'metis',
  'inuit',
  'undrip',
  'dripa',
  'section 35',
  'duty to consult',
  'honour of the crown',
  'honor of the crown',
  'traditional territory',
  'traditional knowledge',
  'tek',
  'consent',
  'reconciliation',
] as const;

/**
 * Check if text contains Indigenous/TIER_3 trigger keywords.
 * Returns the first matched keyword or null.
 */
export function detectIndigenousContent(text: string): string | null {
  const lower = text.toLowerCase();
  for (const keyword of INDIGENOUS_KEYWORDS) {
    if (lower.includes(keyword)) {
      return keyword;
    }
  }
  return null;
}

/** Hard-stop response when Indigenous content is detected */
export const INDIGENOUS_HARD_STOP =
  'This matter involves Indigenous consultation rights and is classified as TIER_3_STATUTORY. ' +
  'It requires determination by a Statutory Decision Maker. I cannot provide analysis on this topic.';

/**
 * Build the system prompt for the assistant.
 * Includes role definition, safety constraints, and grounding instructions.
 */
export function buildSystemPrompt(): string {
  return [
    'You are a regulatory research assistant for BC contaminated sites under the Environmental Management Act (EMA) and Contaminated Sites Regulation (CSR 375/96).',
    '',
    'ROLE: You retrieve and summarize regulatory requirements. You do NOT evaluate adequacy.',
    '',
    'CRITICAL CONSTRAINTS:',
    '1. You MUST NOT provide adequacy determinations. Never state that a submission is "adequate" or "inadequate". Never say a policy requirement is "met" or "not met" as a determination.',
    '2. You MAY summarize policy requirements, retrieve and present evidence from the submission, explain what a reviewer should look for, and highlight potential gaps or areas of concern.',
    '3. For TIER_2_PROFESSIONAL policies (containing "should", "sufficient", "appropriate"): Note that these require professional judgment — AI assessment is limited to flagging, not determination.',
    '4. For TIER_3_STATUTORY policies (containing "may", "Director", "discretion") or Indigenous matters: State that these require a Statutory Decision Maker and do not provide any analysis.',
    '5. Always cite your sources. When referencing a policy, include the policy ID and source document. When referencing submission evidence, include the location and page reference.',
    '',
    'RESPONSE FORMAT:',
    '- Base your answers ONLY on the retrieved passages provided below.',
    '- If the passages do not contain relevant information, say so clearly. Do NOT fabricate content.',
    '- When citing a policy, use the format: [Policy ID] (Source Document, Section).',
    '- When citing submission evidence, use the format: [Location, Page Reference].',
    '- Keep responses focused and concise.',
  ].join('\n');
}

/**
 * Build the user-facing prompt with retrieved context and query.
 */
export function buildContextPrompt(
  context: { policies: string; submissions: string },
  query: string
): string {
  const parts: string[] = [];

  if (context.policies) {
    parts.push(`--- RETRIEVED POLICY CONTEXT ---\n${context.policies}`);
  }

  if (context.submissions) {
    parts.push(`--- RETRIEVED SUBMISSION EVIDENCE ---\n${context.submissions}`);
  }

  if (parts.length === 0) {
    parts.push(
      '--- NO CONTEXT RETRIEVED ---\nNo relevant passages were found for this query.'
    );
  }

  parts.push(`--- USER QUESTION ---\n${query}`);

  return parts.join('\n\n');
}
