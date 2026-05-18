## 2026-05-18 - Fix info leakage via API responses

**Vulnerability:** Information Disclosure
**Learning:** Returning detailed error messages (like `voteError.message` or raw stack traces) to the client in API routes exposes internal database structures or logic, violating the principle of failing securely. Server-side logging is meant to retain these details for debugging, but HTTP responses must sanitize them.
**Prevention:** Ensure that `NextResponse` only returns generic error messages (e.g., "Internal server error" or "Failed to perform action") instead of propagating `error.message` or `error.stack` back to the user.
