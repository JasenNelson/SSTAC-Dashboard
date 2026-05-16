---
title: PROJECTS_MAP (E2E fixture)
purpose: Minimal valid PROJECTS_MAP for the Playwright E2E spec
---

# Projects map (E2E fixture)

This file is read by the Agentic OS admin page when KNOWLEDGE_BASE_PATH points
at the parent directory. The project names below MUST appear in the launch
validator's ALLOWED_PROJECTS set (see src/lib/agentic-os/launch-validator.ts)
because the launch route's gate 6 rejects anything else; if you rename a
project here, also update the validator (or pick another allowlisted name).

## Active Projects

### SSTAC-Dashboard

**Path:** `C:\Projects\SSTAC-Dashboard\e2e\fixtures\agentic-os\projects\test-project-1`
**Purpose:** E2E fixture project #1. Has a test skill and a test agent under .claude/.
**Status:** active
**Tags:** e2e, fixture

### Site3250-KB

**Path:** `C:\Projects\SSTAC-Dashboard\e2e\fixtures\agentic-os\projects\test-project-2`
**Purpose:** E2E fixture project #2. No skills / no agents -- exercises the empty-state path.
**Status:** active
**Tags:** e2e, fixture

## Convergence Edges

```
SSTAC-Dashboard --reads--> Site3250-KB
Site3250-KB --feeds--> SSTAC-Dashboard
```
