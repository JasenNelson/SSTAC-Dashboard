/**
 * Assistant Model Discovery API
 *
 * Queries the local Ollama instance for available models and maps them
 * to the fast/deep capability registry.
 *
 * Guards: requireAdmin() + requireLocalEngine()
 */

import { NextResponse } from 'next/server';
import { requireAdmin, requireLocalEngine } from '@/lib/api-guards';
import { MODEL_REGISTRY, getOllamaBaseUrl } from '@/lib/ollama/model-registry';

interface OllamaModel {
  name: string;
  size: number;
  details?: {
    parameter_size?: string;
  };
}

interface ModelInfo {
  name: string;
  size: string;
  capabilities: ('fast' | 'deep')[];
}

function formatBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)}GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)}MB`;
}

export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;

  const engineError = requireLocalEngine();
  if (engineError) return engineError;

  const baseUrl = getOllamaBaseUrl();

  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return NextResponse.json({
        models: [],
        error: `Ollama returned ${response.status}: ${response.statusText}`,
      });
    }

    const data = await response.json();
    const ollamaModels: OllamaModel[] = data.models || [];

    const fastAllowed = new Set<string>(MODEL_REGISTRY.fast.allowed as readonly string[]);
    const deepAllowed = new Set<string>(MODEL_REGISTRY.deep.allowed as readonly string[]);

    const models: ModelInfo[] = ollamaModels.map((m) => {
      const capabilities: ('fast' | 'deep')[] = [];
      if (fastAllowed.has(m.name)) capabilities.push('fast');
      if (deepAllowed.has(m.name)) capabilities.push('deep');
      return {
        name: m.name,
        size: m.details?.parameter_size || formatBytes(m.size),
        capabilities,
      };
    });

    return NextResponse.json({ models });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unknown error connecting to Ollama';
    return NextResponse.json({
      models: [],
      error: `Ollama not reachable at ${baseUrl}: ${message}`,
    });
  }
}
