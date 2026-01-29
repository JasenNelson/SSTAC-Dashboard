# Phase 1: Pyramid Navigation Implementation Guide

**Date:** January 27, 2026
**Purpose:** Implementation guide for Cursor/ChatGPT/Codex/Antigravity
**Timeline:** 1-2 weeks
**Prerequisites:** UI/UX proposal corrections complete ✅

---

## Overview

**Goal:** Replace technical sheet codes with pyramid topic hierarchy for executive-friendly navigation.

**Current State:**
- Left panel shows: `STG1PSI`, `STG2PSIDSI`, `RAPG`, `REMPLAN` (technical, confusing)
- Flat hierarchy: Sheet → Sections → Items
- Database aesthetic

**Target State:**
- Left panel shows: "Stage 1: Preliminary Investigation", "Stage 2: Detailed Investigation", etc.
- 3-tier pyramid: Workflow Stages → Document Types → Requirements
- Executive-friendly language

---

## Files to Modify

### Primary Files

1. **`src/app/(dashboard)/regulatory-review/[submissionId]/page.tsx`**
   - Type definitions (Sheet naming)
   - Data fetching logic

2. **`src/app/(dashboard)/regulatory-review/[submissionId]/ReviewDashboardClient.tsx`**
   - `SHEET_DISPLAY_NAMES` mapping (lines 109-119)
   - Hierarchy building logic (lines 183-229)
   - Left panel rendering (lines 494-699)

3. **`src/app/(dashboard)/regulatory-review/[submissionId]/components/ReviewSidebar.tsx`**
   - Section grouping logic

### New Files to Create

4. **`src/app/(dashboard)/regulatory-review/[submissionId]/constants/pyramidHierarchy.ts`**
   - Pyramid structure definitions
   - Stage → Topic → Requirement mappings

5. **`src/app/(dashboard)/regulatory-review/[submissionId]/components/PyramidNavigation.tsx`**
   - New navigation component
   - 3-tier collapsible tree

---

## Implementation Steps

### Step 1: Define Pyramid Structure (30 min)

Create `pyramidHierarchy.ts`:

```typescript
export const PYRAMID_STAGES = {
  STAGE1: {
    id: 'stage1',
    label: 'Stage 1: Preliminary Investigation',
    icon: '🔍',
    color: '#3B82F6', // Blue
    sheets: ['STG1PSI'],
    topics: {
      SITE_HISTORY: {
        id: 'site-history',
        label: 'Site History Review',
        description: 'Historical land use and records',
        requirements: ['CSAP-01', 'CSAP-02', 'CSAP-03']
      },
      SITE_RECONNAISSANCE: {
        id: 'site-reconnaissance',
        label: 'Site Reconnaissance',
        description: 'Physical site inspection',
        requirements: ['CSAP-04', 'CSAP-05']
      }
      // ... more topics
    }
  },
  STAGE2: {
    id: 'stage2',
    label: 'Stage 2: Detailed Investigation',
    icon: '🔬',
    color: '#10B981', // Green
    sheets: ['STG2PSIDSI', 'DSI'],
    topics: {
      SAMPLING_PLAN: {
        id: 'sampling-plan',
        label: 'Sampling and Analysis Plan',
        description: 'Field work methodology',
        requirements: ['CSAP-10', 'CSAP-11']
      }
      // ... more topics
    }
  },
  STAGE3: {
    id: 'stage3',
    label: 'Stage 3: Risk Assessment',
    icon: '⚠️',
    color: '#F59E0B', // Amber
    sheets: ['RAPG', 'SLRA'],
    topics: {
      RISK_ANALYSIS: {
        id: 'risk-analysis',
        label: 'Risk Characterization',
        description: 'Exposure pathways and receptors',
        requirements: ['RAPG-01', 'RAPG-02']
      }
      // ... more topics
    }
  },
  STAGE4: {
    id: 'stage4',
    label: 'Stage 4: Remediation Planning',
    icon: '🛠️',
    color: '#EF4444', // Red
    sheets: ['REMPLAN'],
    topics: {
      REMEDIATION_STRATEGY: {
        id: 'remediation-strategy',
        label: 'Remediation Approach',
        description: 'Cleanup methods and objectives',
        requirements: ['REM-01', 'REM-02']
      }
      // ... more topics
    }
  }
};

export type Stage = keyof typeof PYRAMID_STAGES;
export type StageConfig = typeof PYRAMID_STAGES[Stage];
