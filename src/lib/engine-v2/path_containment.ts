// engine_v2 frontend Lane 1: path containment (Findings 15, 25).
// Verifies that `targetPath` resolves inside `basePath`, accounting for
// symlinks/junctions (Windows) and not-yet-existing targets (parent-dir fallback).
//
// Lane 1 callers: quarantine helper (Module L1-6 / storage_materialize.ts).
// Lane 1 file allowlist places this helper in L1-3 because L1-3 owns the
// shared file-handling primitives.

import { realpath } from "fs/promises";
import * as path from "path";

// Returns true if `targetPath` is contained inside `basePath` after realpath
// resolution. Containment is computed on POSIX-normalized lowercase strings on
// Windows (case-insensitive) and exact-case on POSIX.
//
// Behavior:
// - If `targetPath` exists, its realpath is used directly.
// - If `targetPath` does not exist, the deepest existing ancestor's realpath
//   is used, with the remaining (unresolvable) tail re-appended. This avoids
//   ENOENT on quarantine targets that haven't been created yet.
// - If a parent realpath itself fails for any reason (e.g., we reach the
//   filesystem root), we fall back to path.resolve()-only containment.
export async function isContained(
  basePath: string,
  targetPath: string,
): Promise<boolean> {
  const resolvedBase = await safeRealpath(path.resolve(basePath));
  if (resolvedBase === null) {
    // Base must exist for containment to be meaningful.
    return false;
  }
  const resolvedTarget = await resolveTargetWithFallback(path.resolve(targetPath));
  return isWithin(resolvedBase, resolvedTarget);
}

async function safeRealpath(p: string): Promise<string | null> {
  try {
    return await realpath(p);
  } catch {
    return null;
  }
}

// Try realpath of target; if missing, walk up to deepest existing ancestor and
// re-append the unresolved tail. Final fallback: resolved string from input.
async function resolveTargetWithFallback(absoluteTarget: string): Promise<string> {
  const direct = await safeRealpath(absoluteTarget);
  if (direct !== null) return direct;

  let current = absoluteTarget;
  const trailing: string[] = [];
  // Bound the loop to filesystem depth.
  for (let i = 0; i < 256; i++) {
    const parent = path.dirname(current);
    if (parent === current) break; // reached root
    const parentReal = await safeRealpath(parent);
    if (parentReal !== null) {
      trailing.unshift(path.basename(current));
      return path.join(parentReal, ...trailing);
    }
    trailing.unshift(path.basename(current));
    current = parent;
  }
  return absoluteTarget;
}

// Containment check that handles trailing-separator confusion (`/base` vs
// `/base_evil`) AND case-insensitive comparison on Windows.
function isWithin(basePath: string, targetPath: string): boolean {
  const baseNorm = normalizeForCompare(basePath);
  const targetNorm = normalizeForCompare(targetPath);
  if (baseNorm === targetNorm) return true;
  const sep = process.platform === "win32" ? "\\" : "/";
  const baseWithSep = baseNorm.endsWith(sep) ? baseNorm : baseNorm + sep;
  return targetNorm.startsWith(baseWithSep);
}

function normalizeForCompare(p: string): string {
  // Use platform-specific normalize first to collapse `..`/`.` and slashes.
  const normalized = path.normalize(p);
  if (process.platform === "win32") {
    return normalized.toLowerCase();
  }
  return normalized;
}
