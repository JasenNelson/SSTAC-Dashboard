# Markdown Documentation Update Plan
## Based on Recent Survey-Results Pages & Menu Structure Changes

**Date:** Current  
**Last Git Commit:** Update survey-results pages with revised content, fix UI/UX for light/dark modes, update menu structure

---

## Summary of Recent Changes

### **1. Survey-Results Pages Content Updates** ✅ COMPLETED
- **Holistic Protection Page**: Updated with revised presentation content, reordered sections, fixed UI/UX for light/dark modes
- **Prioritization Page**: Completely restructured based on revised presentation, added matrix graph image, fixed color schemes
- **Tiered Framework Page**: Removed outdated content and fabricated statistics, implemented new tiered framework structure

### **2. Menu Structure Changes** ✅ COMPLETED
- **WIKS Menu Item**: Moved under "Prioritization Framework" in Core Themes category
- **WIKS Renamed**: Changed from "Indigenous Knowledge & Science" to "Weaving Indigenous Knowledges & Science"
- **CEW 2025 Page**: Updated menu references to match new structure

### **3. UI/UX Improvements** ✅ COMPLETED
- **Light/Dark Mode Fixes**: Fixed text color issues across all survey-results pages
- **Consistent Color Schemes**: Applied consistent container coloring throughout pages
- **Section Reordering**: Moved "What We Heard" sections to appropriate positions

### **4. Reference Materials Added** ✅ COMPLETED
- Added revised content files in `reference materials/` folder
- Added `matrix-graph.jpg` image for prioritization page

---

## Files Requiring Updates

### **Priority 1: High Impact Documentation**

#### **1. README.md** ⚠️ NEEDS UPDATE
**Location:** Root directory  
**Status:** Current  
**Updates Needed:**

**Section: "Recent Major Updates" (Lines 54-128)**
- [ ] Add new entry for "Survey-Results Pages Content Update" ✅ COMPLETED
- [ ] Document the revised presentation content integration
- [ ] Note UI/UX improvements for light/dark mode consistency

**Section: "Interactive Poll System" (Lines 191-208)**
- [ ] Update survey-results pages description to reflect revised content
- [ ] Note that pages now align with latest presentation materials

**Section: "Features > Survey Results" (Lines 252-256)**
- [ ] Expand description to mention revised content and structure
- [ ] Note improved UI/UX for light/dark mode consistency

**Menu/Navigation References:**
- [ ] Update any references to menu structure
- [ ] Note WIKS menu item relocation and renaming

---

#### **2. docs/PROJECT_STATUS.md** ⚠️ NEEDS UPDATE
**Location:** `docs/PROJECT_STATUS.md`  
**Status:** Current  
**Updates Needed:**

**Section: "LATEST UPDATE" (Line 7)**
- [ ] Add entry for "Survey-Results Pages Content Update" ✅ COMPLETED (January 2025)
- [ ] Document revised presentation content integration
- [ ] Note UI/UX improvements and menu structure changes

**Section: "Recent Major Updates" (Lines 10+)**
- [ ] Add new subsection: "Survey-Results Pages Content Update" ✅ COMPLETED (January 2025)
- [ ] Document changes to holistic-protection, prioritization, tiered-framework pages
- [ ] Note menu structure changes (WIKS relocation and renaming)
- [ ] Document UI/UX improvements for light/dark mode consistency

**Section: "Feature Implementation Status > Interactive Poll System" (Lines 423-443)**
- [ ] Update survey-results pages description to note revised content
- [ ] Document that pages now reflect latest presentation materials

**Menu Structure References:**
- [ ] Verify and update any references to menu/navigation structure
- [ ] Document WIKS menu item changes

---

### **Priority 2: Supporting Documentation**

#### **3. docs/README.md** ⚠️ VERIFY
**Location:** `docs/README.md`  
**Status:** Current  
**Updates Needed:**

**Section: "Documentation Maintenance" (Lines 282-304)**
- [ ] Verify that maintenance procedures are followed
- [ ] Note that update plan documents were created for this round of changes

**Section: "Quick Reference > Common Tasks" (Lines 157-164)**
- [ ] Verify no updates needed (this is a general index)

**General:**
- [ ] Review for any references to survey-results pages or menu structure
- [ ] Update if specific outdated information is found

---

#### **4. Update Plan Documents** ✅ OPTIONAL MARK COMPLETE
**Location:** Root directory  
**Status:** Created during implementation  
**Updates Needed:**

**Files:**
- `PRIORITIZATION_PAGE_UPDATE_PLAN.md` - ✅ COMPLETED (implementation done)
- `TIERED_FRAMEWORK_PAGE_UPDATE_PLAN.md` - ✅ COMPLETED (implementation done)
- `SURVEY_RESULTS_UPDATE_PLAN.md` - ✅ COMPLETED (implementation done)

**Optional Actions:**
- [ ] Add "IMPLEMENTATION STATUS: ✅ COMPLETED" header to each document
- [ ] Add date of completion
- [ ] Note any deviations from plan during implementation

---

### **Priority 3: Reference-Only Documentation**

#### **5. docs/AGENTS.md** ✅ NO UPDATE NEEDED
**Location:** `docs/AGENTS.md`  
**Status:** Verify  
**Rationale:** This file contains core development guidelines and rules. The recent changes were content/structure updates, not architectural changes. However, we should verify if any poll system references need updates.

**Verification Needed:**
- [ ] Check if survey-results page structure changes affect any guidelines
- [ ] Verify poll system references are still accurate
- [ ] Check if menu structure changes impact any documented patterns

---

#### **6. docs/poll-system/*.md** ✅ NO UPDATE NEEDED
**Location:** `docs/poll-system/`  
**Status:** Verify  
**Rationale:** Poll system architecture unchanged. Only page content was updated.

**Verification Needed:**
- [ ] Verify poll system documentation still accurately reflects implementation
- [ ] Check if any page path references need updates

---

#### **7. docs/system-design/*.md** ✅ NO UPDATE NEEDED
**Location:** `docs/system-design/`  
**Status:** Verify  
**Rationale:** System design unchanged. Only page content and UI/UX improved.

**Verification Needed:**
- [ ] Verify matrix graph documentation still accurate (prioritization page has matrix graph)

---

#### **8. docs/review-analysis/*.md** ✅ NO UPDATE NEEDED
**Location:** `docs/review-analysis/`  
**Status:** Verify  
**Rationale:** These are historical/assessment documents. May contain outdated references.

**Verification Needed:**
- [ ] Check if any critical references to survey-results pages are outdated
- [ ] Update only if information is misleading or incorrect

---

## Implementation Plan

### **Phase 1: Critical Updates** (High Priority)

1. **Update README.md**
   - Add "Survey-Results Pages Content Update" section
   - Update survey-results descriptions
   - Note menu structure changes
   - **Estimated Time:** 15-20 minutes

2. **Update docs/PROJECT_STATUS.md**
   - Add "Survey-Results Pages Content Update" to LATEST UPDATE
   - Create new "Recent Major Updates" subsection
   - Document menu structure changes
   - Update feature descriptions
   - **Estimated Time:** 20-25 minutes

### **Phase 2: Verification** (Medium Priority)

3. **Verify docs/README.md**
   - Check for outdated references
   - Update maintenance section if needed
   - **Estimated Time:** 10-15 minutes

4. **Optional: Mark Update Plans Complete**
   - Add completion status to plan documents
   - **Estimated Time:** 5-10 minutes

### **Phase 3: Verification Only** (Low Priority)

5. **Verify Other Documentation**
   - Check docs/AGENTS.md for any needed updates
   - Verify poll-system documentation accuracy
   - Verify system-design documentation accuracy
   - **Estimated Time:** 15-20 minutes

---

## Detailed Update Specifications

### **README.md Updates**

#### **New Section to Add: "Survey-Results Pages Content Update" ✅ COMPLETED (January 2025)**

Add after "TWG Review Access & Authentication Improvements" section:

```markdown
### **Survey-Results Pages Content Update** ✅ NEW (2025-01-31)
- **Revised Content Integration**: All three survey-results pages (Holistic Protection, Prioritization, Tiered Framework) updated to align with revised presentation materials
- **Content Restructuring**: Removed outdated information and fabricated statistics; implemented accurate framework structures based on latest presentations
- **UI/UX Improvements**: Fixed light/dark mode text color issues, applied consistent color schemes across all sections
- **Section Reordering**: Optimized section flow with "What We Heard" sections repositioned for better user experience
- **Menu Structure Update**: WIKS menu item relocated under "Prioritization Framework" and renamed to "Weaving Indigenous Knowledges & Science"
- **Reference Materials**: Added revised content files and matrix graph image for prioritization page
```

#### **Update "Survey Results" Feature Section (Lines 252-256)**

Current:
```markdown
### **Survey Results**
- **Interactive Charts**: Visual representation of stakeholder feedback
- **Data Analysis**: Comprehensive survey result analysis
- **Export Capabilities**: Download results in various formats
- **Historical Tracking**: Monitor changes over time
```

Updated:
```markdown
### **Survey Results**
- **Interactive Charts**: Visual representation of stakeholder feedback
- **Data Analysis**: Comprehensive survey result analysis
- **Export Capabilities**: Download results in various formats
- **Historical Tracking**: Monitor changes over time
- **Revised Content**: Pages aligned with latest presentation materials (January 2025)
- **Enhanced UI/UX**: Consistent light/dark mode support with improved readability
- **Content Accuracy**: Removed outdated information, implemented accurate framework structures
```

---

### **docs/PROJECT_STATUS.md Updates**

#### **Update "LATEST UPDATE" Section (Line 7)**

Add to the beginning of the LATEST UPDATE line:
```markdown
**LATEST UPDATE (January 2025)**: Survey-Results Pages Content Update COMPLETED - All three survey-results pages (holistic-protection, prioritization, tiered-framework) updated with revised presentation content. Removed outdated information and fabricated statistics. Implemented accurate framework structures. Fixed UI/UX issues for light/dark mode consistency. Applied consistent color schemes across all sections. Menu structure updated: WIKS relocated under Prioritization Framework and renamed to "Weaving Indigenous Knowledges & Science". Reference materials added for revised content. [... continue with existing updates ...]
```

#### **New "Recent Major Updates" Subsection**

Add after "Testing & Code Quality Infrastructure" section:

```markdown
### **Survey-Results Pages Content Update** ✅ COMPLETED (January 2025)
- **Holistic Protection Page**: Updated with revised presentation content, reordered sections (moved "What We Heard" above framework sections), fixed UI/UX for light/dark modes
- **Prioritization Page**: Completely restructured based on revised presentation, added matrix graph image, implemented consistent color schemes, fixed text visibility issues
- **Tiered Framework Page**: Removed outdated content and fabricated statistics, implemented new 3-tier framework structure matching revised presentation
- **UI/UX Improvements**: Fixed text color issues in light mode (white text on colored backgrounds, dark text on light backgrounds), applied consistent container coloring
- **Menu Structure**: WIKS menu item moved under "Prioritization Framework" in Core Themes, renamed from "Indigenous Knowledge & Science" to "Weaving Indigenous Knowledges & Science"
- **Reference Materials**: Added revised content text files and matrix-graph.jpg image
- **Content Accuracy**: All pages now reflect accurate, current presentation materials
```

---

## Testing & Verification

### **After Updates, Verify:**

1. **README.md**
   - [ ] All links work correctly
   - [ ] Menu structure references are accurate
   - [ ] Survey-results descriptions reflect current state

2. **docs/PROJECT_STATUS.md**
   - [ ] LATEST UPDATE section reflects all recent changes
   - [ ] Feature descriptions are accurate
   - [ ] Menu structure changes documented

3. **Cross-References**
   - [ ] All references between documents are consistent
   - [ ] No conflicting information about survey-results pages
   - [ ] Menu structure consistently described

---

## Notes

- **Update Plan Documents**: The three update plan documents (PRIORITIZATION_PAGE_UPDATE_PLAN.md, TIERED_FRAMEWORK_PAGE_UPDATE_PLAN.md, SURVEY_RESULTS_UPDATE_PLAN.md) were created during implementation and accurately document the planned changes. These can optionally be marked as completed.

- **Documentation Philosophy**: This project maintains comprehensive documentation. All significant changes should be reflected in the documentation to maintain accuracy and help future developers understand the system state.

- **Priority Focus**: Focus on README.md and PROJECT_STATUS.md first, as these are the most frequently referenced documents. Other documentation should be verified but may not need updates if it's reference-only or historical.

---

**Plan Created:** Current  
**Status:** Ready for Implementation  
**Estimated Total Time:** 60-90 minutes for all phases

