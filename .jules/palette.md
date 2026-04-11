## 2024-05-18 - Missing ARIA Labels on Icon-only Buttons
**Learning:** React components containing icon-only map controls (like Leaflet zoom, toggle overlays) frequently lack standard accessible names, severely impeding screen reader usage.
**Action:** When auditing custom or map-heavy UI elements, always check that `<button>` wrappers around SVG icons (like Lucide React icons) explicitly define an `aria-label`. Further, dynamic UI states (like expanding menus) should be mapped directly to `aria-expanded` attributes.
