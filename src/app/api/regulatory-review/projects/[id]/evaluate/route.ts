/**
 * Evaluation Trigger API
 *
 * POST /api/regulatory-review/projects/[id]/evaluate
 *
 * Spawns a detached evaluation adapter (run_shadow_evaluation.py) with
 * project-derived paths. Mirrors the extract route's detached-spawn pattern.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireLocalEngine } from '@/lib/api-guards';
import {
  getReviewProjectById,
  updateReviewProject,
} from '@/lib/sqlite/queries/review-projects';
import { spawnEvaluation } from '@/lib/regulatory-review/launch-evaluation';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;
    const engineError = requireLocalEngine();
    if (engineError) return engineError;

    const { id } = await params;

    const project = getReviewProjectById(id);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    spawnEvaluation(project);
    updateReviewProject(id, { status: 'evaluating' });

    return NextResponse.json({ status: 'started' });
  } catch (error) {
    console.error('Error starting evaluation:', error);
    return NextResponse.json(
      { error: 'Failed to start evaluation' },
      { status: 500 }
    );
  }
}
