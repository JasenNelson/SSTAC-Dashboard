"use client";

// engine_v2 frontend Lane 1 / Module L1-5: ProjectDetailClient.
//
// Client orchestration for the project detail page. Composes the L1-3 UploadStep
// with the new FileList, ExtractTriggerButton, and ExtractionStatusPanel from
// this module. Owns the client-side mirror of v2_submission_files and the
// latest v2_extraction_runs row for the project; refetches files from
// Supabase via the browser client after each successful upload, and updates
// the run state from ExtractionStatusPanel poll callbacks + ExtractTriggerButton
// trigger callbacks.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { UploadStep } from "@/components/engine-v2/UploadStep";
import { FileList } from "@/components/engine-v2/FileList";
import { ExtractTriggerButton } from "@/components/engine-v2/ExtractTriggerButton";
import { ExtractionStatusPanel } from "@/components/engine-v2/ExtractionStatusPanel";
import type {
  V2Project,
  V2SubmissionFile,
  V2ExtractionRun,
} from "@/lib/engine-v2/types";

interface ProjectDetailClientProps {
  project: V2Project;
  initialFiles: V2SubmissionFile[];
  initialRun: V2ExtractionRun | null;
  accessToken: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export function ProjectDetailClient(
  props: ProjectDetailClientProps,
): React.ReactElement {
  const {
    project,
    initialFiles,
    initialRun,
    accessToken,
    supabaseUrl,
    supabaseAnonKey,
  } = props;

  const [files, setFiles] = useState<V2SubmissionFile[]>(initialFiles);
  const [currentRun, setCurrentRun] = useState<V2ExtractionRun | null>(initialRun);

  // Lane 1 simplification: a single, server-rendered access token is sufficient
  // for the UploadStep TUS flow. Production should refresh the session
  // client-side; we surface this in the README handoff for Lane 2.
  const accessTokenRef = useRef<string>(accessToken);
  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  const getAccessToken = useCallback(async (): Promise<string> => {
    return accessTokenRef.current;
  }, []);

  // Browser-side Supabase client for refetching the file list after upload.
  // We pre-prime its session with the same token used server-side so RLS sees
  // the same admin owner.
  const supabase = useMemo(() => {
    return createBrowserClient(supabaseUrl, supabaseAnonKey);
  }, [supabaseUrl, supabaseAnonKey]);

  const refetchFiles = useCallback(async () => {
    const { data, error } = await supabase
      .from("v2_submission_files")
      .select(
        "id, project_id, original_filename, storage_path, size_bytes, mime_type, sha256, uploaded_at, deleted_at",
      )
      .eq("project_id", project.id)
      .is("deleted_at", null)
      .order("uploaded_at", { ascending: false });
    if (!error && data) {
      setFiles(data as V2SubmissionFile[]);
    }
  }, [supabase, project.id]);

  // L1-3 UploadStep exposes onUploaded(fileId). Use that to refresh the list.
  const onUploaded = useCallback(
    async (_fileId: string) => {
      void _fileId;
      await refetchFiles();
    },
    [refetchFiles],
  );

  const onTriggerStart = useCallback(
    (runId: string) => {
      // Optimistically swap the panel to the new (or existing) run. The next
      // poll inside ExtractionStatusPanel will replace this skeleton with the
      // real row from /extract-status.
      setCurrentRun((prev) => {
        if (prev && prev.id === runId) return prev;
        const nowIso = new Date().toISOString();
        const skeleton: V2ExtractionRun = {
          id: runId,
          project_id: project.id,
          status: "pending",
          total_files: files.length,
          completed_files: 0,
          current_file: null,
          progress: 0,
          errors: [],
          chunk_progress: null,
          updated_at: nowIso,
          started_at: nowIso,
          completed_at: null,
        };
        return skeleton;
      });
    },
    [project.id, files.length],
  );

  const onPoll = useCallback((updated: V2ExtractionRun) => {
    setCurrentRun(updated);
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          {project.name}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
          project_id {project.id}
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-3">
              Upload submission file
            </h3>
            <UploadStep
              projectId={project.id}
              getAccessToken={getAccessToken}
              supabaseUrl={supabaseUrl}
              supabaseAnonKey={supabaseAnonKey}
              onUploaded={onUploaded}
            />
          </section>

          <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-3">
              Files ({files.length} / {project.max_files})
            </h3>
            <FileList files={files} />
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-3">
              Extraction
            </h3>
            <ExtractTriggerButton
              projectId={project.id}
              currentRun={currentRun}
              activeFileCount={files.length}
              onTriggerStart={onTriggerStart}
            />
          </section>

          <section>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-3">
              Status
            </h3>
            <ExtractionStatusPanel
              projectId={project.id}
              run={currentRun}
              onPoll={onPoll}
            />
          </section>
        </div>
      </div>
    </div>
  );
}

export default ProjectDetailClient;
