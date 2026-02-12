/**
 * HITL Packet Validator
 *
 * Performs the same 6 validation checks as validate_packet() in
 * engine/scripts/core/hitl_packet.py:
 *
 * 1. Top-level keys present (schema_version, metadata, records)
 * 2. Metadata has required fields
 * 3. record_count matches actual len(records)
 * 4. Each record has all REQUIRED_RECORD_KEYS (dotted-path traversal)
 * 5. Records sorted by policy_id
 * 6. No duplicate policy_ids
 *
 * IMPORTANT: This function NEVER throws. All structural problems
 * are reported as validation errors in the returned result.
 */

import { REQUIRED_RECORD_KEYS } from './types';
import type { ValidationResult } from './types';

/**
 * Resolve a dotted key path on a nested object.
 * Returns { exists: boolean; value: unknown }.
 */
function resolveDottedKey(
  obj: Record<string, unknown>,
  dottedKey: string
): { exists: boolean; value: unknown } {
  const parts = dottedKey.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return { exists: false, value: undefined };
    }
    const rec = current as Record<string, unknown>;
    if (!(part in rec)) {
      return { exists: false, value: undefined };
    }
    current = rec[part];
  }

  return { exists: true, value: current };
}

/**
 * Validate a parsed HITL packet object.
 *
 * Mirrors the Python validate_packet() exactly:
 * same checks, same error message format.
 *
 * Never throws — all malformed input is caught and reported
 * as validation errors.
 */
export function validatePacket(packet: unknown): ValidationResult {
  const errors: string[] = [];

  if (!packet || typeof packet !== 'object') {
    return { isValid: false, errors: ['Packet is not an object'] };
  }

  const p = packet as Record<string, unknown>;

  // 1. Top-level structure
  for (const key of ['schema_version', 'metadata', 'records']) {
    if (!(key in p)) {
      errors.push(`Missing top-level key: ${key}`);
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // 2. Metadata type guard + required fields
  if (!p.metadata || typeof p.metadata !== 'object') {
    errors.push('metadata is not an object');
    return { isValid: false, errors };
  }

  const meta = p.metadata as Record<string, unknown>;
  for (const mkey of ['session_id', 'generated_at', 'schema_version', 'record_count']) {
    if (!(mkey in meta) || meta[mkey] === null || meta[mkey] === undefined) {
      errors.push(`Missing or null metadata field: ${mkey}`);
    }
  }

  // Records type guard
  if (!Array.isArray(p.records)) {
    errors.push('records is not an array');
    return { isValid: false, errors };
  }

  const records = p.records as Record<string, unknown>[];

  // 3. Record count consistency
  const declared = meta.record_count as number | undefined;
  if (declared !== undefined && declared !== null && declared !== records.length) {
    errors.push(
      `record_count mismatch: metadata says ${declared}, actual records list has ${records.length}`
    );
  }

  // 4. Required keys per record
  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    if (!rec || typeof rec !== 'object') {
      errors.push(`Record at index ${i} is not an object`);
      continue;
    }
    const pid = (rec.policy_id as string) || `[index ${i}]`;

    for (const dottedKey of REQUIRED_RECORD_KEYS) {
      const { exists } = resolveDottedKey(rec, dottedKey);
      if (!exists) {
        errors.push(`Record ${pid}: missing key ${dottedKey}`);
      }
    }
  }

  // 5. Deterministic ordering
  const policyIds = records.map((r) =>
    r && typeof r === 'object' ? ((r as Record<string, unknown>).policy_id as string) || '' : ''
  );
  const sorted = [...policyIds].sort();
  const isSorted = policyIds.every((id, idx) => id === sorted[idx]);
  if (!isSorted) {
    errors.push('Records are not sorted by policy_id');
  }

  // 6. No duplicates
  const seen = new Set<string>();
  for (const pid of policyIds) {
    if (seen.has(pid)) {
      errors.push(`Duplicate policy_id: ${pid}`);
    }
    seen.add(pid);
  }

  return { isValid: errors.length === 0, errors };
}
