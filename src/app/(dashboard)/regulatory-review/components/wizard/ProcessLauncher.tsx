'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { CheckCircle2, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { isLocalEngineClient } from '@/lib/feature-flags';
import UnderConstruction from '@/components/ui/UnderConstruction';
import { type WizardState } from './types';
import { getServiceById } from '@/lib/regulatory-review/schedule3';

interface ProcessLauncherProps {
  wizardState: WizardState;
  onComplete: (projectId: string) => void;
}

type ProcessPhase =
  | 'idle'
  | 'creating'
  | 'uploading'
  | 'extracting'
  | 'evaluating'
  | 'importing'
  | 'done'
  | 'error';

interface ExtractStatus {
  status: string;
  currentFile: string;
  completedFiles: number;
  totalFiles: number;
  progress: number;
  errors: string[];
}

interface EvalStatus {
  status: string;
  policies_completed?: number;
  policies_total?: number;
  elapsed_s?: number;
  error?: string;
  importResult?: {
    submissionCreated: boolean;
    assessmentsImported: number;
  };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

// Tracks which phase was active when an error occurred, so retry can resume
// from the right point instead of creating a duplicate project.
type FailedPhase = 'extracting' | 'evaluating' | null;

export default function ProcessLauncher({
  wizardState,
  onComplete: _onComplete,
}: ProcessLauncherProps) {
  const [phase, setPhase] = useState<ProcessPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [failedPhase, setFailedPhase] = useState<FailedPhase>(null);
  const [extractStatus, setExtractStatus] = useState<ExtractStatus | null>(null);
  const [evalStatus, setEvalStatus] = useState<EvalStatus | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const engineEnabled = isLocalEngineClient();

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const appTypeServices = wizardState.applicationTypes
    .map((id) => getServiceById(id))
    .filter(Boolean);

  const additionalServices = wizardState.selectedServices
    .map((id) => getServiceById(id))
    .filter(Boolean);

  const totalFileSize = wizardState.files.reduce((sum, f) => sum + f.size, 0);

  /**
   * Start extraction for an existing project.
   * Triggers POST to extract route, then polls extract-status.
   *
   * When extraction completes, the extract-status route auto-chains into
   * evaluation server-side (Option B).  This function transitions the UI
   * to pollEvaluation() — it does NOT POST to the evaluate route, which
   * would spawn a duplicate evaluation process.
   */
  const startExtraction = useCallback(async (pid: string) => {
    setPhase('extracting');
    setExtractStatus(null);
    setFailedPhase(null);

    try {
      const extractRes = await fetch(
        `/api/regulatory-review/projects/${pid}/extract`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'full' }),
        },
      );

      if (!extractRes.ok) {
        throw new Error(`Failed to start extraction: ${extractRes.statusText}`);
      }

      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(
            `/api/regulatory-review/projects/${pid}/extract-status`,
          );
          if (!statusRes.ok) return;

          const status: ExtractStatus = await statusRes.json();
          setExtractStatus(status);

          if (status.status === 'completed') {
            // Clean extraction success — server auto-chains evaluation.
            // Transition UI to poll evaluate-status (no POST needed).
            if (pollRef.current) clearInterval(pollRef.current);
            pollEvaluation(pid);
          } else if (status.status === 'completed_with_errors') {
            // Partial extraction — do NOT auto-chain evaluation.
            // Stop polling; user must review errors before proceeding.
            if (pollRef.current) clearInterval(pollRef.current);
            setPhase('error');
            setFailedPhase('extracting');
            setError('Extraction completed with errors — review before evaluating');
          } else if (status.status === 'error') {
            if (pollRef.current) clearInterval(pollRef.current);
            setPhase('error');
            setFailedPhase('extracting');
            setError((status as ExtractStatus & { error?: string }).error || 'Extraction failed');
          }
        } catch {
          // Ignore transient poll errors
        }
      }, 2000);
    } catch (err) {
      setPhase('error');
      setFailedPhase('extracting');
      setError(err instanceof Error ? err.message : 'Failed to start extraction');
      if (pollRef.current) clearInterval(pollRef.current);
    }
  }, []);

  /**
   * Poll evaluate-status until evaluation completes or fails.
   *
   * Does NOT start evaluation — the server already did that via the
   * extract-status auto-chain.  This only tracks progress for UI display.
   */
  const pollEvaluation = useCallback((pid: string) => {
    setPhase('evaluating');
    setEvalStatus(null);
    setFailedPhase(null);

    pollRef.current = setInterval(async () => {
      try {
        const statusRes = await fetch(
          `/api/regulatory-review/projects/${pid}/evaluate-status`,
        );
        if (!statusRes.ok) return;

        const status: EvalStatus = await statusRes.json();
        setEvalStatus(status);

        if (status.status === 'completed') {
          if (pollRef.current) clearInterval(pollRef.current);
          setPhase('done');
        } else if (status.status === 'error' || status.status === 'import_failed') {
          if (pollRef.current) clearInterval(pollRef.current);
          setPhase('error');
          setFailedPhase('evaluating');
          setError(status.error || 'Evaluation failed');
        }
      } catch {
        // Ignore transient poll errors
      }
    }, 5000);
  }, []);

  /**
   * Retry evaluation after a failure.  POSTs to the evaluate route
   * explicitly — this is the ONLY wizard path that calls evaluate POST.
   * The normal happy path uses the server-side auto-chain instead.
   */
  const retryEvaluation = useCallback(async (pid: string) => {
    setPhase('evaluating');
    setEvalStatus(null);
    setFailedPhase(null);
    setError(null);

    try {
      const evalRes = await fetch(
        `/api/regulatory-review/projects/${pid}/evaluate`,
        { method: 'POST' },
      );

      if (!evalRes.ok) {
        const body = await evalRes.json().catch(() => ({}));
        throw new Error(body.error || `Failed to start evaluation: ${evalRes.statusText}`);
      }

      // Now poll — same as pollEvaluation
      pollEvaluation(pid);
    } catch (err) {
      setPhase('error');
      setFailedPhase('evaluating');
      setError(err instanceof Error ? err.message : 'Failed to start evaluation');
    }
  }, [pollEvaluation]);

  const handleStart = useCallback(async () => {
    setPhase('creating');
    setError(null);

    try {
      // Step 1: Create project
      const createRes = await fetch('/api/regulatory-review/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: wizardState.siteInfo.siteId,
          siteName: wizardState.siteInfo.siteName,
          applicantName: wizardState.siteInfo.applicantName,
          applicantCompany: wizardState.siteInfo.applicantCompany,
          applicationTypes: wizardState.applicationTypes,
          selectedServices: wizardState.selectedServices,
          submissionDate: wizardState.siteInfo.submissionDate,
          siteAddress: wizardState.siteInfo.siteAddress,
          siteRegion: wizardState.siteInfo.siteRegion,
          notes: wizardState.siteInfo.notes,
        }),
      });

      if (!createRes.ok) {
        throw new Error(`Failed to create project: ${createRes.statusText}`);
      }

      const { project } = await createRes.json();
      const newProjectId = project.id;
      setProjectId(newProjectId);

      // Step 2: Upload files
      setPhase('uploading');
      const formData = new FormData();
      wizardState.files.forEach((wf) => {
        formData.append('files', wf.file, wf.name);
      });

      const uploadRes = await fetch(
        `/api/regulatory-review/projects/${newProjectId}/files`,
        { method: 'POST', body: formData },
      );

      if (!uploadRes.ok) {
        throw new Error(`Failed to upload files: ${uploadRes.statusText}`);
      }

      // Step 3: Trigger extraction + poll (reuses startExtraction helper)
      await startExtraction(newProjectId);
    } catch (err) {
      setPhase('error');
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      if (pollRef.current) clearInterval(pollRef.current);
    }
  }, [wizardState, startExtraction]);

  const handleRetry = () => {
    setError(null);

    // If a project already exists, resume from the failed phase instead of
    // creating a duplicate project.
    if (projectId && failedPhase === 'extracting') {
      startExtraction(projectId);
      return;
    }
    if (projectId && failedPhase === 'evaluating') {
      // Evaluation failed — explicitly POST to evaluate route to retry.
      // This is the manual recovery path (distinct from auto-chain).
      retryEvaluation(projectId);
      return;
    }

    // No existing project or failure was before project creation — full reset
    setPhase('idle');
    setProjectId(null);
    setFailedPhase(null);
    setExtractStatus(null);
    setEvalStatus(null);
  };

  const isProcessing =
    phase !== 'idle' && phase !== 'done' && phase !== 'error';

  if (!engineEnabled) {
    return <UnderConstruction feature="Document Processing" />;
  }

  // Evaluation progress percentage
  const evalProgress =
    evalStatus?.policies_total && evalStatus.policies_total > 0
      ? Math.round(
          ((evalStatus.policies_completed ?? 0) / evalStatus.policies_total) * 100,
        )
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Review Summary</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Confirm your selections and start document processing.
        </p>
      </div>

      {/* Summary */}
      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700">
        {/* Application types */}
        <div className="p-4">
          <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Application {appTypeServices.length === 1 ? 'Type' : 'Types'}
          </dt>
          <dd className="mt-1 flex flex-wrap gap-1.5">
            {appTypeServices.length === 0 ? (
              <span className="text-sm text-slate-400 dark:text-slate-500">Not selected</span>
            ) : (
              appTypeServices.map((s) => (
                <span
                  key={s!.id}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300"
                >
                  {s!.name}
                </span>
              ))
            )}
          </dd>
        </div>

        {/* Additional services */}
        <div className="p-4">
          <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Additional Services
          </dt>
          <dd className="mt-1 flex flex-wrap gap-1.5">
            {additionalServices.length === 0 ? (
              <span className="text-sm text-slate-400 dark:text-slate-500">None</span>
            ) : (
              additionalServices.map((s) => (
                <span
                  key={s!.id}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300"
                >
                  {s!.name}
                </span>
              ))
            )}
          </dd>
        </div>

        {/* Site info */}
        <div className="p-4">
          <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Site Information
          </dt>
          <dd className="mt-1 text-sm text-slate-900 dark:text-white space-y-0.5">
            <div>
              <span className="font-medium">{wizardState.siteInfo.siteName}</span>
              {' '}(ID: {wizardState.siteInfo.siteId})
            </div>
            <div className="text-slate-500 dark:text-slate-400">
              Applicant: {wizardState.siteInfo.applicantName}
              {wizardState.siteInfo.applicantCompany && ` - ${wizardState.siteInfo.applicantCompany}`}
            </div>
            <div className="text-slate-500 dark:text-slate-400">
              Submitted: {wizardState.siteInfo.submissionDate}
              {wizardState.siteInfo.siteRegion && ` | ${wizardState.siteInfo.siteRegion}`}
            </div>
          </dd>
        </div>

        {/* Files */}
        <div className="p-4">
          <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Files
          </dt>
          <dd className="mt-1 text-sm text-slate-900 dark:text-white">
            {wizardState.files.length} {wizardState.files.length === 1 ? 'file' : 'files'}
            {' '}({formatFileSize(totalFileSize)})
          </dd>
        </div>
      </div>

      {/* Action area */}
      {phase === 'idle' && (
        <button
          type="button"
          onClick={handleStart}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-white font-medium bg-emerald-600 dark:bg-emerald-500 hover:bg-emerald-700 dark:hover:bg-emerald-600 transition-colors shadow-sm"
        >
          Start Document Processing
        </button>
      )}

      {isProcessing && (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-sky-600 dark:text-sky-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            {phase === 'creating' && 'Creating project...'}
            {phase === 'uploading' && 'Uploading files...'}
            {phase === 'extracting' && 'Extracting documents...'}
            {phase === 'evaluating' && 'Evaluating policies...'}
            {phase === 'importing' && 'Importing results...'}
          </div>

          {/* Extraction progress */}
          {extractStatus && phase === 'extracting' && (
            <>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <div
                  className="bg-sky-500 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${extractStatus.progress}%`,
                  }}
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {extractStatus.currentFile}
                {' '}({extractStatus.completedFiles}/{extractStatus.totalFiles})
              </p>
            </>
          )}

          {/* Evaluation progress */}
          {phase === 'evaluating' && evalStatus && evalStatus.policies_total != null && (
            <>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <div
                  className="bg-sky-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${evalProgress}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {evalStatus.policies_completed ?? 0} of {evalStatus.policies_total} policies
                {evalStatus.elapsed_s != null && ` (${formatElapsed(evalStatus.elapsed_s)})`}
              </p>
            </>
          )}
          {phase === 'evaluating' && (!evalStatus || evalStatus.policies_total == null) && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Initializing evaluation pipeline...
            </p>
          )}
        </div>
      )}

      {phase === 'done' && projectId && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800 p-4 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
              Processing complete
              {evalStatus?.importResult && (
                <span className="font-normal text-emerald-600 dark:text-emerald-400">
                  {' '}&mdash; {evalStatus.importResult.assessmentsImported} assessments imported
                </span>
              )}
            </p>
            <a
              href={`/regulatory-review/${projectId}`}
              className="inline-flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 mt-1"
            >
              View Review
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-sm font-medium text-red-800 dark:text-red-200">Processing failed</p>
          </div>
          <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 underline"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
