## 2026-05-11 - Add ARIA menu attributes to ShareButton dropdown
**Learning:** Adding ARIA roles to dropdown menus (`role="menu"` and `role="menuitem"`) and wrapping dynamic feedback text in an `aria-live="polite"` region significantly improves screen reader accessibility without changing visual behavior.
**Action:** Always ensure custom dropdown menus implement proper ARIA roles and that dynamic text changes (like "Copied!") are announced using `aria-live`.
