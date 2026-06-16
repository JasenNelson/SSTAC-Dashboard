/**
 * Path-traversal-safe filename handling for regulatory-review file operations.
 *
 * User-controlled upload filenames (the multipart File.name, and the
 * client-supplied extract `files[]` list) must never be trusted when building
 * a filesystem path or a subprocess argument. A name like
 * "../../../../Windows/Temp/evil.exe" passed to path.join() escapes the
 * intended directory (path.join normalizes ".." segments), yielding an
 * arbitrary-write / arbitrary-delete primitive and a poisoned --files argument
 * to the spawned extraction process.
 *
 * These helpers reduce a user-controlled name to a single safe path segment
 * and (optionally) assert that resolving it inside a trusted base directory
 * does not escape that base. Plain ASCII only.
 */

import path from 'path';

// This feature targets a Windows local-engine host: ACTIVE_REVIEWS_BASE is a
// "C:\\..." path, the routes are gated by requireLocalEngine(), and extraction
// spawns pythonw.exe. Use win32 path semantics EXPLICITLY so that both "/" and
// "\\" are treated as separators (and absolute prefixes like "C:\\" or "/" are
// stripped) regardless of the host -- in particular so these helpers behave
// identically under Vitest on a POSIX CI runner, where the default path module
// would NOT treat "\\" as a separator.
const p = path.win32;

/**
 * Reduce a user-controlled filename to a single safe path segment.
 *
 * win32 basename strips any directory components (both "../" / "..\\" segments
 * and absolute-path prefixes such as "C:\\" or "/"). We additionally reject
 * empty, "." / ".." results, any name containing a NUL byte, and any name that
 * begins with "-": such a name, when passed as a subprocess --files argument
 * (extract/route.ts), would be parsed by the Python argparse consumer as an
 * OPTION (e.g. "--source-dir", "--chunk-size") rather than a file value,
 * letting an authenticated admin corrupt or abort an extraction run. Rejecting
 * leading-dash names neutralizes that argv option-injection at the source.
 *
 * @returns the sanitized basename, or null if the name cannot be reduced to a
 *          safe segment (caller should treat null as a 400 / skip).
 */
export function safeFilename(name: unknown): string | null {
  if (typeof name !== 'string' || name.length === 0) return null;
  if (name.includes('\0')) return null;
  const base = p.basename(name);
  if (base === '' || base === '.' || base === '..') return null;
  if (base.startsWith('-')) return null;
  return base;
}

/**
 * Resolve a user-controlled filename inside a trusted base directory and
 * assert the result stays within that base (belt-and-suspenders on top of
 * safeFilename). Returns the absolute resolved path, or null if the name is
 * unsafe or would escape baseDir.
 */
export function resolveWithinBase(baseDir: string, name: unknown): string | null {
  const safe = safeFilename(name);
  if (safe === null) return null;
  const resolvedBase = p.resolve(baseDir);
  const resolved = p.resolve(resolvedBase, safe);
  const rel = p.relative(resolvedBase, resolved);
  // A valid single-segment filename resolves to "<base>\\<name>", so rel is the
  // bare filename (safeFilename already stripped any separators). A true escape
  // is therefore exactly "" (rel resolves to the base itself), ".." or an
  // absolute path. We check segment-wise (rel === '..' or rel starts with
  // ".." + separator) rather than a bare startsWith('..'), so a legitimate name
  // like "..summary.pdf" is NOT false-rejected.
  if (rel === '' || rel === '..' || rel.startsWith('..' + p.sep) || p.isAbsolute(rel)) {
    return null;
  }
  return resolved;
}
