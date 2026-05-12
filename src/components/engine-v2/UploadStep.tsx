"use client";

// engine_v2 frontend Lane 1 / Module L1-3: UploadStep client component.
//
// Drives the TUS resumable upload to Supabase Storage, then posts /files/complete.
// Implements DECISIVE / AMBIGUOUS / CLEANUP-UNKNOWN flow per plan v7.19 Findings 40,
// 48, 53, 56, 65, 66, 71, 75, 85, 94, 100. Strict-equality checking on
// `orphan_cleanup_required` per Finding 100 (no unsafe fallback).
//
// Notes:
// - file_id is a client-generated UUID v4 supplied to TUS as part of objectName.
// - Server's v2_submission_files.id == client file_id (Finding 58).
// - AMBIGUOUS path polls GET /files/exists at 1s intervals up to 5 polls.
// - AbortSignal.timeout(1000) on /files/complete fetch is GATED on non-production
//   env flags (Findings 70, 79) so production never aborts.

import { useCallback, useState } from "react";
import * as tus from "tus-js-client";
import { mimeToExtension } from "@/lib/engine-v2/mime_to_extension";
import type { AllowedMimeType } from "@/lib/engine-v2/types";

interface UploadStepProps {
  projectId: string;
  // Optional: caller supplies session access token; in real usage UploadStep reads
  // it via supabase-js (createBrowserClient) but the prop form keeps this component
  // testable without booting Supabase.
  getAccessToken: () => Promise<string>;
  // Optional override for tus.Upload (test injection).
  tusUploadCtor?: typeof tus.Upload;
  // Optional fetch override for tests.
  fetchImpl?: typeof fetch;
  // Optional override returning a Supabase project URL string. Default reads
  // NEXT_PUBLIC_SUPABASE_URL from process.env.
  supabaseUrl?: string;
  onUploaded?: (fileId: string) => void;
}

type UploadStatus =
  | "idle"
  | "uploading"
  | "finalizing"
  | "polling"
  | "success"
  | "error"
  | "conflict";

interface UiMessage {
  kind: "info" | "warn" | "error" | "success";
  text: string;
}

const TUS_CHUNK = 6 * 1024 * 1024;
const POLL_INTERVAL_MS = 1000;
const POLL_MAX_TRIES = 5;

function uuidV4(): string {
  // Use Web Crypto when available; falls back to Math.random for jsdom test envs.
  const g: { crypto?: { randomUUID?: () => string } } = globalThis as unknown as {
    crypto?: { randomUUID?: () => string };
  };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  const r = () =>
    Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0");
  return `${r()}${r()}-${r()}-4${r().slice(1)}-${r()}-${r()}${r()}${r()}`;
}

function deriveSupabaseTusEndpoint(supabaseUrl: string): string {
  // Use the canonical Supabase project host per official resumable-uploads docs
  // (https://supabase.com/docs/guides/storage/uploads/resumable-uploads). The
  // `.storage.supabase.co` subdomain that plan v7.19 line 777 prescribed exists
  // but does not resolve auth.uid() from the Bearer token in the same way as
  // the main project URL, causing storage.objects RLS to reject the INSERT as
  // anonymous even with a valid session JWT. Verified 2026-05-12.
  if (!supabaseUrl) throw new Error("invalid_supabase_url");
  const trimmed = supabaseUrl.replace(/\/+$/, "");
  return `${trimmed}/storage/v1/upload/resumable`;
}

function isAllowedMime(mt: string): mt is AllowedMimeType {
  return (
    mt === "application/pdf" ||
    mt === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mt === "application/msword"
  );
}

// Strict-equality classification per Finding 100. ANYTHING that is not literal
// boolean true or false maps to CLEANUP-UNKNOWN.
type FlagClass = "cleanup-required" | "no-cleanup" | "unknown";
function classifyOrphanFlag(parsed: unknown): FlagClass {
  if (!parsed || typeof parsed !== "object") return "unknown";
  const obj = parsed as { orphan_cleanup_required?: unknown };
  if (obj.orphan_cleanup_required === true) return "cleanup-required";
  if (obj.orphan_cleanup_required === false) return "no-cleanup";
  return "unknown";
}

function shouldUseTestTimeout(): boolean {
  // Both gates must fail-closed in production builds.
  const vercelEnv = (
    process.env as Record<string, string | undefined>
  ).NEXT_PUBLIC_VERCEL_ENV;
  const nodeEnv = (process.env as Record<string, string | undefined>).NODE_ENV;
  return vercelEnv !== "production" && nodeEnv !== "production";
}

export function UploadStep(props: UploadStepProps): React.ReactElement {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState<number>(0);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [lastFileId, setLastFileId] = useState<string | null>(null);

  const pushMessage = useCallback((m: UiMessage) => {
    setMessages((prev) => [...prev, m]);
  }, []);

  const upload = useCallback(
    async (file: File) => {
      setMessages([]);
      setProgress(0);
      setStatus("uploading");

      if (!isAllowedMime(file.type)) {
        setStatus("error");
        pushMessage({ kind: "error", text: `Unsupported MIME type: ${file.type}` });
        return;
      }

      // Generate client-supplied file_id (Finding 58).
      const fileId = uuidV4();
      setLastFileId(fileId);

      let accessToken: string;
      try {
        accessToken = await props.getAccessToken();
      } catch (err) {
        setStatus("error");
        pushMessage({
          kind: "error",
          text: `Could not retrieve session token: ${(err as Error).message}`,
        });
        return;
      }

      // Derive endpoint + objectName.
      const supabaseUrl =
        props.supabaseUrl ??
        (process.env as Record<string, string | undefined>).NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        setStatus("error");
        pushMessage({ kind: "error", text: "Supabase URL not configured" });
        return;
      }
      let endpoint: string;
      try {
        endpoint = deriveSupabaseTusEndpoint(supabaseUrl);
      } catch (err) {
        setStatus("error");
        pushMessage({ kind: "error", text: (err as Error).message });
        return;
      }

      // objectName = <user_id>/<project_id>/<file_id>/<file_id>.<ext>.
      // We do not know user_id client-side; the TUS authentication flow will
      // associate the upload with the authenticated user. The server derives the
      // expected storage path from the JWT user.id + payload. The TUS objectName
      // must still nest under the user prefix to satisfy RLS. We rely on Supabase
      // Storage's signed-upload flow to inject the user-id prefix via the JWT, OR
      // alternatively the caller provides a "user_id" via the access-token payload.
      // For Lane 1, the objectName uses the file_id stem + extension; bucket RLS
      // policy keys off auth.uid() and matches the storage path prefix.
      const ext = mimeToExtension(file.type);
      // The TUS path here uses the file_id stem; the v2-submissions bucket RLS
      // policy validates auth.uid() is the first path segment server-side. To
      // satisfy this, we encode placeholder ${userId}; resolved via the JWT-side
      // user_id is not directly available client-side -- we encode the file path
      // tail and let the server validate.
      // Plan reads: `<user_id>/<project_id>/<file_id>/<file_id>.<ext>`. We extract
      // user id from the JWT payload (sub claim).
      let userId: string;
      try {
        userId = jwtSubject(accessToken);
      } catch {
        setStatus("error");
        pushMessage({ kind: "error", text: "Could not extract user id from token" });
        return;
      }
      const objectName = `${userId}/${props.projectId}/${fileId}/${fileId}.${ext}`;

      const Ctor = props.tusUploadCtor ?? tus.Upload;
      const tusOk = await new Promise<boolean>((resolve) => {
        const upload = new Ctor(file, {
          endpoint,
          chunkSize: TUS_CHUNK,
          retryDelays: [0, 1000, 3000, 5000],
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
          metadata: {
            bucketName: "v2-submissions",
            objectName,
            contentType: file.type,
          },
          onError: (err: Error) => {
            pushMessage({ kind: "error", text: `TUS error: ${err.message}` });
            resolve(false);
          },
          onProgress: (bytesSent: number, bytesTotal: number) => {
            if (bytesTotal > 0) {
              setProgress(Math.floor((bytesSent / bytesTotal) * 100));
            }
          },
          onSuccess: () => {
            resolve(true);
          },
        });
        upload.start();
      });

      if (!tusOk) {
        setStatus("error");
        return;
      }

      setStatus("finalizing");
      // POST /files/complete with the JSON payload.
      const fetchImpl = props.fetchImpl ?? fetch;
      const payload = {
        project_id: props.projectId,
        file_id: fileId,
        original_filename: file.name,
        size_bytes: file.size,
        content_type: file.type,
      };
      const init: RequestInit = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      };
      if (shouldUseTestTimeout()) {
        try {
          (init as RequestInit & { signal?: AbortSignal }).signal = AbortSignal.timeout(1000);
        } catch {
          // jsdom or older runtimes may not implement AbortSignal.timeout; ignore.
        }
      }

      let response: Response | null = null;
      let throwErr: unknown = null;
      try {
        response = await fetchImpl("/api/engine-v2/files/complete", init);
      } catch (err) {
        throwErr = err;
      }

      if (throwErr || !response) {
        // AMBIGUOUS (a): network throw.
        await runAmbiguousPolling(props, fileId, fetchImpl, pushMessage, setStatus);
        return;
      }

      // Try to parse body.
      let parsedBody: unknown;
      let parseFailed = false;
      try {
        parsedBody = await response.json();
      } catch {
        parseFailed = true;
      }

      if (response.ok) {
        if (parseFailed) {
          // AMBIGUOUS (b): 2xx with body-read failure.
          await runAmbiguousPolling(props, fileId, fetchImpl, pushMessage, setStatus);
          return;
        }
        // Success.
        setStatus("success");
        pushMessage({ kind: "success", text: "Upload complete" });
        props.onUploaded?.(fileId);
        return;
      }

      // Non-2xx.
      if (parseFailed) {
        // AMBIGUOUS (c): non-2xx with parse failure.
        await runAmbiguousPolling(props, fileId, fetchImpl, pushMessage, setStatus);
        return;
      }

      // DECISIVE -- classify the orphan flag per Finding 100.
      const cls = classifyOrphanFlag(parsedBody);
      const errBody = parsedBody as Record<string, unknown> | null;
      const errMsg =
        (errBody && typeof errBody.error === "string" && (errBody.error as string)) ||
        `HTTP ${response.status}`;
      if (cls === "cleanup-required") {
        const orphanRes = await safeOrphanCall(props, fileId, fetchImpl);
        if (orphanRes.alreadyFinalized) {
          // F56: treat as success.
          setStatus("success");
          pushMessage({
            kind: "success",
            text: "Upload finalized (race-recovered).",
          });
          props.onUploaded?.(fileId);
          return;
        }
        if (!orphanRes.ok) {
          pushMessage({
            kind: "warn",
            text: `Orphan cleanup did not complete: ${orphanRes.message}`,
          });
        }
        setStatus("error");
        pushMessage({ kind: "error", text: errMsg });
        return;
      }
      if (cls === "no-cleanup") {
        // 409 file_id_reused_with_different_content.
        setStatus("conflict");
        pushMessage({
          kind: "error",
          text:
            errMsg === "file_id_reused_with_different_content"
              ? "This file ID is already used by a different file. Try again."
              : errMsg,
        });
        return;
      }
      // cls === "unknown" -- CLEANUP-UNKNOWN. NO orphan call. Optional /files/exists poll.
      pushMessage({
        kind: "warn",
        text: `Storage cleanup status unclear (server response was malformed); ${errMsg}`,
      });
      await runAmbiguousPolling(props, fileId, fetchImpl, pushMessage, setStatus, {
        treat404AsError: true,
        existingErrorMsg: errMsg,
      });
    },
    [props, pushMessage],
  );

  return (
    <div data-testid="upload-step" data-status={status} data-progress={progress}>
      <input
        type="file"
        data-testid="upload-step-input"
        accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />
      <div data-testid="upload-step-progress">{progress}%</div>
      <ul data-testid="upload-step-messages">
        {messages.map((m, i) => (
          <li key={i} data-kind={m.kind}>
            {m.text}
          </li>
        ))}
      </ul>
      {lastFileId !== null ? (
        <div data-testid="upload-step-file-id">{lastFileId}</div>
      ) : null}
    </div>
  );
}

// Extract `sub` (user id) from a JWT without verifying the signature. The server
// validates the JWT; client-side we only need the prefix for the storage path.
function jwtSubject(token: string): string {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("invalid_jwt");
  const payload = parts[1]!;
  const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
  // base64url -> base64.
  const b64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const json =
    typeof atob === "function"
      ? atob(b64)
      : Buffer.from(b64, "base64").toString("utf8");
  const obj = JSON.parse(json) as { sub?: string };
  if (!obj.sub) throw new Error("missing_sub");
  return obj.sub;
}

interface OrphanCallResult {
  ok: boolean;
  alreadyFinalized: boolean;
  message: string;
}

async function safeOrphanCall(
  props: UploadStepProps,
  fileId: string,
  fetchImpl: typeof fetch,
): Promise<OrphanCallResult> {
  try {
    const res = await fetchImpl("/api/engine-v2/files/orphan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: props.projectId, file_id: fileId }),
    });
    if (res.status === 409) {
      let body: { error?: string } = {};
      try {
        body = (await res.json()) as { error?: string };
      } catch {
        // ignore
      }
      if (body.error === "already_finalized") {
        return { ok: true, alreadyFinalized: true, message: "already_finalized" };
      }
      return { ok: false, alreadyFinalized: false, message: body.error ?? "conflict" };
    }
    if (res.ok) return { ok: true, alreadyFinalized: false, message: "deleted" };
    return { ok: false, alreadyFinalized: false, message: `HTTP ${res.status}` };
  } catch (err) {
    return {
      ok: false,
      alreadyFinalized: false,
      message: (err as Error).message,
    };
  }
}

interface AmbiguousPollOptions {
  treat404AsError?: boolean;
  existingErrorMsg?: string;
}

async function runAmbiguousPolling(
  props: UploadStepProps,
  fileId: string,
  fetchImpl: typeof fetch,
  pushMessage: (m: UiMessage) => void,
  setStatus: (s: UploadStatus) => void,
  options: AmbiguousPollOptions = {},
): Promise<void> {
  setStatus("polling");
  for (let i = 0; i < POLL_MAX_TRIES; i++) {
    try {
      const url = `/api/engine-v2/files/exists?project_id=${encodeURIComponent(
        props.projectId,
      )}&file_id=${encodeURIComponent(fileId)}`;
      const res = await fetchImpl(url, { method: "GET" });
      if (res.ok) {
        setStatus("success");
        pushMessage({ kind: "success", text: "Upload finalized (status-resolved)." });
        props.onUploaded?.(fileId);
        return;
      }
      // 404 -> keep polling.
    } catch {
      // network blip; keep polling.
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  setStatus("error");
  if (options.treat404AsError && options.existingErrorMsg) {
    pushMessage({ kind: "error", text: options.existingErrorMsg });
    return;
  }
  pushMessage({
    kind: "warn",
    text:
      "Upload status unclear; if you don't see your file, retry. Orphaned storage may require manual admin cleanup until the Lane 2 maintenance task is added.",
  });
}

export default UploadStep;
