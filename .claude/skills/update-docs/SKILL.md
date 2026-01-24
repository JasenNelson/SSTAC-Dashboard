---
name: update-docs
version: 1.0
last_updated: 2026-01-24
description: Session documentation update skill for SSTAC-Dashboard. Captures lessons learned, updates manifest facts, validates documentation gates, and ensures lifecycle policy compliance. Auto-suggest at session end after significant work.
triggers:
  - pattern: "update.*docs"
  - pattern: "end.*session"
  - pattern: "session.*end"
  - pattern: "wrap.*up"
  - pattern: "finishing.*work"
  - pattern: "document.*lesson"
auto_suggest:
  - event: SessionEnd
    condition: "significant_work_done"
    message: "Consider running /update-docs to document session progress"
  - event: AfterBugFix
    condition: "always"
    message: "Bug fix completed - /update-docs can capture this lesson"
  - event: AfterDiscovery
    condition: "always"
    message: "New discovery - consider /update-docs for lessons and manifest updates"
  - event: AfterFeatureImplementation
    condition: "always"
    message: "Feature implemented - /update-docs can document the approach"
---

# /update-docs Skill for SSTAC-Dashboard

**Purpose:** Systematically document session work, capture lessons learned, and update the documentation manifest with facts about project progress.

## When to Use This Skill

### Manual Triggers
- User invokes `/update-docs`
- User says "update docs", "end session", "wrap up", "finishing work", "document lesson"

### AI Auto-Suggestion (MANDATORY BEHAVIOR)

**AI agents SHOULD proactively suggest running `/update-docs` before ending sessions when:**

1. **Significant work was completed:**
   - Bug fixes
   - Feature implementations
   - Code modifications to core files
   - Deployment successes or challenges

2. **Discoveries were made:**
   - New patterns identified
   - Problems solved after failed attempts
   - Anti-patterns discovered
   - Platform limitations/capabilities found
   - Integration challenges

3. **Gate or test progress occurred:**
   - Tests passing/failing
   - Documentation requirements validated
   - Code changes affecting gated paths

4. **Issues encountered and resolved:**
   - Bugs requiring workarounds
   - Build failures and solutions
   - Architecture decisions made
   - Environment-specific challenges

**Example auto-suggestion:**
```
Before ending this session, I recommend running /update-docs to:
- Capture the lesson about [specific discovery]
- Update docs/_meta/docs-manifest.json with deployment insights
- Document the multi-environment approach in LESSONS.md
- Validate all gate requirements are still met

Shall I proceed?
```

---

## The SSTAC-Dashboard Documentation System

### Key Documents
| Document | Purpose | Location | Lifecycle |
|----------|---------|----------|-----------|
| docs/INDEX.md | Canonical entrypoint, system overview | `F:\sstac-dashboard\docs\INDEX.md` | AUTHORITATIVE |
| docs/_meta/docs-manifest.json | Gate definitions, lifecycle policies, facts | `F:\sstac-dashboard\docs\_meta\docs-manifest.json` | AUTHORITATIVE |
| docs/LESSONS.md | Lessons learned during development | `F:\sstac-dashboard\docs\LESSONS.md` | REFERENCE |
| docs/NEXT_STEPS.md | Plan for future work | `F:\sstac-dashboard\docs\NEXT_STEPS.md` | REFERENCE |
| docs/ARCHITECTURE.md | System design and patterns | `F:\sstac-dashboard\docs\ARCHITECTURE.md` | REFERENCE |

### Lifecycle Policies
- **AUTHORITATIVE**: Required documentation; gates enforce these; changes blocked if requirements missing
- **REFERENCE**: Helpful context; not enforced by gates; can be archived/historical
- **HISTORICAL**: Snapshots of previous states; preserved for reference only

---

## Golden Rules

```
1. NEVER modify AUTHORITATIVE docs without understanding gate implications
2. ALWAYS validate changes against docs/_meta/docs-manifest.json BEFORE committing
3. UPDATE manifest facts FIRST, then document changes in REFERENCE docs
4. LESSONS are facts-based - include specific file paths, code sections, problems solved
5. When in doubt about policy compliance, check the gate bundle definition first
```

---

## Execution Procedure

### Phase 1: Gather Session Information

**Step 1.1: Understand What Happened**

Identify:
- What work was completed (bug fixes, features, debugging)?
- What was learned (patterns, problems, solutions)?
- What code changed (which files, which paths)?
- Were any gate-affected paths modified?

**Step 1.2: Check Current Manifest State**

Read the current manifest to understand:
- Which gates are active
- Which paths trigger which gates
- What facts are currently stored
- What document versions are recorded

---

### Phase 2: Document Lessons Learned (If Applicable)

**When to Add Lessons:**
- Problems solved after failed attempts
- Patterns discovered that apply beyond current task
- Anti-patterns identified (what NOT to do)
- Platform limitations/capabilities discovered
- Architecture decisions with rationale
- Integration challenges and solutions
- Multi-environment deployment strategies

**Step 2.1: Open docs/LESSONS.md**

Add to the appropriate section or create new section:

```markdown
## YYYY-MM-DD - Lesson Title [NEW|CRITICAL]

**Date:** January 24, 2026
**Area:** [Deployment|Architecture|Integration|Testing|etc.]
**Impact:** [LOW|MEDIUM|HIGH|CRITICAL]
**Status:** [Implemented|Documented|In Progress|etc.]

### Problem or Discovery
[Clear description of what was found or fixed]

### Root Cause or Context
[Why this happened or technical background]

### Solution or Pattern
[What worked, code examples if applicable]

### File References
- File path with line numbers: `F:\sstac-dashboard\src\...:line_number`
- Related files that implement this pattern

### Key Takeaway
[One-line summary for quick reference]
```

**Example from recent deployment fix:**

```markdown
## 2026-01-24 - Native Modules in Serverless Environments [CRITICAL]

**Date:** January 24, 2026
**Area:** Deployment
**Impact:** CRITICAL (blocked Vercel deployment)
**Status:** Implemented

### Problem or Discovery
`better-sqlite3` native C++ module caused webpack compilation failure in Vercel's serverless environment because native modules cannot be compiled during build.

### Root Cause or Context
Vercel's build environment cannot compile C++ native modules. Three cascading issues:
1. Direct imports in route.ts forced webpack to statically analyze `better-sqlite3`
2. Webpack tried to resolve and bundle the module
3. Module resolution failed because compilation isn't possible in serverless

### Solution or Pattern
Three-pronged approach:
1. Mark module as external in webpack config: `next.config.ts:16`
2. Use lazy loading with try-catch in sqlite client: `src/lib/sqlite/client.ts:25-35`
3. Add conditional imports to API routes: `src/app/api/regulatory-review/search/route.ts:14-19`

### File References
- Configuration: `F:\sstac-dashboard\next.config.ts:12-18`
- Client init: `F:\sstac-dashboard\src\lib\sqlite\client.ts:25-36`
- API routes using pattern:
  - `F:\sstac-dashboard\src\app\api\regulatory-review\search\route.ts:14-19`
  - `F:\sstac-dashboard\src\app\api\regulatory-review\submission-search\route.ts:14-19`

### Key Takeaway
For any feature requiring native modules, use lazy loading + webpack externals to support both local dev (with module) and serverless (without module).
```

**Lesson Quality Filter - Only Add If:**
- Applies to future work (not just this one task)
- Would save significant time if known earlier
- Represents a pattern or architectural principle
- Involves multiple files or cross-system concerns

---

### Phase 3: Update Manifest Facts

**Step 3.1: Read Current Manifest**

```powershell
# View current manifest
Get-Content 'F:\sstac-dashboard\docs\_meta\docs-manifest.json' | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

**Step 3.2: Update Facts Section**

If session involved:
- Deployment changes
- Test count changes
- Grade/quality metric changes
- New patterns discovered

Update `docs/_meta/docs-manifest.json:policies.facts` to reflect:
```json
"facts": {
  "last_session": "2026-01-24 - Deployment fix for native module handling",
  "deployment_status": "Vercel: SUCCESS",
  "multi_environment_support": "local (SQLite) + serverless (graceful fallback)",
  "critical_lessons_count": 1,
  "updated_by": "Claude Session 2026-01-24"
}
```

**Step 3.3: Validate Gate Bundles**

If code changes affected gated paths, verify required documentation:

Example: If you modified `src/app/api/regulatory-review/**`:
1. Check manifest for API_GATE bundle
2. Verify all required sections in docs/INDEX.md exist
3. Confirm documentation describes the API changes

```powershell
# Quick validation: search for gate definitions
Select-String -Path 'F:\sstac-dashboard\docs\_meta\docs-manifest.json' -Pattern '"API_GATE"' -Context 5
```

---

### Phase 4: Update Reference Documentation

**Step 4.1: Update docs/NEXT_STEPS.md (If Work Status Changed)**

If this session resolved blockers or changed priorities:
```markdown
## Updated: [Date] - [Work Completed]

- [✓] Previous blocker resolved: [description]
- [ ] Next priority: [new task]
- [→] In progress: [what's blocked on what]
```

**Step 4.2: Update ARCHITECTURE.md (If Patterns Changed)**

If new architectural patterns were implemented:
```markdown
## Pattern: [Pattern Name]

**Session:** January 24, 2026
**Problem Addressed:** [What issue this solves]
**Implementation:** [Code references]

See also: LESSONS.md - [Related Lesson]
```

---

### Phase 5: Validate Documentation Consistency

**Step 5.1: Verify Manifest Integrity**

Check that:
- All document paths in manifest actually exist
- Gate bundles reference existing sections
- Facts are accurate and current
- No circular dependencies in gate definitions

```powershell
# Validate JSON syntax
Test-Json -Path 'F:\sstac-dashboard\docs\_meta\docs-manifest.json'

# Count documents
(Get-Content 'F:\sstac-dashboard\docs\_meta\docs-manifest.json' | ConvertFrom-Json).documents.Count
```

**Step 5.2: Check for Gate Compliance**

If code changes affected gated paths:
```powershell
# Example: if you modified regulatory-review API
Select-String -Path 'F:\sstac-dashboard\docs\INDEX.md' -Pattern 'API.*regulatory.*review' -Context 3
```

**Step 5.3: Verify Lifecycle Compliance**

Confirm:
- AUTHORITATIVE docs were not modified carelessly
- REFERENCE docs properly reference AUTHORITATIVE sources
- No volatile metrics appear in non-AUTHORITATIVE docs
- Facts are stored in manifest, not scattered in docs

---

### Phase 6: Final Checklist

Before completing `/update-docs`:

**Documentation Updates**
- [ ] docs/LESSONS.md updated with session insights (if applicable)
- [ ] Lesson follows quality filter (applies beyond this task)
- [ ] Lesson includes specific file references with line numbers
- [ ] docs/NEXT_STEPS.md updated if work status changed
- [ ] docs/ARCHITECTURE.md updated if patterns changed (if applicable)

**Manifest Updates**
- [ ] docs/_meta/docs-manifest.json facts section updated
- [ ] Manifest JSON validates with no syntax errors
- [ ] Gate bundles still point to existing documentation
- [ ] No AUTHORITATIVE docs were carelessly modified

**Validation**
- [ ] All modified docs are reachable from docs/INDEX.md
- [ ] Lifecycle policies respected (AUTHORITATIVE vs REFERENCE)
- [ ] If code changed gated paths, gate requirements still met
- [ ] No circular references in gate definitions
- [ ] Lessons are reusable patterns, not one-off fixes

**Communication**
- [ ] Session progress clearly documented
- [ ] Next session priorities identified
- [ ] Any blockers highlighted in NEXT_STEPS.md

---

## Common Mistakes (AVOID THESE)

| Mistake | Consequence | Prevention |
|---------|-------------|------------|
| Modifying AUTHORITATIVE docs without understanding gates | Gate requirements may become unmatchable | Always check gate bundles first |
| Storing metrics in docs instead of manifest facts | Drift between different sources of truth | All facts go in manifest, then referenced |
| Lessons that are one-off fixes | Clutters knowledge base, not reusable | Use quality filter: applies beyond this task? |
| Forgetting to update manifest | Next session doesn't know what changed | Always update facts section |
| Circular gate dependencies | Impossible to satisfy all requirements | Validate gate bundles in manifest |
| Empty lesson entries | Wastes documentation space | Only add lessons worth capturing |
| Not validating JSON after edits | Manifest becomes invalid, gates fail | Always run Test-Json |

---

## Integration with Other Skills

| Skill | Relationship |
|-------|-------------|
| `/doc-navigator` | Use before adding lessons to check if similar already exists |
| `/safe-exit` | Run `/safe-exit` before `/exit` to ensure system is clean |
| Git workflow | Commit documentation updates separately from code changes when significant |

---

## AI Agent Behavior Guidelines

### DO:
- Proactively suggest `/update-docs` before session end when significant work occurred
- Mention specific items that should be documented
- Verify lesson quality before adding (reusable? cross-system? saves time?)
- Always validate manifest JSON after modifications
- Check gate bundles when code changes gated paths

### DO NOT:
- End sessions without offering to update docs after meaningful work
- Add one-off fixes as lessons (they should be reusable patterns)
- Modify AUTHORITATIVE docs without understanding gate implications
- Store volatile metrics anywhere except manifest facts
- Assume previous session's manifest is still valid

### Auto-Suggestion Template:

```
I recommend running /update-docs before ending this session to capture:

**Work Completed:**
- [Specific accomplishment 1]
- [Specific accomplishment 2]

**Lessons Worth Documenting:**
- [Pattern/discovery 1 - includes which files affected]
- [Pattern/discovery 2]

**Manifest Updates:**
- Update facts with deployment/testing insights
- Validate gates still satisfied for modified code paths

This will:
1. Document lessons for future reference
2. Update manifest facts with session progress
3. Validate documentation consistency
4. Ensure all gate requirements are still met

Shall I proceed with /update-docs?
```

---

## Phase-Specific Commands

### Validate Manifest JSON
```powershell
$manifest = Get-Content 'F:\sstac-dashboard\docs\_meta\docs-manifest.json' | ConvertFrom-Json
$manifest | ConvertTo-Json -Depth 20 | Out-Null
Write-Host "✓ Manifest is valid JSON"
```

### List All Gates
```powershell
$manifest = Get-Content 'F:\sstac-dashboard\docs\_meta\docs-manifest.json' | ConvertFrom-Json
$manifest.bundles | Format-Table -AutoSize
```

### Check Document Existence
```powershell
$manifest = Get-Content 'F:\sstac-dashboard\docs\_meta\docs-manifest.json' | ConvertFrom-Json
foreach ($doc in $manifest.documents) {
    $exists = Test-Path $doc.path
    Write-Host "$($doc.name): $exists"
}
```

---

## Example Session Update

**Scenario:** Session fixed Vercel deployment issue and discovered multi-environment pattern.

### Step 1: Capture Lesson (docs/LESSONS.md)
```markdown
## 2026-01-24 - Native Modules in Serverless Environments [CRITICAL]

**Date:** January 24, 2026
**Area:** Deployment
**Impact:** CRITICAL
**Status:** Implemented

### Problem or Discovery
`better-sqlite3` native module caused Vercel deployment failure - webpack tried to resolve native C++ module in serverless environment where compilation is impossible.

### Solution or Pattern
Three-pronged approach:
1. Mark module external in webpack
2. Lazy load with try-catch
3. Add conditional imports to API routes

### File References
- `next.config.ts:12-18`
- `src/lib/sqlite/client.ts:25-36`
- `src/app/api/regulatory-review/search/route.ts:14-19`

### Key Takeaway
For native modules, use lazy loading + webpack externals for multi-environment support.
```

### Step 2: Update Manifest Facts
```json
{
  "facts": {
    "last_session": "2026-01-24 - Fixed Vercel deployment, discovered multi-environment pattern",
    "deployment_status": "Vercel: ✓ SUCCESS",
    "sqlite_approach": "lazy loading + webpack externals",
    "multi_environment_tested": "local (SQLite) + serverless (graceful fallback)",
    "critical_lessons": 1
  }
}
```

### Step 3: Validate
```powershell
# Test manifest is valid
Test-Json -Path 'F:\sstac-dashboard\docs\_meta\docs-manifest.json'

# Verify all documents exist
$manifest = Get-Content 'F:\sstac-dashboard\docs\_meta\docs-manifest.json' | ConvertFrom-Json
$manifest.documents | Where-Object {-not (Test-Path $_.path)} | ForEach-Object { Write-Warning "Missing: $($_.name)" }
```

---

**Created:** 2026-01-24
**Updated:** 2026-01-24
**Purpose:** End-of-session documentation and lesson capture for SSTAC-Dashboard
**Framework:** Adapted from Regulatory-Review /update-docs skill with manifest-based modifications
