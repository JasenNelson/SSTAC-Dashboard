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
});
