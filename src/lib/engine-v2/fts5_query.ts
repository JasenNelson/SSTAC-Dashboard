// engine_v2 frontend Lane 2d / Module L2d-1: FTS5 query sanitizer.
//
// Pure function. Takes raw reviewer input, returns either:
//   - a well-formed FTS5 MATCH expression (prefix OR-joined quoted tokens), or
//   - null (no usable tokens; caller short-circuits to LIKE fallback / 400).
//
// Defense-in-depth notes (ED-2d-3):
// - Strip FTS5 syntactic metacharacters BEFORE tokenizing: ', ", *, ;, --,
//   and ASCII control characters (including newlines / tabs / NUL).
// - Drop unicode surrogates and other non-printable code points (>= U+FFFE);
//   FTS5 tokenizer behavior on lone surrogates is undefined.
// - Split on whitespace; drop tokens shorter than 2 chars (matches the route
//   400-gate threshold).
// - Wrap each token in double quotes (FTS5 phrase quoting) and suffix with `*`
//   (prefix match).
// - Cap at 16 tokens to bound MATCH parse cost.
// - Return null if zero usable tokens remain.
//
// The `MATCH` parameter is also a prepared-statement bind, so even if this
// sanitizer regresses the SQL injection class is structurally blocked. The
// sanitizer's job is to keep the FTS5 expression well-formed (no parse errors
// that would surface as a 500).
//
// LIKE fallback helper: escapeLikePattern wraps `%` and `_` (LIKE wildcards)
// with the SQLite ESCAPE character so reviewer punctuation does not turn into
// a wildcard match.

const MAX_TOKENS = 16;
const MIN_TOKEN_LEN = 2;

// Characters stripped from input before tokenization.
// - Single quote, double quote: SQL string delimiters (defense in depth).
// - Asterisk: FTS5 prefix operator (we add our own).
// - Semicolon: SQL statement terminator.
// - Two consecutive hyphens are stripped separately (SQL line comment).
// - Other FTS5 / parser metacharacters: ( ) : ^ + - = .
// Note: FTS5 boolean operators (AND / OR / NOT / NEAR) are NOT in the strip
// set; they survive the sanitizer and get phrase-quoted as bag-of-words
// tokens, so they are NOT exposed as boolean operators -- intentional v1
// parity. Reviewers searching for the literal string "AND" or "NOT" get a
// term match, not a boolean clause.
const STRIP_CHARS_RE = /['"*;()=:^+\-.]/g;
const DOUBLE_HYPHEN_RE = /--+/g;

// Control characters: U+0000 - U+001F (incl. \n, \r, \t, NUL) and U+007F.
// Plus the unicode surrogate range U+D800-U+DFFF and the two noncharacters
// U+FFFE / U+FFFF. Built via RegExp + string literal so the source file is
// pure ASCII per CLAUDE.md discipline (no literal control / surrogate /
// non-character glyphs embedded in source).
const CONTROL_AND_SURROGATES_RE = new RegExp(
  "[\\u0000-\\u001F\\u007F\\uD800-\\uDFFF\\uFFFE\\uFFFF]",
  "g",
);

export function sanitizeForFts(raw: string): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(CONTROL_AND_SURROGATES_RE, " ")
    .replace(DOUBLE_HYPHEN_RE, " ")
    .replace(STRIP_CHARS_RE, " ")
    .trim();
}

export function buildFtsQuery(rawQuery: string): string | null {
  const sanitized = sanitizeForFts(rawQuery);
  if (sanitized.length === 0) return null;

  const tokens = sanitized
    .split(/\s+/)
    .filter((tok) => tok.length >= MIN_TOKEN_LEN)
    .slice(0, MAX_TOKENS);

  if (tokens.length === 0) return null;

  return tokens.map((tok) => `"${tok}"*`).join(" OR ");
}

// LIKE wildcard escape. Use with SQLite `... LIKE ? ESCAPE '\'` so user
// punctuation does not become a wildcard.
export function escapeLikePattern(raw: string): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
