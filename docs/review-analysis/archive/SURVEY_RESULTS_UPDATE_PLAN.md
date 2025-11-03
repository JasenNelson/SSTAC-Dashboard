# Survey Results Pages Update Plan
## Aligning Pages with Revised Presentations

**IMPLEMENTATION STATUS:** ✅ **COMPLETED** (January 2025)  
**Date:** Current  
**Purpose:** This document outlines the plan for reviewing revised presentation PDFs and updating the corresponding survey-results pages to align with the updated content.

---

## Overview

The survey-results pages were originally developed based on draft presentations for each theme. These presentations have been revised, and we need to update the pages to reflect the new material. The main presentation file "Holistic-Protection-of-Aquatic-Ecosystems-Developing-a-Scientific-Framework-to-Modernize-Sediment-St (5).pdf" contains information for the entire project and may inform updates to other dashboard pages as well.

---

## Current Pages Structure

### Pages Under Review:

1. **Holistic Protection** (`/survey-results/holistic-protection`)
   - **File:** `src/app/(dashboard)/survey-results/holistic-protection/HolisticProtectionClient.tsx`
   - **Current Focus:** Matrix Sediment Standards Framework
   - **Key Sections:**
     - Hero/Header Section
     - Framework Overview (3 cards: Challenge, Solution, Benefits)
     - Matrix Framework Components (2x2 matrix: SedS-directECO, SedS-directHH, SedS-foodECO, SedS-foodHH)
     - Survey Findings Section
     - Interactive Polls Section (8 questions: importance/feasibility pairs)
     - Next Steps Section

2. **Prioritization** (`/survey-results/prioritization`)
   - **File:** `src/app/(dashboard)/survey-results/prioritization/PrioritizationClient.tsx`
   - **Current Focus:** Collaborative Strategic Planning
   - **Key Sections:**
     - Hero/Header Section
     - Framework Overview (3 cards: Challenge, Solution, Benefits)
     - Prioritization Framework Components (Accordions: Legacy Contaminants, Emerging Contaminants, Prioritization Criteria)
     - Survey Findings Section
     - Interactive Polls Section (5 questions: 2 single-choice, 2 ranking, 1 wordcloud)
     - Next Steps Section

3. **Tiered Framework** (`/survey-results/tiered-framework`)
   - **File:** `src/app/(dashboard)/survey-results/tiered-framework/TieredFrameworkClient.tsx`
   - **Current Focus:** Site-Specific Sediment Standards
   - **Key Sections:**
     - Hero/Header Section
     - Framework Overview (3 cards: Challenge, Survey Findings)
     - Three-Tier Assessment Framework (Accordions: Tier 1, Tier 2a, Tier 2b, Tier 3)
     - Survey Findings Section
     - Interactive Polls Section (3 questions: all single-choice)
     - Next Steps Section

---

## Reference Materials Available

### PDF Presentations (Need Text Extraction):
1. **Defining-Holistic-Protection (1).pdf** → Maps to: Holistic Protection page
2. **Prio-Modernizing-BCs-Sediment-Standards (2).pdf** → Maps to: Prioritization page
3. **Tiered-Framework (1).pdf** → Maps to: Tiered Framework page
4. **Holistic-Protection-of-Aquatic-Ecosystems-Developing-a-Scientific-Framework-to-Modernize-Sediment-St (5).pdf** → Overall project presentation (may inform dashboard landing page and other pages)

### Markdown Documents (Already Accessible):
- `Modernizing BC Sediment Quality Standards v2.5.md` - Comprehensive technical document
- `Draft Sediment Standards Review_ What We Heard.md` - Survey feedback summary

---

## Proposed Update Process

### Phase 1: Content Extraction and Analysis

**Step 1: Extract Text from PDF Presentations**
- Extract text content from each PDF presentation
- Identify key sections, headings, bullet points, and statistics
- Note any new terminology, frameworks, or concepts introduced
- Capture any visual/diagram descriptions or key figures

**Step 2: Content Mapping**
- Map extracted content to corresponding page sections:
  - **Hero/Header Section** → Title, subtitle, quote/description
  - **Framework Overview Cards** → Challenge, Solution, Benefits
  - **Framework Components** → Detailed accordions, matrix elements
  - **Survey Findings** → Statistics, percentages, key themes
  - **Next Steps** → Immediate actions, long-term development

**Step 3: Gap Analysis**
- Compare current page content with revised presentation content
- Identify:
  - **New content** to add
  - **Updated content** to modify
  - **Outdated content** to remove
  - **Terminology changes** to reflect
  - **Statistical updates** (new survey results, percentages)
  - **Structural changes** (new sections, reorganized content)

### Phase 2: Content Updates by Page

#### **1. Holistic Protection Page Updates**

**Areas to Review:**

**A. Hero Section (Lines 154-169)**
- Current title: "Matrix Sediment Standards Framework"
- Current subtitle: "Holistic Protection for Aquatic Ecosystems"
- Current quote: Generic description
- **Action:** Check if title/subtitle/quote need updating based on revised presentation

**B. Framework Overview Cards (Lines 179-216)**
- **Card 1 - Challenge:** Current description of single-threshold limitations
- **Card 2 - Solution:** Current description of Matrix Framework
- **Card 3 - Benefits:** Current description of four standards
- **Action:** Verify if challenge statements, solution approach, or benefits have been refined

**C. Matrix Framework Components (Lines 220-517)**
- **2x2 Matrix Structure:**
  - SedS-directECO (Ecological Direct Exposure)
  - SedS-directHH (Human Health Direct Exposure)
  - SedS-foodECO (Ecological Food Web)
  - SedS-foodHH (Human Food Web)
- **Detailed Accordion Panels:** Purpose, Derivation Method, Protection Focus for each
- **Action:** 
  - Check if matrix structure remains the same
  - Verify terminology (e.g., "SedS" abbreviation usage)
  - Update descriptions if derivation methods or protection focuses have changed
  - Check for new technical terms or concepts

**D. Survey Findings Section (Lines 519-572)**
- Current statistics:
  - 87% support comprehensive ecosystem protection
  - 92% recognize protection gaps
  - 78% emphasize site-specific flexibility
  - 85% identify food web gaps
  - 65% express complexity concerns
  - 71% highlight need for guidance
  - 58% request training
  - 82% emphasize case studies
- **Action:** Update with any new survey statistics from revised presentations

**E. Poll Questions (Lines 16-105)**
- 8 questions total (4 importance/feasibility pairs)
- **Action:** Verify if questions remain the same or if wording needs updates

**F. Next Steps Section (Lines 621-659)**
- Current text on immediate actions and long-term development
- **Action:** Update if revised presentation has new implementation timelines or priorities

---

#### **2. Prioritization Page Updates**

**Areas to Review:**

**A. Hero Section (Lines 125-140)**
- Current title: "Prioritization Framework"
- Current subtitle: "Collaborative Strategic Planning for Sediment Standards Modernization"
- **Action:** Check for updated title/subtitle/quote

**B. Framework Overview Cards (Lines 149-186)**
- Challenge: Multiple modernization approaches
- Solution: Collaborative Framework
- Benefits: Strategic Implementation
- **Action:** Verify if approach or emphasis has changed

**C. Prioritization Framework Components (Lines 189-323)**
- **Accordion 1:** Legacy Contaminants Priority
- **Accordion 2:** Emerging Contaminants Strategy
- **Accordion 3:** Prioritization Criteria
- **Action:** 
  - Check if list of emerging contaminants has changed
  - Verify prioritization criteria remain the same
  - Update examples or approaches if revised

**D. Survey Findings Section (Lines 325-378)**
- Current generic findings (no specific percentages)
- **Action:** Add specific statistics if available in revised presentation

**E. Poll Questions (Lines 25-87)**
- Q1-Q2: Single-choice (bioavailability)
- Q3-Q4: Ranking polls
- Q5: Wordcloud poll (constraints)
- **Action:** Verify question wording and options

**F. Next Steps Section (Lines 466-504)**
- Current focus on prioritization criteria and phased implementation
- **Action:** Update if new priorities or timelines identified

---

#### **3. Tiered Framework Page Updates**

**Areas to Review:**

**A. Hero Section (Lines 94-109)**
- Current title: "Tiered Assessment Framework"
- Current subtitle: "Site-Specific Sediment Standards"
- **Action:** Check for updated title/subtitle/quote

**B. Framework Overview Cards (Lines 119-158)**
- Challenge: Bright-line standards limitations
- Site-Specific Bioavailability: 89% support, 76% emphasize data needs
- Tiered Assessment Options: 82% support decision trees, 71% want flexibility
- **Action:** 
  - Verify if statistics need updating
  - Check if challenge statements have evolved

**C. Three-Tier Framework (Lines 163-352)**
- **Tier 1:** Screening Level Numerical Assessment
- **Tier 2a:** Refined Numerical Assessment
- **Tier 2b:** Screening-Level Risk-Based Assessment
- **Tier 3:** Detailed Risk-Based Assessment
- **Action:** 
  - Verify tier descriptions, purposes, and approaches
  - Check if tier naming or structure has changed
  - Update technical details if derivation methods evolved

**D. Survey Findings Section (Lines 354-407)**
- Current statistics:
  - 86.4% found tiered framework beneficial
  - 88.1% felt bioavailability adjustments important
  - 73% complexity concerns
  - 67% need for protocols
  - 81% request guidance
  - 69% emphasize training
- **Action:** Update with any new survey statistics

**E. Poll Questions (Lines 16-53)**
- 3 single-choice questions on probabilistic/Bayesian frameworks
- **Action:** Verify question wording remains accurate

**F. Next Steps Section (Lines 441-479)**
- Current focus on tier escalation criteria and bioavailability protocols
- **Action:** Update if implementation approach has changed

---

### Phase 3: Additional Pages to Consider

**Dashboard Landing Page** (`src/app/(dashboard)/dashboard/page.tsx`)
- Review overall project description
- Update if project scope, objectives, or timeline has changed
- Check project phases if mentioned

**Survey Results Main Page** (`src/app/(dashboard)/survey-results/page.tsx`)
- Review theme descriptions and card content
- Update if theme names or descriptions have changed

---

## Specific Elements to Check for Changes

### Terminology Updates:
- Check for consistent use of abbreviations (SedS, CSR, etc.)
- Verify technical term definitions
- Update acronym usage if changed

### Statistical Updates:
- All percentage values in "What We Heard" sections
- Survey response counts
- Poll result references

### Structural Changes:
- New sections or subsections
- Reorganized content flow
- Added or removed framework components

### Visual/Design Elements:
- Diagram descriptions
- Matrix structure changes
- New icons or imagery concepts

### Poll Questions:
- Question wording accuracy
- Option text updates
- Question numbering if structure changed

---

## Implementation Steps

### Step 1: Extract PDF Content
**Option A:** Use a PDF text extraction tool or command:
```bash
# If pdftotext is available:
pdftotext "reference materials/Defining-Holistic-Protection (1).pdf" - | head -200

# Or use Python with PyPDF2/pdfplumber:
python -c "import PyPDF2; ..."
```

**Option B:** Manual review - Read PDFs and extract key content to a temporary markdown file

### Step 2: Create Comparison Document
For each page, create a side-by-side comparison:
- Left column: Current page content
- Right column: Revised presentation content
- Middle column: Changes needed

### Step 3: Update Pages Systematically
- Start with Holistic Protection page
- Then Prioritization page
- Then Tiered Framework page
- Finally, review dashboard landing page

### Step 4: Verify Consistency
- Ensure terminology is consistent across all pages
- Check that statistics match across references
- Verify poll questions align with presentation content
- Confirm navigation and links remain functional

---

## Questions to Answer from Revised Presentations

1. **Holistic Protection:**
   - Has the matrix structure (2x2) changed?
   - Are the four standards still the same (SedS-directECO, etc.)?
   - Have derivation methods been updated?
   - Are there new technical concepts to include?

2. **Prioritization:**
   - Has the list of emerging contaminants changed?
   - Are prioritization criteria still the same?
   - Has the framework approach evolved?

3. **Tiered Framework:**
   - Are the four tiers still accurately described?
   - Has the tier naming changed?
   - Are there new approaches or methods to include?
   - Has the probabilistic/Bayesian framework description changed?

4. **Overall:**
   - Have any key project objectives changed?
   - Are there new themes or concepts not yet covered?
   - Have survey statistics been updated with final results?

---

## Next Actions

1. **Extract text from PDF files** - Use appropriate tool or manual extraction
2. **Create content comparison documents** - For each presentation-to-page mapping
3. **Identify specific changes** - List all additions, modifications, and deletions needed
4. **Propose specific edits** - Show exact text changes for review
5. **Implement updates** - Make changes to page files after approval

---

## Notes

- The markdown document "Modernizing BC Sediment Quality Standards v2.5.md" provides comprehensive technical context and should be referenced for terminology and concepts
- The "What We Heard" markdown provides survey feedback that may inform survey findings sections
- Poll questions should remain consistent with what's in the database unless explicitly changed
- Maintain existing page structure and styling unless presentation suggests major restructuring

---

## Output Deliverables

After completing the review, this plan will be updated with:

1. **Detailed Change Log** - Specific line-by-line changes for each page
2. **Content Comparison Tables** - Side-by-side current vs. revised content
3. **Proposed Updates** - Specific text replacements and additions
4. **Implementation Checklist** - Step-by-step update tasks

---

**Status:** Awaiting PDF content extraction and comparison

