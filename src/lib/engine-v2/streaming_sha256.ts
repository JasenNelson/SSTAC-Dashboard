// engine_v2 frontend Lane 1: streaming SHA256 + magic-byte capture (Findings 2, 3, 21, 29, 36).
//
// `computeStreamingSha256AndMagic(signedUrl, headers)` fetches a Supabase Storage object
// via signed URL, streams it through Node `crypto.createHash('sha256')`, and accumulates the
// first 8 bytes for magic-number validation. NO local-disk writeStream at this stage --
// /files/complete only needs the hash + leading bytes (Finding 29 split from materialization).
//
// Iteration: explicit `getReader()`/`read()` loop (Finding 3 -- `for await` was rejected).
// `releaseLock()` is wrapped in try/catch so a release failure cannot mask the original
// error (Finding 36).

import { createHash } from "crypto";

export interface StreamingSha256Result {
  sha256: string;
  firstBytes: Uint8Array; // up to 8 bytes; may be shorter if the file is truncated
}

export async function computeStreamingSha256AndMagic(
  signedUrl: string,
  headers: Record<string, string> = {},
): Promise<StreamingSha256Result> {
  const response = await fetch(signedUrl, { headers });
  if (!response.ok) {
    throw new Error(
      `streaming_sha_fetch_failed:status=${response.status}:${response.statusText}`,
    );
  }
  if (!response.body) {
    throw new Error("streaming_sha_fetch_failed:no_body");
  }

  const reader = response.body.getReader();
  const hash = createHash("sha256");
  const firstBytesAccum: number[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;
      hash.update(value);
      if (firstBytesAccum.length < 8) {
        const needed = 8 - firstBytesAccum.length;
        const take = Math.min(needed, value.byteLength);
        for (let i = 0; i < take; i++) {
          firstBytesAccum.push(value[i]!);
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Finding 36: do not mask the original error path.
    }
  }

  return {
    sha256: hash.digest("hex"),
    firstBytes: new Uint8Array(firstBytesAccum),
  };
}
