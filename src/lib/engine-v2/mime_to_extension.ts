// engine_v2 frontend Lane 1: shared MIME -> extension lookup (Finding 57).
// Used by BOTH UploadStep client (TUS objectName) and /files/complete server
// (expected storage_path derivation). A single source of truth prevents
// client/server drift that would orphan storage objects.

export const MIME_TO_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
};

// Throws on unsupported MIME so callers cannot silently produce a wrong path.
// /files/complete gates on the Zod enum before this is ever invoked; this throw
// is purely a belt-and-suspenders defense.
export function mimeToExtension(mime: string): string {
  const ext = MIME_TO_EXT[mime];
  if (!ext) {
    throw new Error(`unsupported_mime_type:${mime}`);
  }
  return ext;
}
