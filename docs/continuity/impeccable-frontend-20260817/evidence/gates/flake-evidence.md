# Flake evidence -- the two e2e failures hit during re-gating, and why each is a flake

## 1. Stack A2 first attempt: 2 Firefox teardown crashes (admin-agentic-os)
```
    Error: browserContext.close: Protocol error (Browser.removeBrowserContext): can't access property "_maybeDontRestoreTabs", this._windows[aWindow.__SSi] is undefined

    Error Context: test-results\admin-agentic-os-Agentic-O-29456-icated---redirects-to-login-firefox\error-context.md

--
    Error: browserContext.close: Protocol error (Browser.removeBrowserContext): can't access property "_maybeDontRestoreTabs", this._windows[aWindow.__SSi] is undefined

    Error Context: test-results\admin-agentic-os-Agentic-O-796b8-rom-PROJECTS-MAP-md-fixture-firefox\error-context.md

```
Retry on the identical tree: 0 occurrences of _maybeDontRestoreTabs; both tests executed.
Causal isolation: TWGReviewPortal (the only source file the correction touched) is imported
only by MatrixDashboard.tsx and JermilovaReviewPortal.tsx -- it is NOT in the admin/agentic-os
route module graph. The pre-correction Stack A tree passed the same spec 167/0.

## 2. Stack B2 first attempt: 1 matrix-options 15s tablist timeout
```
```
This is the flake class this lane had already documented (concurrent load -> 15s timeout).
The #787 correction touched no layout.tsx and no matrix-options file, and the pre-correction
Stack B tree -- carrying the identical headers()-driven dynamic-route behaviour -- passed 208/0.
Full six-gate retry on the same tree: 208 passed / 0 failed.
