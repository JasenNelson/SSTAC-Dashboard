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
import { spawn } from 'child_process';
import { mkdir } from 'fs/promises';
import path from 'path';
import {
  getReviewProjectById,
  updateReviewProject,
} from '@/lib/sqlite/queries/review-projects';

const ACTIVE_REVIEWS_BASE = 'C:/Projects/Regulatory-Review/1_Active_Reviews';
const ENGINE_BASE_PATH = process.env.REG_REVIEW_ENGINE_BASE_PATH || 'C:/Projects/Regulatory-Review/engine';
const EVAL_SCRIPT = path.join(ENGINE_BASE_PATH, 'scripts', 'orchestrators', 'run_shadow_evaluation.py');

/**
 * Parse a DB-stored JSON array string (e.g. '["a","b"]') to comma-separated.
 * Falls back to returning the raw value if not valid JSON array.
 */
function parseJsonArrayToCSV(value: string | null | undefined): string {
  if (!value) return '';
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.join(',');
  } catch {
    // not JSON — return as-is
  }
  return value;
}

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

    // Derive paths from project
    const extractionPath = path.join(
      ACTIVE_REVIEWS_BASE,
      project.folder_path,
      '1_Extractions'
    );
    const outputPath = path.join(
      ACTIVE_REVIEWS_BASE,
      project.folder_path,
      '2_Evaluation_Output'
    );
    const progressFile = path.join(
      ACTIVE_REVIEWS_BASE,
      project.folder_path,
      '.evaluation_status.json'
    );

    // Ensure output directory exists
    await mkdir(outputPath, { recursive: true });

    // Minimal env allowlist — matches extract/route.ts pattern (F-09)
    const env = {
      PATH: process.env.PATH,
      SYSTEMROOT: process.env.SYSTEMROOT,
      COMSPEC: process.env.COMSPEC,
      TEMP: process.env.TEMP,
      TMP: process.env.TMP,
      NODE_ENV: process.env.NODE_ENV,
      EXTRACTION_PATH: extractionPath,
      OUTPUT_PATH: outputPath,
      SUBMISSION_ID: project.id,
      SITE_ID: project.site_id,
      EVAL_PROGRESS_FILE: progressFile,
      APPLICATION_TYPE: parseJsonArrayToCSV(project.application_type),
      SELECTED_SERVICES: parseJsonArrayToCSV(project.selected_services),
      ...(process.env.OLLAMA_URL ? { OLLAMA_URL: process.env.OLLAMA_URL } : {}),
    } as NodeJS.ProcessEnv;

    // Spawn detached process
    const pythonPath = process.env.REG_REVIEW_PYTHON_PATH || 'python';
    const child = spawn(pythonPath, [EVAL_SCRIPT], {
      cwd: ENGINE_BASE_PATH,
      detached: true,
      stdio: 'ignore',
      env,
    });
    child.unref();

    // Update project status
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
