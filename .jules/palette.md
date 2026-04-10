## 2024-04-10 - Header Navigation Accessibility
**Learning:** The desktop and mobile menu buttons in the `Header` component were missing essential ARIA attributes (`aria-expanded`, `aria-haspopup`) to communicate their state and function to screen readers.
**Action:** Added `aria-expanded` reflecting the React state (`isDesktopMenuOpen` / `isMobileMenuOpen`) and `aria-haspopup="true"` to clarify the presence of dropdown/flyout menus.
