/**
 * RAW-BYTE CONTROL-CHARACTER SCAN.
 *
 * All that remains of this module. The guard-proving helper it once held was
 * retired with the source-text machinery it supported: proving a regex could
 * fire did not prove it was the right regex, and the pattern generated five
 * consecutive review cycles. Consumer behaviour is proved by execution now.
 *
 * This check survives because it cannot be expressed behaviourally and it
 * found a real defect: four assertions carried a literal 0x08 where a word-boundary escape was
 * intended, which the plain-ASCII sweep could never catch -- 0x08 is code
 * point 8, inside the <= 127 ceiling that sweep tests.
 */

/**
 * ASCII CONTROL CHARACTERS that must never appear in repository source.
 *
 * Deliberately DISTINCT from the plain-ASCII (code point <= 127) check, which
 * this class passes trivially. TAB, LF and CR are the only permitted controls.
 */
export function findForbiddenControlChars(text: string): Array<{ line: number; codePoint: number }> {
  const hits: Array<{ line: number; codePoint: number }> = [];
  text.split('\n').forEach((lineText, index) => {
    for (const ch of lineText) {
      const cp = ch.codePointAt(0)!;
      const forbidden =
        (cp >= 0x00 && cp <= 0x08) ||
        cp === 0x0b ||
        cp === 0x0c ||
        (cp >= 0x0e && cp <= 0x1f) ||
        cp === 0x7f;
      if (forbidden) hits.push({ line: index + 1, codePoint: cp });
    }
  });
  return hits;
}
