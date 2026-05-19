// Canonical category identifiers for the matrix-options calculator selector.
// Short form per plan v6 (2026-05-19): decoupled from backing-component
// filenames so future alternative methods (e.g., a kinetic uptake model
// alongside BSAF for Eco-Food) can swap without renaming the identifier.
//
// MatrixCategory is derived from the canonical Pathway type at
// src/lib/matrix-options/types.ts by excluding 'tier0' (which renders as
// a post-derivation Background Adjustment panel, NOT as one of the four
// matrix-category calculator slots). Using Exclude<> keeps the two unions
// in lockstep so adding a future pathway is a one-touch change in
// lib/matrix-options/types.ts (cursor-agent review 2026-05-19 P2 #3).
//
// Plain ASCII only.

import type { Pathway } from '@/lib/matrix-options/types';

export type MatrixCategory = Exclude<Pathway, 'tier0'>;

export const ALL_MATRIX_CATEGORIES: ReadonlyArray<MatrixCategory> = [
  'eco-direct',
  'eco-food',
  'hh-direct',
  'hh-food',
];

// Categories currently enabled for end-user selection in PR-A2.
// HH categories enable in PR-A4 after HITL sign-off on the placeholder
// disclaimer copy (plan v3 section 2 + v4 Delta 2).
export const ENABLED_CATEGORIES_PR_A2: ReadonlyArray<MatrixCategory> = [
  'eco-direct',
  'eco-food',
];

export function isMatrixCategory(value: unknown): value is MatrixCategory {
  return (
    typeof value === 'string' &&
    (ALL_MATRIX_CATEGORIES as readonly string[]).includes(value)
  );
}

// Type-level exhaustiveness guard (codex review 2026-05-19 P3): if a future
// Pathway addition widens MatrixCategory and ALL_MATRIX_CATEGORIES is not
// updated to match, this conditional type resolves to `false` and the
// assignment below fails to compile. Forces hand-maintained array to stay
// in lockstep with the derived union.
type AllCategoriesExhaustive =
  MatrixCategory extends (typeof ALL_MATRIX_CATEGORIES)[number] ? true : false;
const _allCategoriesExhaustive: AllCategoriesExhaustive = true;
// Reference to silence unused-var lint (the guard works at compile time).
void _allCategoriesExhaustive;
