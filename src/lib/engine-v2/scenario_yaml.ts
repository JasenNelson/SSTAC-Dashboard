// engine_v2 frontend Lane 2a / Module L2a-2: scenario YAML composer.
//
// Produces a deterministic YAML string consumed by the engine's
// run_owner_scenario.py via `--scenario-config <path>`. The script's
// argparse expects a flat top-level mapping with the keys listed in its
// docstring (lines 28-77). We intentionally avoid pulling in a YAML
// library: the schema is small, the writer is the only producer, and
// keeping this dependency-free keeps the Next.js build slim.
//
// All values are emitted as double-quoted strings to dodge YAML type
// coercion (e.g. an empty model field becoming `null` if unquoted).
// Double-quotes in path components are escaped to `\"`.

export interface ComposeScenarioYamlArgs {
  scenarioId: string;
  extractPath: string;
  benchFixture: string;
  applicabilityMode: "off" | "pre" | "soft";
  evaluationBackend: "stub" | "live";
  embedderBackend: "stub" | "real";
  rerankerBackend: "disabled" | "stub" | "real";
  // Empty string is acceptable -- engine falls back to its own default
  // (qwen2.5:14b-instruct-q4_K_M) when running stub backends.
  model: string;
  variant: string;
  // Path to pre-downloaded BGE model directory. Required when
  // embedderBackend === "real". Engine pre-flight verifies on-disk.
  embedderModelPath?: string;
  // Path to a JSON array of HITL-confirmed applicable policy ids, written by the
  // evaluate route into evalRunDir (policy_ids.json). Consumed by
  // run_owner_scenario.py via the cfg key `applicable_policy_ids_file`, which it
  // forwards to the evaluator as `--policy-ids-file`. Omitted (no line emitted)
  // when the project has no confirmed list -> engine falls back to its
  // bench_fixture default. Landed engine-side at c97d3d17.
  applicablePolicyIdsFile?: string;
}

// YAML double-quoted scalar: escape backslash + double-quote.
function quote(value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

export function composeScenarioYaml(args: ComposeScenarioYamlArgs): string {
  const lines: string[] = [
    `scenario_id: ${quote(args.scenarioId)}`,
    `extract_path: ${quote(args.extractPath)}`,
    `bench_fixture: ${quote(args.benchFixture)}`,
    `applicability_mode: ${quote(args.applicabilityMode)}`,
    `evaluation_backend: ${quote(args.evaluationBackend)}`,
    `embedder_backend: ${quote(args.embedderBackend)}`,
    `reranker_backend: ${quote(args.rerankerBackend)}`,
    `model: ${quote(args.model)}`,
    `variant: ${quote(args.variant)}`,
    `rerank: ${quote("off")}`,
    `pathway_notes_mode: ${quote("annotation_only")}`,
  ];
  if (args.embedderModelPath) {
    lines.push(`embedder_model_path: ${quote(args.embedderModelPath)}`);
  }
  if (args.applicablePolicyIdsFile) {
    lines.push(
      `applicable_policy_ids_file: ${quote(args.applicablePolicyIdsFile)}`,
    );
  }
  // Trailing newline to keep POSIX-style file contents.
  return lines.join("\n") + "\n";
}
