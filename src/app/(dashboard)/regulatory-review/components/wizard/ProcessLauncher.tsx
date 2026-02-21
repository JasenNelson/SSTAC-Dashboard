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

type ProcessPhase = 'idle' | 'creating' | 'uploading' | 'extracting' | 'done' | 'error';

interface ExtractStatus {
  status: string;
  currentFile: string;
  completedFiles: number;
  totalFiles: number;
  progress: number;
  errors: string[];
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ProcessLauncher({
  wizardState,
  onComplete,
}: ProcessLauncherProps) {
  const [phase, setPhase] = useState<ProcessPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [extractStatus, setExtractStatus] = useState<ExtractStatus | null>(null);
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

      // Step 3: Trigger extraction
      setPhase('extracting');
      const extractRes = await fetch(
        `/api/regulatory-review/projects/${newProjectId}/extract`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'full' }),
        },
      );

      if (!extractRes.ok) {
        throw new Error(`Failed to start extraction: ${extractRes.statusText}`);
      }

      // Step 4: Poll for extraction status
      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(
            `/api/regulatory-review/projects/${newProjectId}/extract-status`,
          );
          if (!statusRes.ok) return;

          const status: ExtractStatus = await statusRes.json();
          setExtractStatus(status);

          if (status.status === 'completed' || status.status === 'completed_with_errors') {
            if (pollRef.current) clearInterval(pollRef.current);
            setPhase('done');
          }
        } catch {
          // Ignore transient poll errors
        }
      }, 2000);
    } catch (err) {
      setPhase('error');
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      if (pollRef.current) clearInterval(pollRef.current);
    }
  }, [wizardState, onComplete]);

  const handleRetry = () => {
    setPhase('idle');
    setError(null);
    setProjectId(null);
    setExtractStatus(null);
  };

  const isProcessing = phase !== 'idle' && phase !== 'done' && phase !== 'error';

  if (!engineEnabled) {
    return <UnderConstruction feature="Document Processing" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Review Summary</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Confirm your selections and start document processing.
        </p>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
        {/* Application types */}
        <div className="p-4">
          <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Application {appTypeServices.length === 1 ? 'Type' : 'Types'}
          </dt>
          <dd className="mt-1 flex flex-wrap gap-1.5">
            {appTypeServices.length === 0 ? (
              <span className="text-sm text-gray-400 dark:text-gray-500">Not selected</span>
            ) : (
              appTypeServices.map((s) => (
                <span
                  key={s!.id}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                >
                  {s!.name}
                </span>
              ))
            )}
          </dd>
        </div>

        {/* Additional services */}
        <div className="p-4">
          <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Additional Services
          </dt>
          <dd className="mt-1 flex flex-wrap gap-1.5">
            {additionalServices.length === 0 ? (
              <span className="text-sm text-gray-400 dark:text-gray-500">None</span>
            ) : (
              additionalServices.map((s) => (
                <span
                  key={s!.id}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                >
                  {s!.name}
                </span>
              ))
            )}
          </dd>
        </div>

        {/* Site info */}
        <div className="p-4">
          <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Site Information
          </dt>
          <dd className="mt-1 text-sm text-gray-900 dark:text-white space-y-0.5">
            <div>
              <span className="font-medium">{wizardState.siteInfo.siteName}</span>
              {' '}(ID: {wizardState.siteInfo.siteId})
            </div>
            <div className="text-gray-600 dark:text-gray-400">
              Applicant: {wizardState.siteInfo.applicantName}
              {wizardState.siteInfo.applicantCompany && ` - ${wizardState.siteInfo.applicantCompany}`}
            </div>
            <div className="text-gray-500 dark:text-gray-400">
              Submitted: {wizardState.siteInfo.submissionDate}
              {wizardState.siteInfo.siteRegion && ` | ${wizardState.siteInfo.siteRegion}`}
            </div>
          </dd>
        </div>

        {/* Files */}
        <div className="p-4">
          <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Files
          </dt>
          <dd className="mt-1 text-sm text-gray-900 dark:text-white">
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
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            {phase === 'creating' && 'Creating project...'}
            {phase === 'uploading' && 'Uploading files...'}
            {phase === 'extracting' && 'Extracting documents...'}
          </div>
          {extractStatus && phase === 'extracting' && (
            <>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${extractStatus.progress}%`,
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {extractStatus.currentFile}
                {' '}({extractStatus.completedFiles}/{extractStatus.totalFiles})
              </p>
            </>
          )}
        </div>
      )}

      {phase === 'done' && projectId && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800 p-4 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Processing complete</p>
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
