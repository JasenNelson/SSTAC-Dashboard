/**
 * Extraction Trigger API
 *
 * POST /api/regulatory-review/projects/[id]/extract - Start Docling extraction
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireLocalEngine } from '@/lib/api-guards';
import { spawn } from 'child_process';
import { openSync, closeSync, existsSync } from 'fs';
import path from 'path';
import {
  getReviewProjectById,
  getUnprocessedFiles,
  updateReviewProject,
} from '@/lib/sqlite/queries/review-projects';

const ACTIVE_REVIEWS_BASE = 'C:/Projects/Regulatory-Review/1_Active_Reviews';
const EXTRACT_SCRIPT = 'C:/Projects/Regulatory-Review/engine/scripts/dashboard_extract.py';

/**
 * POST /api/regulatory-review/projects/[id]/extract
 *
 * Spawns a detached Python extraction subprocess.
 * Body: { mode: 'new' | 'full', files?: string[] }
 */
export async function POST(
  request: NextRequest,
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

    const body = await request.json();
    const mode: string = body.mode || 'new';

    const sourceDir = path.join(
      ACTIVE_REVIEWS_BASE,
      project.folder_path,
      '0_Source_Documents'
    );
    const outputDir = path.join(
      ACTIVE_REVIEWS_BASE,
      project.folder_path,
      '1_Extractions'
    );
    const progressFile = path.join(
      ACTIVE_REVIEWS_BASE,
      project.folder_path,
      '.extraction_status.json'
    );

    const args = [
      EXTRACT_SCRIPT,
      '--source-dir', sourceDir,
      '--output-dir', outputDir,
      '--progress-file', progressFile,
    ];

    // If mode is 'new', only process unprocessed files
    if (mode === 'new') {
      const filenames = body.files as string[] | undefined;
      if (filenames && filenames.length > 0) {
        args.push('--files', ...filenames);
      } else {
        // Get unprocessed files from DB
        const unprocessed = getUnprocessedFiles(id);
        if (unprocessed.length === 0) {
          return NextResponse.json(
            { error: 'No unprocessed files to extract' },
            { status: 400 }
          );
        }
        args.push('--files', ...unprocessed.map((f) => f.filename));
      }
    }

    // Spawn detached process with log capture for post-mortem diagnosis.
    // The Python script also writes its own .extraction.log via TeeWriter,
    // but this captures any startup/crash output that occurs before the
    // script's own logging initializes.
    const logFile = path.join(
      ACTIVE_REVIEWS_BASE,
      project.folder_path,
      '.extraction_spawn.log'
    );
    const logFd = openSync(logFile, 'w');
    // Use pythonw.exe (windowless) to prevent console window spam on Windows.
    // FAIL-CLOSED: throw if pythonw.exe missing — no silent fallback to python.exe.
    const configuredPython = process.env.REG_REVIEW_PYTHON_PATH || 'python';
    const pythonwPath = configuredPython.replace(/python\.exe$/i, 'pythonw.exe');
    if (!existsSync(pythonwPath)) {
      return NextResponse.json(
        { error: `pythonw.exe not found at ${pythonwPath}. Required for windowless extraction.` },
        { status: 500 }
      );
    }
    const pythonPath = pythonwPath;
    const child = spawn(pythonPath, args, {
      detached: true,
      stdio: ['ignore', logFd, logFd],
      windowsHide: true,
    });
    child.unref();
    closeSync(logFd);

    // Update project status
    updateReviewProject(id, { status: 'extracting' });

    return NextResponse.json({
      status: 'started',
      progressFile,
    });
  } catch (error) {
    console.error('Error starting extraction:', error);
    return NextResponse.json(
      { error: 'Failed to start extraction' },
      { status: 500 }
    );
  }
}
