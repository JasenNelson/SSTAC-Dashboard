## 2025-02-12 - [Graph Visualization Toggle Accessibility]
**Learning:** For segmented controls or toggle button groups that change view/visualization modes, a `title` attribute is insufficient for assistive technology.
**Action:** When implementing a group of toggle buttons, explicitly implement `role="group"` with an `aria-label` on the container, and use `aria-pressed={state === 'current'}` on the child buttons. If the buttons are icon-only, ensure they also have an `aria-label`.
