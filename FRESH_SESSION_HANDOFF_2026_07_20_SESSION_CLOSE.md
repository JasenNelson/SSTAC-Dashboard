# Fresh Session Handoff - 2026-07-20 (Session Close)

## STATUS
- origin/main = c1e79be4ae7d748f56d5a66d513a969a0aff6698 (2026-07-20)
- One-line state: Idle on origin/main, awaiting owner merge of #703 and #704.

## SHIPPED THIS SESSION
- #692: cheap Guidance index (269 PDFs, metadata-only)
- #693: Phase2TasksSection test
- #694: no-explicit-any (2 test files)
- #695: 4 D2a inhalation rows + BC CSR source registered
- #696: audit-script type-safety
- #697: HI/ILCR wired as source-backed inhalation defaults (provenance-only, zero numeric change)
- #698: HI/ILCR review_notes de-stale
- #699: ILCR re-source HC PQRA -> BC CSR s.18
- #700: Option B methodology packet (design only)
- #701: docs-manifest vitest_test_count 5635 -> 5821
- #702: promote-script generator sync

## OPEN / AWAITING OWNER MERGE
- #703: remove 27 no-explicit-any + 1 prefer-const across 5 MO test files; types-only, 107/107 tests unchanged.
- #704: guide/content type-guard + coercion tests, additive, 17 tests, with an independent pinned roster anchor.

## KEY DECISIONS
- SVI THQ->HI correction: The draft SVI packet's "THQ = 0.2" was WRONG for BC. The BC operative metric is the Hazard Index (HI) = 1.0 per BC CSR (B.C. Reg. 375/96) Section 18. The HI row is BC-CSR-sourced; ILCR = 1e-5 was also re-sourced to BC CSR s.18 (s.18 specifies both, corroborated in sources.json). THQ 0.2 was never applied. Caught at the dry-run owner gate.
- IR intake-model ruling (OPTION A): The 2 HC PQRA IR_air rows (adult 16.6, toddler 8.3 m3/day) stay VERIFIED REFERENCE-ONLY; EPA SSL concentration-based inhalation remains the SOLE operational method. Option B (intake-based model) is a future owner-initiated lane; packet merged in #700.
- All 4 D2a rows are non-operational needs_review / not_default; HI + ILCR are wired by id-pin (provenance only, no default_status promotion).

## OPERATIONAL FINDINGS
1. CODEX: `codex-cli 0.142.5` is installed. The BINARY resolves, but `codex review` is UNUSABLE in this repo: given a single-file memo review with a file-based prompt and hard timeout, it ignored the scope instruction, dumped ~1308 lines of repo source, hit exit 124 at 350s, and produced NO VERDICT line (10620 lines of output). Fallbacks that DID work today: cursor-agent (gpt-5.3-codex-xhigh) returned a clean verdict in one shot; Opus/Sonnet adversarial reviewer subagents caught three real defects. Do NOT plan codex as the per-commit gate without a bounded probe + immediate fallback.
2. SQUASH-MERGE DETECTION: this repo squash-merges, so `git branch --merged` / `git merge-base --is-ancestor` UNDERCOUNTS merged branches (a squash-merged branch tip is never an ancestor of main -- verified on #692 and #693 branches). Use `gh pr list --state all` joined on headRefName as the truth source for worktree/branch cleanup decisions.
3. AGY-FIRST: worked end to end at zero weekly-Claude budget for all mechanical authoring; the orchestrator must always verify (AGY introduced 5 tsc errors in one draft and a wrong assumption_tags copy in another -- both caught by gates/review).

## HELD / OWNER-GATED (do NOT start without explicit owner approval)
1. Merge #703 and #704.
2. Worktree cleanup -- DRY-RUN inventory only was done. ~101-110 worktrees; 76 SAFE-remove by PR-merged state (NOT by ancestry -- see finding 2). Junction-safe procedure mandatory: remove the node_modules junction FIRST, verify the shared store is unchanged, THEN git worktree remove + prune. NO deletions performed. 14 worktrees were created this session.
3. Zotero write lane -- local API is UP (localhost:23119); read-only preflight showed existing attachments are imported_url web snapshots, NONE linked to G:. The G: Guidance corpus (269 PDFs) is a clean linked-reference candidate using the #692 filename index (no PDF opening). Needs an owner ruling on subset, dedup, and collection structure before any create/update.
4. Option B intake-model implementation (5 owner rulings in the #700 packet).
5. ~41 .tmp_* scratch files at the repo root from this session -- recommend-only, not deleted.

## RESUME POINTERS
- Start from origin/main.
- Fresh worktrees off origin/main only -- the shared local checkout is ~160 commits stale.
- Never `git checkout -b` in the shared checkout.
- No `gh pr merge`.
- AGY-first.
