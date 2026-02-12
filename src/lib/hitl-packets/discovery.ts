/**
 * HITL Packet Discovery
 *
 * Discovers packet files from a configurable base directory
 * (env: HITL_PACKET_DIR) and provides path-safe access.
 *
 * File naming convention from the evaluator:
 *   HITL_PACKET_{sessionId}.json
 *   HITL_PACKET_{sessionId}.csv
 *   HITL_PACKET_{sessionId}.md
 */

import fs from 'fs';
import path from 'path';
import type { PacketSession, PacketMetadata } from './types';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Base directory for HITL packet files.
 * Defaults to the standard evaluation output path.
 */
function getPacketDir(): string {
  return (
    process.env.HITL_PACKET_DIR ||
    path.join(process.cwd(), '..', 'Regulatory-Review', '1_Active_Reviews',
      'Teck_Trail-WARP', '2_Evaluation_Output')
  );
}

// Filename prefix used by the evaluator
const PACKET_PREFIX = 'HITL_PACKET_';

// ---------------------------------------------------------------------------
// Path safety
// ---------------------------------------------------------------------------

/**
 * Validate a session ID to prevent path traversal.
 * Only alphanumeric, underscores, and hyphens allowed.
 */
export function isValidSessionId(sessionId: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(sessionId) && sessionId.length > 0 && sessionId.length <= 200;
}

/**
 * Resolve a packet file path safely.
 * Returns null if the resolved path escapes the base directory.
 */
function safeResolvePath(sessionId: string, ext: string): string | null {
  if (!isValidSessionId(sessionId)) {
    return null;
  }

  const baseDir = path.resolve(getPacketDir());
  const filename = `${PACKET_PREFIX}${sessionId}${ext}`;
  const resolved = path.resolve(baseDir, filename);

  // Prevent path traversal: resolved path must be directly inside baseDir
  const resolvedDir = path.dirname(resolved);
  if (resolvedDir !== baseDir) {
    return null;
  }

  return resolved;
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

/**
 * Discover all HITL packet sessions in the packet directory.
 * Returns session metadata sorted by modification time (newest first).
 */
export function discoverPacketSessions(): PacketSession[] {
  const baseDir = getPacketDir();

  if (!fs.existsSync(baseDir)) {
    return [];
  }

  let files: string[];
  try {
    files = fs.readdirSync(baseDir);
  } catch {
    return [];
  }

  // Find all JSON packet files
  const jsonFiles = files.filter(
    (f) => f.startsWith(PACKET_PREFIX) && f.endsWith('.json')
  );

  const sessions: PacketSession[] = [];

  for (const jsonFile of jsonFiles) {
    // Extract session ID from filename: HITL_PACKET_{sessionId}.json
    const sessionId = jsonFile.slice(PACKET_PREFIX.length, -5); // strip prefix and .json

    if (!isValidSessionId(sessionId)) {
      continue;
    }

    const jsonPath = path.join(baseDir, jsonFile);
    const csvFile = `${PACKET_PREFIX}${sessionId}.csv`;
    const mdFile = `${PACKET_PREFIX}${sessionId}.md`;

    const csvPath = files.includes(csvFile) ? path.join(baseDir, csvFile) : null;
    const mdPath = files.includes(mdFile) ? path.join(baseDir, mdFile) : null;

    // Read metadata from JSON (lightweight: parse only top-level)
    let metadata: PacketMetadata | null = null;
    let modifiedAt = '';
    try {
      const stat = fs.statSync(jsonPath);
      modifiedAt = stat.mtime.toISOString();

      const raw = fs.readFileSync(jsonPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.metadata) {
        metadata = parsed.metadata as PacketMetadata;
      }
    } catch {
      // Skip files that can't be read or parsed
      continue;
    }

    sessions.push({
      sessionId,
      jsonPath,
      csvPath,
      mdPath,
      metadata,
      modifiedAt,
    });
  }

  // Sort newest first
  sessions.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));

  return sessions;
}

/**
 * Load a packet JSON file by session ID.
 * Returns null if the file doesn't exist or can't be parsed.
 */
export function loadPacketBySessionId(sessionId: string): unknown | null {
  const filePath = safeResolvePath(sessionId, '.json');
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Get the path to a packet artifact (CSV or MD) by session ID.
 * Returns null if the file doesn't exist.
 */
export function getArtifactPath(
  sessionId: string,
  format: 'csv' | 'md'
): string | null {
  const ext = format === 'csv' ? '.csv' : '.md';
  const filePath = safeResolvePath(sessionId, ext);
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }
  return filePath;
}
