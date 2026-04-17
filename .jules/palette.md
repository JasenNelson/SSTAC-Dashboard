## 2026-04-17 - Added pending state to EditDocumentForm submit button
**Learning:** Utilizing `useFormStatus` from `react-dom` is an effective, clean way to handle pending states in Next.js Server Action forms. Integrating it with Tailwind `disabled:` modifiers prevents double submissions and clearly communicates the loading status to the user.
**Action:** Always check form submissions that trigger Server Actions for missing loading states, and use `useFormStatus` combined with Tailwind `disabled:` modifiers to implement them.
