## 2025-05-20 - [Focus Visible Enhancement]
**Learning:** Overusing standard `focus:` tailwind utility classes for interactive elements across React applications leads to focus rings persisting on mouse clicks, deteriorating mouse-user UX. Using `focus-visible:` properly segregates visual feedback, only rendering focus rings when elements are focused via keyboard navigation.
**Action:** Always prefer `focus-visible:` over `focus:` for keyboard-accessible focus rings in Tailwind components going forward, particularly on interactive buttons and toggles.
