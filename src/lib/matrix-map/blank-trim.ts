/**
 * TypeScript mirror of `matrix_map.blank_trim(text)`.
 *
 * WHY THIS EXISTS, given that this correction pass is largely about REMOVING
 * second implementations of one rule: the SQL is and remains the authority --
 * it normalizes before persisting. This mirror exists only so the API route can
 * COMPARE its request against what the database will have stored, and it is
 * needed because JavaScript `.trim()` and the SQL TrimString set genuinely
 * differ.
 *
 * BE PRECISE ABOUT HOW THEY DIFFER -- an earlier version of this comment got it
 * wrong. `.trim()` strips whitespace per the ECMAScript definition, which DOES
 * include U+FEFF, so `'\uFEFFx\uFEFF'.trim() === 'x'`. It does NOT include
 * U+200B ZERO WIDTH SPACE (not whitespace in Unicode), so
 * `'\u200Bx\u200B'.trim()` returns the string unchanged. The SQL strips both,
 * along with the rest of an EXPLICITLY ENUMERATED set that `.trim()` does not
 * track.
 *
 * (Written as escapes deliberately: this file is plain ASCII, and embedding the
 * literal characters in a comment about zero-width characters is exactly how
 * one gets pasted somewhere it matters.)
 *
 * The mirror is required regardless of any single character: the SQL boundary
 * normalizes against a set it defines itself, and comparing against
 * `.trim()` would let the two layers drift. Concretely, without the mirror a
 * label containing U+200B commits correctly and then fails its own readback
 * with `verification_label_mismatch`.
 *
 * The duplication is made SAFE rather than merely documented: a contract test
 * parses the character set out of the SQL function and asserts it equals
 * `BLANK_TRIM_CODEPOINTS` exactly, so the two cannot drift apart silently.
 * If you change one, the test fails until you change the other.
 */

/**
 * The exact TrimString code points, in the same order as the SQL literal.
 *
 * ZWNJ (U+200C) and ZWJ (U+200D) are deliberately ABSENT: invisible, but they
 * carry orthographic meaning in Indic, Arabic and emoji sequences, so stripping
 * them would corrupt legitimate text rather than reject blank text.
 */
export const BLANK_TRIM_CODEPOINTS: readonly number[] = [
  0x0009, 0x000a, 0x000b, 0x000c, 0x000d, 0x0020, 0x00a0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003,
  0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a, 0x200b, 0x2028, 0x2029, 0x202f, 0x205f,
  0x3000, 0xfeff,
];

const BLANK_CHARS = new Set(BLANK_TRIM_CODEPOINTS.map((cp) => String.fromCodePoint(cp)));

/**
 * Strip the TrimString set from both ends, exactly as `matrix_map.blank_trim`
 * does. Not a general-purpose trim: use it only to predict what the database
 * will have persisted.
 */
export function blankTrim(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && BLANK_CHARS.has(value[start])) start += 1;
  while (end > start && BLANK_CHARS.has(value[end - 1])) end -= 1;
  return value.slice(start, end);
}
