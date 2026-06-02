## 2026-05-10 - [Avoid Security Theater with Client-Side UI Randomness]
**Vulnerability:** Weak random number generation (`Math.random()`) was found in both backend API handlers (for generating filenames/IDs) and frontend UI components (Toast notifications).
**Learning:** Applying cryptographic randomness (like `crypto.randomUUID()`) to non-sensitive UI elements (e.g. `Toast.tsx` IDs) is "security theater" and can cause client-side crashes if accessed over non-secure contexts (HTTP), breaking the application unnecessarily.
**Prevention:** Restrict cryptographic random generation (e.g. `randomBytes`, `generateCEWUserId`) strictly to backend handlers, true security tokens, or session IDs. Leave innocuous UI IDs alone.
