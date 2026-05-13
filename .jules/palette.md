## 2025-02-12 - Icon-only buttons lacking ARIA labels
**Learning:** Several interactive elements (Edit/Delete buttons, color selection swatches) in dashboard management components relied solely on the `title` attribute for accessibility. `title` attributes are not sufficient for screen readers, which require `aria-label` or inner screen-reader-only text.
**Action:** Ensure all icon-only buttons and visual-only interactive elements (like color swatches) have explicit `aria-label` attributes describing their action or value.
