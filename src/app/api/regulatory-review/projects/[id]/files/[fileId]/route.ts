/**
 * Single File API
 *
 * DELETE /api/regulatory-review/projects/[id]/files/[fileId] - Remove a file
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireLocalEngine } from '@/lib/api-guards';
import { unlink } from 'fs/promises';
import path from 'path';
import {
  getReviewProjectById,
  getProjectFiles,
  removeProjectFile,
} from '@/lib/sqlite/queries/review-projects';

const ACTIVE_REVIEWS_BASE = 'C:/Projects/Regulatory-Review/1_Active_Reviews';

/**
 * DELETE /api/regulatory-review/projects/[id]/files/[fileId]
 *
 * Removes a file record from the DB and optionally deletes from disk.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const authError = await requireAdmin()
    if (authError) return authError
    const engineError = requireLocalEngine()
    if (engineError) return engineError

    const { id, fileId } = await params;
    const numericFileId = parseInt(fileId, 10);

    if (isNaN(numericFileId)) {
      return NextResponse.json(
        { error: 'Invalid file ID' },
        { status: 400 }
      );
    }

    const project = getReviewProjectById(id);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Look up the file record before deleting so we can remove from disk
    const files = getProjectFiles(id);
    const fileRecord = files.find((f) => f.id === numericFileId);

    if (!fileRecord) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Remove from DB
    const deleted = removeProjectFile(numericFileId);
    if (!deleted) {
      return NextResponse.json(
        { error: 'Failed to remove file' },
        { status: 500 }
      );
    }

    // Try to remove from disk
    if (fileRecord.filename && project.folder_path) {
      const filePath = path.join(
        ACTIVE_REVIEWS_BASE,
        project.folder_path,
        '0_Source_Documents',
        fileRecord.filename
      );
      try {
        await unlink(filePath);
      } catch (fsError) {
        // File may already be gone - don't fail the request
        console.error('Error deleting file from disk:', fsError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing project file:', error);
    return NextResponse.json(
      { error: 'Failed to remove file' },
      { status: 500 }
    );
  }
}
