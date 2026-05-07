## 2025-05-07 - [Fix Path Traversal in Project File Upload API]
**Vulnerability:** Path Traversal
**Learning:** `entry.name` directly accessed from `FormData` uploaded by user is not safe and can contain path traversal characters `../` which can be exploited.
**Prevention:** Always use `path.basename` when constructing a target file path based on a user-provided file name.
