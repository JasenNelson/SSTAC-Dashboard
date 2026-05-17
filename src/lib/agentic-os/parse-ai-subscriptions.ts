// Server-only parser for Knowledge-Base/AI_SUBSCRIPTIONS.md.
//
// AI_SUBSCRIPTIONS.md is the single source of truth for the Agentic OS admin
// page's AI Subscriptions panel. Plain markdown with YAML frontmatter. Owner
// edits it by hand. This parser turns it into typed data structures the view
// layer consumes.
//
// Architecture: mirrors `parse-projects-map.ts` deliberately so the two data
// surfaces (PROJECTS_MAP + AI_SUBSCRIPTIONS) follow the same maintenance
// pattern. If you change one, consider whether the symmetric change applies
// to the other.
//
// Pure parsing functions are exported for unit testing in isolation. The IO
// wrapper readAiSubscriptions() handles filesystem access and path resolution.
// Never import this module into a 'use client' file -- it uses node:fs.

import { promises as fs } from 'fs';
import path from 'path';
import matter from 'gray-matter';

export interface AiSubscription {
  /** Heading text, stripped of wrapping backticks. e.g. "Claude" */
  name: string;
  /** Free-text provider name from **Provider:** field. Empty string if missing. */
  provider: string;
  /** Free-text tier from **Subscription tier:** field. Empty string if missing. */
  subscriptionTier: string;
  /** Free-text cadence from **Billing cycle:** field. Empty string if missing. */
  billingCycle: string;
  /** Free-text date / pointer from **Reset date:** field. Empty string if missing. */
  resetDate: string;
  /** ISO-ish date from **Last checked:** field. Empty string if missing. */
  lastChecked: string;
  /** Click-through URL from **Usage URL:** field. Empty string if missing. */
  usageUrl: string;
  /**
   * Optional CLI subcommand string from **Live check command:** field.
   * Stored as the verbatim shell string the operator could type (e.g.
   * "claude auth status"). The launch route does NOT execute this verbatim
   * -- it maps the entry to a hardcoded launch-validator template by name.
   * Stored here for display + operator copy-paste.
   */
  liveCheckCommand?: string;
  /**
   * Optional action key from **Live check action:** field. Must exactly
   * match a hardcoded entry in launch-validator.ts COMMAND_TEMPLATES
   * (e.g. "check_claude_auth"). The renderer uses this to wire the
   * "Check now" button to the launch route. Absent -> no button rendered
   * (provider stays manual-data + click-through only).
   *
   * SECURITY: this string is sent to the launch route as the action key
   * and is matched there against COMMAND_TEMPLATES via a constant-time
   * lookup. The data file is owner-edited and trusted; the launch
   * validator's allowlist check is the security boundary regardless.
   */
  liveCheckAction?: string;
  /** Free-text notes from **Notes:** field. Empty string if missing. */
  notes: string;
  /**
   * Any other **Bold:** field encountered (e.g. "Status:", "Renewal:"). Keys
   * preserve original casing.
   */
  extras: Record<string, string>;
}

export interface ParsedAiSubscriptions {
  subscriptions: AiSubscription[];
}

// Field key (lowercased) -> AiSubscription property mapping. Anything not in
// this map drops into `extras` keyed by the original (un-lowercased, trimmed)
// heading.
const FIELD_TO_PROPERTY: Record<string, keyof AiSubscription> = {
  provider: 'provider',
  'subscription tier': 'subscriptionTier',
  'billing cycle': 'billingCycle',
  'reset date': 'resetDate',
  'last checked': 'lastChecked',
  'usage url': 'usageUrl',
  'live check command': 'liveCheckCommand',
  'live check action': 'liveCheckAction',
  notes: 'notes',
};

// Action keys allowed for the `Live check action:` field. Mirrors the
// COMMAND_TEMPLATES check_* entries in launch-validator.ts. The launch
// route is the security boundary; this allowlist exists so an owner typo
// (e.g. "check_claud_auth") fails closed at parse time instead of
// silently rendering a button that produces a 400 at click time.
const ALLOWED_LIVE_CHECK_ACTIONS: ReadonlySet<string> = new Set<string>([
  'check_claude_auth',
  'check_codex_login',
  'check_cursor_about',
  'check_ollama_models',
]);

// Exported for tests + future allowlist surfacing (e.g. a /doctor route
// that prints the supported actions). Callers MUST NOT mutate.
export const __ALLOWED_LIVE_CHECK_ACTIONS_FOR_TEST: ReadonlySet<string> =
  ALLOWED_LIVE_CHECK_ACTIONS;

const RE_SECTION_HEADING = /^##\s+(.+)$/;
const RE_PROVIDER_HEADING = /^###\s+(.+)$/;
const RE_BOLD_FIELD = /^\*\*([^:]+):\*\*\s*(.*)$/;
const RE_BOM = /^﻿/;

/**
 * Strip wrapping backticks ONLY when the value is a single backtick-delimited
 * token. Leaves inline-code values alone, since those may contain meaningful
 * structure (e.g. a multi-token CLI command).
 */
function stripWrappingBackticks(s: string): string {
  const t = s.trim();
  if (
    t.length >= 2 &&
    t.startsWith('`') &&
    t.endsWith('`') &&
    t.indexOf('`', 1) === t.length - 1
  ) {
    return t.slice(1, -1);
  }
  return t;
}

/** Trim wrapping straight/curly quotes from a free-text value. */
function stripWrappingQuotes(s: string): string {
  return s.replace(/^["'“‘]|["'”’]$/g, '');
}

function emptySubscription(name: string): AiSubscription {
  return {
    name,
    provider: '',
    subscriptionTier: '',
    billingCycle: '',
    resetDate: '',
    lastChecked: '',
    usageUrl: '',
    notes: '',
    extras: {},
  };
}

/**
 * Parse the body of an AI_SUBSCRIPTIONS.md file (post-frontmatter) into typed
 * data.
 *
 * Strategy:
 *  - gray-matter strips YAML frontmatter; remaining body is scanned line-by-line.
 *  - `## Providers` opens the providers section. Each subsequent `### name`
 *    starts a new provider; `**Field:**` lines until the next heading populate it.
 *  - Section names other than "Providers" are ignored (Status Codes, Maintenance,
 *    etc. are documentation for humans, not data for the dashboard).
 *  - Malformed lines are silently skipped (human-maintained data; forgiveness
 *    > strictness).
 */
export function parseAiSubscriptions(markdown: string): ParsedAiSubscriptions {
  const stripped = markdown.replace(RE_BOM, '');
  // gray-matter is forgiving when frontmatter is absent; it just returns content.
  const { content } = matter(stripped);
  const lines = content.replace(/\r\n/g, '\n').split('\n');

  const subscriptions: AiSubscription[] = [];

  let currentSection: string | null = null;
  let currentSubscription: AiSubscription | null = null;

  const flushSubscription = () => {
    if (currentSubscription) {
      subscriptions.push(currentSubscription);
      currentSubscription = null;
    }
  };

  for (const line of lines) {
    // Section heading (##) closes any open subscription and resets section state.
    const sectionMatch = line.match(RE_SECTION_HEADING);
    if (sectionMatch) {
      flushSubscription();
      currentSection = sectionMatch[1].trim().toLowerCase();
      continue;
    }

    if (currentSection === 'providers') {
      const provMatch = line.match(RE_PROVIDER_HEADING);
      if (provMatch) {
        flushSubscription();
        const name = stripWrappingBackticks(provMatch[1]).trim();
        if (name) currentSubscription = emptySubscription(name);
        continue;
      }

      if (currentSubscription) {
        const fieldMatch = line.match(RE_BOLD_FIELD);
        if (!fieldMatch) continue;

        const rawKey = fieldMatch[1].trim();
        const rawValue = fieldMatch[2];
        const value = stripWrappingQuotes(stripWrappingBackticks(rawValue)).trim();
        const prop = FIELD_TO_PROPERTY[rawKey.toLowerCase()];

        if (
          prop === 'provider' ||
          prop === 'subscriptionTier' ||
          prop === 'billingCycle' ||
          prop === 'resetDate' ||
          prop === 'lastChecked' ||
          prop === 'usageUrl' ||
          prop === 'notes'
        ) {
          currentSubscription[prop] = value;
        } else if (prop === 'liveCheckCommand') {
          // Only populate when non-empty AND not the literal "none" sentinel.
          // Saves the renderer from special-casing "none" / "" everywhere.
          if (value && value.toLowerCase() !== 'none') {
            currentSubscription.liveCheckCommand = value;
          }
        } else if (prop === 'liveCheckAction') {
          // Only populate when non-empty AND matches the allowlist. An
          // unrecognized action silently drops -- prevents an owner typo
          // from rendering a button that 400s at click time.
          if (value && ALLOWED_LIVE_CHECK_ACTIONS.has(value)) {
            currentSubscription.liveCheckAction = value;
          }
        } else {
          // Unknown bold field -> extras, preserving the original key casing.
          // Defense in depth: if the trimmed key resolves to a typed property,
          // it must NEVER reach extras even if lookup-key drifted.
          const normalized = rawKey.toLowerCase().trim();
          if (normalized in FIELD_TO_PROPERTY) continue;
          if (rawKey && !(rawKey in currentSubscription.extras)) {
            currentSubscription.extras[rawKey] = value;
          }
        }
      }
      // Within the providers section but not a heading and no current
      // subscription open (e.g. intro prose between ## Providers and the
      // first ###): silently ignore.
    }
  }

  flushSubscription();

  return { subscriptions };
}

/**
 * Resolve the absolute path to AI_SUBSCRIPTIONS.md.
 *
 * Order of resolution mirrors PROJECTS_MAP.md:
 *   1. If env var KNOWLEDGE_BASE_PATH is set, treat it as the Knowledge-Base
 *      directory and join AI_SUBSCRIPTIONS.md to it.
 *   2. Otherwise fall back to "../Knowledge-Base/AI_SUBSCRIPTIONS.md" relative
 *      to the current process cwd (which during `next dev` is the dashboard root).
 *
 * The env var override lets us point at an alternate Knowledge-Base location
 * for tests, CI, or a co-tenanted dev setup without changing code.
 */
export function resolveAiSubscriptionsPath(): string {
  const envBase = process.env.KNOWLEDGE_BASE_PATH;
  if (envBase && envBase.trim()) {
    return path.join(envBase.trim(), 'AI_SUBSCRIPTIONS.md');
  }
  return path.join(process.cwd(), '..', 'Knowledge-Base', 'AI_SUBSCRIPTIONS.md');
}

/**
 * Read AI_SUBSCRIPTIONS.md from disk and parse it.
 *
 * @param absPath Optional explicit absolute path. If omitted, resolveAiSubscriptionsPath() is used.
 * @throws if the file cannot be read (ENOENT, EACCES, etc.) -- caller decides
 *         whether to render an empty state or surface the error.
 */
export async function readAiSubscriptions(absPath?: string): Promise<ParsedAiSubscriptions> {
  const target = absPath ?? resolveAiSubscriptionsPath();
  const markdown = await fs.readFile(target, 'utf-8');
  return parseAiSubscriptions(markdown);
}
