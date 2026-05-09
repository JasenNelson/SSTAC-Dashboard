## 2024-05-09 - Path Traversal in File Uploads
**Vulnerability:** Path traversal vulnerability in the file upload endpoint (`/api/regulatory-review/projects/[id]/files/route.ts`), where user-provided filenames (`entry.name`) were used directly to construct file paths for writing.
**Learning:** Never trust user input, especially filenames provided during uploads. Attackers can provide filenames like `../../../etc/passwd` to overwrite files outside the intended directory.
**Prevention:** Always sanitize user-provided filenames. For simple local storage, `path.basename(filename)` is an effective way to strip directory paths and ensure the file is written to the intended target directory.
