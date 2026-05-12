import { describe, it, expect } from "vitest";
import {
  SERVICE_TO_MEDIA,
  deriveMediaTypesFromServices,
} from "../service_to_media";

describe("SERVICE_TO_MEDIA shape", () => {
  it("has a non-empty set of service ids", () => {
    const keys = Object.keys(SERVICE_TO_MEDIA);
    expect(keys.length).toBeGreaterThan(0);
  });

  it("every value is a non-empty array of non-empty strings", () => {
    for (const [id, media] of Object.entries(SERVICE_TO_MEDIA)) {
      expect(Array.isArray(media), `${id} must map to an array`).toBe(true);
      expect(media.length, `${id} must have at least one media type`).toBeGreaterThan(0);
      for (const m of media) {
        expect(typeof m).toBe("string");
        expect(m.length).toBeGreaterThan(0);
      }
    }
  });

  it("preserves known v1 mappings (regression guard against literal-copy drift)", () => {
    // Spot-check the rows whose breakage would silently corrupt downstream
    // applicability filtering. These mirror the v1 source at
    // launch-evaluation.ts:19-42.
    expect(SERVICE_TO_MEDIA["era-review"]).toEqual([
      "soil",
      "sediment",
      "surface_water",
      "groundwater",
    ]);
    expect(SERVICE_TO_MEDIA["via-review"]).toEqual(["vapour"]);
    expect(SERVICE_TO_MEDIA["csra"]).toEqual(["soil"]);
    expect(SERVICE_TO_MEDIA["wide-area-designation"]).toEqual(["soil"]);
    expect(SERVICE_TO_MEDIA["hhra-review"]).toEqual([
      "soil",
      "groundwater",
      "vapour",
    ]);
  });
});

describe("deriveMediaTypesFromServices", () => {
  it("returns the sorted media types for a single known service", () => {
    // era-review maps to [soil, sediment, surface_water, groundwater];
    // sorted ascending the helper must return [groundwater, sediment, soil, surface_water].
    expect(deriveMediaTypesFromServices(["era-review"])).toEqual([
      "groundwater",
      "sediment",
      "soil",
      "surface_water",
    ]);
  });

  it("dedupes media types across multiple services", () => {
    // psi-review = [soil, groundwater]
    // hhra-review = [soil, groundwater, vapour]
    // Combined unique sorted = [groundwater, soil, vapour]
    expect(
      deriveMediaTypesFromServices(["psi-review", "hhra-review"]),
    ).toEqual(["groundwater", "soil", "vapour"]);
  });

  it("silently skips unknown service ids (no throw)", () => {
    expect(() =>
      deriveMediaTypesFromServices(["totally-not-a-service"]),
    ).not.toThrow();
    expect(deriveMediaTypesFromServices(["totally-not-a-service"])).toEqual([]);
  });

  it("mixes known + unknown ids and returns only the known media types", () => {
    expect(
      deriveMediaTypesFromServices(["unknown-id", "csra", "another-bad"]),
    ).toEqual(["soil"]);
  });

  it("returns an empty array for an empty selection", () => {
    expect(deriveMediaTypesFromServices([])).toEqual([]);
  });

  it("ignores empty / whitespace-only / non-string entries defensively", () => {
    expect(
      deriveMediaTypesFromServices([
        "",
        "   ",
        // Force a non-string through the readonly string[] contract to confirm
        // runtime tolerance; TypeScript would normally reject this at compile
        // time, which is fine - the runtime guard is defense-in-depth.
        null as unknown as string,
        "csra",
      ]),
    ).toEqual(["soil"]);
  });
});
