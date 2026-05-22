## 2025-04-27 - [Color Swatches]
**Learning:** Found an accessibility issue pattern specific to this app's components: Color swatches (`<button>` tags with background color) used for selection lack accessible labels. Even if they have a `title` attribute for tooltips, they need an `aria-label` to provide a reliable accessible name for screen reader users, acting as icon-only buttons.
**Action:** When implementing color swatches or any visual-only selection buttons, always ensure they have an `aria-label` providing a text alternative (e.g., `aria-label="Select color #EF4444"`).
