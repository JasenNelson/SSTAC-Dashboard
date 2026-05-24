## 2024-05-24 - [Accessible Color Swatch Buttons]
**Learning:** Visual-only interactive elements, such as color swatches (`<button>` tags indicating color via background styles), lack accessible names and rely solely on visual cues (like hover states) for interaction.
**Action:** Always include explicit `aria-label` attributes for screen readers to describe the purpose of the swatch, and add `focus-visible` Tailwind classes (e.g., `focus-visible:ring-2`) to ensure keyboard navigation support and visible focus indicators.
