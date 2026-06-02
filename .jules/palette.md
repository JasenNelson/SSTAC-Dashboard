## 2024-05-21 - Added missing ARIA labels to icon-only buttons
**Learning:** Icon-only buttons (using only Lucide icons or raw SVGs inside `<button>`) without `aria-label`s are a common accessibility issue across various dashboard modules (regulatory-review, bn-rrm). Screen readers cannot interpret the intended action of these buttons.
**Action:** When creating or reviewing components with icon-only interactive elements (like edit, delete, close, or clear actions), always ensure an explicit `aria-label` attribute is provided that describes the action being taken.
