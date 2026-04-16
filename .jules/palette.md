## 2026-04-16 - Map toggle states to aria-expanded
**Learning:** Navigation menu toggles need `aria-expanded` attributes mapped directly to their internal state variables (like `isExpanded` or `isOpen`) to ensure assistive technologies stay synchronized with visual changes.
**Action:** Add `aria-expanded={isOpen}` to any button that controls a dropdown, menu, or collapsible section to keep screen readers informed of the current state.
