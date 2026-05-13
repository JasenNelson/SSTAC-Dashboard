// engine_v2 frontend Lane 2d / Phase D: chat mode -> Ollama model map.
//
// User-editable scaffolding. Owner edits the model ids and fallback
// chains here without touching route code. The chat route imports
// MODE_TO_MODEL and walks `default` -> `fallbacks` against the cached
// `/api/tags` probe to pick a model.
//
// gemma4:26b is INTENTIONALLY ABSENT from defaults and fallbacks. The
// owner's hardware spills it to CPU, which is unacceptably slow for
// interactive chat. The snapshot test in
// __tests__/chat-model-registry.test.ts pins this absence.
//
// ASCII only.

import type { ChatMode } from "./chat-prompts";

export interface ChatModeConfig {
  default: string;
  fallbacks: readonly string[];
  temperature: number;
}

export const MODE_TO_MODEL: Readonly<Record<ChatMode, ChatModeConfig>> = {
  fast: {
    default: "gemma4:e4b",
    fallbacks: ["qwen3.5:9b", "mistral-nemo:latest"],
    temperature: 0.3,
  },
  thinking: {
    default: "qwen2.5:14b-instruct-q4_K_M",
    fallbacks: ["qwen3.5:9b", "mistral-nemo:latest"],
    temperature: 0.5,
  },
} as const;

/**
 * Resolve a model id for the requested mode against the available tag
 * list. Returns null if neither default nor any fallback is available.
 * The route emits a clean `error` SSE event when resolution fails.
 */
export function resolveChatModel(
  mode: ChatMode,
  availableModels: readonly string[],
): { model: string; temperature: number } | null {
  const cfg = MODE_TO_MODEL[mode];
  if (availableModels.includes(cfg.default)) {
    return { model: cfg.default, temperature: cfg.temperature };
  }
  for (const fb of cfg.fallbacks) {
    if (availableModels.includes(fb)) {
      return { model: fb, temperature: cfg.temperature };
    }
  }
  return null;
}
