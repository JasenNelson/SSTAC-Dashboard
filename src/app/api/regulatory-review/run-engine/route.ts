/**
 * Legacy Evaluation Engine API (DEPRECATED)
 *
 * POST /api/regulatory-review/run-engine
 *
 * This endpoint previously invoked run_ralph_evaluation.py directly.
 * It has been replaced by the project-based evaluation route:
 *   POST /api/regulatory-review/projects/[id]/evaluate
 *
 * Returns 501 with a redirect message.
 */

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error:
        'This endpoint is deprecated. Use POST /api/regulatory-review/projects/[id]/evaluate instead.',
    },
    { status: 501 }
  );
}
