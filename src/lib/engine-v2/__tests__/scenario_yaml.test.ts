import { describe, it, expect } from "vitest";
import { composeScenarioYaml } from "../scenario_yaml";

describe("composeScenarioYaml", () => {
  it("produces expected YAML for happy-path input", () => {
    const yaml = composeScenarioYaml({
      scenarioId: "abc-123",
      extractPath: "C:/data/extract.json",
      benchFixture: "bench_43_full",
      applicabilityMode: "off",
      evaluationBackend: "stub",
      embedderBackend: "stub",
      rerankerBackend: "disabled",
      model: "",
      variant: "graph_v2_default",
    });
    const expected =
      'scenario_id: "abc-123"\n' +
      'extract_path: "C:/data/extract.json"\n' +
      'bench_fixture: "bench_43_full"\n' +
      'applicability_mode: "off"\n' +
      'evaluation_backend: "stub"\n' +
      'embedder_backend: "stub"\n' +
      'reranker_backend: "disabled"\n' +
      'model: ""\n' +
      'variant: "graph_v2_default"\n' +
      'rerank: "off"\n' +
      'pathway_notes_mode: "annotation_only"\n';
    expect(yaml).toBe(expected);
  });

  it("escapes double-quotes in paths", () => {
    const yaml = composeScenarioYaml({
      scenarioId: "scn",
      extractPath: 'C:/weird"quote/file.json',
      benchFixture: "bench_43_full",
      applicabilityMode: "off",
      evaluationBackend: "stub",
      embedderBackend: "stub",
      rerankerBackend: "disabled",
      model: "",
      variant: "graph_v2_default",
    });
    expect(yaml).toContain('extract_path: "C:/weird\\"quote/file.json"');
  });

  it("includes all required fields when defaults supplied", () => {
    const yaml = composeScenarioYaml({
      scenarioId: "scn",
      extractPath: "C:/x.json",
      benchFixture: "bench_43_full",
      applicabilityMode: "pre",
      evaluationBackend: "live",
      embedderBackend: "real",
      rerankerBackend: "stub",
      model: "qwen2.5:14b-instruct-q4_K_M",
      variant: "graph_v2_default",
    });
    const requiredFields = [
      "scenario_id:",
      "extract_path:",
      "bench_fixture:",
      "applicability_mode:",
      "evaluation_backend:",
      "embedder_backend:",
      "reranker_backend:",
      "model:",
      "variant:",
      "rerank:",
      "pathway_notes_mode:",
    ];
    for (const f of requiredFields) {
      expect(yaml).toContain(f);
    }
    expect(yaml).toContain('applicability_mode: "pre"');
    expect(yaml).toContain('evaluation_backend: "live"');
    expect(yaml).toContain('embedder_backend: "real"');
    expect(yaml).toContain('reranker_backend: "stub"');
    expect(yaml).toContain('model: "qwen2.5:14b-instruct-q4_K_M"');
    expect(yaml).toContain('rerank: "off"');
    expect(yaml).toContain('pathway_notes_mode: "annotation_only"');
  });

  it("escapes backslashes in Windows paths", () => {
    const yaml = composeScenarioYaml({
      scenarioId: "scn",
      extractPath: "C:\\data\\extract.json",
      benchFixture: "bench_43_full",
      applicabilityMode: "off",
      evaluationBackend: "stub",
      embedderBackend: "stub",
      rerankerBackend: "disabled",
      model: "",
      variant: "graph_v2_default",
    });
    // Each backslash should be doubled in the emitted YAML.
    expect(yaml).toContain('extract_path: "C:\\\\data\\\\extract.json"');
  });

  it("emits applicable_policy_ids_file (quoted, snake_case key) when provided", () => {
    const yaml = composeScenarioYaml({
      scenarioId: "scn",
      extractPath: "C:/x.json",
      benchFixture: "bench_43_full",
      applicabilityMode: "off",
      evaluationBackend: "stub",
      embedderBackend: "stub",
      rerankerBackend: "disabled",
      model: "",
      variant: "graph_v2_default",
      applicablePolicyIdsFile: "C:/runs/abc/policy_ids.json",
    });
    expect(yaml).toContain(
      'applicable_policy_ids_file: "C:/runs/abc/policy_ids.json"',
    );
  });

  it("omits applicable_policy_ids_file when absent", () => {
    const yaml = composeScenarioYaml({
      scenarioId: "scn",
      extractPath: "C:/x.json",
      benchFixture: "bench_43_full",
      applicabilityMode: "off",
      evaluationBackend: "stub",
      embedderBackend: "stub",
      rerankerBackend: "disabled",
      model: "",
      variant: "graph_v2_default",
    });
    expect(yaml).not.toContain("applicable_policy_ids_file");
  });

  it("byte-identity: absent applicablePolicyIdsFile == pre-M1c composer output", () => {
    // Golden equality proving the expand-contract fallback path is byte-for-byte
    // unchanged from the pre-M1c composer when the field is not supplied.
    const yaml = composeScenarioYaml({
      scenarioId: "abc-123",
      extractPath: "C:/data/extract.json",
      benchFixture: "bench_43_full",
      applicabilityMode: "off",
      evaluationBackend: "stub",
      embedderBackend: "stub",
      rerankerBackend: "disabled",
      model: "",
      variant: "graph_v2_default",
    });
    const expectedPreM1c =
      'scenario_id: "abc-123"\n' +
      'extract_path: "C:/data/extract.json"\n' +
      'bench_fixture: "bench_43_full"\n' +
      'applicability_mode: "off"\n' +
      'evaluation_backend: "stub"\n' +
      'embedder_backend: "stub"\n' +
      'reranker_backend: "disabled"\n' +
      'model: ""\n' +
      'variant: "graph_v2_default"\n' +
      'rerank: "off"\n' +
      'pathway_notes_mode: "annotation_only"\n';
    expect(yaml).toBe(expectedPreM1c);
  });

  it("passing applicablePolicyIdsFile: undefined is identical to omitting it", () => {
    const base = {
      scenarioId: "scn",
      extractPath: "C:/x.json",
      benchFixture: "bench_43_full",
      applicabilityMode: "off" as const,
      evaluationBackend: "stub" as const,
      embedderBackend: "stub" as const,
      rerankerBackend: "disabled" as const,
      model: "",
      variant: "graph_v2_default",
    };
    const omitted = composeScenarioYaml(base);
    const explicitUndefined = composeScenarioYaml({
      ...base,
      applicablePolicyIdsFile: undefined,
    });
    expect(explicitUndefined).toBe(omitted);
  });

  // Phase 2: scenario_yaml never emits retrieval_ keys (retrieval is CLI-only
  // in run_owner_scenario.py; emitting them as YAML keys is silently inert).

  it("never emits retrieval_backend or retrieval_workspace keys", () => {
    // retrieval wiring is passed as CLI flags in spawn_scenario.ts, not as YAML
    // keys. Confirm the composer does not emit them under any circumstance.
    const yaml = composeScenarioYaml({
      scenarioId: "scn",
      extractPath: "C:/x.json",
      benchFixture: "bench_43_full",
      applicabilityMode: "off",
      evaluationBackend: "stub",
      embedderBackend: "stub",
      rerankerBackend: "disabled",
      model: "",
      variant: "graph_v2_default",
    });
    expect(yaml).not.toContain("retrieval_backend");
    expect(yaml).not.toContain("retrieval_workspace");
  });

  it("byte-identity: output is byte-identical to pre-Phase-2 baseline (no retrieval_ keys)", () => {
    // Golden equality: the composer output is byte-for-byte unchanged from
    // the pre-Phase-2 baseline when no optional fields are supplied. Any future
    // addition to the fixed lines would break this test intentionally, forcing a
    // conscious baseline update.
    const yaml = composeScenarioYaml({
      scenarioId: "abc-123",
      extractPath: "C:/data/extract.json",
      benchFixture: "bench_43_full",
      applicabilityMode: "off",
      evaluationBackend: "stub",
      embedderBackend: "stub",
      rerankerBackend: "disabled",
      model: "",
      variant: "graph_v2_default",
    });
    const expectedPrePhase2 =
      'scenario_id: "abc-123"\n' +
      'extract_path: "C:/data/extract.json"\n' +
      'bench_fixture: "bench_43_full"\n' +
      'applicability_mode: "off"\n' +
      'evaluation_backend: "stub"\n' +
      'embedder_backend: "stub"\n' +
      'reranker_backend: "disabled"\n' +
      'model: ""\n' +
      'variant: "graph_v2_default"\n' +
      'rerank: "off"\n' +
      'pathway_notes_mode: "annotation_only"\n';
    expect(yaml).toBe(expectedPrePhase2);
  });
});
