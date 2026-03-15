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

// ---------------------------------------------------------------------------
// Phase 1 Applicability: Schedule 3 service/application IDs → engine media types
// ---------------------------------------------------------------------------
// Maps frontend service IDs to the media types the engine's applicability filter
// understands. The engine filter uses these to exclude obviously non-applicable
// media-scoped policies (e.g., vapour-only policies when vapour is not selected).
//
// NOTE: This does NOT implement ERA-vs-HHRA content routing (Phase 2).
// It only ensures the engine receives valid media types instead of raw service IDs.
//
// Both applicationTypes and selectedServices are checked; results are unioned
// and deduplicated.  Unknown IDs are ignored (conservative: no media restriction
// rather than wrong restriction).
const SERVICE_TO_MEDIA: Record<string, string[]> = {
  // --- Investigation (broad media scope) ---
  'psi-review':                ['soil', 'groundwater'],
  'dsi-review':                ['soil', 'groundwater'],
  'supplemental-investigation': ['soil', 'groundwater'],
  // --- Remediation ---
  'remediation-plan':          ['soil', 'groundwater'],
  'remediation-plan-risk':     ['soil', 'groundwater'],
  // --- Risk Assessment (domain-specific media) ---
  'hhra-review':               ['soil', 'groundwater', 'vapour'],
  'era-review':                ['soil', 'sediment', 'surface_water', 'groundwater'],
  'via-review':                ['vapour'],
  // --- Confirmation / Certification (broad) ---
  'cor-review':                ['soil', 'groundwater'],
  'aip-application':           ['soil', 'groundwater'],
  'coc-application':           ['soil', 'groundwater'],
  'ap-coc':                    ['soil', 'groundwater'],
  // --- Site Determination ---
  'site-determination-s44':    ['soil', 'groundwater'],
  'independent-remediation-s49': ['soil', 'groundwater'],
  'ap-s44-determination':      ['soil', 'groundwater'],
  'determination':             ['soil', 'groundwater'],
  // --- Agreements ---
  'vra':                       ['soil', 'groundwater'],
  'csra':                      ['soil'],
  'ira':                       ['soil', 'groundwater'],
  // --- Specialized ---
  'background-concentration':  ['soil', 'groundwater'],
  'site-specific-standards':   ['soil', 'groundwater'],
  'wide-area-designation':     ['soil'],
};

/**
 * Derive engine-compatible MEDIA_TYPES from the project's applicationTypes
 * and selectedServices. Returns a deduplicated comma-separated string of
 * valid media identifiers (soil, groundwater, vapour, sediment, surface_water).
 *
 * Unknown service IDs are silently skipped (conservative: if nothing maps,
 * the engine defaults to ["soil"]).
 */
function deriveMediaTypes(
  applicationTypesCSV: string,
  selectedServicesCSV: string,
): string {
  const allIds = [
    ...applicationTypesCSV.split(','),
    ...selectedServicesCSV.split(','),
  ]
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const mediaSet = new Set<string>();
  for (const id of allIds) {
    const media = SERVICE_TO_MEDIA[id];
    if (media) {
      for (const m of media) mediaSet.add(m);
    }
  }
  return [...mediaSet].sort().join(',');
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
    const appTypeCSV = parseJsonArrayToCSV(project.application_type);
    const servicesCSV = parseJsonArrayToCSV(project.selected_services);
    const mediaTypesCSV = deriveMediaTypes(appTypeCSV, servicesCSV);

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
      APPLICATION_TYPE: appTypeCSV,
      SELECTED_SERVICES: servicesCSV,
      MEDIA_TYPES: mediaTypesCSV,
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
