/**
 * Ollama model registry — maps fast/deep modes to tested local models.
 *
 * Models listed here have been validated in the V2/V3 pilot runs.
 * Phase B will add explicit model selection UI.
 */

export const MODEL_REGISTRY = {
  fast: {
    default: 'mistral-nemo:latest',
    allowed: ['mistral-nemo:latest', 'qwen2.5:14b', 'llama3.1:8b'],
  },
  deep: {
    default: 'qwen3:14b',
    allowed: ['qwen3:14b', 'mistral-nemo:latest'],
  },
} as const;

export type Mode = keyof typeof MODEL_REGISTRY;

/**
 * Resolve which model to use given a mode and the set of available Ollama models.
 * Returns the model name or null if no compatible model is available.
 *
 * Priority: preferredModel (if allowed + available) > default > allowed list order.
 */
export function resolveModel(
  mode: Mode,
  availableModels: string[],
  preferredModel?: string
): string | null {
  const registry = MODEL_REGISTRY[mode];
  const allowed = registry.allowed as readonly string[];

  // If a preferred model is specified, allowed, and available — use it
  if (preferredModel && allowed.includes(preferredModel) && availableModels.includes(preferredModel)) {
    return preferredModel;
  }

  // Try the default first
  if (availableModels.includes(registry.default)) {
    return registry.default;
  }

  // Try each allowed model in order
  for (const model of allowed) {
    if (availableModels.includes(model)) {
      return model;
    }
  }

  return null;
}

/** Ollama base URL, configurable via environment variable */
export function getOllamaBaseUrl(): string {
  return process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
}
