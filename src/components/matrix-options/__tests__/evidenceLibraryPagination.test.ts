import { describe, it, expect } from 'vitest';
import {
  VALUES_PAGE_SIZE,
  computeValuesPagination,
} from '../evidenceLibraryPagination';

describe('computeValuesPagination', () => {
  it('does not page when the list fits in one page', () => {
    const p = computeValuesPagination(10, 0, 50);
    expect(p.isPaged).toBe(false);
    expect(p.pageCount).toBe(1);
    expect(p.clampedPage).toBe(0);
    expect(p.sliceStart).toBe(0);
    expect(p.sliceEnd).toBe(10);
    expect(p.start).toBe(1);
    expect(p.end).toBe(10);
  });

  it('does not page at exactly one full page', () => {
    const p = computeValuesPagination(50, 0, 50);
    expect(p.isPaged).toBe(false); // 50 is NOT > 50
    expect(p.pageCount).toBe(1);
  });

  it('pages when the list exceeds one page', () => {
    const p = computeValuesPagination(1161, 0, 50);
    expect(p.isPaged).toBe(true);
    expect(p.pageCount).toBe(24); // ceil(1161 / 50)
    expect(p.sliceStart).toBe(0);
    expect(p.sliceEnd).toBe(50);
    expect(p.start).toBe(1);
    expect(p.end).toBe(50);
  });

  it('computes the window for a middle page', () => {
    const p = computeValuesPagination(1161, 3, 50);
    expect(p.clampedPage).toBe(3);
    expect(p.sliceStart).toBe(150);
    expect(p.sliceEnd).toBe(200);
    expect(p.start).toBe(151);
    expect(p.end).toBe(200);
  });

  it('computes a partial last page', () => {
    const p = computeValuesPagination(1161, 23, 50);
    expect(p.clampedPage).toBe(23);
    expect(p.sliceStart).toBe(1150);
    expect(p.sliceEnd).toBe(1161); // not 1200 -- clamped to total
    expect(p.end).toBe(1161);
  });

  it('clamps a stale page index past the end (no out-of-range empty page)', () => {
    // 60 rows -> 2 pages; a stale page 5 clamps to the last page (index 1).
    const p = computeValuesPagination(60, 5, 50);
    expect(p.pageCount).toBe(2);
    expect(p.clampedPage).toBe(1);
    expect(p.sliceStart).toBe(50);
    expect(p.sliceEnd).toBe(60);
  });

  it('clamps a negative page to zero', () => {
    const p = computeValuesPagination(120, -3, 50);
    expect(p.clampedPage).toBe(0);
    expect(p.sliceStart).toBe(0);
  });

  it('handles an empty list as page 1 of 1 with a zero start', () => {
    const p = computeValuesPagination(0, 0, 50);
    expect(p.pageCount).toBe(1);
    expect(p.isPaged).toBe(false);
    expect(p.start).toBe(0);
    expect(p.end).toBe(0);
    expect(p.sliceStart).toBe(0);
    expect(p.sliceEnd).toBe(0);
  });

  it('defaults to VALUES_PAGE_SIZE when no page size is given', () => {
    expect(VALUES_PAGE_SIZE).toBe(50);
    const p = computeValuesPagination(120, 1);
    expect(p.sliceStart).toBe(50);
    expect(p.sliceEnd).toBe(100);
  });
});
