// Unit tests for fetchMatrixMapSamplesServerSide -- the bbox-lane Stage 1
// additive fields (total_in_bbox / returned_sample_count / truncated /
// bbox_applied) pass through, fall back when the pre-migration RPC omits them,
// and the error path returns the empty fallback. Plain ASCII.

import { describe, it, expect, vi } from 'vitest';
import { fetchMatrixMapSamplesServerSide } from '../fetch-samples-server';
import { EMPTY_MATRIX_MAP_DATA } from '@/app/(dashboard)/matrix-map/types';

// Minimal mock of the supabase server client: only .schema(...).rpc(...) is used.
function mockClient(rpcReturn: { data?: unknown; error?: unknown }, rpcFn?: any) {
  return {
    schema: () => ({
      rpc: rpcFn ?? (async () => rpcReturn),
    }),
  } as unknown as Parameters<typeof fetchMatrixMapSamplesServerSide>[0];
}

const oneSample = {
  id: 's1',
  bnrrm_station_id: 1,
  station_id: 'ST1',
  display_name: 'Station 1',
  geometry: { type: 'Point', coordinates: [-123, 49] },
  coordinate_quality_tier: 'high',
  coordinate_source: 'surveyed',
  classification: 'reference',
  classification_source: 'station_type',
  classification_rationale: null,
  classification_confidence: null,
  source_dra_id: 'd1',
  public: true,
  bc_region: null,
  waterbody: null,
  waterbody_type: null,
};

describe('fetchMatrixMapSamplesServerSide -- bbox-lane Stage 1 fields', () => {
  it('passes through the new additive fields when the RPC returns them', async () => {
    const supabase = mockClient({
      data: {
        visible_samples: [oneSample],
        hidden_sample_count: 5,
        hidden_dra_count: 2,
        hidden_dra_ids: ['d2', 'd3'],
        data_snapshot_version: '2026-06-23',
        total_in_bbox: 9000,
        returned_sample_count: 2500,
        truncated: true,
        bbox_applied: true,
      },
      error: null,
    });
    const { initialMapData, fetchErrorMessage } = await fetchMatrixMapSamplesServerSide(supabase);
    expect(fetchErrorMessage).toBeNull();
    expect(initialMapData.total_in_bbox).toBe(9000);
    expect(initialMapData.returned_sample_count).toBe(2500);
    expect(initialMapData.truncated).toBe(true);
    expect(initialMapData.bbox_applied).toBe(true);
    expect(initialMapData.visible_samples).toHaveLength(1);
  });

  it('falls back when the pre-migration RPC omits the new fields', async () => {
    const supabase = mockClient({
      data: {
        visible_samples: [oneSample],
        hidden_sample_count: 0,
        hidden_dra_count: 0,
        hidden_dra_ids: [],
        data_snapshot_version: '2026-06-22',
        // total_in_bbox / truncated / bbox_applied intentionally ABSENT (old RPC)
      },
      error: null,
    });
    const { initialMapData } = await fetchMatrixMapSamplesServerSide(supabase);
    // total_in_bbox + returned_sample_count fall back to the visible count;
    // truncated + bbox_applied default to false (province-wide, untruncated).
    expect(initialMapData.total_in_bbox).toBe(1);
    expect(initialMapData.returned_sample_count).toBe(1);
    expect(initialMapData.truncated).toBe(false);
    expect(initialMapData.bbox_applied).toBe(false);
  });

  it('returns the empty fallback + an error message on RPC error', async () => {
    const supabase = mockClient({ data: null, error: { message: 'boom', code: 'PGRST200' } });
    const { initialMapData, fetchErrorMessage } = await fetchMatrixMapSamplesServerSide(supabase);
    expect(initialMapData).toEqual(EMPTY_MATRIX_MAP_DATA);
    expect(fetchErrorMessage).toMatch(/temporarily unavailable/);
  });

  it('forwards a valid bbox as snake_case p_bbox', async () => {
    const rpcFn = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = mockClient({ data: null, error: null }, rpcFn);
    await fetchMatrixMapSamplesServerSide(supabase, { minLng: -125, minLat: 48, maxLng: -120, maxLat: 50 });
    expect(rpcFn).toHaveBeenCalledWith('fetch_samples_with_hidden_summary', {
      p_bbox: { min_lng: -125, min_lat: 48, max_lng: -120, max_lat: 50 },
    });
  });

  it('forwards p_bbox: null when called with no bbox or null', async () => {
    const rpcFn = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = mockClient({ data: null, error: null }, rpcFn);
    await fetchMatrixMapSamplesServerSide(supabase);
    expect(rpcFn).toHaveBeenCalledWith('fetch_samples_with_hidden_summary', { p_bbox: null });
    await fetchMatrixMapSamplesServerSide(supabase, null);
    expect(rpcFn).toHaveBeenCalledWith('fetch_samples_with_hidden_summary', { p_bbox: null });
  });
});
