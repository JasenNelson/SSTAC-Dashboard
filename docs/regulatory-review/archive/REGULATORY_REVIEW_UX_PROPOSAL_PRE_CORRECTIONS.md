# Regulatory Review Dashboard - UI/UX Improvement Proposal

**Date:** January 27, 2026
**Version:** 1.0
**Status:** Proposed
**Target:** Executive presentations and general users

---

## Executive Summary

The current regulatory review interface is **efficient for developers** but **overwhelming for executives and general users**. This proposal redesigns the interface to:

1. **Pyramid-based topic hierarchy** - Top-down organization from broad stages to specific requirements
2. **Executive Summary View** - Clean, visual presentation mode for demonstrations
3. **Database Power View** - Retained for technical users who need detailed access
4. **WCAG 2.1 AA compliance** - Meeting April 2026 government accessibility requirements

---

## Product Positioning: Reviewer Assistant + Memo Generator (Not a Decision Tool)

- This UI supports evidence review and memo authoring; it does not make legal decisions.
- AI outputs are proposed findings for review; reviewer decisions are the authoritative record.
- Memo artifacts:
  - **INTERIM Memo:** highly detailed, process/audit focused; saved to project records; not typically shared externally.
  - **FINAL Memo:** concise 6-10 pages for decision-maker; derived from interim content plus reviewer curation.

---

## Current State Analysis

### What Works Well ✅
- Comprehensive data access
- Efficient for power users who know what they're looking for
- Robust filtering and search
- Hierarchical organization (Sheet → Section → Items)

### Pain Points ⚠️
- **Too Dense:** Small text, cramped spacing, overwhelming information density
- **Technical Language:** Sheet names (STG1PSI, STG2PSIDSI, RAPG) not intuitive for non-experts
- **Flat Visual Hierarchy:** Hard to distinguish importance levels at a glance
- **Database Aesthetic:** List-heavy interface feels like development tool, not executive dashboard

---

## Research-Based Recommendations

### Key Findings from Industry Research

1. **[Compliance Dashboard Best Practices](https://www.explo.co/blog/compliance-dashboards-compliance-management-reporting):**
   - Tailor dashboards to user types (C-suite vs department managers)
   - Reduce cognitive load through clear information flow
   - Transform complex data into digestible visual insights

2. **[Pyramid Navigation Model](https://lowkeylabs.github.io/cmsc427-course-admin/guide/visual-design/navigational-models.html):**
   - Start with broad base, progress toward narrower options
   - Each layer acts as foundation for next layer
   - Effective for filtering and refining content progressively

3. **[Government Accessibility Requirements](https://www.accessibility.works/blog/ada-title-ii-2-compliance-standards-requirements-states-cities-towns/):**
   - WCAG 2.1 Level AA compliance by April 2026 (mandatory)
   - Keyboard accessibility essential
   - Screen reader compatibility required

---

## Proposed Design: Two-Mode Interface

### Mode 1: Executive Summary View (Presentation-friendly)

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  Header: Evidence Sufficiency Overview (Sufficient/Insufficient/Needs More Evidence)   │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│   PYRAMID    │         CARD-BASED CONTENT AREA              │
│  NAVIGATION  │                                              │
│              │  ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  Stage 1 ►   │  │ Policy  │ │ Policy  │ │ Policy  │       │
│    ↳ PSI     │  │  Card   │ │  Card   │ │  Card   │       │
│    ↳ History │  └─────────┘ └─────────┘ └─────────┘       │
│              │                                              │
│  Stage 2 ►   │  Visual Status Indicators + Progress Bars   │
│    ↳ DSI     │                                              │
│    ↳ Sampling│  Key Evidence Excerpts (not full data)      │
│              │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

**Key Features:**
- **Larger Text:** 14-16px body, 18-24px headings
- **Generous Spacing:** 16-24px gaps between elements
- **Visual Hierarchy:** Color-coded workflow stages
- **Plain Language:** "Stage 1: Site Investigation" not "STG1PSI"
- **Cards over Tables:** Visual, scannable cards instead of dense rows
- **Progress Indicators:** Donut charts, progress bars for quick status
- **Defaulting:** Role-based default + remember last view; allow per-link override via URL

### Mode 2: Database Power View (Technical Users)

**Retained features:**
- Dense table view with all columns
- Advanced filtering and sorting
- Technical sheet names for precision
- Detailed evidence display
- Quick batch operations
- Virtualized rows for large datasets (50+)
- Tabular numerals for numeric columns

**Toggle:** Button in header "Executive View <-> Database View" (persist per user, synced to URL)

---

## Evidence Sufficiency Model

Primary workflow label is **Evidence Sufficiency**; **AI Proposed Status** is secondary for traceability only.

**Sufficiency dimensions:**
1. Coverage: does evidence address all parts of the CSAP meta-question?
2. Quality: verbatim, specific, non-generic, non-placeholder.
3. Traceability: includes source doc + page reference + policy citation.
4. Policy alignment: evidence ties to relevant policies (requirements/guidance/best practices) for the submission type/topic.

**UI fields (minimum set):**
- AI Proposed Status (PASS/FAIL/NOT_FOUND/ESCALATE) badge
- Evidence candidates (ranked, with confidence + method)
- Reviewer Sufficiency (Sufficient / Insufficient / Needs More Evidence)
- Reviewer Notes (memo-ready)
- Include-in-FINAL flag + "Final Memo summary" short field (1-3 paragraphs)
- Optional: Follow-up needed / request more engine evaluation flag

**Authority:** Reviewer Sufficiency is authoritative; AI is advisory.

## Memo Workflow: Interim vs Final

**Interim Memo (internal, audit-focused):**
- Highly detailed evidence list and evaluation process documentation
- Per requirement: evidence candidates, confidence, rationale, reviewer notes, sufficiency decision
- Full traceability: internal IDs, policy codes + labels, page citations

**Final Memo (6-10 pages, decision-maker):**
- Executive summary of major findings
- Only curated/high-confidence evidence excerpts + citations
- Reviewer-written summaries per topic/stage
- Clearly separated "Reviewer Conclusions" vs "Engine Suggestions"

**UI behavior:**
- Reviewer curates Final Memo content during review (Include-in-FINAL + summary field)
- Final Memo generation enabled once review completion threshold is met (e.g., all required items have Reviewer Sufficiency set)

**Export requirements:**
- Final Memo export is required
- Interim Memo export exists and must be retained

## Evidence Display and Anti-Placeholder Requirements

Each evidence excerpt displayed must include:
- verbatim quote
- source document identifier
- page reference (required)
- extraction/match method (keyword / embedding / semantic / AI reasoning / etc.)
- confidence score + short explanation

UI affordances:
- "View in source" action (doc + page anchor in v1 is acceptable)
- show top N evidence candidates (N=3 default) with quick compare
- "flag as weak/irrelevant evidence" control to feed QA/improvement queues

Placeholder/generic evidence must be filtered or explicitly flagged; do not present as sufficient.

## Pyramid Topic Hierarchy (Left Panel)

### Current Problem
```
Sheet Groups (Technical):
├─ STG1PSI (What does this mean?)
│  ├─ DOCUMENTATION AND REPORTING
│  ├─ SITE HISTORY
│  └─ -
├─ STG2PSIDSI (Confusing acronym)
│  └─ -
```

### Traceability & Mapping (Required for Audit)

To preserve auditability and search fidelity, keep a mapping table of technical codes to plain-language labels. Both labels appear in search and exports.

| Code      | New Label                         | Search Alias/Notes            |
|-----------|-----------------------------------|-------------------------------|
| STG1PSI   | Stage 1: Preliminary Investigation| "PSI", "Prelim", "Stage 1"    |
| STG2PSIDSI| Stage 2: Detailed Investigation   | "DSI", "Stage 2"              |
| RAPG      | Stage 3: Risk Assessment          | "Risk", "RAPG"                 |
| REMPLAN   | Stage 4: Remediation Planning     | "RemPlan", "Remediation"      |

Implementation note: keep codes in the data model and show them in detail views/tooltips and CSV exports.

## Traceability and Identifier Strategy

- Internal DB IDs remain stable for joins, deep links, and exports (e.g., CSR_CHUNK_XX_XXX).
- Add a "Citation Label" layer for user-facing legal references (e.g., "CSR s.18") while preserving internal IDs.
- Exports must include BOTH internal ID and citation label whenever possible.

**Future migration note:** we may later rename/alias IDs to match legal conventions; design must support alias mapping without breaking deep links (canonical internal ID + alias label).

## Taxonomy Mapping Plan (Schema-Aware)

- Mapping derived from existing DB fields used to group requirements/topics.
- Output is a mapping table: stage/topic/subtopic + code + label + join key.
- Store mapping as versioned config initially; optionally move to DB tables later.
- Mapping must preserve stable IDs and enable future citation label migration.

**Deliverable:**
- `taxonomy_mapping.csv` (or `.json`) with columns:
  - internal_requirement_id
  - stage_id
  - stage_label
  - topic_id
  - topic_label
  - subtopic_id (optional)
  - subtopic_label (optional)
  - code (original)
  - citation_label (human readable; may be blank initially)
  - notes

### Proposed Pyramid Structure

```
TIER 1: Workflow Stages (Pyramid Base - Broadest)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┌─ 📋 Stage 1: Preliminary Investigation
│   └─ Purpose: Initial site review and risk screening
│
├─ 🔬 Stage 2: Detailed Investigation
│   └─ Purpose: Comprehensive sampling and testing
│
├─ ⚠️  Stage 3: Risk Assessment
│   └─ Purpose: Evaluate contamination impacts
│
├─ 🛠️  Stage 4: Remediation Planning
│   └─ Purpose: Design cleanup strategy
│
└─ 📊 Cross-Cutting Requirements
    └─ Purpose: Standards applying to all stages

TIER 2: Document Types & Topics (Middle Layer)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Stage 1: Preliminary Investigation
├─ 📄 Site History Review
├─ 📍 Site Reconnaissance
├─ 🗺️  Preliminary Site Model
└─ 📋 Documentation & Reporting

TIER 3: Specific Requirements (Pyramid Top - Narrowest)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Site History Review
├─ CSAP-01: Historical land use research
├─ CSAP-02: Previous environmental reports
├─ CSAP-03: Regulatory database searches
└─ - (5-10 specific requirements)
```

### Visual Design Elements

**Stage Level (Tier 1):**
- **Size:** Large (16px), bold
- **Icons:** Workflow icons (clipboard, microscope, warning, tools)
- **Color:** Stage-specific colors (blue, green, orange, red)
- **Spacing:** 24px top/bottom padding
- **Expand/Collapse:** Default expanded for Stage 1, collapsed for others

**Document Type (Tier 2):**
- **Size:** Medium (14px), semi-bold
- **Icons:** Document type icons
- **Color:** Inherit from parent stage (lighter shade)
- **Spacing:** 16px top/bottom padding
- **Indent:** 12px from left

**Requirement (Tier 3):**
- **Size:** Small (12px), regular weight
- **Icons:** Status dots + text label (not color alone); decorative icons `aria-hidden="true"`
- **Color:** Gray text, status-colored dot
- **Spacing:** 8px top/bottom padding
- **Indent:** 24px from left
- **Show:** First 3 by default, "+X more" expandable

### Interactive Behaviors

1. **Click Stage:** Filter main content to show only that stage
2. **Click Document Type:** Filter to specific document requirements
3. **Click Requirement:** Open detail view in main content area
4. **Hover:** Show tooltip with description/purpose
5. **Search:** Highlight matching items across all pyramid levels
6. **State & Deep Links:** View mode, filters, expanded panels, and pagination synced to URL

---

## Deep-Link and State Persistence Contract

URL must encode:
- view mode (executive vs DB)
- selected node (stage/topic/requirement)
- filters: status, tier, sufficiency, unresolved-only
- sorting/pagination (DB view)

Precedence:
- URL overrides saved preferences
- saved preferences override role defaults

Example query params (provisional):
-view=exec|db
&stage=STG1
&topic=site-history
&reqId=CSAP-XYZ-123
&tier=TIER_2_PROFESSIONAL
&suff=insufficient
&status=not_found
&sort=confidence_desc
&page=3

## Main Content Area Improvements

### Executive Summary View (Card Layout)

#### Policy Card Design (Memo-first)
```
----------------------------------------------------------------
- - CSAP-01: Historical Land Use Research                      - - Title
- AI Proposed Status: PASS (badge)                             -
- Evidence Sufficiency (Reviewer): [Sufficient -]              -
- Requirement: Document all historical uses-                   -
- Evidence: "Records indicate industrial use 1950-1975-"       -
-   Doc A, p.12 - Method: semantic - Confidence: 0.92           -
- [Review Evidence] [Open source (Doc A, p.12)]                -
- Include in Final: [on]                                       -
- Final Memo summary: "Industrial use documented 1950-1975-"   -
- Reviewer Notes: "Add context on zoning change in 1976."      -
----------------------------------------------------------------
```

┌───────────────────────────────────────────────┐
│ ● CSAP-01: Historical Land Use Research      │ ← Status dot + Title
│                                               │
│ Requirement: Document all historical uses- │ ← Plain language summary
│                                               │
│ Status: ✅ ADEQUATE                           │ ← Large, clear status
│ Confidence: ██████████ HIGH (92%)            │ ← Visual confidence meter
│                                               │
│ Evidence Found:                               │
│ "Records indicate industrial use from         │ ← Key excerpt (not all data)
│  1950-1975- [3 sources]"                   │
│                                               │
│ Tier 1 - Binary Determination                │ ← Tier badge
└───────────────────────────────────────────────┘
```

**Card Features:**
- **Evidence Sufficiency control** (reviewer authoritative) + **AI Proposed Status** badge (secondary)
- **Evidence candidates** (top 3) with confidence, method, and citations
- **View in source** action and **flag weak/irrelevant evidence** control
- **Include-in-FINAL** toggle + **Final Memo summary** field
- **Reviewer Notes** for memo-ready language
- **Color coding (sufficiency):** Sufficient (green), Needs More Evidence (amber), Insufficient (red), Unreviewed (gray)

#### Summary Statistics Panel (Top of Page)

```
----------------------------------------------------------------
- Evidence Sufficiency Coverage: 68%  ------------------ (123/180 reviewed) -
-                                                              -
- Sufficient: 85   Needs More Evidence: 38   Insufficient: 12  -
- Unreviewed: 45                                              -
----------------------------------------------------------------
```

┌─────────────────────────────────────────────────────────────┐
│  Evidence Sufficiency Coverage: 68%  ████████████░░░░░░  (123/180)    │
│                                                             │
│  ✅ Adequate: 85    ⚠️ Flagged: 38    ❌ Inadequate: 12    │
│  ⏳ Pending: 45                                            │
└─────────────────────────────────────────────────────────────┘
```

### Database Power View (Retained Table)

- Keep existing AssessmentTable component
- Add columns: **AI Proposed Status**, **Reviewer Sufficiency**, **Reviewer Notes indicator**, **Include-in-FINAL**
- Provide row-level evidence preview with **Open source (doc + page)** action
- Ensure truncation reveal works on focus (keyboard), not just hover
- Add "Switch to Executive View" button at top

---

## Visual Design System

### Color Palette

**Workflow Stage Colors:**
- Stage 1 (Preliminary): Blue (#3B82F6)
- Stage 2 (Detailed): Green (#10B981)
- Stage 3 (Risk): Orange (#F59E0B)
- Stage 4 (Remediation): Purple (#8B5CF6)
- Cross-Cutting: Gray (#6B7280)

**Status Colors (Evidence Sufficiency):**
- Sufficient: Green (#10B981)
- Insufficient: Red (#EF4444)
- Needs More Evidence: Amber (#F59E0B)
- Unreviewed: Gray (#9CA3AF)
- AI Proposed Status (secondary): outline badge; do not rely on color alone

**Tier Colors:**
- Tier 1 (Binary): Blue (#3B82F6)
- Tier 2 (Professional): Purple (#8B5CF6)
- Tier 3 (Statutory): Red (#DC2626)

### Typography Scale

**Executive View:**
- Page Title: 28px (font-semibold)
- Section Headings: 20px (font-semibold)
- Card Titles: 16px (font-medium)
- Body Text: 14px (font-normal)
- Labels: 12px (font-medium, uppercase)

**Database View:**
- Keep current sizes (smaller, denser)

### Spacing Scale

**Executive View:**
- Section gaps: 32px
- Card gaps: 24px
- Internal card padding: 20px
- Button/badge gaps: 12px

**Database View:**
- Keep current spacing (more compact)

---

## Accessibility Compliance (WCAG 2.1 AA)

### Accessibility v0 (early)

- Keyboard-only end-to-end review flow
- Visible focus with `:focus-visible` everywhere
- Labeled inputs (no placeholder-only)
- Truncation reveal works on focus, not only hover
- Color not the only channel for meaning

### WCAG 2.1 AA (formal audit, later)

1. **Keyboard Navigation:**
   - Tab through all interactive elements
   - Enter/Space to activate
   - Arrow keys for hierarchical navigation
   - Escape to close modals/panels

2. **Screen Reader Support:**
   - Semantic HTML (`<nav>`, `<article>`, `<section>`)
   - ARIA labels for status indicators and icon-only controls
   - ARIA live regions for dynamic updates
   - Skip navigation links

3. **Color Contrast:**
   - Text: Minimum 4.5:1 contrast ratio
   - Large text (18px+): Minimum 3:1
   - Interactive elements: Minimum 3:1

4. **Form Accessibility:**
   - Label every input
   - Error messages programmatically associated
   - Suggestion text for corrections

5. **Focus Indicators:**
   - Visible focus rings (2px, high contrast)
   - Use `:focus-visible` (avoid focus ring on click)
   - Never remove `:focus` styles without replacement

---

## Implementation Priority

### Phase 1: Foundation (Week 1-2)
- [ ] Refactor left panel to pyramid structure
- [ ] Add workflow stage grouping
- [ ] Implement plain language labels
- [ ] Add stage icons and colors

### Phase 2: Executive View (Week 3-4)
- [ ] Create card component for policies
- [ ] Build summary statistics panel
- [ ] Implement card grid layout
- [ ] Add view mode toggle

### Phase 3: Polish & Accessibility (Week 5-6)
- [ ] Add keyboard navigation
- [ ] Implement ARIA labels
- [ ] Test with screen readers
- [ ] Ensure color contrast compliance
- [ ] Add focus indicators

### Phase 4: Testing & Refinement (Week 7-8)
- [ ] User testing with executives
- [ ] User testing with technical users
- [ ] Accessibility audit
- [ ] Performance optimization
- [ ] Documentation

### Success Metrics & Acceptance Criteria

- **Time-to-evidence:** median < 60s to locate evidence for a requirement
- **Topic review completion:** median < 10 min per topic with Reviewer Notes captured
- **Reviewer Sufficiency coverage:** 95%+ required items have Reviewer Sufficiency set
- **Final Memo readiness:** Final Memo generation available once threshold is met; export completes reliably

---

## Comparison: Before & After

### Before (Current State)
- **User Feedback:** "Feels like a database dump"
- **Executive Reaction:** "Too technical, hard to follow"
- **Demo Challenge:** Requires extensive explanation
- **Learning Curve:** Steep for new users

### After (Proposed State)
- **User Feedback:** "Clean, professional, easy to navigate"
- **Executive Reaction:** "I can see evidence sufficiency at a glance"
- **Demo Advantage:** Visual, self-explanatory
- **Learning Curve:** Gentle, progressive disclosure

---

## Next Steps

1. **Review this proposal** with stakeholders
2. **Prioritize features** based on demo timeline
3. **Create mockups** for key screens
4. **Implement Phase 1** (pyramid navigation)
5. **Iterate** based on user feedback

---

## References

### Research Sources

**Compliance Dashboard Best Practices:**
- [Effective Dashboard Design Principles for 2025 | UXPin](https://www.uxpin.com/studio/blog/dashboard-design-principles/)
- [Compliance Dashboards: Examples & Best Practices | Explo](https://www.explo.co/blog/compliance-dashboards-compliance-management-reporting)
- [Compliance Dashboard in 2025: A Complete Guide | MetricStream](https://www.metricstream.com/learn/compliance-dashboard.html)
- [UI/UX Design in Regulated Industries | Medium](https://cadabrastudio.medium.com/ui-ux-design-in-regulated-industries-balancing-compliance-user-experience-84f8e85bc091)

**Hierarchical Navigation & Information Architecture:**
- [Information Architecture for Navigation | Abby Covert](https://abbycovert.com/writing/information-architecture-for-navigation/)
- [Navigational Models Guide | LowKeyLabs](https://lowkeylabs.github.io/cmsc427-course-admin/guide/visual-design/navigational-models.html)
- [The Comprehensive Guide to Information Architecture | Toptal](https://www.toptal.com/designers/ia/guide-to-information-architecture)
- [Information Architecture: A UX Designer's Guide | Justinmind](https://www.justinmind.com/wireframe/information-architecture-ux-guide)

**Government Accessibility Requirements:**
- [New ADA Title II Web Accessibility Requirements Hit April 24, 2026 | Accessibility.works](https://www.accessibility.works/blog/ada-title-ii-2-compliance-standards-requirements-states-cities-towns/)
- [Updated Web Accessibility Rules: A Guide for Government Agencies | PublicInput](https://publicinput.com/wp/updated-web-accessibility-rules-a-guide-for-government-agencies/)
- [Government Websites Face 2026 Accessibility Crackdown | AudioEye](https://www.audioeye.com/post/government-websites-face-2026-accessibility-crackdown-here-s-how-to-prepare-/)

---

**Document Version:** 1.0
**Created:** January 27, 2026
**Status:** Proposal - Awaiting Stakeholder Review
**Contact:** See SSTAC Dashboard project team
