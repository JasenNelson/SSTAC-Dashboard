## 2026-05-12 - Replace Insecure Random Generation
**Vulnerability:** Use of cryptographically weak `Math.random()` for generating user IDs, filenames, and session tokens.
**Learning:** `Math.random()` values are predictable and can lead to token collisions, ID guessing, or brute force attacks on anonymous submissions or uploaded files.
**Prevention:** Use `crypto.randomBytes()`, `crypto.randomUUID()`, or a centralized utility (e.g., `generateCEWUserId`) for sensitive identifier generation in Next.js handlers and state management.
