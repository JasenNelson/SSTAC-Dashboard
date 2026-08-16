# New UI findings, 2026-08-15 -- NOT in the original 21 decisions

Surfaced by the impeccable design detector while the batch was being implemented. Neither was fixed:
both are visual-identity changes that need an owner decision, not a unilateral edit. Add them to the
next decision round.

---

## N1. Eleven pastel gradient patterns in light mode (the classic AI-UI tell)

**Where:** `src/app/globals.css:158-169` is a DARK-MODE OVERRIDE that replaces pastel gradients with
a flat slate background. The override itself is fine. What it reveals is the inventory of gradients
in use in LIGHT mode:

    from-blue-50 to-indigo-50          from-indigo-50 to-blue-50
    from-green-50 to-blue-50           from-blue-50 to-green-50
    from-green-50 to-emerald-50        from-green-50 via-blue-50 to-emerald-50
    from-gray-50 to-indigo-50          from-red-50 to-pink-50
    from-purple-50 to-pink-50          from-amber-50 to-yellow-50
    from-yellow-50 to-orange-50

**Why it matters:** soft blue/indigo and purple/pink gradient cards are among the most recognisable
signatures of AI-generated interfaces, and the owner's original brief was explicitly to find and
clean that. The dark-mode override means the tell is invisible in dark mode and fully present in
light mode -- so it has survived review by anyone working in dark.

**Why it was NOT fixed here:** removing or replacing eleven gradient treatments changes the app's
visual identity across many surfaces at once. That is an owner call, and it interacts with the
Bathymetric `--db-*` token direction already established for the Calculator.

**Suggested options for the next round:**
- A: replace all pastel gradients with flat token-backed surfaces (`--db-depth-1` / `--db-surface`),
  matching the direction already taken in the Calculator shell.
- B: keep gradients only where they encode something (e.g. a status or a phase), flatten the rest.
- C: keep them, but re-derive the stops from the `--db-*` palette so they stop reading as Tailwind
  defaults.

**First step regardless of option:** inventory which components actually use each class, so the
blast radius is known before choosing. Not yet done.

---

## N2. The body typeface is Arial

**Where:** `src/app/globals.css:405` -- `font-family: Arial, Helvetica, sans-serif;`

**Why it matters:** this is the root of the cascade, so it sets the voice of every surface that does
not override it. Arial is not a considered choice; it is what you get when no choice is made. The
owner's brief was about generic, AI-produced design, and a characterless default body face is that
condition at its most fundamental. Note the Calculator work introduced three font stacks in the
`--db-*` token set; those are scoped to the Calculator and do not reach the rest of the app.

**Why it was NOT fixed here:** changing the body typeface is the single most visible change that
could be made to this product. It must be the owner's choice, seen side by side, in both themes.

**Suggested next step:** a rendered comparison page -- the same real page content set in three or
four candidate stacks, at desktop and 375px, in light and dark, so the owner picks by looking rather
than by name. Same format as the layout-options page that produced the original 21 decisions.

**Constraint to respect:** the Artifact CSP blocks external font CDNs, so any comparison page must
inline faces as data URIs or restrict itself to system stacks. A named webfont that silently falls
back would make the comparison meaningless.

---

## Also re-confirmed, unchanged: the gray-on-color false positive

`MatrixDashboard.tsx` panel toggles (currently ~L1818 and ~L1832, the line numbers drift as the file
changes). The detector pairs the INACTIVE state's gray text with the ACTIVE state's sky background;
those two states never co-occur. Left un-suppressed deliberately -- the ignore-value shape was
guessed wrong twice already, and a too-broad entry would blind the detector to genuine contrast
defects. Three lines of hook output per turn is the cheaper price.
