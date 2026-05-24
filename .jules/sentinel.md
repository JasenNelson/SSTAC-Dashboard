## 2025-02-28 - [Fix Weak Randomness in File Uploads and Anonymous Poll IDs]
**Vulnerability:** The application was using `Math.random().toString(36)` to generate anonymous user IDs for ranking/wordcloud polls and unique file names for uploads, creating a risk of resource collision and predictability.
**Learning:** `Math.random()` provides pseudo-randomness which is insecure for ID generation and creating unique, non-predictable file paths in file upload routines.
**Prevention:** Always use Node's `crypto` module (e.g., `crypto.randomBytes`) for server-side generation of IDs and unique file names, or `crypto.randomUUID()` where appropriate, and centralize the ID generation logic (e.g. `generateCEWUserId`) to avoid regressions.
