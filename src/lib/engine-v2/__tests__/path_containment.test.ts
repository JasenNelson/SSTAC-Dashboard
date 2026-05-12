import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdir, mkdtemp, rm, symlink } from "fs/promises";
import { tmpdir } from "os";
import * as path from "path";
import { isContained } from "../path_containment";

let tmpRoot: string;

beforeAll(async () => {
  tmpRoot = await mkdtemp(path.join(tmpdir(), "engine-v2-path-"));
});

afterAll(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
});

describe("isContained (Findings 15, 25)", () => {
  it("returns true for path inside base (existing)", async () => {
    const base = path.join(tmpRoot, "base1");
    await mkdir(base, { recursive: true });
    const target = path.join(base, "child");
    await mkdir(target, { recursive: true });
    expect(await isContained(base, target)).toBe(true);
  });

  it("returns false for path outside base", async () => {
    const base = path.join(tmpRoot, "base2");
    await mkdir(base, { recursive: true });
    const outside = path.join(tmpRoot, "outside2");
    await mkdir(outside, { recursive: true });
    expect(await isContained(base, outside)).toBe(false);
  });

  it("rejects trailing-separator confusion (/base vs /base_evil)", async () => {
    const base = path.join(tmpRoot, "base3");
    await mkdir(base, { recursive: true });
    const sibling = path.join(tmpRoot, "base3_evil");
    await mkdir(sibling, { recursive: true });
    expect(await isContained(base, sibling)).toBe(false);
  });

  it("uses parent-dir realpath fallback for non-existing target", async () => {
    const base = path.join(tmpRoot, "base4");
    await mkdir(base, { recursive: true });
    const target = path.join(base, "does", "not", "exist");
    expect(await isContained(base, target)).toBe(true);
  });

  it("returns false when base does not exist", async () => {
    const base = path.join(tmpRoot, "missing_base");
    const target = path.join(base, "child");
    expect(await isContained(base, target)).toBe(false);
  });

  it("handles case-insensitivity on Windows", async () => {
    if (process.platform !== "win32") return;
    const base = path.join(tmpRoot, "CaseSensitive");
    await mkdir(base, { recursive: true });
    const target = path.join(tmpRoot, "casesensitive", "child");
    // realpath resolves the canonical casing; comparison normalizes to lowercase.
    expect(await isContained(base, target)).toBe(true);
  });

  it("rejects POSIX symlink that escapes base", async () => {
    if (process.platform === "win32") return;
    const base = path.join(tmpRoot, "base_sym");
    await mkdir(base, { recursive: true });
    const outside = path.join(tmpRoot, "outside_sym");
    await mkdir(outside, { recursive: true });
    const link = path.join(base, "escape");
    try {
      await symlink(outside, link, "dir");
    } catch {
      // unsupported runtime; skip silently
      return;
    }
    expect(await isContained(base, link)).toBe(false);
  });
});
