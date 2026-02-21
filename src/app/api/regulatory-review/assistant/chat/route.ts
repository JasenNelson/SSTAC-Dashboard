/**
 * Assistant Chat API — Stateless RAG-based chat with Ollama
 *
 * Retrieves context from policy and/or submission databases,
 * composes a grounded prompt, and streams the response via SSE.
 *
 * Guards: requireAdmin() + requireLocalEngine()
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireLocalEngine } from '@/lib/api-guards';
import {
  resolveModel,
  getOllamaBaseUrl,
  type Mode,
} from '@/lib/ollama/model-registry';
import {
  detectIndigenousContent,
  INDIGENOUS_HARD_STOP,
  buildSystemPrompt,
  buildContextPrompt,
} from '@/lib/ollama/prompts';
import { Database } from '@/lib/sqlite/require-database';
import path from 'path';

// DB paths — same as existing search routes
const RRAA_DB_PATH = path.join(
  process.cwd(),
  '..',
  'Regulatory-Review',
  'engine',
  'data',
  'rraa_v3_2.db'
);
const SUBMISSION_DB_PATH = path.join(
  process.cwd(),
  'src',
  'data',
  'regulatory-review.db'
);

// --- Types ---

type Scope = 'policy' | 'submission' | 'hybrid';

interface ChatRequest {
  submissionId: string;
  query: string;
  scope: Scope;
  mode: Mode;
  model?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

interface PolicyContext {
  id: string;
  originalText: string;
  discretionTier: string;
  sourceDocument: string | null;
  sourceSection: string | null;
}

interface SubmissionContext {
  csapId: string;
  location: string;
  excerpt: string;
  pageReference: string | null;
  specDescription: string;
}

// --- SSE helpers ---

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
} as const;

function sseEvent(event: string, data: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// --- Retrieval (reuses patterns from search/route.ts and submission-search/route.ts) ---

function retrievePolicies(query: string, limit: number = 5): PolicyContext[] {
  if (!Database) return [];
  let db;
  try {
    db = new Database(RRAA_DB_PATH, { readonly: true });

    const ftsQuery = query
      .replace(/['"]/g, '')
      .split(/\s+/)
      .filter((term: string) => term.length > 1)
      .map((term: string) => `"${term}"*`)
      .join(' OR ');

    if (!ftsQuery) return [];

    let results: PolicyContext[] = [];

    try {
      results = db
        .prepare(
          `SELECT
            p.id,
            p.original_text as originalText,
            p.discretion_tier as discretionTier,
            p.source_document_name as sourceDocument,
            p.source_section_reference as sourceSection
          FROM policy_statements p
          INNER JOIN policy_statements_fts fts ON p.id = fts.id
          WHERE policy_statements_fts MATCH ?
            AND p.is_active = 1
          ORDER BY rank
          LIMIT ?`
        )
        .all(ftsQuery, limit) as PolicyContext[];
    } catch {
      // FTS unavailable — fall back to LIKE
      const likeQ = `%${query}%`;
      results = db
        .prepare(
          `SELECT
            id,
            original_text as originalText,
            discretion_tier as discretionTier,
            source_document_name as sourceDocument,
            source_section_reference as sourceSection
          FROM policy_statements
          WHERE is_active = 1
            AND (original_text LIKE ? OR plain_language_summary LIKE ? OR keywords LIKE ?)
          LIMIT ?`
        )
        .all(likeQ, likeQ, likeQ, limit) as PolicyContext[];
    }

    return results;
  } catch (err) {
    console.error('Policy retrieval error:', err);
    return [];
  } finally {
    db?.close();
  }
}

function retrieveSubmissionEvidence(
  query: string,
  submissionId: string,
  limit: number = 5
): SubmissionContext[] {
  if (!Database) return [];
  let db;
  try {
    db = new Database(SUBMISSION_DB_PATH, { readonly: true });

    const assessments = db
      .prepare(
        `SELECT id, csap_id, evidence_found
        FROM assessments
        WHERE evidence_found IS NOT NULL AND submission_id = ?`
      )
      .all(submissionId) as {
      id: number;
      csap_id: string;
      evidence_found: string;
    }[];

    const results: SubmissionContext[] = [];
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter((t) => t.length > 1);

    for (const assessment of assessments) {
      try {
        const evidence = JSON.parse(assessment.evidence_found) as Array<{
          spec_description?: string;
          location?: string;
          page_reference?: string;
          excerpt?: string;
        }>;

        for (const item of evidence) {
          const searchable = [
            item.excerpt || '',
            item.location || '',
            item.spec_description || '',
          ]
            .join(' ')
            .toLowerCase();

          if (queryTerms.some((term) => searchable.includes(term))) {
            results.push({
              csapId: assessment.csap_id,
              location: item.location || 'Unknown',
              excerpt: item.excerpt || '',
              pageReference: item.page_reference || null,
              specDescription: item.spec_description || '',
            });
            if (results.length >= limit) break;
          }
        }
      } catch {
        continue;
      }
      if (results.length >= limit) break;
    }

    return results;
  } catch (err) {
    console.error('Submission retrieval error:', err);
    return [];
  } finally {
    db?.close();
  }
}

// --- Context formatting ---

function formatPolicyContext(policies: PolicyContext[]): string {
  if (policies.length === 0) return '';
  return policies
    .map((p, i) => {
      const source = [p.sourceDocument, p.sourceSection]
        .filter(Boolean)
        .join(', ');
      const tierNote =
        p.discretionTier === 'TIER_2_PROFESSIONAL'
          ? ' [TIER_2: Requires professional judgment]'
          : p.discretionTier === 'TIER_3_STATUTORY'
            ? ' [TIER_3: Requires Statutory Decision Maker]'
            : '';
      return `[${i + 1}] Policy ${p.id}${tierNote} (${source || 'Source unknown'}):\n${p.originalText}`;
    })
    .join('\n\n');
}

function formatSubmissionContext(evidence: SubmissionContext[]): string {
  if (evidence.length === 0) return '';
  return evidence
    .map((e, i) => {
      const ref = [e.location, e.pageReference].filter(Boolean).join(', ');
      return `[${i + 1}] ${e.csapId} (${ref}):\n${e.excerpt}`;
    })
    .join('\n\n');
}

// --- Validation ---

const VALID_SCOPES: Scope[] = ['policy', 'submission', 'hybrid'];
const VALID_MODES: Mode[] = ['fast', 'deep'];

function validateRequest(
  body: ChatRequest
): string | null {
  if (!body.submissionId || !body.query || !body.scope || !body.mode) {
    return 'Missing required fields: submissionId, query, scope, mode';
  }
  if (!VALID_SCOPES.includes(body.scope)) {
    return `Invalid scope: ${body.scope}. Must be one of: ${VALID_SCOPES.join(', ')}`;
  }
  if (!VALID_MODES.includes(body.mode)) {
    return `Invalid mode: ${body.mode}. Must be one of: ${VALID_MODES.join(', ')}`;
  }
  return null;
}

// --- Main handler ---

export async function POST(request: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const engineError = requireLocalEngine();
  if (engineError) return engineError;

  if (!Database) {
    return NextResponse.json(
      { error: 'Chat assistant is only available in local development' },
      { status: 503 }
    );
  }

  // Parse request body
  let body: ChatRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON in request body' },
      { status: 400 }
    );
  }

  const validationError = validateRequest(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const { submissionId, query, scope, mode, model: preferredModel } = body;

  // Indigenous content hard-stop (checks current query only per plan Section 7.6)
  const indigenousMatch = detectIndigenousContent(query);
  if (indigenousMatch) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(sseEvent('delta', { text: INDIGENOUS_HARD_STOP }))
        );
        controller.enqueue(
          encoder.encode(
            sseEvent('meta', {
              model: 'none',
              mode,
              retrievalCount: 0,
              durationMs: 0,
            })
          )
        );
        controller.enqueue(encoder.encode(sseEvent('done', {})));
        controller.close();
      },
    });
    return new Response(stream, { headers: SSE_HEADERS });
  }

  // Cap history at last 10 turns
  const history = (body.history || []).slice(-10);

  // Discover available Ollama models to resolve the right one
  const baseUrl = getOllamaBaseUrl();
  let availableModels: string[] = [];
  try {
    const tagsResp = await fetch(`${baseUrl}/api/tags`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (tagsResp.ok) {
      const tagsData = await tagsResp.json();
      availableModels = (tagsData.models || []).map(
        (m: { name: string }) => m.name
      );
    }
  } catch {
    // Ollama not reachable — handled below
  }

  const resolvedModel = resolveModel(mode, availableModels, preferredModel);
  if (!resolvedModel) {
    const msg =
      availableModels.length === 0
        ? `Ollama is not running or not reachable at ${baseUrl}. Start Ollama and try again.`
        : `No compatible model found for mode '${mode}'. Available models: ${availableModels.join(', ')}`;
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sseEvent('error', { message: msg })));
        controller.close();
      },
    });
    return new Response(stream, { headers: SSE_HEADERS });
  }

  // Retrieve context based on scope
  const startMs = Date.now();

  let policies: PolicyContext[] = [];
  let submissions: SubmissionContext[] = [];

  if (scope === 'policy' || scope === 'hybrid') {
    policies = retrievePolicies(query, 5);
  }
  if (scope === 'submission' || scope === 'hybrid') {
    submissions = retrieveSubmissionEvidence(query, submissionId, 5);
  }

  const retrievalCount = policies.length + submissions.length;

  // Build Ollama messages
  const systemPrompt = buildSystemPrompt();
  const contextPrompt = buildContextPrompt(
    {
      policies: formatPolicyContext(policies),
      submissions: formatSubmissionContext(submissions),
    },
    query
  );

  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
  ];
  for (const turn of history) {
    messages.push({ role: turn.role, content: turn.content });
  }
  messages.push({ role: 'user', content: contextPrompt });

  // Stream response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Emit citation events for retrieved passages
        for (const p of policies) {
          controller.enqueue(
            encoder.encode(
              sseEvent('citation', {
                type: 'policy',
                id: p.id,
                text: p.originalText.slice(0, 200),
                source:
                  [p.sourceDocument, p.sourceSection]
                    .filter(Boolean)
                    .join(', ') || undefined,
              })
            )
          );
        }
        for (const s of submissions) {
          controller.enqueue(
            encoder.encode(
              sseEvent('citation', {
                type: 'submission',
                id: s.csapId,
                text: s.excerpt.slice(0, 200),
                source:
                  [s.location, s.pageReference].filter(Boolean).join(', ') ||
                  undefined,
              })
            )
          );
        }

        // Call Ollama streaming chat API
        const ollamaResp = await fetch(`${baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: resolvedModel,
            messages,
            stream: true,
          }),
        });

        if (!ollamaResp.ok || !ollamaResp.body) {
          controller.enqueue(
            encoder.encode(
              sseEvent('error', {
                message: `Ollama returned ${ollamaResp.status}: ${ollamaResp.statusText}`,
              })
            )
          );
          controller.close();
          return;
        }

        // Parse Ollama NDJSON stream and re-emit as SSE delta events
        const reader = ollamaResp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const chunk = JSON.parse(line);
              if (chunk.message?.content) {
                controller.enqueue(
                  encoder.encode(
                    sseEvent('delta', { text: chunk.message.content })
                  )
                );
              }
            } catch {
              // Skip malformed JSON lines
            }
          }
        }

        // Process remaining buffer
        if (buffer.trim()) {
          try {
            const chunk = JSON.parse(buffer);
            if (chunk.message?.content) {
              controller.enqueue(
                encoder.encode(
                  sseEvent('delta', { text: chunk.message.content })
                )
              );
            }
          } catch {
            // Skip
          }
        }

        // Meta event
        controller.enqueue(
          encoder.encode(
            sseEvent('meta', {
              model: resolvedModel,
              mode,
              retrievalCount,
              durationMs: Date.now() - startMs,
            })
          )
        );

        // Done
        controller.enqueue(encoder.encode(sseEvent('done', {})));
        controller.close();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unknown error during chat';
        try {
          controller.enqueue(
            encoder.encode(sseEvent('error', { message }))
          );
          controller.close();
        } catch {
          // Controller already closed
        }
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
