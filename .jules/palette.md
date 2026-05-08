## 2025-02-12 - Missing ARIA Labels on Color Swatches
**Learning:** Visual-only interactive elements, such as color swatches (`<button>` tags indicating color via background styles without inner text), are difficult for screen readers to interpret if they only rely on a `title` attribute.
**Action:** Always include an explicit `aria-label` providing a textual description (e.g. `Select color #3B82F6`) on buttons that convey information purely through visual style like background color.
