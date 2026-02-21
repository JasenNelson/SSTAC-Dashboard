# Regulatory Review Dashboard - Visual Mockups

**Date:** January 27, 2026
**Purpose:** Visual comparison of current vs proposed interface

---

## Left Panel Comparison

### BEFORE: Current Technical List
```
┌─────────────────────────────┐
│ 🔍 Search CSAP items-     │
│ ▼ All Tiers                 │
│ ▼ All Status                │
├─────────────────────────────┤
│ Topics (5)                  │
├─────────────────────────────┤
│ ▼ STG1PSI                   │─┐
│   ├─ DOCUMENTATION AND R- │ │ Too technical
│   ├─ SITE HISTORY          │ │ Cramped
│   │  ├─ CSAP-01            │ │ Small text
│   │  ├─ CSAP-02            │ │
│   │  └─ +5 more items      │─┘
│   └─ PRELIMINARY SITE-    │
│                             │
│ ▶ STG2PSIDSI                │  Confusing
│ ▶ SLRA                      │  acronyms
│ ▶ RAPG                      │
│ ▶ REMPLAN                   │
└─────────────────────────────┘
```

### AFTER: Pyramid Topic Hierarchy

Accessibility notes: search and filter controls use visible labels; placeholders are examples, not labels.

```
┌──────────────────────────────────────────┐
│ 🔍 Search policies and requirements-  │
│ ▼ All Tiers    ▼ All Status             │
├──────────────────────────────────────────┤
│ WORKFLOW STAGES                          │
├──────────────────────────────────────────┤
│                                          │
│ 📋 Stage 1: Preliminary Investigation   │─┐
│    Initial site review & risk screening │ │
│    ▼ Site History Review          [85%] │ │ Plain
│       📄 Historical Land Use        ✅   │ │ language
│       📄 Previous Reports           ✅   │ │
│       📄 Database Searches          ⚠️   │ │ Clear
│       └─ +3 more requirements            │ │ purpose
│    ▶ Site Reconnaissance          [40%] │ │
│    ▶ Preliminary Site Model       [60%] │─┘
│    ▶ Documentation                [92%] │
│                                          │
│ 🔬 Stage 2: Detailed Investigation      │
│    Comprehensive sampling & testing      │
│    ▶ Sampling Program              [55%] │
│    ▶ Laboratory Analysis           [70%] │
│    ▶ Data Quality Assurance        [80%] │
│                                          │
│ ⚠️  Stage 3: Risk Assessment             │
│    Evaluate contamination impacts        │
│    ▶ Exposure Assessment           [30%] │
│    ▶ Toxicity Evaluation           [45%] │
│                                          │
│ 🛠️  Stage 4: Remediation Planning        │
│    Design cleanup strategy               │
│    ▶ Remedial Options              [0%]  │
│    ▶ Implementation Plan           [0%]  │
│                                          │
│ 📊 Cross-Cutting Standards               │
│    Requirements for all stages           │
│    ▶ Indigenous Consultation       [100%]│
│    ▶ Public Engagement             [75%] │
│                                          │
└──────────────────────────────────────────┘
```

**Key Improvements:**
- - Labeled inputs (visible labels + aria-labels)
- - Truncated labels reveal full text on hover/focus
- ✅ Workflow stages instead of sheet codes
- ✅ Plain language descriptions
- ✅ Progress percentages at each level
- ✅ Icons for visual scanning
- ✅ Status indicators inline
- ✅ Contextual "purpose" subtitles
- ✅ Better spacing and hierarchy

---

## Main Content Area Comparison

### BEFORE: Database Table View
```
+--------------------------------------------------------------------------------+
| CSAP ID | Section            | Tier | Status | Evidence | Confidence | ...     |
+--------------------------------------------------------------------------------+
| CSAP-01 | SITE HISTORY       | T1   | PASS   | 3       | HIGH       | ...     |
| CSAP-02 | SITE HISTORY       | T1   | PEND   | 1       | MEDIUM     | ...     |
| CSAP-03 | DOCUMENTATION ...  | T2   | FAIL   | 0       | LOW        | ...     |
| CSAP-04 | PRELIMINARY SITE...| T1   | PASS   | 5       | HIGH       | ...     |
| ... (150 more rows)                                                        |
+--------------------------------------------------------------------------------+
|                          Showing 1-25 of 180 items                          |
+--------------------------------------------------------------------------------+
```
**Problem:** Dense, overwhelming, requires horizontal scrolling, evidence sufficiency not prominent

**Note:** Use row virtualization for 50+ rows and tabular numerals for numeric columns.

### AFTER: Database Power View (Reviewer + AI)
```
+--------------------------------------------------------------------------------+
| CSAP ID | Section      | Tier | AI Status | Reviewer Suff. | Notes | Final |
+--------------------------------------------------------------------------------+
| CSAP-01 | SITE HISTORY | T1   | PASS      | Sufficient      | YES   | YES   |
| CSAP-02 | SITE HISTORY | T1   | NOT_FOUND | Needs More      |       |       |
| CSAP-03 | DOC & REPORT | T2   | FAIL      | Insufficient    | YES   | YES   |
+--------------------------------------------------------------------------------+
| Evidence preview: "Records indicate industrial use 1950-1975..." (Doc A, p.12) |
| [Open source (Doc A, p.12)]  [Review Evidence]  [Flag weak]                 |
+--------------------------------------------------------------------------------+
```
Accessibility notes: truncation reveal on focus, labeled controls, keyboard navigation across table + panel.

### AFTER: Executive Card View (Memo-first)
```
+--------------------------------------------------------------------------------+
| Evidence Sufficiency Coverage: 68%  ##########------ (123/180 reviewed)     |
| Sufficient: 85  Needs More: 38  Insufficient: 12  Unreviewed: 45            |
+--------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------+
| CSAP-01: Historical Land Use Research                                        |
| AI Proposed Status: PASS (badge)                                             |
| Evidence Sufficiency (Reviewer): [Sufficient v]                              |
| Requirement: Document all historical uses...                                 |
| Evidence: "Records indicate industrial use 1950-1975..."                     |
|   Doc A, p.12 | Method: semantic | Confidence: 0.92                           |
| [Review Evidence] [Open source (Doc A, p.12)]                                |
| Include in Final: [ON]                                                       |
| Final Memo summary: "Industrial use documented 1950-1975..."                 |
| Reviewer Notes: "Add context on zoning change in 1976."                      |
+--------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------+
| ... more cards                                                                |
+--------------------------------------------------------------------------------+
```
**Key Improvements:**
- Evidence Sufficiency is primary; AI Proposed Status is secondary
- Review Evidence + Open source actions are visible
- Include-in-FINAL toggle + Final Memo summary field
- Citations show doc + page in every evidence snippet
- Truncation reveal on focus/hover with full text access

Accessibility notes: visible labels, focus-visible, keyboard navigation across tree/table/cards.

### Memo Preview Panel (Interim vs Final)
```
+--------------------------------------------------------------------------------+
| Memo Preview                                                                   |
| - Interim Memo (internal, audit)                                               |
|   - Evidence list, per-requirement rationale                                   |
|   - IDs + policy citations + page references                                   |
|   [Generate Interim Memo]                                                     |
| - Final Memo (6-10 pages, decision-maker)                                      |
|   - Curated excerpts + reviewer summaries                                     |
|   - Reviewer Conclusions vs Engine Suggestions                                |
|   [Generate Final Memo]                                                       |
+--------------------------------------------------------------------------------+
```

## Color-Coded Workflow Stages

### Visual Legend

```
📋 STAGE 1: PRELIMINARY INVESTIGATION
   Color: Blue (#3B82F6)
   Purpose: Initial site review and risk screening

   ┌─────────────────────┐
   │ ■■■■■■■■░░░░░░ 60%  │  ← Progress bar in stage color
   │                     │
   │ • Site History      │
   │ • Reconnaissance    │
   │ • Prelim Model      │
   └─────────────────────┘

🔬 STAGE 2: DETAILED INVESTIGATION
   Color: Green (#10B981)
   Purpose: Comprehensive sampling and testing

   ┌─────────────────────┐
   │ ■■■■■■░░░░░░░░ 45%  │
   │                     │
   │ • Sampling Plan     │
   │ • Lab Analysis      │
   │ • Data QA/QC        │
   └─────────────────────┘

⚠️ STAGE 3: RISK ASSESSMENT
   Color: Orange (#F59E0B)
   Purpose: Evaluate contamination impacts

   ┌─────────────────────┐
   │ ■■■░░░░░░░░░░░ 22%  │
   │                     │
   │ • Exposure Path     │
   │ • Toxicity Review   │
   │ • Risk Calc         │
   └─────────────────────┘

🛠️ STAGE 4: REMEDIATION PLANNING
   Color: Purple (#8B5CF6)
   Purpose: Design cleanup strategy

   ┌─────────────────────┐
   │ ░░░░░░░░░░░░░░░ 0%  │
   │                     │
   │ • Options Analysis  │
   │ • Implementation    │
   │ • Monitoring        │
   └─────────────────────┘

📊 CROSS-CUTTING STANDARDS
   Color: Gray (#6B7280)
   Purpose: Requirements for all stages

   ┌─────────────────────┐
   │ ■■■■■■■■■■■░░ 85%   │
   │                     │
   │ • Indigenous Cons.  │
   │ • Public Engage.    │
   │ • Documentation     │
   └─────────────────────┘
```

### Stage Color Usage

**In Left Panel:**
- Stage header background: Light tint of stage color
- Stage icon: Full saturation stage color
- Child items: Inherit parent color at lower opacity

**In Main Cards:**
- Left border accent: Stage color
- Progress bars: Stage color fill
- Section badges: Stage color background

**Consistency:**
- Same item always shows same stage color across interface
- Color becomes a "spatial anchor" for users
- Reduces cognitive load - "green items are always Stage 2"

---

## Mobile Responsive Design

### Desktop (1920px+)
```
┌──────────────────────────────────────────────────────────┐
│ [Pyramid Nav - 320px] │ [Card Grid - 3 columns]         │
└──────────────────────────────────────────────────────────┘
```

### Tablet (768px - 1919px)
```
┌──────────────────────────────────────────────────────────┐
│ [Pyramid Nav - 280px] │ [Card Grid - 2 columns]         │
└──────────────────────────────────────────────────────────┘
```

### Mobile (< 768px)
```
┌────────────────────┐
│ [Hamburger Menu]   │  ← Pyramid nav in drawer
│ [Summary Stats]    │
│                    │
│ [Card Stack]       │  ← Single column
│ [Card]             │
│ [Card]             │
│ [Card]             │
└────────────────────┘
```

---

## Interactive Prototypes (Future)

### Planned Prototype Tools
- Figma for high-fidelity mockups
- InVision/Marvel for clickable prototypes
- User testing with:
  - 3 executives (non-technical)
  - 3 environmental professionals (technical)
  - 2 accessibility users (screen reader)

### Key Flows to Test
1. **Executive Demo:** "Show me the compliance status"
2. **Technical Review:** "Find all Tier 2 inadequate items"
3. **Keyboard Navigation:** Complete review without mouse
4. **Screen Reader:** Navigate and understand all content

---

## Implementation Notes

### Phase 1: Quick Win (1-2 weeks)
- Refactor left panel to pyramid structure
- Add plain language stage names
- Implement stage icons
- **Result:** Immediate improvement in demo clarity

### Phase 2: Visual Impact (2-3 weeks)
- Build card component
- Add summary statistics panel
- Implement view mode toggle
- **Result:** Executive-friendly presentation mode

### Phase 3: Polish (1-2 weeks)
- Accessibility audit and fixes
- Performance optimization
- User testing and refinement
- **Result:** Production-ready, WCAG 2.1 AA compliant

---

**Document Version:** 1.0
**Created:** January 27, 2026
**Status:** Visual Reference for Implementation
**Related:** See REGULATORY_REVIEW_UX_PROPOSAL.md for full specifications
