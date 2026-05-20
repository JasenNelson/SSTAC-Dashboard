## 2025-02-23 - [Predictable Upload Filenames]
**Vulnerability:** The application was using `Math.random()` to generate unique filenames during file uploads in `src/app/api/review/upload/route.ts`.
**Learning:** `Math.random()` is a pseudo-random number generator that is cryptographically weak and predictable. In a file upload context, this predictability could lead to "predictable resource location," allowing an attacker to guess the filenames of uploaded files. If bucket permissions are misconfigured, this could lead to unauthorized access.
**Prevention:** Always use cryptographically secure random number generators, such as Node's `crypto.randomBytes()`, when generating unique identifiers, tokens, or filenames for security-sensitive operations.
