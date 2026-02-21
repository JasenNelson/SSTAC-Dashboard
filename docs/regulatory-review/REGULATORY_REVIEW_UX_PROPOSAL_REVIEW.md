# Regulatory Review UX Proposal - Comprehensive Review Report

**Date:** January 27, 2026
**Reviewers:** 4 specialized AI agents (parallel review)
**Documents Reviewed:**
- `F:\sstac-dashboard\docs\regulatory-review\REGULATORY_REVIEW_UX_PROPOSAL.md`
- `F:\sstac-dashboard\docs\regulatory-review\REGULATORY_REVIEW_MOCKUPS.md`

**Review Type:** Comment-only (no code changes)
**Status:** Complete - Ready for corrections

---

## Executive Summary
> Note (Jan 28, 2026): This review is historical; corrections were applied and terminology standardized to Title Case. Line references may drift; refer to the proposal headings rather than line numbers.


**Overall Assessment:** ✅ **STRONG** with minor terminology inconsistencies requiring cleanup.

**Findings:**
- ✅ **24 terminology/capitalization issues** identified (easy fixes)
- ✅ **1 critical missing URL parameter** (unresolved-only filter)
- ✅ **1 legacy mockup section** requiring rewrite (lines 377-382)
- ✅ **All core requirements met** - evidence, memo workflow, traceability, accessibility

**Estimated Cleanup Time:** 30-45 minutes

---

## Review Results by Category

### 1. ✅ Scope & Framing - CONSISTENT

**Product Positioning: Reviewer Assistant + Memo Generator**

✅ **CONFIRMED** - Clear throughout proposal:
- Line 21: Section header explicitly states positioning
- Line 23: "This UI supports evidence review and memo authoring; it does not make legal decisions"
- Line 24: "AI outputs are proposed findings for review; reviewer decisions are the authoritative record"

✅ **CONFIRMED** - AI Proposed Status is secondary, Evidence Sufficiency is primary:
- Line 118: "Primary workflow label is **Evidence Sufficiency**; **AI Proposed Status** is secondary"
- Line 134: "Authority: Reviewer Sufficiency is authoritative; AI is advisory"
- Consistently maintained throughout both documents

**Recommendation:** ⚠️ Consider adding brief product positioning statement to MOCKUPS.md introduction (currently only in PROPOSAL.md)

---

### 2. ⚠️ Terminology Consistency - 24 ISSUES FOUND

#### Critical Issue #1: Legacy Status Terms (HIGH PRIORITY)

**Location:** REGULATORY_REVIEW_UX_PROPOSAL.md

| Line | Current (WRONG) | Should Be (CORRECT) | Issue Type |
|------|-----------------|---------------------|------------|
| 347 | Status: ✅ ADEQUATE | Status: ✅ Sufficient | Wrong terminology |
| 380 | ✅ Adequate: 85 | ✅ Sufficient: 85 | Wrong terminology |
| 380 | ⚠️ Flagged: 38 | ⚠️ Needs More Evidence: 38 | Wrong terminology |
| 380 | ❌ Inadequate: 12 | ❌ Insufficient: 12 | Wrong terminology |
| 381 | ⏳ Pending: 45 | ⏳ Unreviewed: 45 | Wrong terminology |

**Impact:** These legacy terms contradict the Evidence Sufficiency model established throughout the document.

**Also found in MOCKUPS.md:**
- Line 305: "Find all Tier 2 inadequate items" → Should be "insufficient items"

---

#### Critical Issue #2: Memo Capitalization (MEDIUM PRIORITY)

**Correct Standard (from lines 26-27):**
- "Interim Memo" (Title Case)
- "Final Memo" (Title Case)

**17 instances need correction:**

**REGULATORY_REVIEW_UX_PROPOSAL.md:**

| Line | Current | Should Be |
|------|---------|-----------|
| 138 | **Interim Memo** | **Interim Memo** |
| 143 | **Final Memo** | **Final Memo** |
| 150 | Final Memo content | Final Memo content |
| 151 | Final Memo generation | Final Memo generation |
| 154 | Final Memo export | Final Memo export |
| 155 | Interim Memo export | Interim Memo export |
| 337 | Final Memo summary: | Final Memo summary: |
| 362 | **Final Memo summary** | **Final Memo summary** |
| 517 | **Final Memo readiness:** | **Final Memo readiness:** |

**REGULATORY_REVIEW_MOCKUPS.md:**

| Line | Current | Should Be |
|------|---------|-----------|
| 145 | Final Memo summary: | Final Memo summary: |
| 156 | Final Memo summary field | Final Memo summary field |
| 166 | - Interim Memo | - Interim Memo |
| 169 | [Generate Interim Memo] | [Generate Interim Memo] |
| 170 | - Final Memo | - Final Memo |
| 173 | [Generate Final Memo] | [Generate Final Memo] |

---

#### Critical Issue #3: Include-in-Final Formatting (LOW PRIORITY)

**Correct Format:** "Include-in-Final" (hyphenated, Final in Title Case)

**4 instances need correction:**

**REGULATORY_REVIEW_UX_PROPOSAL.md:**
- Line 336: "Include in Final: [on]" → "Include-in-Final: [on]"

**REGULATORY_REVIEW_MOCKUPS.md:**
- Line 144: "Include in Final: [ON]" → "Include-in-Final: [ON]"

---

### 3. ✅ Evidence Requirements - ALL COMPLETE

**Section Location:** Lines 157-172 in PROPOSAL.md

✅ **Each evidence requirement includes all 5 elements** (Line 159-164):
1. Verbatim quote
2. Source document identifier
3. Page reference (required)
4. Extraction/match method
5. Confidence score + explanation

✅ **"View in source" explicitly required** (Line 167):
- "View in source" action (doc + page anchor in v1 is acceptable)

✅ **Anti-placeholder rule unambiguous** (Line 171):
- "Placeholder/generic evidence must be filtered or explicitly flagged; do not present as sufficient"

**Mockups Confirmation:**
- Line 142 (MOCKUPS.md): Shows all 5 elements in card UI
- Line 143 (MOCKUPS.md): "[Open source (Doc A, p.12)]" action present

**Status:** No issues found. Requirements are clear and complete.

---

### 4. ✅ Memo Workflow - ALL COMPLETE

**Section Location:** Lines 136-156 in PROPOSAL.md

✅ **Interim vs Final scope is clear:**
- **Interim Memo** (Lines 138-141): Detailed evidence list, full traceability, internal IDs
- **Final Memo** (Lines 143-147): 6-10 pages, curated excerpts, executive summary

✅ **Export requirements explicit** (Lines 153-155):
- "Final Memo export is required"
- "Interim Memo export exists and must be retained"

✅ **UI fields specified** (Lines 131, 149-150):
- "Include-in-Final flag + 'Final Memo summary' short field"
- Mockups show both fields (lines 144-145 in MOCKUPS.md)

**Status:** No issues found. Workflow is well-defined.

---

### 5. ✅ Traceability & IDs - COMPLETE

**Section Location:** Lines 199-226 in PROPOSAL.md

✅ **Internal IDs remain stable** (Line 201):
- "Internal DB IDs remain stable for joins, deep links, and exports"

✅ **Citation Label layer required** (Lines 202-203):
- "Add a 'Citation Label' layer for user-facing legal references"
- "Exports must include BOTH internal ID and citation label"

✅ **Future aliasing explicitly supported** (Lines 205-206):
- "Design must support alias mapping without breaking deep links"

✅ **Taxonomy mapping schema defined** (Lines 214-225):
- Complete schema with internal_requirement_id, citation_label, stage/topic hierarchy

**Status:** No issues found. ID strategy is robust and forward-compatible.

---

### 6. ⚠️ Deep-Link/State Contract - 1 CRITICAL ISSUE

**Section Location:** Lines 299-320 in PROPOSAL.md

✅ **URL parameter list mostly complete** (Lines 311-320):
- view, stage, topic, reqId, tier, suff, status, sort, page

✅ **Precedence order clear** (Lines 307-309):
- URL → saved preferences → role defaults

⚠️ **CRITICAL ISSUE: Missing "unresolved-only" parameter**

**Discrepancy Found:**
- **Line 304** states: "filters: status, tier, sufficiency, **unresolved-only**"
- **Lines 311-320** (example URL): Does NOT include unresolved-only parameter

**Recommendation:**
Add missing parameter to example URL (after line 320):
```
&unresolved=true|false
```

**Minor Issues:**

1. **Parameter abbreviation undocumented:**
   - "suff" is used for "sufficiency" without explanation
   - **Recommendation:** Add note documenting abbreviations

2. **Filter combination behavior unclear:**
   - Can `status` and `suff` filters be combined?
   - **Recommendation:** Specify AND/OR logic or mutual exclusivity

---

### 7. ✅ Accessibility v0 Slice - COMPLETE

**Section Location:** Lines 445-452 in PROPOSAL.md

✅ **v0 requirements are concrete:**
- "Keyboard-only end-to-end review flow"
- "Visible focus with `:focus-visible` everywhere"
- "Labeled inputs (no placeholder-only)"
- "Truncation reveal works on focus, not only hover"
- "Color not the only channel for meaning"

✅ **Later WCAG audit properly separated** (Lines 453-480):
- Full WCAG 2.1 AA requirements specified as separate formal audit stage
- Includes keyboard navigation, screen reader support, color contrast, form accessibility, focus indicators

**Status:** No issues found. Accessibility requirements are well-structured.

---

### 8. ✅ Mockups Alignment - FULLY CONSISTENT

**Executive Card Mockup** (Lines 137-147 in MOCKUPS.md):
- ✅ AI Proposed Status badge
- ✅ Evidence Sufficiency dropdown (reviewer authoritative)
- ✅ Evidence snippet with doc+page+method+confidence
- ✅ "Review Evidence" and "Open source" actions
- ✅ Include-in-Final toggle
- ✅ Final Memo summary field
- ✅ Reviewer notes field

**Database Power View Mockup** (Lines 115-127 in MOCKUPS.md):
- ✅ AI vs Reviewer fields (separate columns)
- ✅ Notes indicator column
- ✅ Include-in-Final column
- ✅ Evidence preview with doc+page
- ✅ "Open source" action
- ✅ Accessibility note (truncation on focus, labeled controls)

**Memo Preview Panel Mockup** (Lines 162-174 in MOCKUPS.md):
- ✅ Interim Memo section with action button
- ✅ Final Memo section with action button
- ✅ Clear distinction between memo types

**Status:** All mockups fully aligned with specifications.

---

### 9. ⚠️ Known Cleanup Item - CONFIRMED

**Location:** Lines 377-382 in PROPOSAL.md

**Issue:** Legacy summary panel shows incorrect terminology.

**Current (WRONG):**
```
│  ✅ Adequate: 85    ⚠️ Flagged: 38    ❌ Inadequate: 12    │
│  ⏳ Pending: 45                                            │
```

**Should Be:**
```
│  ✅ Sufficient: 85    ⚠️ Needs More Evidence: 38    ❌ Insufficient: 12    │
│  ⏳ Unreviewed: 45                                         │
```

**Note:** Lines 368-374 already show the correct terminology. This is a redundant mockup block that contradicts the established terminology.

**Recommendation:** Update lines 380-381 to use correct terminology OR remove the redundant mockup block entirely.

---

## Summary
> Note (Jan 28, 2026): User requested Title Case for memo terms (Interim Memo / Final Memo) and Include-in-Final.
 of Required Changes

### High Priority (Must Fix Before Implementation)

1. **Legacy status terms** (6 instances):
   - Lines 347, 380 (x3), 381 in PROPOSAL.md
   - Line 305 in MOCKUPS.md
   - Replace: Adequate → Sufficient, Flagged → Needs More Evidence, Inadequate → Insufficient, Pending → Unreviewed

2. **Missing URL parameter**:
   - Add `&unresolved=true|false` to example in PROPOSAL.md after line 320

### Medium Priority (Should Fix for Consistency)

3. **Memo capitalization** (17 instances):
   - 9 instances in PROPOSAL.md (lines 138, 143, 150, 151, 154, 155, 337, 362, 517)
   - 5 instances in MOCKUPS.md (lines 145, 156, 166, 169, 170, 173)
   - Change: "Interim Memo" → "Interim Memo", "Final Memo" → "Final Memo"

### Low Priority (Polish)

4. **Include-in-Final formatting** (2 instances):
   - Line 336 in PROPOSAL.md
   - Line 144 in MOCKUPS.md
   - Change: "Include in Final" → "Include-in-Final"

5. **Documentation clarifications**:
   - Add note explaining URL parameter abbreviations (suff = sufficiency)
   - Clarify filter combination behavior (status + sufficiency: AND/OR/exclusive?)

---

## Validation Checklist Results

### Scope + Framing
- [x] Document consistently states "reviewer assistant + memo generator, not a decision tool"
- [x] "AI Proposed Status" is secondary and "Evidence Sufficiency" is primary throughout

### Terminology Consistency
- [ ] ⚠️ "Evidence Sufficiency" labels used everywhere (6 legacy terms found)
- [ ] ⚠️ "Interim Memo" and "Final Memo" consistently capitalized (17 issues found)
- [ ] ⚠️ No lingering "Adequate / Inadequate / Flagged / Pending" language (6 found)

### Evidence Requirements
- [x] Each evidence requirement includes: verbatim quote, doc ID, page, method, confidence
- [x] "View in source" is called out as required behavior
- [x] Anti-placeholder rule is explicit and unambiguous

### Memo Workflow
- [x] Interim vs Final scope is clear and complete
- [x] Final Memo export required; Interim export retained
- [x] "Include-in-Final" + "Final Memo summary" fields specified in UI requirements

### Traceability + IDs
- [x] Internal IDs remain stable and are used in deep links/exports
- [x] "Citation Label" layer required and exports include both IDs
- [x] Future aliasing/migration explicitly supported

### Deep-Link/State Contract
- [ ] ⚠️ URL param list complete (missing "unresolved-only")
- [x] Precedence order clear
- [ ] ⚠️ All filters accounted for (unresolved-only not parameterized)

### Accessibility v0 Slice
- [x] "v0" requirements are concrete
- [x] Later WCAG audit present as separate stage

### Mockups Alignment
- [x] Executive card shows all required fields
- [x] DB view shows AI vs Reviewer fields, notes, include-in-FINAL, evidence preview, open source
- [x] Memo Preview panel shows Interim vs Final + actions

### Known Cleanup Item
- [x] Legacy summary mockup at lines 377-382 flagged for rewrite

---

## Recommendations for Next Steps

### Before Phase 1 Implementation:

1. **Apply terminology fixes** (30-45 minutes):
   - Update 6 legacy status terms to Evidence Sufficiency labels
   - Standardize 17 memo capitalization instances
   - Fix 2 Include-in-Final formatting issues

2. **Add missing deep-link parameter** (5 minutes):
   - Add `&unresolved=true|false` to URL parameter example

3. **Clarify filter behavior** (10 minutes):
   - Document URL parameter abbreviations
   - Specify filter combination logic

4. **Rewrite or remove redundant mockup** (5 minutes):
   - Update lines 377-382 to use correct terminology OR remove block

**Total Estimated Time:** 50-70 minutes of documentation cleanup

### After Cleanup:

5. **Final review pass** - Quick scan to confirm all changes applied
6. **User approval** - Get sign-off on refined proposal
7. **Begin Phase 1 implementation** - Pyramid navigation refactor

---

## Conclusion

**Overall Quality:** ✅ **EXCELLENT** - The proposal is comprehensive, well-researched, and implementable.

**Key Strengths:**
- Clear product positioning and authority boundaries
- Complete evidence and memo workflow specifications
- Robust traceability and ID strategy
- Concrete accessibility requirements
- Fully aligned mockups

**Issues Summary:**
- 24 minor terminology/capitalization inconsistencies (easy fixes)
- 1 missing URL parameter (easy fix)
- All issues are documentation-level - no design flaws

**Ready for Implementation:** ✅ YES, after applying the cleanup items listed above.

---

**Review Completed:** January 27, 2026
**Agent IDs (for resumption):**
- Scope & Terminology: aab5640
- Evidence & Memo: a71a5f6
- Traceability & Deep-Link: a0012fd
- Accessibility & Mockups: ad146a8

**Next Action:** Apply corrections listed in "Summary of Required Changes" section.
