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

// Tuple with literal types preserved so the exhaustiveness check below
// can actually detect a missing member. cursor-agent review on Commit 2
// (2026-05-19) caught that a `ReadonlyArray<MatrixCategory>` annotation
// here widens the tuple's literal types to `MatrixCategory`, which made
// the prior Exclude<>-based guard a tautology (always passed). The
// `as const satisfies readonly MatrixCategory[]` pattern preserves the
// literal tuple while still enforcing that every entry is a valid
// MatrixCategory.
const ALL_MATRIX_CATEGORIES_TUPLE = [
  'eco-direct',
  'eco-food',
  'hh-direct',
  'hh-food',
] as const satisfies readonly MatrixCategory[];

export const ALL_MATRIX_CATEGORIES: ReadonlyArray<MatrixCategory> =
  ALL_MATRIX_CATEGORIES_TUPLE;

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

// Type-level exhaustiveness guard. If a future Pathway addition widens
// MatrixCategory and the tuple above is not updated to match, Exclude<>
// resolves to the missing member(s) (not `never`), which makes the
// `true` literal incompatible with `false` and the assignment below
// fails to compile. cursor-agent review 2026-05-19 P2 corrected the
// earlier pattern (which used the `ReadonlyArray<MatrixCategory>`
// annotation and reduced to a tautology).
type AllCategoriesExhaustive =
  Exclude<MatrixCategory, (typeof ALL_MATRIX_CATEGORIES_TUPLE)[number]> extends never
    ? true
    : false;
const _allCategoriesExhaustive: AllCategoriesExhaustive = true;
void _allCategoriesExhaustive;
