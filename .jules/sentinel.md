## 2025-02-14 - [XSS vulnerability via dangerouslySetInnerHTML]
**Vulnerability:** XSS vulnerability through usage of `dangerouslySetInnerHTML={{ __html: icon }}` in `FeatureCard` component of `src/app/(dashboard)/bn-rrm/BNRRMClient.tsx`.
**Learning:** Even static or seemingly safe HTML encoded strings passed as props can be a vector for XSS if explicitly unescaped via `dangerouslySetInnerHTML`. React handles standard entities fine inside JSX.
**Prevention:** Avoid `dangerouslySetInnerHTML` for simple HTML entity strings; rely on React's automatic string escaping and entity resolution.
