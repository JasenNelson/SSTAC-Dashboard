import { describe, expect, it } from 'vitest';

import { ALL_MATRIX_CATEGORIES, isMatrixCategory } from '../types';

describe('types (matrix categories)', () => {
  // Roster anchor (defense-in-depth). Unlike the regulatory-frame case, MatrixCategory derives from
  // the independently-hardcoded Pathway union (Exclude<Pathway, 'tier0'>), so dropping a member from
  // ALL_MATRIX_CATEGORIES_TUPLE already fails to compile via the exhaustiveness check. Pinning the
  // roster here still makes an intentional add/remove an explicit, reviewed edit.
  const EXPECTED_MATRIX_CATEGORIES = ['eco-direct', 'eco-food', 'hh-direct', 'hh-food'];

  it('ALL_MATRIX_CATEGORIES matches the pinned roster exactly', () => {
    expect([...ALL_MATRIX_CATEGORIES]).toEqual(EXPECTED_MATRIX_CATEGORIES);
  });

  describe('isMatrixCategory', () => {
    it('returns true for every member of ALL_MATRIX_CATEGORIES', () => {
      for (const category of ALL_MATRIX_CATEGORIES) {
        expect(isMatrixCategory(category)).toBe(true);
      }
    });

    it('returns false for invalid inputs', () => {
      expect(isMatrixCategory('invalid-category')).toBe(false);
      expect(isMatrixCategory('tier0')).toBe(false);
      expect(isMatrixCategory('')).toBe(false);
      expect(isMatrixCategory(null as unknown)).toBe(false);
      expect(isMatrixCategory(undefined as unknown)).toBe(false);
      expect(isMatrixCategory(123 as unknown)).toBe(false);
      expect(isMatrixCategory({} as unknown)).toBe(false);
    });
  });
});
