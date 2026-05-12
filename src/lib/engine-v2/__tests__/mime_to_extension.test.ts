import { describe, it, expect } from "vitest";
import { mimeToExtension, MIME_TO_EXT } from "../mime_to_extension";

describe("mimeToExtension (Finding 57)", () => {
  it("maps application/pdf -> pdf", () => {
    expect(mimeToExtension("application/pdf")).toBe("pdf");
  });
  it("maps DOCX MIME -> docx", () => {
    expect(
      mimeToExtension(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe("docx");
  });
  it("maps application/msword -> doc", () => {
    expect(mimeToExtension("application/msword")).toBe("doc");
  });
  it("throws on unknown MIME", () => {
    expect(() => mimeToExtension("application/x-evil")).toThrow(/unsupported_mime_type/);
  });
  it("MIME_TO_EXT exposes all 3 allowed types", () => {
    expect(Object.keys(MIME_TO_EXT).sort()).toEqual(
      [
        "application/msword",
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ].sort(),
    );
  });
});
