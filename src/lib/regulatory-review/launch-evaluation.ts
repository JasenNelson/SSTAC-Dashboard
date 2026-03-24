/**
 * Shared evaluation launcher.
 *
 * Encapsulates the subprocess spawn logic so both the evaluate POST route
 * and the extract-status auto-chain use identical launch behavior.
 *
 * Idempotency is NOT handled here — callers must ensure the project is in
 * the correct state before calling.
 */

import { spawn } from 'child_process';
import { mkdirSync, openSync, closeSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

const ACTIVE_REVIEWS_BASE = 'C:/Projects/Regulatory-Review/1_Active_Reviews';
const ENGINE_BASE_PATH = process.env.REG_REVIEW_ENGINE_BASE_PATH || 'C:/Projects/Regulatory-Review/engine';
const EVAL_SCRIPT = path.join(ENGINE_BASE_PATH, 'scripts', 'orchestrators', 'run_shadow_evaluation.py');

const SERVICE_TO_MEDIA: Record<string, string[]> = {
  'psi-review':                ['soil', 'groundwater'],
  'dsi-review':                ['soil', 'groundwater'],
  'supplemental-investigation': ['soil', 'groundwater'],
  'remediation-plan':          ['soil', 'groundwater'],
  'remediation-plan-risk':     ['soil', 'groundwater'],
  'hhra-review':               ['soil', 'groundwater', 'vapour'],
  'era-review':                ['soil', 'sediment', 'surface_water', 'groundwater'],
  'via-review':                ['vapour'],
  'cor-review':                ['soil', 'groundwater'],
  'aip-application':           ['soil', 'groundwater'],
  'coc-application':           ['soil', 'groundwater'],
  'ap-coc':                    ['soil', 'groundwater'],
  'site-determination-s44':    ['soil', 'groundwater'],
  'independent-remediation-s49': ['soil', 'groundwater'],
  'ap-s44-determination':      ['soil', 'groundwater'],
  'determination':             ['soil', 'groundwater'],
  'vra':                       ['soil', 'groundwater'],
  'csra':                      ['soil'],
  'ira':                       ['soil', 'groundwater'],
  'background-concentration':  ['soil', 'groundwater'],
  'site-specific-standards':   ['soil', 'groundwater'],
  'wide-area-designation':     ['soil'],
};

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

/**
 * Project shape expected by the launcher.  Matches the review_projects row
 * fields actually used — callers pass the DB row directly.
 */
export interface LaunchableProject {
  id: string;
  site_id: string;
  folder_path: string;
  application_type: string | null;
  selected_services: string | null;
}

/**
 * Spawn the evaluation subprocess for a project.
 *
 * This is a fire-and-forget spawn.  The caller is responsible for:
 * - Verifying the project is in the correct state before calling
 * - Updating the project status to 'evaluating' (or handling failure)
 *
 * Throws on spawn failure so the caller can persist a failure state.
 */
export function spawnEvaluation(project: LaunchableProject): void {
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

  mkdirSync(outputPath, { recursive: true });

  // Seed a fresh evaluation status file so stale artifacts from prior runs
  // cannot masquerade as the current run.  The Python adapter overwrites this
  // with {"status": "initializing"} on startup, but this seed ensures the
  // status file is fresh even if Python fails to start.
  writeFileSync(progressFile, JSON.stringify({
    status: 'launching',
    updatedAt: new Date().toISOString(),
  }));

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

  const logFile = path.join(
    ACTIVE_REVIEWS_BASE,
    project.folder_path,
    '.evaluation_spawn.log'
  );
  const logFd = openSync(logFile, 'w');

  // Use pythonw.exe (windowless Python) to prevent console window creation.
  // python.exe is a "console subsystem" app — even with windowsHide: true,
  // Windows creates a hidden console that can cascade/flash under load.
  // pythonw.exe is a "windows subsystem" app — no console window at all.
  // FAIL-CLOSED: if pythonw.exe is not found, throw rather than silently
  // falling back to python.exe (which reintroduces window spam).
  const configuredPython = process.env.REG_REVIEW_PYTHON_PATH || 'python';
  const pythonwPath = configuredPython.replace(/python\.exe$/i, 'pythonw.exe');
  if (!existsSync(pythonwPath)) {
    throw new Error(
      `pythonw.exe not found at ${pythonwPath}. ` +
      `Required for windowless evaluation. ` +
      `Ensure REG_REVIEW_PYTHON_PATH points to a directory containing pythonw.exe.`
    );
  }
  const pythonPath = pythonwPath;

  const child = spawn(pythonPath, [EVAL_SCRIPT], {
    cwd: ENGINE_BASE_PATH,
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env,
    windowsHide: true,
  });
  child.unref();
  closeSync(logFd);
}
