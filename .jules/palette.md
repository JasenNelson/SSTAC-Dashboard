## 2026-05-15 - [InteractivePieChart Accessibility]
**Learning:** SVG paths and custom legend divs in interactive charts lack keyboard and screen reader accessibility by default.
**Action:** Add role='button', tabIndex={0}, onKeyDown for Enter/Space, aria-label, and focus-visible classes to make custom interactive chart elements fully accessible.
