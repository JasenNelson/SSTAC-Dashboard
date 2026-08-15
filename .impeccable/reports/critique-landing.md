Method: dual-agent (A: design review, unanchored · B: detector + browser evidence), plus an independent technical audit read for cross-reference.

# Landing Page (`/`) - Combined Critique

Targets: `src/app/page.tsx`, `src/components/dashboard/ProjectPhases.tsx`, `src/components/ThemeToggle.tsx`, `src/app/layout.tsx`, `src/app/globals.css`.

## Design Health Score

Heuristic 7 (Flexibility and Efficiency) is scored `n/a` per the Persuade-mode rule: a front door has no legitimate accelerator layer to score. Applicable max renormalized to **36** (9 heuristics x 4).

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | Three of five links (`page.tsx:78,93,108`) are gated routes per `route-access.ts:16-25`; `middleware.ts:146-148` redirects to `/login` with zero pre-click signal. B confirms the destinations are real gated prefixes, not a misread. |
| 2 | Match System / Real World | 2 | "BN-RRM" (`page.tsx:35`, `ProjectPhases.tsx:31`) and "TWG" (`page.tsx:13`) are never expanded anywhere on the page; confirmed audience is unfamiliar public visitors (`PRODUCT.md:11-14`). |
| 3 | User Control and Freedom | 2 | Disclosure and theme toggle both reverse cleanly (B confirms the disclosure's `aria-expanded`/`aria-controls` are correctly wired in the actual SSR output, not just in source). No nav exists to get back from a login wall. |
| 4 | Consistency and Standards | 1 | Mismatched icon tile sizes, badge sizes, card vs. button radius (A's source citations). Technical audit adds a systemic cause: a full design-token system exists in `globals.css:8-59` and is used **zero times** in either target component (grep-verified) - every color/spacing decision is a one-off literal, which is why nothing lines up. |
| 5 | Error Prevention | 1 | No guardrail on the most predictable error (a public visitor clicking "Dashboard"); no "members only" label anywhere in the grid (`page.tsx:76-121`). |
| 6 | Recognition Rather Than Recall | 2 | Every icon is paired with a text label - B independently confirms this by reading the rendered HTML (no icon-only controls found; the only interactive element needing an accessible name, the theme toggle, has one). Of ~20 routes `PRODUCT.md:60-65` inventories, only 3 are surfaced. |
| 7 | Flexibility and Efficiency | n/a | Persuade surface; no accelerator layer to score. |
| 8 | Aesthetic and Minimalist | 1 | Phase 2 stated three times in one scroll; rocket emoji used twice. One correction to the source evidence: A's "three competing gradients" is overstated. The Technical audit grep-verified only **two** `bg-gradient-*` utilities actually render on this route (`page.tsx:8` and `:20`); the indigo/purple/pink family at `globals.css:159-176` is real but is dead-code cruft for *other* pages' classes, not a rendering gradient on `/`. The aesthetic score is unchanged (two competing gradients plus a semantically arbitrary sky/green/purple card palette is still a real problem) but the specific "three gradients" claim is corrected to two live + one unused-but-present-in-the-shared-stylesheet. |
| 9 | Error Recovery | 1 | `middleware.ts:68-73` lands the visitor on `/login?redirect=/dashboard` with no explanation; nothing on the landing page participates in recovery. |
| 10 | Help and Documentation | 1 | Scored, not n/a, because `PRODUCT.md:11-14` makes comprehension-by-a-stranger a stated job of this page. No glossary, no contact route, no accessibility/privacy link in the footer (`page.tsx:150-156`). |
| **Total** | | **12/36** | **33% - Poor. Major overhaul required.** |

## Design Specificity Verdict

**CATEGORY-INTERCHANGEABLE.** All three assessments converge on this. A's structural argument (canonical hero -> two-column about -> 3-up card grid -> tinted CTA band -> copyright footer, `page.tsx:20-156`) is corroborated by the Technical audit's independent finding that the page uses **zero** of the app's own semantic design tokens (`--primary`, `--card`, `--muted`, etc., defined at `globals.css:8-59` but never referenced in `page.tsx` or `ProjectPhases.tsx`) - i.e., there isn't even an internal system being expressed inconsistently; there is no system at all, just repeated hand-picked literals. B's browser pass adds a concrete, render-confirmed detail A could only infer from source: the icon layer is entirely emoji glyphs inside bare `<span>` tags in the actual HTML output (`🚀`, `🏛️`, `📊`, `📈`, `🎯`, `✅`), with no `aria-hidden` on any of them - not a source-reading assumption, a rendered fact.

**Where B corrects A's evidence rather than just adding to it:** A cited "three unrelated gradients" competing on the page. The Technical audit's grep is more precise: only two `bg-gradient-*` utilities render on `/` (`page.tsx:8`, `page.tsx:20`); the third family A cited (`globals.css:159-176`, indigo/purple/pink) is real and present in the shared stylesheet but is a dark-mode catch-all for *other, non-landing* pages' classes - it does not fire on this route. This doesn't rescue the aesthetic verdict (two unrelated gradients plus a five-hue arbitrary card palette is still incoherent) but it is a correction, not a nitpick: citing a defect that isn't actually live on this page would have weakened the report's credibility with an engineer checking the claim.

**Deterministic scan (B, static regex detector):** returned `[]` - zero findings, exit 0, across all four files. This is expected and not a false negative: the detector is pattern-matching, and the real defects on this page (missing landmark, arbitrary color choices, un-authored typography, contrast ratios) require either DOM-structure reasoning or actual color-math, neither of which a regex pass does. B's own manual follow-up work (curl + HTML inspection + hand-computed WCAG contrast) is where the real evidence came from, and it corroborates the Technical audit almost exactly (see Priority Issues below) - so the "zero findings" result should be read as "the cheap layer had nothing to say," not "the page is clean."

**Browser evidence (B):** `curl -s http://localhost:3100/` returned HTTP 200, no redirect - the landing page itself is genuinely public, consistent with `PRODUCT.md`'s mixed-audience framing and with A's framing of the page's *job* (get a stranger in). The rendered heading DOM order is `h1 -> h2 -> h3 x7` with no skipped *tag levels* - this needs a careful read against A's and the Technical audit's "broken heading hierarchy" claim (see Priority Issues: it is not a contradiction, it is a different axis of the same defect - no level is skipped, but two whole sections have no owning `h2` at all, so multiple `h3`s hang directly under the single existing `h2`). No puppeteer was available for full-render contrast/computed-style checks, so B's contrast numbers are hand-computed from Tailwind hex values against the WCAG relative-luminance formula, not read from live computed styles - noted as the one honest gap in B's evidence chain, and the reason the Technical audit's independently-computed numbers matter as a cross-check.

## Overall Impression

The page works technically and fails as a front door. Nothing is broken in the sense of throwing errors; everything is broken in the sense that the biggest, most decorated part of the page (three nav cards) is a trap for the confirmed primary audience (unfamiliar public visitors), the one credibility fact that differentiates this project from a template (the ENV/Ministry partnership, `page.tsx:60`) is buried below the fold, and the two real accessibility failures found by hand (not by the detector) sit on the page's actual status-explaining copy. The single biggest opportunity, per A and echoed structurally by the Technical audit's token-adoption finding, is that fixing this isn't a matter of adjusting values - a real design system already exists in `globals.css` and is simply not connected to anything the visitor sees.

## What's Working

1. **The white-paper disclosure is a genuinely complete interactive contract**, and this is confirmed at two independent levels, not just asserted from source. A cites the source wiring (`ProjectPhases.tsx:57-61,71`: real `button`, `aria-expanded`, `aria-controls`, matching `id`). B independently verified the same contract in the **actual rendered HTML** (`aria-expanded="false" aria-controls="white-paper-details"` present in the SSR output). Two assessments reading two different layers (source vs. rendered DOM) landed on the same answer - this is worth preserving verbatim through any redesign.
2. **ThemeToggle is the best-built control on the surface**, also cross-confirmed: A cites the source (`ThemeToggle.tsx:11-13`: computed `aria-label`/`title`, icon swap communicating the target state, a real `focus:ring-2` with dark-mode offset). B confirms the `aria-label` is present in the rendered output, not just written in source and silently dropped somewhere in the render path. Nothing else on the page has a custom focus style; this should be the pattern the rest of the page inherits.
3. **Icons are never load-bearing.** Every emoji tile sits next to a text label in both the source (A) and the rendered HTML (B confirms no icon-only controls exist besides the theme toggle, which has its own accessible name). The iconography is the wrong *choice*, but removing or replacing it costs zero meaning - the fix is cheap.

## Priority Issues

--------------------------------------------------------------------
**[P0] The three primary navigation cards are dead ends for half the audience**
--------------------------------------------------------------------
**What:** `/dashboard` (`page.tsx:78`), `/survey-results` (`page.tsx:93`), and `/cew-2025` (`page.tsx:108`) are all in `GATED_ROUTE_PREFIXES` (`route-access.ts:16-25`); `middleware.ts:146-148` redirects unauthenticated requests to `/login?redirect=<path>`. Card copy promises otherwise ("Access project overview, documents, and key metrics", `page.tsx:88`). Nothing on the card signals an account is required. B independently confirms the landing page *itself* is public (HTTP 200, no redirect on `curl /`), which sharpens rather than softens the problem: the page is reachable by the exact audience it then traps.

**Why it matters:** `PRODUCT.md:11-14` confirms unfamiliar public visitors as a primary audience for this page; `PRODUCT.md:123-124` states the page must serve both a stranger and a returning member "without either job degrading the other." The largest, most visually invested region of the page is currently a wall for the stranger half of that mandate.

**Fix:** Split the grid into two labeled zones - public-reachable destinations get primary treatment (there currently are none besides `/login`/`/signup`, which is itself the real finding); gated destinations move to a visually subordinate "For SSTAC and TWG members" group with a persistent **text** affordance ("Sign in required" - not an icon alone, per `PRODUCT.md:135`'s rule against color/icon-only status). Have `/login` render the reason it was reached via the existing `redirect` param.
**Suggested command:** `/impeccable clarify`

--------------------------------------------------------------------
**[P1] Two measured WCAG contrast failures on the page's actual status copy**
--------------------------------------------------------------------
**What:** This is the strongest three-way agreement in the whole critique. A flagged both locations from source reading. B independently hand-computed both ratios from the Tailwind hex values using the WCAG relative-luminance formula. The Technical audit computed the same two ratios by the same method, independently. All three land on materially the same numbers:
- `ProjectPhases.tsx:82` - `text-slate-400` (#94A3B8) on `bg-slate-50` (#F8FAFC), `text-xs`: **~2.45:1** (light mode). Dark mode (`dark:text-slate-500` on the card's dark surface): **~3.07:1**. Both fail AA's 4.5:1 floor for normal text.
- `ProjectPhases.tsx:46` - `text-amber-600` (#D97706) on `bg-amber-50` (#FFFBEB), `text-xs`: **~3.07:1** (light mode), also failing AA. B and the Technical audit agree the dark-mode pairing (`text-amber-500` on `amber-900/20`) passes at ~6.4-6.45:1 - i.e., this is a light-mode-only defect, meaning dark mode was tuned for contrast and light mode was not, on the same content.

The `ProjectPhases.tsx:46` line is the sentence stating the project's actual delivery status ("...pending ENV feedback"); the `:82` block is the six sub-bullet items inside the white-paper disclosure.

**Why it matters:** `PRODUCT.md:132-135` is a dated, explicit owner decision that text contrast is a must-fix line item, not a polish item, on a page whose stated job includes explaining real regulatory status to a stranger.

**Fix:** Raise `text-slate-400`/`text-amber-600` in light mode to values that clear 4.5:1 against their respective backgrounds (e.g. `text-slate-600` and `text-amber-700`), and verify both themes rather than only the one that happens to pass.
**Suggested command:** `/impeccable harden`

--------------------------------------------------------------------
**[P1] No `<main>` landmark, no skip link, and a heading structure that misrepresents the page**
--------------------------------------------------------------------
**What:** `layout.tsx:23-37` wraps children directly in `body`; `page.tsx:7` opens with a plain `div` - no `<main>` anywhere in the render path, no skip link. On heading structure, A and the Technical audit both flag that the nav-card grid (`page.tsx:76-121`, three `<h3>` at 85/100/115) and the "Get Involved" section (`page.tsx:126`, `<h3>`) have no owning `<h2>` of their own - the only `<h2>` on the page belongs to the "About" card (`page.tsx:46`). **B's browser evidence needs to be read precisely here, not treated as a contradiction:** B reports the rendered DOM heading order as `h1 -> h2 -> h3 x7` with "no skipped levels" - and that is correct as far as it goes (no `<h4>` appears without a preceding `<h3>`, etc.). But "no level-skip" and "correct outline" are different claims. With only one `<h2>` on the entire page followed by seven `<h3>`s, a screen-reader user navigating by heading level finds two unrelated sections (the nav-card grid and "Get Involved") with no document-level heading of their own - they read as sub-items of "About the Sediment Standards Project" rather than as their own sections. B's finding and A's/the audit's finding are describing the same rendered DOM from two different angles; they agree once precisely stated.

**Why it matters:** WCAG 1.3.1 / 2.4.1 / 2.4.6. A keyboard/screen-reader user has no way to jump past the header, and the heading outline actively misrepresents the page's actual section structure.

**Fix:** Wrap the page body in a single `<main>` with an id; add a skip link as layout.tsx's first focusable element; add owning `<h2>`s above the nav-card grid and above "Get Involved" (or demote the card/CTA titles under a new `<h2>`).
**Suggested command:** `/impeccable harden`

--------------------------------------------------------------------
**[P1] Neither audience's actual action is the page's primary element**
--------------------------------------------------------------------
**What:** The header (`page.tsx:10-17`) is wordmark + theme toggle only - no nav, no sign-in. "Create Account" (`page.tsx:134`) and "Log In" (`page.tsx:140`) sit in a single low-contrast band at the very bottom of the scroll, after the three dead-end cards. "Log In" is styled as the outlined *secondary* variant (`page.tsx:141`) - backwards for the returning-member half of the audience, who by definition already have somewhere to go.

**Why it matters:** `PRODUCT.md:15-18` states a returning member's job is fast entry; they currently must scroll the entire marketing narrative every visit to reach a secondary-styled button. `PRODUCT.md:123-124`'s "neither job degrades the other" standard is violated for both audiences simultaneously.

**Fix:** Put a persistent "Sign in" in the header. Promote the stranger's action into the first viewport attached to a specific, verifiable claim rather than the generic "Get Involved" heading, which names no object.
**Suggested command:** `/impeccable layout`

--------------------------------------------------------------------
**[P2] Zero adoption of the app's own design-token system**
--------------------------------------------------------------------
**What:** This is the Technical audit's most load-bearing addition to A's evidence, and it explains *why* the consistency and aesthetic scores are low rather than just cataloging that they are. `globals.css:8-59` defines a complete, correctly structured light/dark token set (`--primary`, `--background`, `--card`, `--muted`, wired through `@theme inline`). A grep across `page.tsx` and `ProjectPhases.tsx` for any of `bg-primary|text-foreground|bg-card|text-muted-foreground|bg-secondary|bg-accent|bg-background` returns **zero matches**. Every one of the five color families in use (slate, sky, green, purple, amber) is a raw literal with a hand-maintained `dark:` twin - roughly 40+ paired declarations.

**Why it matters:** The already-approved rebrand (`PRODUCT.md:88-95`, cleared for replacement) will otherwise have to hand-edit dozens of scattered class strings instead of a handful of CSS variables. This is the single highest-leverage structural fix ahead of any visual replacement work.

**Fix:** Route landing-page colors through the existing token set (extend it for the hero band and the accent chips) before the redesign begins; define a semantic accent scale rather than four unrelated hues chosen per-card.
**Suggested command:** `/impeccable adapt`

--------------------------------------------------------------------
**[P2] The page repeats itself and carries stale, wrong-register boilerplate**
--------------------------------------------------------------------
**What:** Phase 2 is stated three times in one scroll (`page.tsx:31`, `page.tsx:35`, `ProjectPhases.tsx:16,18`); the rocket emoji appears twice (`page.tsx:31`, `ProjectPhases.tsx:13`). The footer (`page.tsx:153`) reads "(c) 2025 SSTAC & TWG Dashboard. All rights reserved." - hardcoded, already stale relative to the hero's own stated 2026-2027 phase copy (`page.tsx:31`), confirmed as a literal (not computed) by the Technical audit. "All rights reserved" is also the wrong register for a public-sector scientific collaboration, and it is the only thing in the footer - no contact, no privacy, no accessibility statement.

**Why it matters:** A visibly stale copyright year is the cheapest possible signal that a site is unmaintained, on a surface whose entire job is establishing credibility.

**Fix:** State the phase once, in the hero; let `ProjectPhases` carry detail without restating the headline. Replace the footer with partnership attribution, a contact route, and an accessibility statement; compute the year or drop the rights-reserved framing entirely.
**Suggested command:** `/impeccable distill`

## Persona Red Flags

**Jordan (Confused First-Timer)** - confirmed primary audience. Hits three undefined acronyms before the first fold ("SSTAC & TWG" at `page.tsx:13`, "CSR standards" at `page.tsx:60`, "BN-RRM" at `page.tsx:35`, never expanded). Reads "Access project overview, documents, and key metrics" (`page.tsx:88`), clicks Dashboard, and - B confirms this is a real server-side redirect, not a client-side soft state - lands on a login form with no explanation (`middleware.ts:146-148`). No help, no glossary, no contact route (`page.tsx:150-156`). The one credibility fact that answers "is this legitimate" (the ENV/Ministry partnership, `page.tsx:60`) sits below the fold next to an unlabeled emoji. **Verdict: abandons at the first card click.**

**Riley (Deliberate Stress Tester)** - files the top bug immediately: three links advertise content, all three deliver a login redirect. Notices the footer year is already wrong. Toggles theme and finds the sub-bullet text unreadable in both modes (`ProjectPhases.tsx:82`) - confirmed by two independent contrast computations (B, Technical audit), so this is not a one-reviewer artifact. Expands the white paper, reloads, finds the disclosure state gone (`useState` at `ProjectPhases.tsx:6`, no persistence). Zooms to 200% and finds no skip link, no `main` landmark - matching B's and the Technical audit's independent finding on the same defect. **Verdict: every probe finds a promise the implementation does not keep.**

**Casey (Distracted Mobile User)** - both real actions sit at the very bottom of a long scroll; the header offers no shortcut (`page.tsx:10-17`). At `md` and below, the card grid collapses to one column (`page.tsx:76`), turning three dead-end cards into three full-height scroll stages before the CTA. Hero `h1` has no responsive step-down (`text-5xl`, `page.tsx:23`); the hero pill is a 90-character uppercase sentence that will wrap into a multi-line block at 375px. Card hover feedback (`hover:-translate-y-2`, `group-hover:scale-110`, `page.tsx:79,82`) is desktop-only and does nothing on touch. **Verdict: reaches the bottom only if motivated, with no touch feedback along the way.**

## Minor Observations

- `ThemeContext.tsx:49-57` renders a substitute white `min-h-screen` wrapper until `mounted`; on a slow first load this is the first thing a Persuade surface's visitor sees - a blank page.
- `ThemeContext.tsx:22` defaults to light and never consults `prefers-color-scheme`, so a system-dark visitor gets an unrequested light flash.
- `page.tsx:1` marks the whole route `'use client'` although only its two children need interactivity; both A and the Technical audit flag this independently as an unnecessary hydration cost on the most first-paint-sensitive route in the product.
- All five primary CTAs use raw `<a href>` instead of `next/link` (`page.tsx:77,92,107,133,139`) - confirmed by A's citation and the Technical audit's grep for a missing `Link` import; every click is a full document reload.
- `ProjectPhases.tsx:65` uses a literal geometric-shape glyph as the disclosure chevron. B adds a rendered-DOM confirmation this is not just a source curiosity: the glyph sits in a `<span>` with no `aria-hidden`, and B verified it is exposed as literal text within the button's accessible name computation - a screen reader user hears the shape character as part of the label.
- No `prefers-reduced-motion` handling anywhere in `globals.css` (confirmed by zero-match search in both A's and the Technical audit's independent passes), while the card hovers animate `transform` unconditionally.
- `globals.css:10` and `globals.css:287` both hardcode `Arial, Helvetica, sans-serif` - once as a token, once again as a raw `body` override that bypasses the token path entirely; harmless today, but exactly the kind of redundant declaration that drifts once a real typeface is chosen.

## Questions Worth Considering

- If all three featured destinations require an account, what is the public visitor actually allowed to see? If the honest answer is "nothing," this is a sign-in page with a brochure attached, and it should be designed as one.
- What is the one verifiable thing this project can show that no competitor could truthfully copy - real regulatory provenance, cited toxicity reference values, human-in-the-loop verdicts (`PRODUCT.md:43-48`)? What would the first viewport look like if it demonstrated that instead of asserting a mission statement over a gradient?
- Should "Get Involved" (`page.tsx:127`) exist at all, if membership is role-assigned rather than open self-service?
- Given that a real design-token system already exists and is simply unused, is the fastest path to a credible page a values swap inside the current structure, or does the structure itself (three equal-weight cards, none of them truly public) need to change first?
