## 2024-05-17 - ShareButton ARIA Enhancement
**Learning:** The `ShareButton` component was built using standard unstyled `div`s and `button`s to create a dropdown menu, but lacked standard WAI-ARIA properties (`aria-expanded`, `role="menu"`, `role="menuitem"`, etc.) and announced background elements.
**Action:** When creating custom dropdown menus or inspecting existing ones in this repository, always verify the presence of `aria-expanded` and `aria-haspopup` on the trigger, `role="menu"` on the container, `role="menuitem"` on items, and `aria-hidden="true"` on decorative icons/backdrops.
