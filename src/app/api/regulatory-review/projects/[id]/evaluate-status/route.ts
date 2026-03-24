/**
 * Evaluation Status Polling API
 *
 * GET /api/regulatory-review/projects/[id]/evaluate-status
 *
 * Reads .evaluation_status.json from the project folder.
 * On completion, auto-imports results to dashboard DB.
 * Mirrors the extract-status route pattern.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireLocalEngine } from '@/lib/api-guards';
import { readFile, stat, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import {
  getReviewProjectById,
  updateReviewProject,
} from '@/lib/sqlite/queries/review-projects';
import {
  importResultsToDatabase,
  type EvaluationResult,
} from '@/lib/regulatory-review/import-results';

const ACTIVE_REVIEWS_BASE = 'C:/Projects/Regulatory-Review/1_Active_Reviews';

// Default: 30 minutes since the last progress update.
// Mirrors extract-status stale detection.  If the evaluation process dies
// without writing {"status":"error"}, this ensures the project transitions
// to eval_failed instead of staying stuck in 'evaluating' forever.
// Override via EVAL_STALE_TIMEOUT_MS env var.
const DEFAULT_EVAL_STALE_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Find the most recent evaluation output JSON in outputDir.
 */
async function findLatestOutputFile(outputDir: string): Promise<string | null> {
  try {
    const files = await readdir(outputDir);
    const jsonFiles = files.filter(
      (f) => f.endsWith('.json') && (f.includes('EvalResult') || f.includes('evaluation_results'))
    );

    if (jsonFiles.length === 0) return null;

    // Sort by mtime descending
    const withStats = await Promise.all(
      jsonFiles.map(async (f) => {
        const fullPath = path.join(outputDir, f);
        const s = await stat(fullPath);
        return { path: fullPath, mtime: s.mtime.getTime() };
      })
    );
    withStats.sort((a, b) => b.mtime - a.mtime);
    return withStats[0].path;
  } catch {
    return null;
  }
}

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
      '.evaluation_status.json'
    );

    if (!existsSync(progressFile)) {
      return NextResponse.json({ status: 'not_started' });
    }

    const raw = await readFile(progressFile, 'utf-8');
    const progress = JSON.parse(raw);

    // Stale detection: use updatedAt from JSON content if available,
    // fall back to file mtime.  Mirrors extract-status pattern.
    const TERMINAL_STATUSES = ['completed', 'complete', 'error'];
    if (!TERMINAL_STATUSES.includes(progress.status)) {
      const staleMs = parseInt(
        process.env.EVAL_STALE_TIMEOUT_MS || '',
        10
      ) || DEFAULT_EVAL_STALE_TIMEOUT_MS;

      let elapsedMs: number;
      if (progress.updatedAt) {
        elapsedMs = Date.now() - new Date(progress.updatedAt).getTime();
      } else {
        const fileStat = await stat(progressFile);
        elapsedMs = Date.now() - fileStat.mtime.getTime();
      }

      if (elapsedMs > staleMs) {
        updateReviewProject(id, { status: 'eval_failed' });
        return NextResponse.json({
          status: 'error',
          error: `Evaluation timed out — no progress for ${Math.round(elapsedMs / 60000)} minutes`,
        });
      }
    }

    // On completion: auto-import results to dashboard DB
    if (progress.status === 'completed' || progress.status === 'complete') {
      try {
        const outputDir = path.join(
          ACTIVE_REVIEWS_BASE,
          project.folder_path,
          '2_Evaluation_Output'
        );

        // Use outputFile from progress if available, else find latest
        let resultPath: string | null = null;
        const outputFileHint = progress.outputFile || progress.result_file;
        if (outputFileHint) {
          // result_file from shadow adapter may be absolute; outputFile is relative
          const candidate = path.isAbsolute(outputFileHint)
            ? outputFileHint
            : path.join(outputDir, outputFileHint);
          if (existsSync(candidate)) {
            resultPath = candidate;
          }
        }
        if (!resultPath) {
          resultPath = await findLatestOutputFile(outputDir);
        }

        if (!resultPath) {
          updateReviewProject(id, { status: 'eval_failed' });
          return NextResponse.json({
            status: 'import_failed',
            error: 'Evaluation completed but no output file found',
          });
        }

        const resultContent = await readFile(resultPath, 'utf-8');
        const result: EvaluationResult = JSON.parse(resultContent);

        // Override submission_id to use project ID (canonical for dashboard flow)
        result.submission_id = project.id;

        const importResult = await importResultsToDatabase(result);

        updateReviewProject(id, { status: 'evaluated' });

        return NextResponse.json({
          status: 'completed',
          importResult: {
            submissionCreated: importResult.submissionCreated,
            assessmentsImported: importResult.assessmentsImported,
          },
        });
      } catch (importError) {
        console.error('Error importing evaluation results:', importError);
        updateReviewProject(id, { status: 'eval_failed' });
        return NextResponse.json({
          status: 'import_failed',
          error: 'Evaluation completed but import failed',
        });
      }
    }

    // On error from adapter
    if (progress.status === 'error') {
      updateReviewProject(id, { status: 'eval_failed' });
      return NextResponse.json({
        status: 'error',
        error: progress.error || 'Evaluation failed',
      });
    }

    // Still running — pass through progress details for UI
    return NextResponse.json({
      status: progress.status,
      ...(progress.policies_completed != null && {
        policies_completed: progress.policies_completed,
      }),
      ...(progress.policies_total != null && {
        policies_total: progress.policies_total,
      }),
      ...(progress.elapsed_s != null && {
        elapsed_s: progress.elapsed_s,
      }),
    });
  } catch (error) {
    console.error('Error reading evaluation status:', error);
    return NextResponse.json(
      { error: 'Failed to read evaluation status' },
      { status: 500 }
    );
  }
}
