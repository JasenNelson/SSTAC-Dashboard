# Prioritization Page Update Plan
## Aligning with Revised Presentation Content

**Date:** Current  
**File:** `src/app/(dashboard)/survey-results/prioritization/PrioritizationClient.tsx`  
**Section to Update:** "Framework Components & Research Priorities" (Lines 189-323)

---

## Current State Analysis

### Current "Framework Components & Research Priorities" Section
**Location:** Lines 189-323  
**Structure:** Three accordion containers:
1. Legacy Contaminants Priority (Lines 197-235)
2. Emerging Contaminants Strategy (Lines 237-276)
3. Prioritization Criteria (Lines 278-320)

**Issue:** This content does NOT match the revised presentation. The current accordions focus narrowly on prioritization criteria and contaminant categories, whereas the revised presentation provides a comprehensive overview of the entire modernization framework.

---

## Revised Content Structure

Based on `Prioritization Framework page.txt`, the new section should include:

### 1. **Why Modernize BC's Sediment Standards?** (4 reasons)
- Evolving Scientific Understanding
- Non-scheduled & Emerging Contaminants
- Site-Specific & Risk-Based Approaches
- Ecosystem Protection

### 2. **Key Areas for Modernizing the Sediment Standards Framework** (4 areas)
- Matrix Sediment Standards
- Tiered, Site-Specific Sediment Standards
- Emerging Contaminants / Mixtures
- Harnessing Available Knowledge

### 3. **Matrix Sediment Standards (SedS) Framework**
- **Direct Toxicity (SedS-direct):**
  - SedS-directECO
  - SedS-directHH
- **Food Pathway Toxicity (SedS-food):**
  - SedS-foodECO
  - SedS-foodHH
- **Visual:** Include the Matrix Graph.jpg image showing the 2x2 matrix

### 4. **Expanding the Tiered Framework**
- Tier 1: Matrix Sediment Standards
- Tier 2: Site-Specific Sediment Standards
- Tier 3: Risk-Based Standards

### 5. **Emerging Contaminants & Mixtures**
- Non-scheduled Substances
- Complex Mixtures
- Adaptive Frameworks
- Proactive Hazard Identification

### 6. **Data Gap, Feasibility & Prioritization Framework**
- Address Information Gaps
- Acknowledge Feasibility
- Prioritization approach
- Goal statement

---

## Proposed Update Structure

### Section Title Change
**From:** "Framework Components & Research Priorities"  
**To:** "Modernizing BC's Sediment Standards Framework"

### New Layout Approach

**Option A: Multi-Section Approach (Recommended)**
Replace the single section with multiple well-organized sections:

1. **Why Modernize Section** - Hero-style introduction with 4 reason cards
2. **Key Areas Section** - Grid of 4 modernization areas
3. **Matrix Standards Section** - Feature the matrix graph prominently
4. **Tiered Framework Overview** - Brief overview (detailed info on tiered-framework page)
5. **Emerging Contaminants Section** - Key points about new challenges
6. **Prioritization Framework Section** - Data gaps, feasibility, and prioritization approach

**Option B: Accordion-Based Approach**
Keep accordions but restructure content:
- Accordion 1: Why Modernize & Key Areas
- Accordion 2: Matrix Sediment Standards Framework (with image)
- Accordion 3: Tiered Framework Overview
- Accordion 4: Emerging Contaminants & Mixtures
- Accordion 5: Data Gap, Feasibility & Prioritization Framework

**Recommendation:** Use **Option A** (multi-section) for better visual hierarchy and to give proper prominence to the matrix graph.

---

## Detailed Content Mapping

### Section 1: Why Modernize BC's Sediment Standards?
**Location:** After "Framework Overview" section  
**Design:** 4-card grid (similar to current Framework Overview cards)  
**Content:**
- Card 1: Evolving Scientific Understanding
- Card 2: Non-scheduled & Emerging Contaminants  
- Card 3: Site-Specific & Risk-Based Approaches
- Card 4: Ecosystem Protection

### Section 2: Key Areas for Modernizing
**Design:** 4-card grid or feature boxes  
**Content:**
- Matrix Sediment Standards
- Tiered, Site-Specific Sediment Standards
- Emerging Contaminants / Mixtures
- Harnessing Available Knowledge (with sub-bullets)

### Section 3: Matrix Sediment Standards Framework
**Design:** Feature section with matrix graph image prominently displayed  
**Image:** `Matrix Graph.jpg` - needs to be added to `/public` folder  
**Content:**
- Introduction to Matrix Framework
- Display the matrix graph (center, large size)
- Breakdown of 4 standards:
  - Direct Toxicity section:
    - SedS-directECO description
    - SedS-directHH description
  - Food Pathway Toxicity section:
    - SedS-foodECO description
    - SedS-foodHH description
- **Note:** This section should link/reference the holistic-protection page for more details

### Section 4: Expanding the Tiered Framework
**Design:** Brief overview section (3-tier summary)  
**Content:**
- Tier 1: Matrix Sediment Standards ('Safe' for any location)
- Tier 2: Site-Specific Sediment Standards (Bioavailability-adjusted)
- Tier 3: Risk-Based Standards (Protocol 1)
- **Note:** Brief overview - detailed info is on tiered-framework page

### Section 5: Emerging Contaminants & Mixtures
**Design:** Feature box or card with bullet points  
**Content:**
- Introduction paragraph
- 4 key points:
  - Non-scheduled Substances
  - Complex Mixtures
  - Adaptive Frameworks
  - Proactive Hazard Identification

### Section 6: Data Gap, Feasibility & Prioritization Framework
**Design:** Feature section with structured content  
**Content:**
- Address Information Gaps (with sub-points)
- Acknowledge Feasibility (paragraph)
- Prioritization approach (paragraph)
- Goal statement (highlighted)

---

## Implementation Steps

### Step 1: Prepare Assets
- [ ] Copy `Matrix Graph.jpg` to `/public` folder (or appropriate location)
- [ ] Verify image displays correctly
- [ ] Optimize image if needed

### Step 2: Replace Section Content
- [ ] Remove current "Framework Components & Research Priorities" section (Lines 189-323)
- [ ] Create new "Why Modernize" section
- [ ] Create new "Key Areas" section
- [ ] Create new "Matrix Standards" section with image
- [ ] Create new "Tiered Framework Overview" section
- [ ] Create new "Emerging Contaminants" section
- [ ] Create new "Prioritization Framework" section

### Step 3: Update Styling
- [ ] Ensure consistent styling with rest of page
- [ ] Maintain responsive design (mobile/tablet/desktop)
- [ ] Match color scheme (orange/yellow theme from current page)
- [ ] Ensure dark mode compatibility

### Step 4: Verify Other Sections
- [ ] Keep Hero/Header section (Lines 96-140) - verify alignment
- [ ] Keep Framework Overview section (Lines 143-187) - verify it still makes sense with new content
- [ ] Keep Survey Findings section (Lines 325-378) - may need minor updates
- [ ] Keep Interactive Polls section (Lines 380-463) - should remain unchanged
- [ ] Keep Next Steps section (Lines 465-504) - verify alignment with new content

### Step 5: Cross-References
- [ ] Add link to holistic-protection page from Matrix Standards section
- [ ] Add link to tiered-framework page from Tiered Framework section
- [ ] Ensure navigation flow makes sense

---

## Specific Code Changes

### File: `src/app/(dashboard)/survey-results/prioritization/PrioritizationClient.tsx`

#### Delete (Lines 189-323):
```typescript
{/* Prioritization Framework Section */}
<section className="py-20 px-6 bg-white/80 dark:bg-gray-800 backdrop-blur-sm">
  <div className="max-w-6xl mx-auto">
    <h2 className="text-4xl md:text-5xl font-bold text-center mb-16...">
      Framework Components & Research Priorities
    </h2>
    
    {/* All three accordions */}
    ...
  </div>
</section>
```

#### Add: New comprehensive sections (see detailed structure above)

**Key implementation notes:**
- Use existing component patterns (cards, grids, accordions if needed)
- Maintain consistent spacing (`py-20 px-6`)
- Use existing color scheme (orange/yellow for prioritization theme)
- Image component: Use Next.js `Image` component for Matrix Graph.jpg
- Keep accordion functionality if using Option B, or use expandable cards

---

## Content Verification Checklist

After implementation, verify:

- [ ] All 4 "Why Modernize" reasons are clearly presented
- [ ] All 4 "Key Areas" are listed with descriptions
- [ ] Matrix graph image displays correctly and is prominent
- [ ] All 4 Matrix standards (SedS-directECO, SedS-directHH, SedS-foodECO, SedS-foodHH) are described
- [ ] Tiered Framework overview mentions all 3 tiers
- [ ] Emerging Contaminants section includes all 4 key points
- [ ] Prioritization Framework section includes all components (Information Gaps, Feasibility, Prioritization, Goal)
- [ ] Content matches revised presentation exactly
- [ ] No references to "Legacy Contaminants Priority" or old accordion content
- [ ] Poll questions remain unchanged and functional
- [ ] Survey Findings section still makes sense in context

---

## Design Considerations

### Visual Hierarchy
- Matrix graph should be **prominent** - consider full-width or large centered display
- Use cards/grids for "Why Modernize" and "Key Areas" for visual consistency
- Consider using icons or visual elements to break up text-heavy sections

### Responsive Design
- Matrix graph must scale well on mobile
- Grid layouts should stack appropriately on smaller screens
- Text should remain readable at all breakpoints

### Accessibility
- Alt text for matrix graph image
- Proper heading hierarchy (h2, h3, h4)
- Keyboard navigation if using interactive elements
- Color contrast compliance

## UI/UX Color Scheme (Consistent for Light & Dark Modes)

### Color Strategy:
1. **"Why Modernize" Section Cards:**
   - Light Mode: Solid gradient backgrounds (from-500 to-600) with white text
   - Dark Mode: Darker gradients (from-900 to-800) with white text
   - Colors: Blue, Purple, Green, Orange (matching theme)

2. **"Key Areas" Section Cards:**
   - Light Mode: Subtle gradient backgrounds (500/10 opacity) with colored borders (300)
   - Dark Mode: Darker gradients (900/30 opacity) with colored borders (700)
   - Colors: Blue, Green, Purple, Orange (matching "Why Modernize")
   - Text remains dark in light mode, white in dark mode

3. **Consistency Across Page:**
   - Orange/Yellow theme for prioritization page maintained
   - Gradient backgrounds use consistent color families
   - Borders and shadows create visual hierarchy
   - All sections respect light/dark mode preferences

---

## Content Accuracy Notes

### Matrix Standards Descriptions
From the text file:
- **SedS-directECO:** "Protect aquatic organisms from direct exposure from contaminants in sediment"
- **SedS-directHH:** "Protects people from direct contact risks (e.g.,incidental ingestion, dermal contact) during recreational or cultural activities"
- **SedS-foodECO:** "Protects piscivorous wildlife (e.g., otters, eagles, orcas) from the bioaccumulation and biomagnification of contaminants through the food chain"
- **SedS-foodHH:** "Protects human consumers of fish, shellfish, and other aquatic foods"

### Tiered Framework
From the text file (reverse order):
- **Tier 1:** "Matrix Sediment Standards: 'Safe' for any location due to conservative assumptions"
- **Tier 2:** "Site-Specific Sediment Standards: Bioavailability-adjusted and protective for site conditions"
- **Tier 3:** "Risk-Based Standards: Protective for site conditions in accordance with Protocol 1"

---

## Next Steps After Implementation

1. Review updated page in browser (all breakpoints)
2. Verify image loads correctly
3. Test all interactive elements (if any)
4. Check cross-references/links work
5. Review content accuracy against revised presentation
6. Test with dark mode
7. Verify poll questions still function correctly

---

## Questions to Resolve

1. **Image location:** Where should Matrix Graph.jpg be placed? `/public/matrix-graph.jpg`?
2. **Matrix section detail level:** Should this be a brief overview (linking to holistic-protection page) or include full details?
3. **Tiered Framework detail level:** Brief overview (linking to tiered-framework page) or more detail?
4. **Interactive elements:** Use accordions, tabs, or static content with good visual hierarchy?
5. **Section ordering:** Is the order in the text file the desired display order?

---

**Status:** Ready for implementation after resolving questions above

