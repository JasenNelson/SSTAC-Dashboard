// Regression guard for the docs-archive-investigation link scanner.
//
// 2026-06-01: the gate false-failed because a markdown-link EXAMPLE written inside an inline
// code span (`[text](filename.md)`) was parsed as a real (missing) link target. The fix strips
// fenced code blocks FIRST, then line-bounded inline code spans of any backtick-run length.
// These tests lock that behavior in so the false-positive (and the multi-backtick / fenced
// desync edge cases codex flagged) cannot return. Plain ASCII only.
import { describe, it, expect } from 'vitest';
import { stripFences, parseMarkdownLinks } from '../docs-archive-investigation.mjs';

const links = (md) => parseMarkdownLinks(stripFences(md));

describe('docs-archive-investigation link scanner: code spans are not links', () => {
  it('ignores a single-backtick inline-code link example but keeps a real link', () => {
    expect(links('a [real](docs/INDEX.md) and `[ex](single.md)` end')).toEqual(['docs/INDEX.md']);
  });

  it('ignores a double-backtick inline-code link example (codex round 1 edge case)', () => {
    expect(links('a [real](docs/AGENTS.md) and ``[ex](double.md)`` end')).toEqual(['docs/AGENTS.md']);
  });

  it('keeps prose links around a fenced block whose code contains backticks (no desync)', () => {
    // codex round 2 regression: an inline stripper run before fence removal consumed the
    // closing-fence backticks and stripped real prose. Fenced-first + line-bounded prevents it.
    const md = 'before [a](docs/A.md)\n```js\nconsole.error(`Error: ${x}`)\n```\nafter [b](docs/B.md)';
    expect(links(md)).toEqual(['docs/A.md', 'docs/B.md']);
  });

  it('handles a stray unclosed backtick before a fenced block', () => {
    const md = '[r](docs/E.md) `stray\n```\ncode\n```\n[s](docs/F.md)';
    expect(links(md)).toEqual(['docs/E.md', 'docs/F.md']);
  });

  it('still detects a genuine link target outside any code span', () => {
    // The scanner must NOT over-strip: real links are still extracted so real broken links fail.
    expect(links('see [missing](docs/does-not-exist.md)')).toEqual(['docs/does-not-exist.md']);
  });
});
