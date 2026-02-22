import { describe, it, expect, afterEach } from 'vitest';
import { resolveModel, getOllamaBaseUrl, MODEL_REGISTRY } from '../model-registry';

describe('MODEL_REGISTRY', () => {
  it('has fast and deep modes with defaults and allowed lists', () => {
    expect(MODEL_REGISTRY.fast.default).toBe('mistral-nemo:latest');
    expect(MODEL_REGISTRY.fast.allowed.length).toBeGreaterThan(0);
    expect(MODEL_REGISTRY.deep.default).toBe('qwen3:14b');
    expect(MODEL_REGISTRY.deep.allowed.length).toBeGreaterThan(0);
  });
});

describe('resolveModel', () => {
  it('returns default model when available', () => {
    expect(resolveModel('fast', ['mistral-nemo:latest', 'other'])).toBe(
      'mistral-nemo:latest'
    );
  });

  it('returns null when no compatible models available', () => {
    expect(resolveModel('fast', ['unrelated-model'])).toBeNull();
  });

  it('returns null when model list is empty', () => {
    expect(resolveModel('fast', [])).toBeNull();
  });

  it('prefers preferred model when allowed and available', () => {
    expect(
      resolveModel('fast', ['mistral-nemo:latest', 'qwen2.5:14b'], 'qwen2.5:14b')
    ).toBe('qwen2.5:14b');
  });

  it('ignores preferred model when not in allowed list', () => {
    expect(
      resolveModel('fast', ['mistral-nemo:latest', 'rogue:7b'], 'rogue:7b')
    ).toBe('mistral-nemo:latest');
  });

  it('ignores preferred model when not available locally', () => {
    expect(
      resolveModel('fast', ['mistral-nemo:latest'], 'qwen2.5:14b')
    ).toBe('mistral-nemo:latest');
  });

  it('falls back through allowed list when default unavailable', () => {
    expect(resolveModel('fast', ['llama3.1:8b'])).toBe('llama3.1:8b');
  });

  it('resolves deep mode default', () => {
    expect(resolveModel('deep', ['qwen3:14b'])).toBe('qwen3:14b');
  });

  it('resolves deep mode fallback', () => {
    expect(resolveModel('deep', ['mistral-nemo:latest'])).toBe(
      'mistral-nemo:latest'
    );
  });
});

describe('getOllamaBaseUrl', () => {
  const saved = process.env.OLLAMA_BASE_URL;

  afterEach(() => {
    if (saved === undefined) {
      delete process.env.OLLAMA_BASE_URL;
    } else {
      process.env.OLLAMA_BASE_URL = saved;
    }
  });

  it('returns default when env not set', () => {
    delete process.env.OLLAMA_BASE_URL;
    expect(getOllamaBaseUrl()).toBe('http://localhost:11434');
  });

  it('returns env value when set', () => {
    process.env.OLLAMA_BASE_URL = 'http://custom:9999';
    expect(getOllamaBaseUrl()).toBe('http://custom:9999');
  });
});
