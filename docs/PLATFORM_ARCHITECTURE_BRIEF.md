# SSTAC-Dashboard -- Lead Systems Architect Brief

Prepared as presentation source material: a high-level architectural scan of the SSTAC-Dashboard as
an integrated platform for collaborative scientific research and sediment-standards policy development.

## 1. Platform Purpose

A unified ecosystem that turns raw sediment-toxicity science into defensible, auditable regulatory
policy. SSTAC-Dashboard collapses the traditional gap between data, analysis, and decision. Where
sediment-standards development normally lives across disconnected spreadsheets, PDF review cycles,
and email threads, this platform makes the entire pipeline -- evidence -> model -> derivation ->
stakeholder deliberation -> judgment -- a single, traceable surface. Every standard it helps produce
carries its provenance back to the source data, and every human judgment is recorded against that
evidence rather than replacing it.

Throughline: evidence-to-policy traceability. The AI surfaces and organizes evidence; qualified
humans (HITL) make the calls.

## 2. Key Functional Pillars

### Pillar A -- The Analytical Engine (quantitative core)
Three interlocking model families convert toxicity data into candidate standards:
- BN-RRM (Bayesian Network Risk/Resource Management) -- interactive risk maps and HITL decision
  packets that model uncertainty across competing lines of evidence.
- Matrix Options -- Protocol-28-grounded standards calculators with a curated evidence library
  (US EPA IRIS, Health Canada, BC Protocol 28 TRVs), full provenance tracking, and a HITL-curated
  default-policy library.
- SSD Workbench -- Species Sensitivity Distribution modelling with HCp derivation, parity-tested
  against the R `ssdtools` standard, fed by ECOTOX toxicity records.

### Pillar B -- The Collaborative Interface (deliberation layer)
The same evidence is opened up to structured stakeholder input:
- Live polling (CEW 2025 sessions + results) for real-time expert consensus capture.
- White-paper / document review and commenting (TWG review portal, structured review workflows) so
  feedback attaches to specific evidence, not a detached document.
- Submission and upload portals for contributed data and review packages.

### Pillar C -- The Data Foundation (single source of truth)
A dual-store architecture feeds everything above:
- PostgreSQL (Supabase) -- auth, role governance, matrix-map data, saved views, and the HITL
  judgment write-path.
- RRAA engine v1 policy database (read-only SQLite) -- the assessment/policy record.
- Curated reference catalogs + ECOTOX -- validated regulatory values (IRIS/EPA, Health Canada,
  Protocol 28) and toxicity data that drive the models, with retrieval-status and data-integrity
  gates.

Interconnection: the Data Foundation feeds the Analytical Engine; the Engine's outputs are exposed
through the Collaborative Interface; stakeholder input and HITL judgments write back to the
Foundation -- a closed, auditable loop.

## 3. Architectural Value Proposition

Why this beats siloed, traditional review:
- Integrated, not fragmented. Data, models, and deliberation share one platform and one record --
  no reconciling versions across tools.
- Provenance by construction. Every value traces to its source (e.g., validated against the EPA
  IRIS source data, not memory); standards are defensible because their derivation is inspectable.
- Governed human-in-the-loop. The AI organizes and surfaces evidence; it never sets a policy default
  or writes a verdict. Qualified reviewers judge -- captured with rationale.
- Reproducible and verifiable. Model logic (e.g., SSD vs `ssdtools` parity) and data-integrity gates
  make results auditable and repeatable -- the scientific bar a regulatory process must clear.
- Structured collaboration at scale. Polling and attached-to-evidence commenting turn diffuse expert
  input into a structured, queryable record instead of an inbox.

## 4. Future Outlook -- Supporting "Living" Policy

The platform is built so standards stay current rather than frozen at publication:
- Evidence library that grows. New EPA/IRIS/Health Canada values are ingested with retrieval-status
  and integrity checks; standards can be re-derived as the science advances.
- Continuous stakeholder feedback loops. Polling and review portals capture new expert input,
  attached to evidence, on an ongoing basis -- not just once.
- Versioned, auditable change. Because every derivation and judgment is recorded with provenance, a
  standard can be revisited, re-evaluated against new data, and the why-it-changed is preserved.
- Automation-ready. The Agentic OS layer positions the platform to assist with routine ingestion and
  synthesis under human governance -- scaling the science without sacrificing oversight.

Closing line: From data to decision to deliberation -- and back again. SSTAC-Dashboard makes sediment
policy a living, evidence-anchored system rather than a static document.
