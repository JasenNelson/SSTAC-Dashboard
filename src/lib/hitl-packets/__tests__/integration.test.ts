/**
 * Integration test: load a real Python-generated packet
 * and validate it with the TS validator.
 *
 * These tests are SKIPPED when the fixture file is absent
 * (e.g. CI without Python engine). Generate with:
 *   cd Regulatory-Review && python3 -c "..." (see engine smoke test)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { validatePacket } from '../validator';
import { flattenRecord } from '../flatten';
import { hitlPacketSchema } from '../schema';
import type { HitlPacket } from '../types';

const FIXTURE_DIR = path.join(os.tmpdir(), 'hitl_test_packets');
const FIXTURE_JSON = path.join(FIXTURE_DIR, 'HITL_PACKET_TEST_FIXTURE_001.json');

const fixtureExists = fs.existsSync(FIXTURE_JSON);

describe.skipIf(!fixtureExists)('integration: Python-generated packet', () => {
  let rawPacket: unknown;
  let packet: HitlPacket;

  beforeAll(() => {
    const raw = fs.readFileSync(FIXTURE_JSON, 'utf-8');
    rawPacket = JSON.parse(raw);
    packet = rawPacket as HitlPacket;
  });

  it('Zod schema accepts real packet', () => {
    const result = hitlPacketSchema.safeParse(rawPacket);
    expect(result.success).toBe(true);
  });

  it('validator passes real packet', () => {
    const result = validatePacket(rawPacket);
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('has expected record count', () => {
    expect(packet.metadata.record_count).toBe(5);
    expect(packet.records.length).toBe(5);
  });

  it('records are sorted by policy_id', () => {
    const ids = packet.records.map((r) => r.policy_id);
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });

  it('flatten produces valid flat records', () => {
    for (const rec of packet.records) {
      const flat = flattenRecord(rec);
      expect(flat.policy_id).toBeTruthy();
      expect(typeof flat.decision_score).toBe('number');
      expect(typeof flat.ai_invoked).toBe('boolean');
    }
  });

  it('CSV artifact exists', () => {
    const csvPath = path.join(FIXTURE_DIR, 'HITL_PACKET_TEST_FIXTURE_001.csv');
    expect(fs.existsSync(csvPath)).toBe(true);
  });

  it('MD artifact exists', () => {
    const mdPath = path.join(FIXTURE_DIR, 'HITL_PACKET_TEST_FIXTURE_001.md');
    expect(fs.existsSync(mdPath)).toBe(true);
  });

  // Tampered packet test
  it('validator catches tampered record_count', () => {
    const tampered = JSON.parse(JSON.stringify(rawPacket));
    tampered.metadata.record_count = 999;
    const result = validatePacket(tampered);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e: string) => e.includes('record_count mismatch'))).toBe(true);
  });

  it('validator catches removed required key', () => {
    const tampered = JSON.parse(JSON.stringify(rawPacket));
    delete tampered.records[0].ai.invocation_reason;
    const result = validatePacket(tampered);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e: string) => e.includes('ai.invocation_reason'))).toBe(true);
  });
});
