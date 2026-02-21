/**
 * Extraction Status Polling API
 *
 * GET /api/regulatory-review/projects/[id]/extract-status - Poll extraction progress
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireLocalEngine } from '@/lib/api-guards';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import {
  getReviewProjectById,
  getProjectFiles,
  markFileProcessed,
  updateReviewProject,
} from '@/lib/sqlite/queries/review-projects';

const ACTIVE_REVIEWS_BASE = 'C:/Projects/Regulatory-Review/1_Active_Reviews';

/**
 * GET /api/regulatory-review/projects/[id]/extract-status
 *
 * Reads .extraction_status.json from the project folder.
 * If extraction is completed, marks files as processed and updates project status.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = await requireAdmin()
    if (authError) return authError
    const engineError = requireLocalEngine()
    if (engineError) return engineError

    const { id } = await params;

    const project = getReviewProjectById(id);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const progressFile = path.join(
      ACTIVE_REVIEWS_BASE,
      project.folder_path,
      '.extraction_status.json'
    );

    if (!existsSync(progressFile)) {
      return NextResponse.json({ status: 'not_started' });
    }

    const raw = await readFile(progressFile, 'utf-8');
    const progress = JSON.parse(raw);

    // If extraction completed, mark files as processed and update project
    if (progress.status === 'completed') {
      const files = getProjectFiles(id);
      for (const file of files) {
        if (file.processed === 0) {
          markFileProcessed(file.id);
        }
      }
      updateReviewProject(id, { status: 'extracted' });
    }

    return NextResponse.json(progress);
  } catch (error) {
    console.error('Error reading extraction status:', error);
    return NextResponse.json(
      { error: 'Failed to read extraction status' },
      { status: 500 }
    );
  }
}
