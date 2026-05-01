## 2024-05-28 - Replace Math.random with Secure Alternatives
**Vulnerability:** Weak random number generation using `Math.random()` for user IDs and filenames.
**Learning:** Discovered that predictable `Math.random()` was still used in several submission API endpoints.
**Prevention:** Use `crypto.randomBytes` or `generateCEWUserId` for secure ID/filename generation instead.
