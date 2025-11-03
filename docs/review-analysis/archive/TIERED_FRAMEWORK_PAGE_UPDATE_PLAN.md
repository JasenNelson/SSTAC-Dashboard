# Tiered Framework Page Update Plan

**IMPLEMENTATION STATUS:** ✅ **COMPLETED** (January 2025)

## Overview
Update the `survey-results/tiered-framework` page to align with the revised CEW presentation content. Remove fabricated statistics and outdated framework structure, replacing with accurate survey insights and the simplified three-tier framework.

---

## Issues to Address

### 1. **Remove Fabricated Statistics**
- **Location**: Lines 136-141, 151-154, 388-401
- **Issue**: Contains made-up percentages that don't reflect actual survey data
- **Action**: Remove all fabricated statistics, keep only verified data from presentation

### 2. **Outdated Framework Structure**
- **Current**: Shows Tier 1, Tier 2a, Tier 2b, Tier 3 (4-tier system with accordions)
- **Revised**: Simple 3-tier structure (Tier 1, Tier 2, Tier 3) as per presentation
- **Action**: Replace entire framework section with correct structure

### 3. **Incorrect Content Section**
- **Location**: "From Single-Threshold to Tiered Assessment" section (lines 113-159)
- **Issue**: Contains outdated challenge/solution approach with fabricated stats
- **Action**: Replace with revised presentation content structure

### 4. **Section Order**
- **Current**: Hero → Framework Overview → Tiered Framework Components → Survey Findings → Polls → Next Steps
- **Revised**: Hero → What We Heard: Survey Insights → Proposed Tiered Framework → Polls → Next Steps

---

## Content Mapping from Revised Presentation

### Source Material (`Tiered Framework page.txt`):

#### Key Statistics (VERIFIED - Keep):
- **86.4%** - Tiered Framework Beneficial for Future Sediment Standards Framework
- **88.1%** - Importance of Bioavailability Adjustments for Future Sediment Standards Framework

#### Why Expand the Tiered Framework Section:
1. **Current Limitations of Generic Sediment Standards:**
   - High uncertainty
   - Conservative or underprotective

2. **Proposed Site-Specific Sediment Standards:**
   - Reduced uncertainty
   - Streamlined remediation

3. **Enhanced Protection:**
   - Improved decision-making and environmental outcomes
   - Effective resource allocation

#### Three-Tier Framework Structure:
1. **Tier 1: Matrix Sediment Standards**
   - Assumes generic site conditions

2. **Tier 2: Site-Specific Sediment Standards**
   - Bioavailability-adjusted using Equilibrium Partitioning (EqP) and/or Biotic Ligand Model (BLM)

3. **Tier 3: Risk-Based Standards**
   - Site-specific risk assessment

**Note**: Presentation showed a pyramid graphic illustrating the tiered concept

---

## Proposed Page Structure

### 1. **Hero/Header Section** (Keep, minor adjustments)
- Title: "Tiered Assessment Framework" or "Tiered Framework with Site-Specific Sediment Standards"
- Description: Update to align with revised messaging
- Background image: Keep existing

### 2. **What We Heard: Survey Insights** (NEW - Move Up, Replace Old Content)
- **Section Title**: "What We Heard: Survey Insights"
- **Key Survey Findings Box**:
  - ✅ 86.4% - Tiered Framework Beneficial for Future Sediment Standards Framework
  - ✅ 88.1% - Importance of Bioavailability Adjustments for Future Sediment Standards Framework
  - **Note**: Include placeholders for pie chart graphs as mentioned in presentation
- **Remove**: All fabricated statistics about concerns, complexity, etc.
- **Keep**: Only verified statistics from the presentation

### 3. **Why Expand the Tiered Framework?** (NEW Section)
- **Current Limitations of Generic Sediment Standards:**
  - High uncertainty
  - Conservative or underprotective

- **Proposed Site-Specific Sediment Standards:**
  - Reduced uncertainty
  - Streamlined remediation

- **Enhanced Protection:**
  - Improved decision-making and environmental outcomes
  - Effective resource allocation

**Design**: Use card-based layout similar to prioritization page, with consistent color scheme

### 4. **Proposed Three-Tier Framework** (Replace Entire Section)
- **Remove**: Current accordion-based 4-tier structure (Tier 1, Tier 2a, Tier 2b, Tier 3)
- **Replace with**: Simple 3-tier structure as per revised presentation

#### Visual Layout:
- **Option A**: Pyramid/Visual representation (as mentioned in presentation notes)
- **Option B**: Three cards in a row showing:
  - **Tier 1: Matrix Sediment Standards**
    - Description: Assumes generic site conditions
  - **Tier 2: Site-Specific Sediment Standards**
    - Description: Bioavailability-adjusted using Equilibrium Partitioning (EqP) and/or Biotic Ligand Model (BLM)
  - **Tier 3: Risk-Based Standards**
    - Description: Site-specific risk assessment

**Design**: Match color scheme used in prioritization page (colored containers with consistent styling)

### 5. **Interactive Polls Section** (Keep)
- Current polls remain unchanged (they are technical questions about Tier 2 implementation)
- **Title**: Update to "Your Input on Tiered Assessment" (keep current)
- **Note**: These polls focus on Tier 2 probabilistic framework, which aligns with the revised Tier 2 description

### 6. **Next Steps Section** (Keep, minor updates)
- Update content to reflect simplified 3-tier framework approach
- Remove references to outdated tier structure

---

## Detailed Code Changes

### Section 1: Remove Fabricated Statistics
**File**: `src/app/(dashboard)/survey-results/tiered-framework/TieredFrameworkClient.tsx`

**Remove lines 133-158** (Framework Overview Section with fake stats):
```tsx
{/* Framework Overview Section */}
<section className="py-20 px-6 bg-white dark:bg-gray-800">
  {/* Card 2: Survey Findings - Site-Specific Bioavailability */}
  {/* Contains: 89%, 76% - FABRICATED */}
  {/* Card 3: Survey Findings - Tiered Options */}
  {/* Contains: 82%, 71%, 68% - FABRICATED */}
</section>
```

**Remove lines 386-403** (Fabricated concerns statistics):
```tsx
{/* Contains: 73%, 67%, 81%, 69% - FABRICATED */}
```

### Section 2: Replace "Framework Overview" with "What We Heard"
**Location**: After Hero section, before framework details

**New Content**:
- Move "What We Heard" section up (currently lines 355-407)
- Keep only verified statistics (86.4%, 88.1%)
- Remove all fabricated concerns/statistics
- Update section title to "What We Heard: Survey Insights" (matching prioritization page)

### Section 3: Add "Why Expand the Tiered Framework?" Section
**Location**: After "What We Heard", before framework structure

**New Section**:
- Use card-based layout similar to prioritization page
- Three cards:
  1. Current Limitations (Red/orange theme)
  2. Proposed Benefits (Green/blue theme)
  3. Enhanced Protection (Blue/purple theme)

### Section 4: Replace Tiered Framework Structure
**Location**: Lines 162-352 (entire "Tiered Framework Components Section")

**Remove**: 
- All accordion components
- Tier 2a and Tier 2b (old 4-tier structure)
- Detailed purpose/approach/when to use sections

**Replace with**:
- Simple 3-tier framework visualization
- Clean card-based layout matching prioritization page style
- Three tiers clearly labeled and described
- Visual pyramid representation (if possible/available) or styled tier cards

### Section 5: Update Section Spacing
- Consistent `py-12` padding (matching prioritization page)
- Remove inconsistent large white spaces

---

## Design Consistency

### Color Scheme
- Match prioritization page approach:
  - White/dark gray outer containers
  - Subtly colored inner boxes (green-50, blue-50, purple-50, orange-50)
  - Dark text on light backgrounds for readability

### Typography
- Consistent heading sizes and fonts
- Match prioritization page typography

### Layout
- Consistent spacing (`py-12` for sections)
- Card-based layouts for key information
- Grid layouts for multi-column content

---

## Content Accuracy Checklist

- [ ] Remove all fabricated statistics (89%, 76%, 82%, 71%, 68%, 73%, 67%, 81%, 69%)
- [ ] Keep only verified statistics (86.4%, 88.1%)
- [ ] Replace 4-tier structure (Tier 1, 2a, 2b, 3) with 3-tier structure (Tier 1, 2, 3)
- [ ] Update tier descriptions to match revised presentation
- [ ] Add "Why Expand" section with correct content
- [ ] Move "What We Heard" section to appear early in page
- [ ] Update section titles to match other survey-results pages
- [ ] Add note about pyramid graphic if available
- [ ] Ensure consistency with prioritization page design patterns

---

## Files to Modify

1. **`src/app/(dashboard)/survey-results/tiered-framework/TieredFrameworkClient.tsx`**
   - Primary file for all content updates
   - Remove fabricated statistics
   - Replace framework structure
   - Reorganize sections
   - Update styling for consistency

---

## Implementation Order

1. **Step 1**: Remove fabricated statistics from "Framework Overview" section (lines 133-158)
2. **Step 2**: Create new "What We Heard: Survey Insights" section with only verified stats (move up, clean up)
3. **Step 3**: Add "Why Expand the Tiered Framework?" section with three cards
4. **Step 4**: Replace entire tiered framework components section with simplified 3-tier structure
5. **Step 5**: Update section spacing and styling for consistency
6. **Step 6**: Review and verify all statistics are accurate

---

## Notes

- **Pie Charts**: Presentation mentions "[insert pie chart graphs for above statistics]" - consider adding visual charts for 86.4% and 88.1% statistics if charts are available
- **Pyramid Graphic**: Presentation notes mention a pyramid graphic illustrating the tiered concept - if available, incorporate into the tier visualization
- **Polls**: Current polls about Tier 2 probabilistic framework are still relevant and should remain unchanged
- **Consistency**: Follow the design patterns established in the prioritization page for visual consistency across survey-results pages

---

## Questions to Clarify

1. Are pie chart graphics available for the 86.4% and 88.1% statistics?
2. Is a pyramid graphic available for the tiered framework visualization?
3. Should the tier descriptions be expanded beyond the brief presentation text, or kept concise?
4. Any additional content from the CEW presentation that should be included?

