## 2024-05-18 - [FeatureCard XSS fix]
**Vulnerability:** Used `dangerouslySetInnerHTML` to render HTML entities (e.g. `&#8594;`) as icons in `BNRRMClient.tsx`.
**Learning:** `dangerouslySetInnerHTML` is unnecessary and introduces XSS risks when just rendering basic unicode symbols.
**Prevention:** Use direct JSX children with literal Unicode characters instead.
