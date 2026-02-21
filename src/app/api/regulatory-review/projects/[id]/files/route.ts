/**
 * Review Project Files API
 *
 * GET  /api/regulatory-review/projects/[id]/files - List project files
 * POST /api/regulatory-review/projects/[id]/files - Upload files
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireLocalEngine } from '@/lib/api-guards';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import {
  getReviewProjectById,
  getProjectFiles,
  addProjectFile,
} from '@/lib/sqlite/queries/review-projects';

const ACTIVE_REVIEWS_BASE = 'C:/Projects/Regulatory-Review/1_Active_Reviews';

/**
 * GET /api/regulatory-review/projects/[id]/files
 *
 * Returns all files for a project.
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

    const files = getProjectFiles(id);

    return NextResponse.json({ files });
  } catch (error) {
    console.error('Error fetching project files:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project files' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/regulatory-review/projects/[id]/files
 *
 * Upload files via FormData. Writes to disk and records in DB.
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

    const formData = await request.formData();
    const uploadedFiles = formData.getAll('files');

    if (!uploadedFiles || uploadedFiles.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    const sourceDir = path.join(
      ACTIVE_REVIEWS_BASE,
      project.folder_path,
      '0_Source_Documents'
    );
    await mkdir(sourceDir, { recursive: true });

    const newFiles = [];

    for (const entry of uploadedFiles) {
      if (!(entry instanceof File)) {
        continue;
      }

      const filename = entry.name;
      const buffer = Buffer.from(await entry.arrayBuffer());
      const filePath = path.join(sourceDir, filename);

      await writeFile(filePath, buffer);

      const fileRecord = addProjectFile(
        id,
        filename,
        entry.size,
        entry.type || 'application/octet-stream'
      );
      newFiles.push(fileRecord);
    }

    return NextResponse.json({ files: newFiles }, { status: 201 });
  } catch (error) {
    console.error('Error uploading project files:', error);
    return NextResponse.json(
      { error: 'Failed to upload files' },
      { status: 500 }
    );
  }
}
