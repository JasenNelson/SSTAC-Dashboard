## 2025-02-05 - Color Swatch Accessibility in Tag Management
**Learning:** Visual-only interactive elements like color swatches that convey information strictly through background color are inaccessible to screen readers without explicit text alternatives.
**Action:** Always provide an explicit `aria-label` (e.g., `aria-label={"Select color " + color}`) and keyboard focus indicators (e.g., `focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2`) for visual-only buttons to ensure they are both discoverable by assistive technologies and navigable via keyboard.
