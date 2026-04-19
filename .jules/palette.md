## 2025-02-12 - Missing ARIA Attributes on Navigation Toggles
**Learning:** The main navigation toggles (desktop "Menu" and mobile hamburger icon) in `Header.tsx` were functioning as state toggles but completely lacked screen reader context (`aria-expanded`, `aria-controls`, `aria-label`).
**Action:** Always ensure interactive elements that control the visibility of other sections properly manage their `aria-expanded` state, tie to the target content using `aria-controls`, and hide decorative SVGs with `aria-hidden="true"`.
