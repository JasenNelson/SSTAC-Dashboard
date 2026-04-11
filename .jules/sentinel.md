## 2025-02-27 - [Cross-Site Scripting (XSS)]
**Vulnerability:** Found `dangerouslySetInnerHTML={{ __html: icon }}` in `src/app/(dashboard)/bn-rrm/BNRRMClient.tsx` used to display static HTML icons for `FeatureCard` component. The `icon` parameter was provided HTML entities that do not require innerHTML evaluation.
**Learning:** `dangerouslySetInnerHTML` should only be used when we need to evaluate trusted HTML string into DOM objects. When an element simply requires simple Unicode rendering, the native string should be used directly.
**Prevention:** Avoid `dangerouslySetInnerHTML` when React native string interpolation `{icon}` suffices. Pass literal Unicode characters (`→`, `←`, `⚡`) as `children` directly instead of using HTML entities strings encoded inside `dangerouslySetInnerHTML`.
