## 2024-05-18 - Prevent XSS in dynamically injected icons
**Vulnerability:** XSS vulnerability through usage of `dangerouslySetInnerHTML={{ __html: icon }}` in `FeatureCard` component of `BNRRMClient.tsx`. The `icon` prop is rendered directly as HTML. While currently it might just be passing static string literals, it poses an XSS risk if the input becomes dynamic or is controlled by a user.
**Learning:** `dangerouslySetInnerHTML` should only be used when absolutely necessary and always with trusted or sanitized input. A React application using DOMPurify could prevent malicious injection.
**Prevention:** Sanitize the input string using `DOMPurify.sanitize()` before passing it to `dangerouslySetInnerHTML`.
