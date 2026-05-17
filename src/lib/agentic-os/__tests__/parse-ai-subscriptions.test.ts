import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

import {
  parseAiSubscriptions,
  readAiSubscriptions,
  resolveAiSubscriptionsPath,
  __ALLOWED_LIVE_CHECK_ACTIONS_FOR_TEST,
} from '../parse-ai-subscriptions';

// Inline fixtures mirror the real AI_SUBSCRIPTIONS.md shape. Each test
// stays self-contained (no shared mutable state) so failures localize.

const HAPPY_PATH = `---
title: AI Subscriptions
type: index
last_updated: 2026-05-16
---

# AI Subscriptions

intro prose

---

## Providers

### \`Claude\`

**Provider:** Anthropic
**Subscription tier:** Max
**Billing cycle:** Monthly
**Reset date:** check Anthropic Console
**Last checked:** 2026-05-16
**Usage URL:** https://console.anthropic.com/settings/usage
**Live check command:** \`claude auth status\`
**Live check action:** check_claude_auth
**Notes:** Live auth-status subcommand returns JSON.

### \`Codex\`

**Provider:** OpenAI
**Subscription tier:** ChatGPT Pro
**Billing cycle:** ~5h cadence for some tiers
**Reset date:** unknown -- error messages
**Last checked:** 2026-05-16
**Usage URL:** https://platform.openai.com/usage
**Live check command:** \`codex login status\`
**Live check action:** check_codex_login
**Notes:** Minimal live signal.

### \`Cursor\`

**Provider:** Anysphere
**Subscription tier:** Pro
**Billing cycle:** Monthly
**Reset date:** check Cursor settings
**Last checked:** 2026-05-16
**Usage URL:** https://www.cursor.com/settings
**Live check command:** \`agent about\`
**Live check action:** check_cursor_about
**Notes:** Rich account info.

---

## Status Codes

| Code | Meaning |
|---|---|
| ACTIVE | within quota |
`;

describe('parseAiSubscriptions', () => {
  it('parses the happy path with 3 providers + all fields populated', () => {
    const result = parseAiSubscriptions(HAPPY_PATH);
    expect(result.subscriptions).toHaveLength(3);

    const claude = result.subscriptions[0];
    expect(claude.name).toBe('Claude');
    expect(claude.provider).toBe('Anthropic');
    expect(claude.subscriptionTier).toBe('Max');
    expect(claude.billingCycle).toBe('Monthly');
    expect(claude.lastChecked).toBe('2026-05-16');
    expect(claude.usageUrl).toBe('https://console.anthropic.com/settings/usage');
    expect(claude.liveCheckCommand).toBe('claude auth status');
    expect(claude.liveCheckAction).toBe('check_claude_auth');
    expect(claude.notes).toContain('Live auth-status');

    const codex = result.subscriptions[1];
    expect(codex.name).toBe('Codex');
    expect(codex.liveCheckAction).toBe('check_codex_login');

    const cursor = result.subscriptions[2];
    expect(cursor.name).toBe('Cursor');
    expect(cursor.liveCheckAction).toBe('check_cursor_about');
  });

  it('ignores sections other than "Providers" -- Status Codes table does not become a provider', () => {
    const result = parseAiSubscriptions(HAPPY_PATH);
    // 3 providers (Claude, Codex, Cursor); the Status Codes section MUST
    // not produce a 4th entry even though it has a ## heading. Validate
    // by name equality so "Codex" (which contains the substring "Code")
    // does not trip a loose substring guard against the Status Codes
    // table title.
    expect(result.subscriptions).toHaveLength(3);
    expect(result.subscriptions.map((s) => s.name)).toEqual(['Claude', 'Codex', 'Cursor']);
  });

  it('treats "none" (any case) as absent liveCheckCommand', () => {
    const noLiveCheck = `---
title: AI Subscriptions
---

## Providers

### \`ManualOnly\`

**Provider:** Web-only Provider
**Subscription tier:** Pro
**Usage URL:** https://example.com/usage
**Live check command:** none
**Notes:** No CLI exposure.
`;
    const result = parseAiSubscriptions(noLiveCheck);
    expect(result.subscriptions).toHaveLength(1);
    expect(result.subscriptions[0].liveCheckCommand).toBeUndefined();
  });

  it('treats empty liveCheckCommand value as absent', () => {
    const emptyLiveCheck = `---
title: AI Subscriptions
---

## Providers

### \`Bare\`

**Provider:** X
**Live check command:**
`;
    const result = parseAiSubscriptions(emptyLiveCheck);
    expect(result.subscriptions[0].liveCheckCommand).toBeUndefined();
  });

  it('rejects an unrecognized liveCheckAction (allowlist enforcement)', () => {
    // Owner typo "check_claud_auth" (missing e) MUST fail closed at parse
    // time instead of rendering a button that 400s at click time.
    const bogusAction = `---
title: AI Subscriptions
---

## Providers

### \`Claude\`

**Live check action:** check_claud_auth
`;
    const result = parseAiSubscriptions(bogusAction);
    expect(result.subscriptions).toHaveLength(1);
    expect(result.subscriptions[0].liveCheckAction).toBeUndefined();
  });

  it('accepts every allowlisted live-check action verbatim', () => {
    for (const action of __ALLOWED_LIVE_CHECK_ACTIONS_FOR_TEST) {
      const md = `---
title: AI Subscriptions
---

## Providers

### \`Sample\`

**Live check action:** ${action}
`;
      const result = parseAiSubscriptions(md);
      expect(result.subscriptions[0].liveCheckAction, `${action} should be allowlisted`).toBe(action);
    }
  });

  it('returns an empty subscriptions list for an empty Providers section', () => {
    const empty = `---
title: AI Subscriptions
---

## Providers

(no providers configured yet)
`;
    const result = parseAiSubscriptions(empty);
    expect(result.subscriptions).toEqual([]);
  });

  it('handles markdown with no frontmatter', () => {
    const noFm = `# AI Subscriptions

## Providers

### \`Solo\`

**Provider:** Test
**Subscription tier:** Free
`;
    const result = parseAiSubscriptions(noFm);
    expect(result.subscriptions).toHaveLength(1);
    expect(result.subscriptions[0].provider).toBe('Test');
  });

  it('strips wrapping backticks from heading-style names but preserves backticks inside commands', () => {
    const md = `---
title: AI Subscriptions
---

## Providers

### \`Claude\`

**Live check command:** \`claude auth status\`
**Notes:** prose with \`inline code\` should pass through.
`;
    const result = parseAiSubscriptions(md);
    expect(result.subscriptions[0].name).toBe('Claude');
    expect(result.subscriptions[0].liveCheckCommand).toBe('claude auth status');
    // Inline-code inside multi-token notes stays verbatim (one backtick
    // pair is wrapping; embedded \`inline code\` is structural).
    expect(result.subscriptions[0].notes).toContain('inline code');
  });

  it('preserves CRLF line endings without producing phantom subscriptions', () => {
    const md = HAPPY_PATH.replace(/\n/g, '\r\n');
    const result = parseAiSubscriptions(md);
    expect(result.subscriptions).toHaveLength(3);
  });

  it('puts unknown bold fields into extras keyed by original casing', () => {
    const md = `---
title: AI Subscriptions
---

## Providers

### \`Sample\`

**Provider:** X
**Some Custom Field:** custom-value
**Another:** another-value
`;
    const result = parseAiSubscriptions(md);
    const sub = result.subscriptions[0];
    expect(sub.extras['Some Custom Field']).toBe('custom-value');
    expect(sub.extras['Another']).toBe('another-value');
  });

  it('does NOT double-write a typed field into extras even if casing varies', () => {
    const md = `---
title: AI Subscriptions
---

## Providers

### \`Test\`

**Provider:** Anthropic
**provider:** Anthropic-lowercase
`;
    const result = parseAiSubscriptions(md);
    const sub = result.subscriptions[0];
    // Both go through the FIELD_TO_PROPERTY map (case-insensitive). The
    // lowercase one OVERWRITES the typed property; it does NOT also land
    // in extras. extras stays empty.
    expect(sub.provider).toBe('Anthropic-lowercase');
    expect(sub.extras).toEqual({});
  });

  it('silently skips lines that do not match heading or bold-field shape', () => {
    const noisy = `---
title: AI Subscriptions
---

## Providers

random prose between heading and first provider

### \`Sample\`

random prose between heading and first bold field

**Provider:** OK

> a blockquote
- a bullet that is not a bold field
plain paragraph
`;
    const result = parseAiSubscriptions(noisy);
    expect(result.subscriptions).toHaveLength(1);
    expect(result.subscriptions[0].provider).toBe('OK');
    expect(result.subscriptions[0].extras).toEqual({});
  });
});

describe('resolveAiSubscriptionsPath', () => {
  const original = process.env.KNOWLEDGE_BASE_PATH;
  afterEach(() => {
    if (original === undefined) {
      delete process.env.KNOWLEDGE_BASE_PATH;
    } else {
      process.env.KNOWLEDGE_BASE_PATH = original;
    }
  });

  it('uses KNOWLEDGE_BASE_PATH when set', () => {
    process.env.KNOWLEDGE_BASE_PATH = path.join('C:', 'KB-alt');
    expect(resolveAiSubscriptionsPath()).toBe(
      path.join('C:', 'KB-alt', 'AI_SUBSCRIPTIONS.md'),
    );
  });

  it('falls back to cwd ../Knowledge-Base/AI_SUBSCRIPTIONS.md when env var unset', () => {
    delete process.env.KNOWLEDGE_BASE_PATH;
    const resolved = resolveAiSubscriptionsPath();
    expect(resolved.endsWith(path.join('Knowledge-Base', 'AI_SUBSCRIPTIONS.md'))).toBe(true);
  });

  it('trims whitespace-only KNOWLEDGE_BASE_PATH and falls through to default', () => {
    process.env.KNOWLEDGE_BASE_PATH = '   ';
    const resolved = resolveAiSubscriptionsPath();
    expect(resolved.endsWith(path.join('Knowledge-Base', 'AI_SUBSCRIPTIONS.md'))).toBe(true);
  });
});

describe('readAiSubscriptions', () => {
  let tmpDir: string;
  const original = process.env.KNOWLEDGE_BASE_PATH;
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-subs-test-'));
    process.env.KNOWLEDGE_BASE_PATH = tmpDir;
  });
  afterEach(async () => {
    if (original === undefined) {
      delete process.env.KNOWLEDGE_BASE_PATH;
    } else {
      process.env.KNOWLEDGE_BASE_PATH = original;
    }
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('reads + parses the AI_SUBSCRIPTIONS.md file at the env-resolved path', async () => {
    await fs.writeFile(
      path.join(tmpDir, 'AI_SUBSCRIPTIONS.md'),
      HAPPY_PATH,
      'utf-8',
    );
    const result = await readAiSubscriptions();
    expect(result.subscriptions).toHaveLength(3);
  });

  it('accepts an explicit absolute path that bypasses env resolution', async () => {
    const altPath = path.join(tmpDir, 'alt.md');
    await fs.writeFile(altPath, HAPPY_PATH, 'utf-8');
    const result = await readAiSubscriptions(altPath);
    expect(result.subscriptions).toHaveLength(3);
  });

  it('throws ENOENT when the resolved file is missing', async () => {
    await expect(readAiSubscriptions()).rejects.toThrow();
  });
});
