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

## Active Guides

- **Vercel Setup**: [`../operations/VERCEL_SETUP.md`](../operations/VERCEL_SETUP.md)
- **Monitoring Guide**: [`../operations/MONITORING_GUIDE.md`](../operations/MONITORING_GUIDE.md)

---

## Historical archives

- Full review (historical): `archive/COMPREHENSIVE_REVIEW_PROGRESS.md`
- Week-by-week records: `archive/WEEK*-*_COMPLETION_SUMMARY.md`
- Consolidated week summary: `archive/MASTER_COMPLETION_SUMMARY.md`

---

## How to use

- For any change, use `docs/INDEX.md` + `npm run docs:gate` to determine required doc review.
- Before moving/archiving docs, ensure `npm run docs:archive:investigate` stays green.
