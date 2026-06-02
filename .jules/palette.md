## 2024-06-25 - [Accessible Table of Contents]
**Learning:** Found an accessibility issue where TOC entries were rendered as `<li>` elements with `onClick` handlers, which are not interactive by default and cannot be navigated via keyboard.
**Action:** Replaced interactive `<li>` elements with `<button type="button">` inside the `<li>` to ensure keyboard navigation (Tab, Enter, Space) works and to expose the `role=button` to screen readers. Added `focus-visible:ring-2` to these and other main buttons to ensure visible focus states.
