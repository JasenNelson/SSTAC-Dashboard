## 2024-05-18 - Prevent XSS in React Symbol Rendering
**Vulnerability:** XSS risk via `dangerouslySetInnerHTML`
**Learning:** Found an unnecessary use of `dangerouslySetInnerHTML` to render simple HTML entities (like `&#8594;`). Using `dangerouslySetInnerHTML` should only be done for fully trusted HTML. If it is only used to render symbols or emojis, it is safer to pass literal unicode characters as direct React children. React automatically escapes strings to prevent XSS.
**Prevention:** Avoid `dangerouslySetInnerHTML` for simple symbol rendering. Instead, encode the symbols directly as unicode strings in the JSX.
