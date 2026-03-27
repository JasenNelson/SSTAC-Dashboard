# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - img [ref=e6]
      - heading "Welcome Back" [level=1] [ref=e8]
      - heading "SSTAC & TWG Dashboard" [level=2] [ref=e9]
      - paragraph [ref=e10]: Sign in to access your dashboard
    - generic [ref=e11]:
      - generic [ref=e12]:
        - generic [ref=e13]:
          - generic [ref=e14]: Email Address
          - textbox "Email Address" [ref=e15]:
            - /placeholder: Enter your email
        - generic [ref=e16]:
          - generic [ref=e17]: Password
          - textbox "Password" [ref=e18]:
            - /placeholder: Enter your password
        - button "Sign In" [ref=e19]
      - paragraph [ref=e21]:
        - text: Don't have an account?
        - link "Create one here" [ref=e22] [cursor=pointer]:
          - /url: /signup
    - paragraph [ref=e24]: © 2025 SSTAC & TWG Dashboard. All rights reserved.
  - button "Open Next.js Dev Tools" [ref=e30] [cursor=pointer]:
    - img [ref=e31]
  - alert [ref=e35]
```