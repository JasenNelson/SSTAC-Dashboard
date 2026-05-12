// engine_v2 frontend Lane 2b / Module L2b-4: TelemetrySidebar component.
//
// Server Component (no client interactivity required). Renders a sticky
// sidebar showing run identity, provenance, backend, selected telemetry,
// and coverage from the V2Evaluation row plus its raw_eval_result_json
// JSONB blob.
//
// Constraints (per Lane 2b plan section L2b-4):
//   - ASCII only. No em dashes, smart quotes, or Unicode arrows.
//   - Hydration safety: any date formatters lock locale to "en-US".
//   - Defensive against null/undefined fields in raw_eval_result_json
//     (JSONB blob; runtime shape is not statically guaranteed).
//   - Empty values render as "-".

import type { V2Evaluation, EvalCoverageStatement } from "@/lib/engine-v2/types_lane2";

interface TelemetrySidebarProps {
  evaluation: V2Evaluation;
}

// --------------------------------------------------------------------------
// Safe accessors for the raw_eval_result_json JSONB blob. Runtime shape is
// unknown, so we narrow defensively before reading.
// --------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readSection(
  raw: Record<string, unknown> | null,
  key: string,
): Record<string, unknown> | null {
  if (!raw) return null;
  const section = raw[key];
  return isRecord(section) ? section : null;
}

function readString(
  source: Record<string, unknown> | null,
  key: string,
): string | null {
  if (!source) return null;
  const value = source[key];
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

function readNumber(
  source: Record<string, unknown> | null,
  key: string,
): number | null {
  if (!source) return null;
  const value = source[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function readStringArray(
  source: Record<string, unknown> | null,
  key: string,
): string[] {
  if (!source) return [];
  const value = source[key];
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === "string") return entry;
      if (typeof entry === "number" || typeof entry === "boolean") {
        return String(entry);
      }
      return null;
    })
    .filter((entry): entry is string => entry !== null && entry.length > 0);
}

function formatDateLocale(value: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
}

function truncate(value: string | null, length: number): string {
  if (!value) return "-";
  if (value.length <= length) return value;
  return value.slice(0, length);
}

function displayOrDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string" && value.length === 0) return "-";
  return String(value);
}

// --------------------------------------------------------------------------
// Presentational helpers
// --------------------------------------------------------------------------

function FieldLabel({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
      {children}
    </div>
  );
}

function FieldValue({
  children,
  mono = false,
  testId,
}: {
  children: React.ReactNode;
  mono?: boolean;
  testId?: string;
}): React.ReactElement {
  const fontClass = mono ? "font-mono" : "";
  return (
    <div
      data-testid={testId}
      className={`text-xs text-slate-800 dark:text-slate-200 break-words ${fontClass}`}
    >
      {children}
    </div>
  );
}

function SectionHeading({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 pb-1">
      {children}
    </h4>
  );
}

function BackendBadge({ value }: { value: string | null }): React.ReactElement {
  const text = value ?? "-";
  let palette =
    "bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300";
  if (text === "live") {
    palette =
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
  } else if (text === "stub") {
    palette =
      "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200";
  }
  return (
    <span
      data-testid="telemetry-backend-badge"
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${palette}`}
    >
      {text}
    </span>
  );
}

// --------------------------------------------------------------------------
// TelemetrySidebar
// --------------------------------------------------------------------------

export function TelemetrySidebar({
  evaluation,
}: TelemetrySidebarProps): React.ReactElement {
  const raw: Record<string, unknown> | null = isRecord(
    evaluation.raw_eval_result_json,
  )
    ? (evaluation.raw_eval_result_json as Record<string, unknown>)
    : null;

  // If the raw_eval_result_json has not yet been imported, render a
  // muted placeholder card so the page layout stays stable.
  if (!raw) {
    return (
      <div
        data-testid="telemetry-sidebar"
        data-state="pending"
        className="sticky top-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-2 opacity-60"
      >
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          Telemetry
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Telemetry pending...
        </p>
      </div>
    );
  }

  const provenance = readSection(raw, "provenance");
  const telemetry = readSection(raw, "telemetry");

  // Provenance fields
  const corpusVersion = readString(provenance, "corpus_version");
  const graphCorpusVersion = readString(provenance, "graph_corpus_version");
  const embedderBackend = readString(provenance, "embedder_backend");
  const rerankerBackend = readString(provenance, "reranker_backend");
  const stagesRun = readStringArray(provenance, "stages_run");
  const gitShaAtRun = readString(provenance, "git_sha_at_run");

  // Telemetry fields
  const schemaClass = readString(telemetry, "schema_class");
  const variant = readString(telemetry, "variant");
  const pathwayNotesMode = readString(telemetry, "pathway_notes_mode");
  const retrievalIndexMode = readString(telemetry, "retrieval_index_mode");
  const chunkPolicyMappingCount = readNumber(
    telemetry,
    "chunk_policy_mapping_count",
  );
  const vectorIndexMappingCount = readNumber(
    telemetry,
    "vector_index_mapping_count",
  );
  const graphDriftWarnings = readStringArray(telemetry, "graph_drift_warnings");

  // Coverage summary derived from evaluation row.
  const coverage = (evaluation.coverage_statement ?? {}) as EvalCoverageStatement;
  const coverageTotal = coverage.total_policies ?? 0;
  const coverageEvaluated = coverage.evaluated ?? 0;
  const coverageDeferred = coverage.deferred ?? 0;
  const coverageError = coverage.error ?? 0;

  return (
    <div
      data-testid="telemetry-sidebar"
      data-state="ready"
      className="sticky top-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-4 max-h-[calc(100vh-2rem)] overflow-y-auto"
    >
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
        Telemetry
      </h3>

      {/* Run identity */}
      <section
        data-testid="telemetry-run-identity"
        className="space-y-2"
      >
        <SectionHeading>Run identity</SectionHeading>
        <div className="space-y-2">
          <div>
            <FieldLabel>Engine run ID</FieldLabel>
            <FieldValue mono testId="telemetry-run-id">
              {displayOrDash(evaluation.run_id_engine)}
            </FieldValue>
          </div>
          <div>
            <FieldLabel>Variant config hash</FieldLabel>
            <FieldValue mono testId="telemetry-variant-hash">
              <span
                title={evaluation.variant_config_hash ?? ""}
                data-full={evaluation.variant_config_hash ?? ""}
              >
                {truncate(evaluation.variant_config_hash, 12)}
              </span>
            </FieldValue>
          </div>
          <div>
            <FieldLabel>Started at</FieldLabel>
            <FieldValue mono testId="telemetry-started-at">
              {formatDateLocale(evaluation.started_at)}
            </FieldValue>
          </div>
          <div>
            <FieldLabel>Completed at</FieldLabel>
            <FieldValue mono testId="telemetry-completed-at">
              {formatDateLocale(evaluation.completed_at)}
            </FieldValue>
          </div>
        </div>
      </section>

      {/* Provenance */}
      {provenance ? (
        <section
          data-testid="telemetry-provenance"
          className="space-y-2"
        >
          <SectionHeading>Provenance</SectionHeading>
          <div className="space-y-2">
            <div>
              <FieldLabel>corpus_version</FieldLabel>
              <FieldValue mono>{displayOrDash(corpusVersion)}</FieldValue>
            </div>
            <div>
              <FieldLabel>graph_corpus_version</FieldLabel>
              <FieldValue mono>{displayOrDash(graphCorpusVersion)}</FieldValue>
            </div>
            <div>
              <FieldLabel>embedder_backend</FieldLabel>
              <FieldValue mono>{displayOrDash(embedderBackend)}</FieldValue>
            </div>
            <div>
              <FieldLabel>reranker_backend</FieldLabel>
              <FieldValue mono>{displayOrDash(rerankerBackend)}</FieldValue>
            </div>
            <div>
              <FieldLabel>stages_run</FieldLabel>
              <FieldValue mono>
                {stagesRun.length > 0 ? stagesRun.join(", ") : "-"}
              </FieldValue>
            </div>
            <div>
              <FieldLabel>git_sha_at_run</FieldLabel>
              <FieldValue mono>
                <span
                  title={gitShaAtRun ?? ""}
                  data-full={gitShaAtRun ?? ""}
                >
                  {truncate(gitShaAtRun, 8)}
                </span>
              </FieldValue>
            </div>
          </div>
        </section>
      ) : null}

      {/* Backend */}
      <section
        data-testid="telemetry-backend"
        className="space-y-2"
      >
        <SectionHeading>Backend</SectionHeading>
        <div className="space-y-2">
          <div>
            <FieldLabel>evaluation_backend</FieldLabel>
            <FieldValue>
              <BackendBadge value={evaluation.evaluation_backend} />
            </FieldValue>
          </div>
          <div>
            <FieldLabel>model</FieldLabel>
            <FieldValue mono>{displayOrDash(evaluation.model)}</FieldValue>
          </div>
          <div>
            <FieldLabel>bench_fixture</FieldLabel>
            <FieldValue mono>{displayOrDash(evaluation.bench_fixture)}</FieldValue>
          </div>
          <div>
            <FieldLabel>applicability_mode</FieldLabel>
            <FieldValue mono>
              {displayOrDash(evaluation.applicability_mode)}
            </FieldValue>
          </div>
        </div>
      </section>

      {/* Selected telemetry */}
      {telemetry ? (
        <section
          data-testid="telemetry-selected"
          className="space-y-2"
        >
          <SectionHeading>Selected telemetry</SectionHeading>
          <div className="space-y-2">
            <div>
              <FieldLabel>schema_class</FieldLabel>
              <FieldValue mono>{displayOrDash(schemaClass)}</FieldValue>
            </div>
            <div>
              <FieldLabel>variant</FieldLabel>
              <FieldValue mono>{displayOrDash(variant)}</FieldValue>
            </div>
            <div>
              <FieldLabel>pathway_notes_mode</FieldLabel>
              <FieldValue mono>{displayOrDash(pathwayNotesMode)}</FieldValue>
            </div>
            <div>
              <FieldLabel>retrieval_index_mode</FieldLabel>
              <FieldValue mono>{displayOrDash(retrievalIndexMode)}</FieldValue>
            </div>
            <div>
              <FieldLabel>chunk_policy_mapping_count</FieldLabel>
              <FieldValue mono>
                {chunkPolicyMappingCount === null
                  ? "-"
                  : String(chunkPolicyMappingCount)}
              </FieldValue>
            </div>
            <div>
              <FieldLabel>vector_index_mapping_count</FieldLabel>
              <FieldValue mono>
                {vectorIndexMappingCount === null
                  ? "-"
                  : String(vectorIndexMappingCount)}
              </FieldValue>
            </div>
            <div>
              <FieldLabel>graph_drift_warnings</FieldLabel>
              {graphDriftWarnings.length === 0 ? (
                <FieldValue mono>-</FieldValue>
              ) : (
                <ul
                  data-testid="telemetry-graph-drift-warnings"
                  className="mt-1 space-y-1"
                >
                  {graphDriftWarnings.map((warning, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-1.5 text-xs text-slate-800 dark:text-slate-200 font-mono break-words"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-600 dark:bg-red-400"
                      />
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {/* Coverage */}
      <section
        data-testid="telemetry-coverage"
        className="space-y-2"
      >
        <SectionHeading>Coverage</SectionHeading>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <FieldLabel>Total</FieldLabel>
            <FieldValue mono testId="telemetry-coverage-total">
              {coverageTotal}
            </FieldValue>
          </div>
          <div>
            <FieldLabel>Evaluated</FieldLabel>
            <FieldValue mono testId="telemetry-coverage-evaluated">
              {coverageEvaluated}
            </FieldValue>
          </div>
          <div>
            <FieldLabel>Deferred</FieldLabel>
            <FieldValue mono testId="telemetry-coverage-deferred">
              {coverageDeferred}
            </FieldValue>
          </div>
          <div>
            <FieldLabel>Error</FieldLabel>
            <FieldValue mono testId="telemetry-coverage-error">
              {coverageError}
            </FieldValue>
          </div>
        </div>
      </section>
    </div>
  );
}
