/**
 * Review Projects API
 *
 * GET  /api/regulatory-review/projects - List all projects
 * POST /api/regulatory-review/projects - Create new project from wizard
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireLocalEngine } from '@/lib/api-guards';
import { mkdir } from 'fs/promises';
import path from 'path';
import {
  getReviewProjects,
  createReviewProject,
} from '@/lib/sqlite/queries/review-projects';

const ACTIVE_REVIEWS_BASE = 'C:/Projects/Regulatory-Review/1_Active_Reviews';

function sanitizeFolderName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * GET /api/regulatory-review/projects
 *
 * Returns all review projects, optionally filtered by status.
 * Query params: status (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const authError = await requireAdmin()
    if (authError) return authError
    const engineError = requireLocalEngine()
    if (engineError) return engineError

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;

    const projects = getReviewProjects(status);

    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Error fetching review projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch review projects' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/regulatory-review/projects
 *
 * Creates a new review project and its folder structure on disk.
 */
export async function POST(request: NextRequest) {
  try {
    const authError = await requireAdmin()
    if (authError) return authError
    const engineError = requireLocalEngine()
    if (engineError) return engineError

    const body = await request.json();
    const {
      siteId,
      siteName,
      applicantName,
      applicantCompany,
      applicationTypes,
      selectedServices,
      submissionDate,
      siteAddress,
      siteRegion,
      notes,
    } = body;

    if (!siteId || !applicationTypes || !Array.isArray(applicationTypes) || applicationTypes.length === 0) {
      return NextResponse.json(
        { error: 'siteId and at least one applicationTypes entry are required' },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();
    const folderName = sanitizeFolderName(`${siteId}_${applicationTypes[0]}`);
    const folderPath = folderName;
    const fullPath = path.join(ACTIVE_REVIEWS_BASE, folderName);

    // Create folder structure on disk
    await mkdir(path.join(fullPath, '0_Source_Documents'), { recursive: true });
    await mkdir(path.join(fullPath, '1_Extractions'), { recursive: true });
    await mkdir(path.join(fullPath, '2_Evaluation_Output'), { recursive: true });

    const project = createReviewProject({
      id,
      site_id: siteId,
      site_name: siteName || null,
      applicant_name: applicantName || null,
      applicant_company: applicantCompany || null,
      application_type: JSON.stringify(applicationTypes),
      selected_services: typeof selectedServices === 'string'
        ? selectedServices
        : JSON.stringify(selectedServices || []),
      submission_date: submissionDate || null,
      site_address: siteAddress || null,
      site_region: siteRegion || null,
      folder_path: folderPath,
      notes: notes || null,
      status: 'created',
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error('Error creating review project:', error);
    return NextResponse.json(
      { error: 'Failed to create review project' },
      { status: 500 }
    );
  }
}
