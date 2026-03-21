/**
 * Extraction Status Polling API
 *
 * GET /api/regulatory-review/projects/[id]/extract-status - Poll extraction progress
 *
 * Reads .extraction_status.json from the project folder.
 * If extraction is completed, marks files as processed and updates project status.
 * If the status file is stale beyond EXTRACT_STALE_TIMEOUT_MS, transitions to
 * extract_failed to prevent permanent stuck state.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireLocalEngine } from '@/lib/api-guards';
import { readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import {
  getReviewProjectById,
  getProjectFiles,
  markFileProcessed,
  updateReviewProject,
} from '@/lib/sqlite/queries/review-projects';

const ACTIVE_REVIEWS_BASE = 'C:/Projects/Regulatory-Review/1_Active_Reviews';

// Default: 30 minutes. Extraction is typically fast (seconds to low minutes).
// Override via EXTRACT_STALE_TIMEOUT_MS env var.
const DEFAULT_EXTRACT_STALE_TIMEOUT_MS = 30 * 60 * 1000;

export async function GET(
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

    // Terminal statuses that should not trigger stale detection
    const TERMINAL_STATUSES = ['completed', 'completed_with_errors', 'error'];

    // Stale detection: if extraction is non-terminal and the status file hasn't
    // been updated within the timeout, the extraction process likely died.
    if (!TERMINAL_STATUSES.includes(progress.status)) {
      const staleMs = parseInt(
        process.env.EXTRACT_STALE_TIMEOUT_MS || '',
        10
      ) || DEFAULT_EXTRACT_STALE_TIMEOUT_MS;

      const fileStat = await stat(progressFile);
      const elapsedMs = Date.now() - fileStat.mtime.getTime();

      if (elapsedMs > staleMs) {
        updateReviewProject(id, { status: 'extract_failed' });
        return NextResponse.json({
          status: 'error',
          error: `Extraction timed out — no progress for ${Math.round(elapsedMs / 60000)} minutes`,
        });
      }
    }

    // If extraction completed, mark files as processed and update project
    if (progress.status === 'completed' || progress.status === 'completed_with_errors') {
      const files = getProjectFiles(id);
      for (const file of files) {
        if (file.processed === 0) {
          markFileProcessed(file.id);
        }
      }
      updateReviewProject(id, { status: 'extracted' });
    }

    // If extraction errored, update project status
    if (progress.status === 'error') {
      updateReviewProject(id, { status: 'extract_failed' });
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
