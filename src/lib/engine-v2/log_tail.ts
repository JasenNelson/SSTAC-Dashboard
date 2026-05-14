// Shared log-tail utility for engine_v2 route handlers.
//
// Reads the last N bytes of a log file as a UTF-8 string using sync fs
// primitives -- intentionally synchronous because callers live on
// rejected-promise catch paths where ergonomics > microseconds.
//
// Returns null  when the file does not exist (ENOENT).
// Returns ""    when the file exists but is empty (size 0).
// Returns the last `n` bytes decoded as UTF-8 otherwise.

import * as fsSync from "fs";

export function tailLogFile(filePath: string, n: number): string | null {
  let fd: number | null = null;
  try {
    const st = fsSync.statSync(filePath);
    const size = st.size;
    if (size === 0) return "";
    const readLen = Math.min(size, n);
    fd = fsSync.openSync(filePath, "r");
    const buf = Buffer.alloc(readLen);
    fsSync.readSync(fd, buf, 0, readLen, size - readLen);
    return buf.toString("utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    return null;
  } finally {
    if (fd !== null) {
      try {
        fsSync.closeSync(fd);
      } catch {
        // Ignore close errors on the diagnostic path.
      }
    }
  }
}
