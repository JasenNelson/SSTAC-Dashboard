import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Deferred-triage item 3: disclosure-marker sweep.
 *
 * `list-none` on a <summary> is the author saying "I do not want the native disclosure
 * triangle" -- and in every one of these cases a custom chevron is drawn instead. But
 * `list-none` alone does not remove it in WebKit, which needs
 * `::-webkit-details-marker { display: none }`. So on Safari and iOS the user saw TWO
 * disclosure affordances: the native triangle and the custom chevron.
 *
 * This is a STRUCTURAL guard, deliberately. jsdom cannot render a WebKit pseudo-element at
 * all, so there is no way to assert the visual result here; what IS assertable is that no
 * new `list-none` summary ships without the WebKit rule beside it. A real WebKit visual
 * check is still owed and is recorded as such in the PR body.
 *
 * Falsified: removing the WebKit utility from any one of the eight call sites fails this
 * test and names the offending file and line.
 *
 * Census correction: the triage doc recorded SIX call sites. The real count is EIGHT -- it
 * missed two <summary> elements in AgenticOsClient.tsx, and the MatrixMap site had moved
 * from the line and directory the doc recorded. Counted here from the source rather than
 * from the doc, so the number cannot silently drift again.
 */

const SRC_ROOT = path.join(process.cwd(), 'src');
const WEBKIT_RULE = '[&::-webkit-details-marker]:hidden';

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.name.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

describe('disclosure marker sweep', () => {
  const offenders: string[] = [];
  let listNoneCount = 0;

  for (const file of walk(SRC_ROOT)) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
      if (!line.includes('list-none')) return;
      listNoneCount += 1;
      if (!line.includes(WEBKIT_RULE)) {
        offenders.push(`${path.relative(process.cwd(), file)}:${index + 1}`);
      }
    });
  }

  it('pairs every list-none disclosure with the WebKit marker rule', () => {
    expect(offenders).toEqual([]);
  });

  it('still finds the call sites at all, so the sweep cannot pass by finding nothing', () => {
    // Without this, deleting every disclosure in the codebase -- or breaking the walk --
    // would make the assertion above pass vacuously. Pair every absence check with an
    // existence check.
    expect(listNoneCount).toBeGreaterThanOrEqual(8);
  });
});
