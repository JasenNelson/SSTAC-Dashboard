/**
 * Single Review Project API
 *
 * GET    /api/regulatory-review/projects/[id] - Get project with files
 * PATCH  /api/regulatory-review/projects/[id] - Update project
 * DELETE /api/regulatory-review/projects/[id] - Delete project
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireLocalEngine } from '@/lib/api-guards';
import { rm } from 'fs/promises';
import path from 'path';
import {
  getReviewProjectById,
  updateReviewProject,
  deleteReviewProject,
  getProjectFiles,
} from '@/lib/sqlite/queries/review-projects';

const ACTIVE_REVIEWS_BASE = 'C:/Projects/Regulatory-Review/1_Active_Reviews';

/**
 * GET /api/regulatory-review/projects/[id]
 *
 * Returns a single project with its files.
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

    return NextResponse.json({ project, files });
  } catch (error) {
    console.error('Error fetching review project:', error);
    return NextResponse.json(
      { error: 'Failed to fetch review project' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/regulatory-review/projects/[id]
 *
 * Updates project fields. Accepts partial body.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = await requireAdmin()
    if (authError) return authError
    const engineError = requireLocalEngine()
    if (engineError) return engineError

    const { id } = await params;

    const existing = getReviewProjectById(id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const body = await request.json();

    const project = updateReviewProject(id, {
      site_id: body.siteId,
      site_name: body.siteName,
      applicant_name: body.applicantName,
      applicant_company: body.applicantCompany,
      application_type: body.applicationTypes !== undefined
        ? JSON.stringify(body.applicationTypes)
        : undefined,
      selected_services: body.selectedServices !== undefined
        ? (typeof body.selectedServices === 'string'
            ? body.selectedServices
            : JSON.stringify(body.selectedServices))
        : undefined,
      submission_date: body.submissionDate,
      site_address: body.siteAddress,
      site_region: body.siteRegion,
      notes: body.notes,
      status: body.status,
    });

    return NextResponse.json({ project });
  } catch (error) {
    console.error('Error updating review project:', error);
    return NextResponse.json(
      { error: 'Failed to update review project' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/regulatory-review/projects/[id]
 *
 * Deletes a project. Pass ?deleteFiles=true to also remove the folder from disk.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = await requireAdmin()
    if (authError) return authError
    const engineError = requireLocalEngine()
    if (engineError) return engineError

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const deleteFiles = searchParams.get('deleteFiles') === 'true';

    const project = getReviewProjectById(id);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Delete from database first
    const deleted = deleteReviewProject(id);
    if (!deleted) {
      return NextResponse.json(
        { error: 'Failed to delete project' },
        { status: 500 }
      );
    }

    // Optionally delete folder from disk
    if (deleteFiles && project.folder_path) {
      const fullPath = path.join(ACTIVE_REVIEWS_BASE, project.folder_path);
      try {
        await rm(fullPath, { recursive: true, force: true });
      } catch (fsError) {
        console.error('Error deleting project folder:', fsError);
        // DB delete succeeded, folder cleanup failed - don't fail the request
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting review project:', error);
    return NextResponse.json(
      { error: 'Failed to delete review project' },
      { status: 500 }
    );
  }
}
