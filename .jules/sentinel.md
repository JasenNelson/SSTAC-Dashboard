## 2024-04-18 - Remove unnecessarily dangerouslySetInnerHTML usage
**Vulnerability:** Use of `dangerouslySetInnerHTML` for simple icons/symbols without sanitization.
**Learning:** `dangerouslySetInnerHTML` should only be used when necessary and with trusted/sanitized HTML. Simple symbols or icons encoded as HTML entities can be rendered directly as React children.
**Prevention:** Avoid `dangerouslySetInnerHTML` for simple character encodings. Pass literal Unicode characters directly as React children.
