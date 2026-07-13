import { describe, it, expect } from 'vitest';
import { isValidSessionId } from '../discovery';

describe('isValidSessionId', () => {
  it('accepts a normal valid alphanumeric id with dashes and underscores', () => {
    expect(isValidSessionId('SESSION-123_abc')).toBe(true);
    expect(isValidSessionId('a')).toBe(true);
    expect(isValidSessionId('A1_')).toBe(true);
  });

  it('rejects ids with path traversal character: /', () => {
    expect(isValidSessionId('session/123')).toBe(false);
    expect(isValidSessionId('/session')).toBe(false);
    expect(isValidSessionId('session/')).toBe(false);
  });

  it('rejects ids with path traversal character: \\', () => {
    expect(isValidSessionId('session\\123')).toBe(false);
    expect(isValidSessionId('\\session')).toBe(false);
    expect(isValidSessionId('session\\')).toBe(false);
  });

  it('rejects ids with path traversal character: ..', () => {
    // The regex ^[A-Za-z0-9_-]+$ does not allow dots
    expect(isValidSessionId('..')).toBe(false);
    expect(isValidSessionId('..session')).toBe(false);
    expect(isValidSessionId('session..')).toBe(false);
    expect(isValidSessionId('ses..sion')).toBe(false);
  });

  it('rejects ids with a null byte', () => {
    expect(isValidSessionId('session\0')).toBe(false);
    expect(isValidSessionId('\0session')).toBe(false);
  });

  it('rejects empty ids', () => {
    expect(isValidSessionId('')).toBe(false);
  });

  it('rejects over-length (>200 char) ids', () => {
    const exactly200 = 'A'.repeat(200);
    expect(isValidSessionId(exactly200)).toBe(true);

    const over200 = 'A'.repeat(201);
    expect(isValidSessionId(over200)).toBe(false);
  });

  it('rejects other special characters', () => {
    expect(isValidSessionId('session$')).toBe(false);
    expect(isValidSessionId('session@')).toBe(false);
    expect(isValidSessionId('session!')).toBe(false);
    expect(isValidSessionId('session ')).toBe(false); // Space
  });
});

describe.skip('fs-bound functions', () => {
  it('discoverPacketSessions, loadPacketBySessionId, getArtifactPath are skipped', () => {
    // Skipped: No clean temp-dir harness is obvious from the sibling mirror tests
    // (safe-path.test.ts). Skipping brittle fs tests as instructed by the brief.
  });
});
