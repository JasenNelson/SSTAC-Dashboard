## 2025-02-24 - [Predictable File Names in Uploads]
**Vulnerability:** The application used `Math.random()` combined with timestamps to generate filenames for document uploads (`src/app/api/review/upload/route.ts`). `Math.random()` is cryptographically weak, which can lead to Predictable Resource Location vulnerabilities, especially if the generated filenames correspond to publicly accessible paths (or become guessable in storage).
**Learning:** Even internal document file names in storage buckets benefit from cryptographically secure identifiers to prevent path enumeration or collision attacks.
**Prevention:** Always use Node's built-in `crypto.randomBytes().toString('hex')` or `crypto.randomUUID()` when generating names or tokens for saved files or user identifiers.
