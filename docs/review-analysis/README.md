# Review & Analysis Documentation

> **Canonical docs entrypoint:** `docs/INDEX.md`  
> **Volatile metrics policy:** Do not hardcode grades/test counts in this folder. Store volatile metrics in `docs/_meta/docs-manifest.json` (`facts`) and/or reference `docs/INDEX.md`.

---

## Purpose

This folder contains review/assessment artifacts from **November 2025**:

- executive summaries and roadmaps
- phase completion summaries
- implementation checklists
- historical archives (see `archive/`)

---

## Start here

- **Executive summary**: [`REVIEW_SUMMARY.md`](REVIEW_SUMMARY.md)
- **Roadmap / current work queue**: [`NEXT_STEPS.md`](NEXT_STEPS.md)

---

## Key documents

- **Phase 3 completion**: [`PHASE3_COMPLETION_SUMMARY.md`](PHASE3_COMPLETION_SUMMARY.md)
- **Path / plan**: [`A_MINUS_ACHIEVEMENT_PLAN.md`](A_MINUS_ACHIEVEMENT_PLAN.md)
- **Poll-safe tasks**: [`POLL_SAFE_IMPROVEMENTS.md`](POLL_SAFE_IMPROVEMENTS.md)
- **Change verification**: [`CODE_CHANGE_VERIFICATION_PROCESS.md`](CODE_CHANGE_VERIFICATION_PROCESS.md)

---

## Historical archives

- Full review (historical): `archive/COMPREHENSIVE_REVIEW_PROGRESS.md`
- Week-by-week records: `archive/WEEK*-*_COMPLETION_SUMMARY.md`
- Consolidated week summary: `archive/MASTER_COMPLETION_SUMMARY.md`

---

## How to use

- For any change, use `docs/INDEX.md` + `npm run docs:gate` to determine required doc review.
- Before moving/archiving docs, ensure `npm run docs:archive:investigate` stays green.
