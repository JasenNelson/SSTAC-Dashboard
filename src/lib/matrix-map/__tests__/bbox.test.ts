import { describe, it, expect } from 'vitest';
import { toRpcBbox } from '../bbox';

describe('toRpcBbox', () => {
  it('converts a valid bbox to snake_case RpcBbox', () => {
    expect(toRpcBbox({ minLng: -125, minLat: 48, maxLng: -120, maxLat: 50 })).toEqual({
      min_lng: -125,
      min_lat: 48,
      max_lng: -120,
      max_lat: 50,
    });
  });

  it('returns null for null and undefined', () => {
    expect(toRpcBbox(null)).toBeNull();
    expect(toRpcBbox(undefined)).toBeNull();
  });

  it('returns null if minLng >= maxLng or minLat >= maxLat', () => {
    expect(toRpcBbox({ minLng: -120, minLat: 48, maxLng: -125, maxLat: 50 })).toBeNull();
    expect(toRpcBbox({ minLng: -125, minLat: 50, maxLng: -120, maxLat: 48 })).toBeNull();
  });

  it('returns null if longitudes are outside [-180, 180]', () => {
    expect(toRpcBbox({ minLng: -190, minLat: 48, maxLng: -120, maxLat: 50 })).toBeNull();
    expect(toRpcBbox({ minLng: -125, minLat: 48, maxLng: 190, maxLat: 50 })).toBeNull();
  });

  it('returns null if latitudes are outside [-90, 90]', () => {
    expect(toRpcBbox({ minLng: -125, minLat: -100, maxLng: -120, maxLat: 50 })).toBeNull();
    expect(toRpcBbox({ minLng: -125, minLat: 48, maxLng: -120, maxLat: 100 })).toBeNull();
  });

  it('returns null for NaN or Infinity', () => {
    expect(toRpcBbox({ minLng: NaN, minLat: 48, maxLng: -120, maxLat: 50 })).toBeNull();
    expect(toRpcBbox({ minLng: -Infinity, minLat: 48, maxLng: -120, maxLat: 50 })).toBeNull();
    expect(toRpcBbox({ minLng: -125, minLat: Infinity, maxLng: -120, maxLat: 50 })).toBeNull();
  });
});
