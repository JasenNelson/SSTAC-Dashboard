# Matrix Options Phase D -- Full Google Drive Reference-Inventory Workflow

Plain ASCII only. No em-dashes, smart quotes, or emoji.

**Status:** READY-TO-LAUNCH template. NOT yet executed. Author date: 2026-06-09.

**Purpose:** capture the Phase D full Google Drive reference-inventory sweep as a
ready-to-launch Claude Code Workflow (JS DSL) that the owner can trigger in one
command when the Drive-wide sweep is needed for catalog expansion. The 3 priority
folders (References, TWG - Preliminary Research, White Paper and Scoping) are
ALREADY inventoried under `matrix_research/reference_catalog/library_inventory_2026_06_09/`
and are excluded from this workflow.

---

## 1. Context and Trigger

### What was already done (Phase C, 2026-06-09 session)

Three priority folders were inventoried by subagents this session:

| Folder | Files | Outcome |
|---|---|---|
| G:\My Drive\SABCS - Sediment Project\References | 560 | ~262 canonical regulatory sources flagged; IRIS/ 146 + EcoSSL/ 22 sub-folders |
| G:\My Drive\SABCS - Sediment Project\TWG - Preliminary Research | 140 | few third-party refs; 89 .gdoc stubs + 20 macOS ._ junk |
| G:\My Drive\SABCS - Sediment Project\White Paper and Scoping | 86 | ~0 third-party refs; 71 .gdoc pointer stubs |

Full manifests: `matrix_research/reference_catalog/library_inventory_2026_06_09/`
Rollup: `matrix_research/reference_catalog/reference_library_inventory_2026_06_09.md`

### When to trigger Phase D

Phase D blocks nothing in the current dev lane. Trigger it when the owner needs to
locate any of these named priority sources that were NOT found in Phase C:

- Richardson 1997 Compendium (fish consumption rates; cited by BC WLRS 2023 + HHRA)
- Canadian EFH 2013 FOOD volume (exposure factors, Health Canada)
- Alberta Health 2018 exposure factors (directs to HHRA receptor characterization)
- WQCIU report local copies (Olsgard et al. 2023; 388 g/day community-specific rate)
- BC risk-based fish-tissue-concentration guidance (distinct from WLRS 2023 or same?)

Or when the owner wants a consolidated manifest of the full Drive collection for
Zotero import planning.

---

## 2. Prerequisites (owner checklist before launch)

1. Zotero desktop app is OPEN and "Allow other applications on this computer to
   communicate with Zotero" is enabled in Zotero Settings -> Advanced. The dedup
   stage calls the local API at `http://localhost:23119/api/users/0/items`. Without
   this, the dedup stage will skip Zotero dedup and note it in the manifest.

2. Google Drive is mounted at G:\ (the path used throughout this workflow). Verify
   with: `Test-Path "G:\My Drive"` in PowerShell.

3. Token / usage-credit caveat: the per-folder agent tasks use STANDARD context
   (not 1M extended). During Phase C, the References-folder agent died immediately
   when given extended/1M context without `/usage-credits` enabled. If you want to
   deep-read PDFs inside very large folders, enable usage credits first (`/usage-credits`
   in the Claude Code session). Otherwise, the agents operate filename-first with
   capped PDF spot-reads (max 3 PDFs per folder, sampled by priority keywords).

4. Run from the repo root: `C:\projects\sstac-dashboard`.

---

## 3. Folder inventory (what Phase D covers)

### 3a. SABCS subfolders NOT yet inventoried (inside G:\My Drive\SABCS - Sediment Project\)

These are the non-priority SABCS subfolders that Phase C did not touch. The exact
list must be confirmed at runtime with a `gdrive_list_folder` call on the SABCS root;
the expected candidates based on the 2026-06-09 session include:

- SABCS Meetings
- Data
- Site_Remediation_Data (or similar)
- RAO collab
- Other named sub-folders discovered at runtime

The workflow script discovers these dynamically (step 1: list the SABCS root and
subtract the already-inventoried three).

### 3b. Other top-level Drive folders (outside SABCS)

These are approximately 15 top-level folders in G:\My Drive outside the SABCS project
folder. The exact names are discovered at runtime. Typical candidates from the session:

- Protocol 19
- Cabana-Nelson Indigenous Research
- Work Stuff
- RAO collab (if top-level)
- Any folder whose name suggests regulatory or environmental content

The workflow script inventories ALL top-level Drive folders outside the SABCS root
EXCEPT the explicit exclusion list below.

### 3c. EXPLICIT EXCLUSIONS (never read, skip with a log entry)

- Envirotox database: any folder named "Envirotox" or "envirotox" anywhere (~8,780 data
  files; would exhaust token budget and contain no reference-library content).
- The three already-inventoried SABCS priority folders:
  - G:\My Drive\SABCS - Sediment Project\References
  - G:\My Drive\SABCS - Sediment Project\TWG - Preliminary Research
  - G:\My Drive\SABCS - Sediment Project\White Paper and Scoping

---

## 4. Workflow Script (Claude Code Workflow DSL)

Paste the script below into a `Workflow({ script: <content> })` call, or save it
to a `.js` file and use `Workflow({ scriptPath: "<path>" })`. See Section 5 for
the exact launch command.

The inventory fan-out in Phase 2 runs agents in batches of 3 folders at a time
(rather than all at once) to stay within the L0 process-safety concurrency cap,
surface partial progress between batches, and avoid overwhelming the Workflow
runtime with a single 15+ agent fan-out.

```javascript
// Phase D -- Full Google Drive Reference-Inventory Workflow
// Plain ASCII only. No em-dashes.
// Ready-to-launch template (not yet executed). Author date: 2026-06-09.
//
// CONTEXT CAVEAT: per-folder agents use STANDARD context.
// The 1M-context tier ("extended thinking" / large context window) requires
// /usage-credits to be enabled in the session. A References-folder agent died
// immediately on 2026-06-09 when given 1M context without credits. If deep PDF
// reads are needed, enable credits first; otherwise agents work filename-first
// with capped spot-reads (max 3 PDFs per folder sampled by priority keywords).
//
// ZOTERO: the dedup stage calls http://localhost:23119/api/users/0/items (no key).
// The owner MUST have Zotero desktop open. If unavailable, dedup stage notes it
// in the manifest and skips Zotero comparison.

export const meta = {
  name: "phase-d-drive-inventory",
  description: "Full Google Drive reference-inventory sweep (Phase D). Fans over all SABCS subfolders + ~15 other top-level Drive folders, excluding Envirotox and the 3 already-inventoried priority folders. Deduplicates against the Zotero local library. Emits one consolidated manifest.",
  phases: [
    "discover",
    "inventory-fan-out",
    "dedup-and-synthesize"
  ]
};

// ---- CONSTANTS ----

const DRIVE_ROOT = "G:\\My Drive";
const SABCS_ROOT = "G:\\My Drive\\SABCS - Sediment Project";

// Already inventoried -- skip these exact paths
const ALREADY_INVENTORIED = [
  "G:\\My Drive\\SABCS - Sediment Project\\References",
  "G:\\My Drive\\SABCS - Sediment Project\\TWG - Preliminary Research",
  "G:\\My Drive\\SABCS - Sediment Project\\White Paper and Scoping"
];

// Skip any folder whose name matches these terms (case-insensitive)
const EXCLUSION_KEYWORDS = ["envirotox"];

// Priority source names to flag if found (substring match, case-insensitive)
const PRIORITY_SOURCES = [
  "richardson",         // Richardson 1997 Compendium
  "canadian efh",       // Canadian EFH 2013 FOOD volume
  "alberta health",     // Alberta Health 2018 exposure factors
  "wqciu",              // WQCIU report (Olsgard et al. 2023)
  "olsgard",            // author name for WQCIU
  "fish tissue",        // BC fish-tissue guidance
  "fish-tissue",
  "screening values for contaminants in fish"
];

// Output paths (relative to repo root)
const OUTPUT_DIR = "matrix_research/reference_catalog/library_inventory_phase_d";
const MANIFEST_PATH = "matrix_research/reference_catalog/drive_inventory_phase_d_manifest.md";

// Zotero local API (no key; owner must have desktop app open)
const ZOTERO_API = "http://localhost:23119/api/users/0/items?limit=100&start=0&format=json";

// ---- STRUCTURED OUTPUT SCHEMA (per-folder agent return) ----
//
// Each per-folder agent returns a JSON object matching this shape:
//
// {
//   "folder_path": string,           // absolute path inventoried
//   "folder_name": string,           // leaf name
//   "file_count": number,            // total files found
//   "filtered_count": number,        // after removing ._ stubs
//   "gdoc_stub_count": number,       // .gdoc/.gsheet/.gform pointer stubs
//   "files": [                       // one entry per non-stub file
//     {
//       "filename": string,
//       "relpath": string,           // relative to folder_path
//       "type": string,              // pdf|xlsx|xls|doc|docx|pptx|other
//       "size_kb": number,
//       "year": string|null,         // extracted from filename if present
//       "title_guess": string,       // best-effort from filename
//       "category": string,          // regulatory-guidance|report|journal-article|spreadsheet|presentation|draft|other
//       "priority_hit": string|null, // matched PRIORITY_SOURCES keyword or null
//       "confidence": string         // low|med|high
//     }
//   ],
//   "gdoc_stubs": [                  // .gdoc/.gsheet/.gform files routed through MCP
//     {
//       "filename": string,
//       "gdrive_id": string|null,    // extracted from the stub JSON if readable
//       "title": string|null,        // returned by gdrive_read_doc or gdrive_export
//       "readable": boolean
//     }
//   ],
//   "priority_finds": [              // entries from files[] where priority_hit is not null
//     { "filename": string, "priority_hit": string, "relpath": string }
//   ],
//   "skipped_macos_stubs": number,   // count of ._ files filtered out
//   "errors": string[]               // any read or MCP errors encountered
// }

// ---- HELPER: build per-folder agent prompt ----

function folderAgentPrompt(folderPath, folderName, exclusions, prioritySources) {
  return `You are a reference-library inventory agent. Your task: produce a structured
JSON inventory of the Google Drive folder at this path:

  ${folderPath}

RULES:
1. List all files recursively using filesystem tools (PowerShell Get-ChildItem or the
   gdrive_list_folder MCP tool for Drive-backed folders). Do NOT recurse into
   sub-folders named "Envirotox" or matching: ${exclusions.join(", ")}. Log a skipped
   entry for those instead.
2. FILTER: remove macOS resource-fork stub files whose names begin with "._" (often
   <4 KB). Count them in skipped_macos_stubs.
3. GDOC/GSHEET/GFORM stubs: these are pointer files unreadable from the filesystem.
   Route each through the gdrive MCP -- try gdrive_read_doc first, then gdrive_export
   if that fails. Record the title if obtained; mark readable: false if both fail.
   Do NOT attempt a filesystem read of .gdoc/.gsheet/.gform files.
4. PDF spot-reads: read at most 3 PDFs in this folder (pick by priority keywords:
   ${prioritySources.join(", ")}). For each, read the first 40 lines to extract a
   title, year, and canonical-source flag. All other PDFs: filename-only inventory.
5. For each non-stub file extract: filename, relpath (relative to folder root),
   type, size_kb, year (from filename if a 4-digit year is present), title_guess
   (cleaned filename), category (regulatory-guidance / report / journal-article /
   spreadsheet / presentation / draft / other), and confidence (low=cryptic name,
   med=descriptive name, high=PDF title confirmed).
6. Flag priority hits: if any filename (case-insensitive) contains one of these
   substrings, set priority_hit to the matching keyword: ${prioritySources.join(", ")}.
7. Return ONLY the JSON object matching the schema below. No prose. No markdown
   wrapping. The caller will parse it directly.

Schema (return exactly this shape):
{
  "folder_path": "${folderPath}",
  "folder_name": "${folderName}",
  "file_count": 0,
  "filtered_count": 0,
  "gdoc_stub_count": 0,
  "files": [],
  "gdoc_stubs": [],
  "priority_finds": [],
  "skipped_macos_stubs": 0,
  "errors": []
}`;
}

// ---- PHASE 1: DISCOVER ----
// List the SABCS subfolders and the top-level Drive folders.
// Subtract the already-inventoried list and the exclusion keywords.
// The result is the folder list to fan out over in phase 2.

async function discoverFolders() {
  return phase("discover", async () => {
    log("Listing SABCS subfolders and top-level Drive folders...");

    const discoveryResult = await agent({
      description: "discover-drive-folders",
      prompt: `List all immediate sub-folders of:
  1. ${SABCS_ROOT}
  2. ${DRIVE_ROOT} (top-level folders only, not recursive)

Use PowerShell: Get-ChildItem -Directory "<path>" | Select-Object FullName, Name

Return a JSON object with this shape:
{
  "sabcs_subfolders": [ { "path": "...", "name": "..." } ],
  "toplevel_folders": [ { "path": "...", "name": "..." } ]
}

No prose. No markdown. JSON only.`
    });

    const discovered = JSON.parse(discoveryResult);

    // Build the target list: SABCS subs + top-level, minus exclusions + already-inventoried
    const allFolders = [
      ...discovered.sabcs_subfolders,
      ...discovered.toplevel_folders.filter(f =>
        !f.path.startsWith(SABCS_ROOT)
      )
    ];

    const targets = allFolders.filter(f => {
      const nameLower = f.name.toLowerCase();
      const isExcludedKeyword = EXCLUSION_KEYWORDS.some(kw => nameLower.includes(kw));
      const isAlreadyDone = ALREADY_INVENTORIED.includes(f.path);
      if (isExcludedKeyword) {
        log(`SKIP (exclusion keyword): ${f.path}`);
        return false;
      }
      if (isAlreadyDone) {
        log(`SKIP (already inventoried): ${f.path}`);
        return false;
      }
      return true;
    });

    log(`Discovery complete. ${targets.length} folders to inventory.`);
    targets.forEach(f => log(`  TARGET: ${f.path}`));
    return targets;
  });
}

// ---- PHASE 2: INVENTORY FAN-OUT ----
// Agents run in parallel batches of BATCH_SIZE folders at a time.
// Batching keeps the fan-out gentle (process-safety: L0 rule 1.9 caps concurrent
// background subagents at 3) and lets results accumulate incrementally between batches
// so partial progress is visible if the run is interrupted. The Workflow runtime also
// caps internal concurrency, but explicit batching is the defensive/idiomatic pattern
// for a large fan-out.
// Each agent returns the structured JSON schema defined above.

const BATCH_SIZE = 3;

async function inventoryFanOut(targets) {
  return phase("inventory-fan-out", async () => {
    log(`Fanning out ${targets.length} per-folder inventory agents in batches of ${BATCH_SIZE}...`);

    const allParsed = [];

    for (let batchStart = 0; batchStart < targets.length; batchStart += BATCH_SIZE) {
      const chunk = targets.slice(batchStart, batchStart + BATCH_SIZE);
      const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(targets.length / BATCH_SIZE);
      log(`Batch ${batchNum}/${totalBatches}: ${chunk.map(f => f.name).join(", ")}`);

      // parallel() runs the batch concurrently and returns an array of results.
      // NOTE: if one agent fails, the others in the batch continue (parallel does not
      // cascade-cancel within a batch). Each result is a JSON string matching the
      // per-folder schema.
      const results = await parallel(chunk.map(folder => agent({
        description: `inventory-${folder.name}`,
        prompt: folderAgentPrompt(folder.path, folder.name, EXCLUSION_KEYWORDS, PRIORITY_SOURCES)
      })));

      const parsedBatch = results.map((raw, idx) => {
        const folder = chunk[idx];
        // parallel() resolves a failed/timed-out agent to null (it NEVER rejects, so one
        // folder's failure does not abort the batch). Map a null into a per-folder error
        // object so the failure is surfaced AND synthesis still runs on the rest.
        if (raw == null) {
          log(`AGENT FAILURE for folder ${folder.path} (null result -- agent error or timeout)`);
          return {
            folder_path: folder.path,
            folder_name: folder.name,
            file_count: 0,
            filtered_count: 0,
            gdoc_stub_count: 0,
            files: [],
            gdoc_stubs: [],
            priority_finds: [],
            skipped_macos_stubs: 0,
            errors: ["agent-failure: parallel() returned null (agent error or timeout)"]
          };
        }
        try {
          return typeof raw === "string" ? JSON.parse(raw) : raw;
        } catch (e) {
          log(`PARSE ERROR for folder ${folder.path}: ${e.message}`);
          return {
            folder_path: folder.path,
            folder_name: folder.name,
            file_count: 0,
            filtered_count: 0,
            gdoc_stub_count: 0,
            files: [],
            gdoc_stubs: [],
            priority_finds: [],
            skipped_macos_stubs: 0,
            errors: [`parse-error: ${e.message}`]
          };
        }
      });

      allParsed.push(...parsedBatch);
      log(`Batch ${batchNum}/${totalBatches} complete. ${allParsed.length}/${targets.length} folders done so far.`);
    }

    log("All per-folder agents complete.");
    return allParsed;
  });
}

// ---- PHASE 3: DEDUP AND SYNTHESIZE ----
// Dedup against the Zotero local library.
// Emit one consolidated manifest + per-folder detail files.

async function dedupAndSynthesize(folderResults) {
  return phase("dedup-and-synthesize", async () => {
    log("Fetching Zotero library for dedup (requires Zotero desktop app open)...");

    const synthesisResult = await agent({
      description: "dedup-and-manifest",
      prompt: `You are the synthesis agent for a Google Drive reference-library inventory.
You have the per-folder JSON results (see FOLDER_RESULTS below) and you must:

1. DEDUP vs Zotero:
   Fetch the Zotero local library using:
     curl.exe "${ZOTERO_API}"
   (Use curl.exe with a pre-built URL string. Do NOT use PowerShell Invoke-RestMethod
   or inline & in a URL -- both mis-parse it. If Zotero is not running, log a note
   and skip dedup; do not fail.)
   Paginate if the library has more than 100 items (increment ?start= by 100).
   For each Drive file, check if a Zotero item's title or filename closely matches.
   Mark files with a dedup_note: "in-zotero" | "possible-match:<zotero-title>" | "".

2. PRIORITY FLAGS:
   Collect all entries where priority_hit is not null across all folders.
   Produce a deduplicated priority_finds list (same file may appear in multiple
   folder results if the folder was listed at multiple levels -- collapse by filename).

3. PER-FOLDER DETAIL FILES:
   Write one markdown file per folder to: ${OUTPUT_DIR}/<folder-name>.md
   Format: a table with columns: filename | type | size_kb | year | category |
   priority_hit | dedup_note | confidence | gdrive_id_if_stub
   Also include counts: file_count, filtered_count, skipped_macos_stubs, gdoc_stub_count.
   Write the file using the Write tool (absolute path from repo root).

4. CONSOLIDATED MANIFEST:
   Write ${MANIFEST_PATH} with:
   - Header: "# Phase D -- Full Drive Reference-Inventory Manifest" + date + folder count
   - Section "## Scope": list of folders inventoried + the 3 skipped (already done) +
     the Envirotox exclusion
   - Section "## Priority Finds": a table of all priority_finds across all folders with
     folder, filename, priority_hit, dedup_note
   - Section "## Rollup": total files, total filtered, total gdoc stubs, total skipped
     macos stubs, total in-zotero matches, total new (not in zotero)
   - Section "## Per-Folder Summary": one row per folder with folder_name, file_count,
     filtered_count, priority_find_count, errors_count
   - Section "## Errors": any agent errors or parse failures
   - Section "## Notes": (1) cite that the 3 priority folders are already inventoried
     at library_inventory_2026_06_09/; (2) Envirotox excluded; (3) Zotero dedup status
     (ran or skipped + reason); (4) next steps for Zotero import

FOLDER_RESULTS:
${JSON.stringify(folderResults, null, 2)}
`
    });

    log("Synthesis complete. Manifest written.");
    log(`Output: ${MANIFEST_PATH}`);
    log(`Per-folder files: ${OUTPUT_DIR}/`);
    return synthesisResult;
  });
}

// ---- MAIN PIPELINE ----

export default async function main(args) {
  log("=== Phase D: Full Drive Reference-Inventory Workflow ===");
  log("Exclusions: Envirotox + 3 already-inventoried priority folders.");
  log("Zotero dedup: requires desktop app open at http://localhost:23119/");
  log("");

  const targets = await discoverFolders();

  if (targets.length === 0) {
    log("No folders to inventory after exclusions. Exiting.");
    return;
  }

  const folderResults = await inventoryFanOut(targets);

  await dedupAndSynthesize(folderResults);

  log("=== Phase D complete. ===");
  log(`Manifest: ${MANIFEST_PATH}`);
  log(`Priority finds: check the manifest's Priority Finds section for named sources.`);
}
```

---

## 5. Launch Instructions

### Option A -- Inline script (paste into a Workflow tool call)

In a Claude Code session (from `C:\projects\sstac-dashboard`):

1. Open a fresh Claude Code session (not one with a poisoned/heavy context).
2. Confirm prerequisites: Zotero desktop open; G:\ mounted.
3. Invoke the Workflow tool with the script above:

```
Workflow({
  script: `<paste the entire JS block above here>`,
  args: {}
})
```

The Workflow tool is a deferred/cloud tool -- load its schema first if needed:
  `ToolSearch({ query: "select:Workflow" })` (if it is not already in scope).

### Option B -- scriptPath (save to a file first)

1. Save the script to a `.js` file (e.g., `scripts/workflows/phase-d-drive-inventory.js`).
2. Invoke:

```
Workflow({
  scriptPath: "scripts/workflows/phase-d-drive-inventory.js",
  args: {}
})
```

### Token / credit note

- Each per-folder agent on STANDARD context can handle ~500-1,000 files reliably
  (filename-first, capped spot-reads). Large folders (>500 files) may need to be
  broken into sub-batches by sub-folder in a follow-up run.
- If the session has `/usage-credits` enabled, agents can deep-read more PDFs;
  update the spot-read cap (currently 3) in `folderAgentPrompt` accordingly.
- The References folder (560 files) was inventoried last session in a single agent
  on standard context with filename-first + 3 spot-reads. That is the proven ceiling.

### Expected outputs

After a successful run:

- `matrix_research/reference_catalog/drive_inventory_phase_d_manifest.md` -- consolidated
  manifest (priority finds, rollup, per-folder summary, errors, next steps)
- `matrix_research/reference_catalog/library_inventory_phase_d/<folder-name>.md` --
  one file per inventoried folder

Commit these in a fresh session after the run (codex + gate process per L0 1.3 +
docs/GATE_MODE_SOP.md). They are documentation-only files; no lint or test impact.

---

## 6. Notes and caveats

### What this workflow does NOT do

- It does not import anything into Zotero. Import is a separate step (owner runs
  Zotero native bulk Add Files with Retrieve Metadata, or uses `zotero-write-queues/`
  scripts with the web API write key, owner-held). The dedup stage only reads the
  local Zotero API; it has no write path.
- It does not update the catalog (`human_health_trv_values.json`, `sources.json`,
  `parameter_values.json`). Catalog entries require HITL-authored values with
  explicit qa_status promotion; AI never writes qa_status.
- It does not open or deeply analyze the Envirotox database (~8,780 data files).
  That folder is excluded explicitly and permanently for this workflow.
- It does not re-inventory the 3 priority folders (already done; see
  `matrix_research/reference_catalog/library_inventory_2026_06_09/`).

### OneDrive

OneDrive sweep is a separate effort (owner was unable to log in during the 2026-06-09
session). When authenticated, apply the same per-folder agent pattern against the
OneDrive mount path. Workflow script can be adapted; the exclusion and priority-source
lists apply there too.

### If the per-folder manifest is too large for context

Break the fan-out into two runs:
  Run A: SABCS subfolders only.
  Run B: top-level Drive folders outside SABCS.
Combine the two manifest files manually (or run a third synthesis agent over both).

### Relationship to existing inventory files

| File | Scope | Status |
|---|---|---|
| library_inventory_2026_06_09/references.md | SABCS/References (560 files) | DONE -- Phase C |
| library_inventory_2026_06_09/twg-preliminary-research.md | SABCS/TWG - Preliminary Research (140 files) | DONE -- Phase C |
| library_inventory_2026_06_09/white-paper-scoping.md | SABCS/White Paper and Scoping (86 files) | DONE -- Phase C |
| drive_inventory_phase_d_manifest.md | All remaining Drive folders | PENDING -- this workflow |

---

*Authored 2026-06-09. Based on sec 4 of FRESH_SESSION_HANDOFF_2026_06_09_INVENTORY_2B.md.*
*L0 rules: plain ASCII, no mass deletions, codex iterate-to-GREEN before commit.*
