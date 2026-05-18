// Glossary dictionary for methodology surface.
//
// Single source of truth for ~35 technical terms surfaced across V1Content,
// V2Content, and TransitionContent. Consumed by the DefinedTerm component
// which renders an inline hover/click popover. Definitions are honest and
// load-bearing-claim aware (e.g., v0.42 lifecycle_state uses the JSON enum
// verbatim, not "GREEN-LIGHT"; M-4 cite Appendix D Section D.2).
//
// Authoring discipline:
//   - `short` is plain English, 1-2 sentences, popover-sized.
//   - `full` is an optional 3-4 sentence expansion for the click-to-expand path.
//   - `cite` points at methodology paper sections, NOT line ranges.
//   - ASCII only; no emoji, no smart quotes, no Unicode arrows.

export interface GlossaryEntry {
  term: string;
  short: string;
  full?: string;
  cite?: string;
}

// Keys are the canonical short form, case-sensitive. The wrapped JSX child
// can use any casing; DefinedTerm normalizes via the `term` prop.
export const GLOSSARY: Record<string, GlossaryEntry> = {
  // ---------------------------------------------------------------------
  // v1 pipeline stages
  // ---------------------------------------------------------------------
  S1: {
    term: 'S1',
    short:
      'Stage 1 of the v1 pipeline: deterministic candidate harvest via keyword and embedding indices. No AI calls. Hard-capped at 50 entries per policy.',
    full:
      'S1 is the only deterministic stage of the v1 Shadow-Additive Pipeline. Given a policy keyword set and anchors, it pulls candidate evidence entries from the submission using keyword matching and an embedding nearest-neighbor pre-rank. The S1 baseline measurement is 1,487 candidates per policy, 94% keyword-driven, with 60.1% noise.',
    cite: 'Part III Section 7.1; Appendix B Section B.0.1',
  },
  S2: {
    term: 'S2',
    short:
      'Stage 2: a small local language model (mistral-nemo via Ollama) labels each S1 candidate as supporting, negating, or neutral evidence. Capped at 30 entries per policy.',
    cite: 'Part III Section 7.2',
  },
  'S2.5': {
    term: 'S2.5',
    short:
      'Boundary pre-rank between S1 and S2: reorders S1 candidates by embedding cosine similarity so the S2 attention budget lands on the most relevant entries.',
    cite: 'Part III Section 7.2',
  },
  S3: {
    term: 'S3',
    short:
      'Stage 3 prioritizer: labels each entry RELEVANT, UNCERTAIN, or NOT_RELEVANT. Does not delete entries; the labels are flags for downstream filtering and ranking. Applies the Pyramid of Compliance authority ordering.',
    cite: 'Part III Section 7.3',
  },
  S4: {
    term: 'S4',
    short:
      'Stage 4 synthesizer: compiles labeled evidence into a per-policy HITL-ready packet with an AI-suggested verdict from {PASS, PARTIAL, FAIL, NOT_FOUND}. FAIL-CLOSED on parse errors.',
    full:
      'S4 is the final v1 stage. It assembles the labeled evidence from S3 into a structured per-policy packet with verbatim citations, an AI-suggested verdict, and a confidence rationale for the HITL reviewer. The FAIL-CLOSED policy means parse failures route to NOT_FOUND with a structured error rather than emit a malformed verdict.',
    cite: 'Part III Section 7.4',
  },
  'Shadow-Additive pipeline': {
    term: 'Shadow-Additive pipeline',
    short:
      'The v1 four-stage evaluation pipeline (S1 harvest, S2 fast-AI label, S3 prioritize, S4 synthesize). Named "shadow-additive" because each stage adds metadata to candidates rather than discarding them; the HITL can audit every step.',
    cite: 'Part III Sections 7.1-7.4',
  },
  'applicability filter': {
    term: 'applicability filter',
    short:
      'Pre-stage filter that narrows the 5,860 active policies down to ~1,500-2,000 applicable policies for a given submission, using media type, contaminants of concern, and site characteristics. Runs FIRST in the data flow.',
    cite: 'Part III Section 9; Appendix B Section B.0.1',
  },

  // ---------------------------------------------------------------------
  // v1 architecture / authority
  // ---------------------------------------------------------------------
  'Pyramid of Compliance': {
    term: 'Pyramid of Compliance',
    short:
      'The authority hierarchy: Acts > Regulations > Protocols > Technical Guidance > External > CSAP. Carries two axes (source-authority ordering plus calibrated numeric weights for retrieval ranking) that are preserved together.',
    full:
      'The numeric weights (Acts 1.0 / Regulations 0.9 / Protocols 0.8 / Technical Guidance 0.7 / CSAP 0.6 / External 0.35) are NOT monotonic with the ordering. External (Level 4) is numerically lower than CSAP (Level 5) because BC External is dominated by out-of-jurisdiction documents while CSAP is BC-jurisdictional consensus with high citation frequency. The inversion is intentional calibration, not a defect.',
    cite: 'Part III Section 10.1; Appendix D Section D.4',
  },
  'authority hierarchy': {
    term: 'authority hierarchy',
    short:
      'When sources conflict, higher authority prevails. Encoded by the Pyramid of Compliance ordering and the calibrated numeric weights used in retrieval ranking.',
    cite: 'Part III Section 10.1',
  },
  'ralph-hybrid': {
    term: 'ralph-hybrid',
    short:
      'The canonical v1 semantic-matcher type: local embeddings combined with optional Claude reasoning, no API fallback. One of two allowed matcher types under the v74.0 architecture lock.',
    cite: 'Appendix D Section D.1',
  },
  'v74.0 architecture lock': {
    term: 'v74.0 architecture lock',
    short:
      'Code-level lock at engine/scripts/core/ai_semantic_matcher.py that raises ValueError if forbidden v1 parameters re-enter the pipeline (notably low_threshold) or if an unsupported matcher type is requested.',
    full:
      'The v74.0 lock guards the v1 fusion stage. It was introduced after the Ralph Loop bypass and the "10x correction" cross-session drift incidents. Documentation alone proved insufficient; the lock enforces architectural decisions at the code boundary so forbidden values cannot silently re-enter.',
    cite: 'Appendix D Section D.1',
  },
  low_threshold: {
    term: 'low_threshold',
    short:
      'A forbidden v1 parameter. When set to 0.3, it auto-routed ~67% of uncertain cases to NOT_FOUND without semantic matching. The v74.0 lock raises ValueError if any caller passes low_threshold.',
    cite: 'Appendix B Section B.3; Appendix D Section D.1',
  },
  'AI semantic matcher': {
    term: 'AI semantic matcher',
    short:
      'The v1 fusion component that combines keyword, embedding, and (when enabled) Claude reasoning signals into per-candidate match scores. Implemented at engine/scripts/core/ai_semantic_matcher.py.',
    cite: 'Appendix A Section A.1',
  },

  // ---------------------------------------------------------------------
  // v2 substrate
  // ---------------------------------------------------------------------
  LightRAG: {
    term: 'LightRAG',
    short:
      'Open-source retrieval framework (HKUDS, MIT-licensed) combining embeddings with a knowledge graph. v2 adopts it as the retrieval substrate for M2.',
    cite: 'Part VI Section 25',
  },
  'RAG-Anything': {
    term: 'RAG-Anything',
    short:
      'Multi-modal extension of LightRAG that handles tables, figures, equations, and other non-text content. v2 adopts it for M3 over the full policy KB.',
    cite: 'Part VI Section 27',
  },
  Docling: {
    term: 'Docling',
    short:
      'IBM open-source document-extraction library. v2 uses Docling 2.77 with vision-language model annotations and force-full-page-OCR to capture figures, tables, and scanned content that v1 lost as "[Figure]" placeholders.',
    cite: 'Part VI Section 24',
  },
  M1: {
    term: 'M1',
    short:
      'Milestone 1 of the v2 substrate: multi-modal Docling extraction. LANDED. Enables figure descriptions, force-full-page OCR, and a LightRAG-shaped content_list sidecar (M1.5).',
    cite: 'Part VI Section 24; Appendix C Section C.4',
  },
  'M-4': {
    term: 'M-4',
    short:
      'Missing Piece 4 of the v2 architecture proposal: the v74.1+ architecture lock guarding the v2 retrieval surface. LANDED at engine_v2/src/rraa_v2/architecture_lock_retrieval.py with 33 anti-drift tests.',
    full:
      'M-4 is the v2 analog of the v74.0 lock. It enforces three guards: query-mode lock (naive/global require explicit opt-in), rerank lock (enabled by default), and authority-coefficient bounds [1.0, 2.0] with a compute_authority_boost formula that respects the Pyramid of Compliance ordering.',
    cite: 'Appendix D Section D.2',
  },
  M2: {
    term: 'M2',
    short:
      'Milestone 2: the LightRAG retrieval shim that replaces v1 keyword-primary retrieval with graph-plus-vector hybrid retrieval. IN PLAN, READY (post-2026-05-17 ontology signoff at engine-v2 commit 05fd767b satisfied Amendment A-8); pre-M2 NetworkX spike authorized + ready.',
    cite: 'Part VI Section 25',
  },
  M3: {
    term: 'M3',
    short:
      'Milestone 3: full multi-modal knowledge graph over all 5,860 active policies on Postgres + Apache AGE. IN PLAN, BLOCKED on M2 completion plus three remaining pre-M3 gates (G1 cost re-baseline, G2 cross-ref audit, G4 owner cost approval); G3 authority injection is DONE via M-4. Ontology signoff is no longer a separate blocker.',
    cite: 'Part VI Section 27',
  },
  'BGE embeddings': {
    term: 'BGE embeddings',
    short:
      'BAAI General Embedding family. v2 uses BGE for its primary embedding signal: higher-dimension, instruction-tuned vectors that outperform v1\'s sentence-transformer model on legal text.',
    cite: 'Part VI Section 25',
  },
  'query mode': {
    term: 'query mode',
    short:
      'LightRAG retrieval mode selector. Four modes: naive (vector-only, bypasses graph), local (entity-anchored graph traversal), global (LLM-authored community summaries), hybrid (default; local + global blended).',
    full:
      'Under the M-4 lock, naive and global modes require explicit opt-in because both bypass key safety properties: naive skips the graph entirely; global synthesizes LLM-authored summaries that risk surfacing as evidence without verbatim provenance. Hybrid is the safe default.',
    cite: 'Appendix D Section D.2',
  },

  // ---------------------------------------------------------------------
  // v2 architecture / locks
  // ---------------------------------------------------------------------
  'v74.1+ M-4 lock': {
    term: 'v74.1+ M-4 lock',
    short:
      'The v2 retrieval-surface architecture lock. Three guards: query-mode gate, rerank gate, and authority-coefficient bounds [1.0, 2.0]. The v2 analog of the v74.0 fusion-stage lock; both coexist.',
    cite: 'Appendix D Section D.2',
  },
  'authority coefficient': {
    term: 'authority coefficient',
    short:
      'A scalar in [1.0, 2.0] that scales how strongly the Pyramid of Compliance influences retrieval ranking. 1.0 is identity (no boost); 2.0 is maximum (Acts get 2x, CSAP 1.6x, External 1.35x).',
    cite: 'Appendix D Section D.2',
  },
  authority_value: {
    term: 'authority_value',
    short:
      'The pinned per-level numeric weight in the Pyramid of Compliance (Acts 1.0 / Regs 0.9 / Protocols 0.8 / Tech Guidance 0.7 / CSAP 0.6 / External 0.35). Consumed at runtime by the M-4 authority-boost formula.',
    cite: 'Appendix D Section D.2',
  },
  'rerank lock': {
    term: 'rerank lock',
    short:
      'One of the three M-4 guards. Rejects enable_rerank=False without explicit opt-in. The reranker is the engine\'s quality floor on retrieval ranking.',
    cite: 'Appendix D Section D.2',
  },
  'entity ontology': {
    term: 'entity ontology',
    short:
      'The schema defining entity types and relationships that LightRAG will extract from documents to build its knowledge graph. v2 ontology at v1.0.0 (lifecycle_state HITL_SIGNED_OFF_V1_0_0) as of 2026-05-17 owner signoff at engine-v2 commit 05fd767b.',
    full:
      'M2 entity-extraction code was originally BLOCKED until the HITL signed off on the ontology (Amendment A-8 of the LightRAG architecture proposal); that signoff landed on 2026-05-17, unblocking M2. The ontology iterated through three arcs: v0.10 -> v0.40 (30 versions; 4 codex CLI holistic + 27 targeted rounds; closed via R-HOLISTIC-FIX-28), v0.40 -> v0.42 (R-HOLISTIC-FIX-29; 29 findings cleared), and v0.42 -> v1.0.0 (owner HITL signoff round at commit 05fd767b).',
    cite: 'Part VI Section 25; ontology file engine_v2/data/lightrag_entity_ontology_v1.json',
  },
  lifecycle_state: {
    term: 'lifecycle_state',
    short:
      'A JSON enum field in the entity ontology recording its review state. Current value: HITL_SIGNED_OFF_V1_0_0 (advanced 2026-05-17 from prior v0.42 state AI_REVISION_COMPLETE_PENDING_HITL_REVIEW via owner signoff at engine-v2 commit 05fd767b).',
    cite: 'engine_v2/data/lightrag_entity_ontology_v1.json',
  },
  AI_REVISION_COMPLETE_PENDING_HITL_REVIEW: {
    term: 'AI_REVISION_COMPLETE_PENDING_HITL_REVIEW',
    short:
      'Historical lifecycle_state of the v2 entity ontology at v0.42-strawman (2026-05-17 pre-signoff). Indicated the AI authoring loop was complete and the human reviewer had not yet signed off. Superseded 2026-05-17 by HITL_SIGNED_OFF_V1_0_0 at signoff commit 05fd767b. Never equivalent to "GREEN-LIGHT".',
    cite: 'engine_v2/data/lightrag_entity_ontology_v1.json (historical; current value is HITL_SIGNED_OFF_V1_0_0)',
  },
  HITL_SIGNED_OFF_V1_0_0: {
    term: 'HITL_SIGNED_OFF_V1_0_0',
    short:
      'Terminal lifecycle_state for the v2 entity ontology. REACHED 2026-05-17 via owner HITL signoff at engine-v2 worktree commit 05fd767b (signed by Jasen Nelson, registered BC toxicologist). Unlocks M2 entity-extraction code per Amendment A-8 effective signoff date.',
    cite: 'engine_v2/data/lightrag_entity_ontology_v1.json header + signoff_record block',
  },

  // ---------------------------------------------------------------------
  // HITL framing
  // ---------------------------------------------------------------------
  HITL: {
    term: 'HITL',
    short:
      'Human-In-The-Loop. The Qualified Professional or Statutory Decision Maker who reviews the AI\'s surfaced evidence and applies professional judgment. The HITL classifies policies into tiers and makes the adequacy / compliance call; the AI is an evidence-finder, not a tier-judge.',
    cite: 'Part I Section 2',
  },
  'discretion tier': {
    term: 'discretion tier',
    short:
      'A HITL-side classification of the regulatory text\'s discretion level: TIER_1_BINARY (must/shall), TIER_2_PROFESSIONAL (should/sufficient), TIER_3_STATUTORY (may/Director). Tiers are HITL workflow, not AI behavior.',
    cite: 'Part I Section 2; CLAUDE.md HITL Tier Model section',
  },
  TIER_1_BINARY: {
    term: 'TIER_1_BINARY',
    short:
      'HITL discretion tier for binding regulatory text (must / shall / required / protocol). Allows verdicts ADEQUATE, INADEQUATE, DEFICIENT, REQUIRES_REVIEW. No additional human gate beyond the QP.',
    cite: 'CLAUDE.md HITL Tier Model section',
  },
  TIER_2_PROFESSIONAL: {
    term: 'TIER_2_PROFESSIONAL',
    short:
      'HITL discretion tier for professional-judgment text (should / sufficient / appropriate). Allows only DEFICIENT or REQUIRES_REVIEW; the v2_judgments write path REJECTS ADEQUATE and INADEQUATE here.',
    cite: 'CLAUDE.md HITL Tier Model section',
  },
  TIER_3_STATUTORY: {
    term: 'TIER_3_STATUTORY',
    short:
      'HITL discretion tier for statutory-discretion text (may / Director / discretion). Allows only OBSERVATION_ONLY; the v2_judgments write path rejects every other verdict. Escalates to SDM / Crown.',
    cite: 'CLAUDE.md HITL Tier Model section',
  },
  tier_assigned_by: {
    term: 'tier_assigned_by',
    short:
      'Database column tracking who assigned a policy\'s discretion tier. As of 2026-05-16, only 78 rows have a non-AI value; tiers are still mostly AI defaults awaiting HITL review.',
    cite: 'CLAUDE.md Active Review Mode section',
  },
  v2_judgments: {
    term: 'v2_judgments',
    short:
      'Supabase table that captures HITL judgments under v2. Server-side and database-level constraints enforce the tier-verdict matrix and archive prior verdicts to v2_judgment_history.',
    cite: 'supabase/engine_v2/database_schema_engine_v2_lane2b_patch.sql',
  },

  // ---------------------------------------------------------------------
  // Cross-cutting concepts
  // ---------------------------------------------------------------------
  'AEE RP': {
    term: 'AEE RP',
    short:
      'Aquatic Effects Endpoint Remediation Plan. A 7-page real-submission PDF used as engine v2 Canary 2. Pages 4-7 (figures and analytical tables) extracted as 8 characters each under v1, surfacing the multi-modal extraction gap.',
    cite: 'Appendix C Section C.3',
  },
  FRDR: {
    term: 'FRDR',
    short:
      'Federated Research Data Repository. The Canadian repository where the RRAA Construction Methodology paper will be archived for citation; assigns a DOI for permanent reference.',
    cite: 'PLAN Section 11',
  },
  evidence_packet: {
    term: 'evidence_packet',
    short:
      'The S4 output structure: a per-policy bundle of cited evidence slices, AI-suggested verdict, confidence rationale, and provenance. The HITL reviews evidence_packets to form judgments.',
    cite: 'engine_v2/contracts/s4_output schema 0.0.1',
  },
  evidence_index: {
    term: 'evidence_index',
    short:
      'The frozen v2 schema (engine_v2/contracts/evidence_index 0.0.1) that records every evidence slice surfaced by retrieval, with edge_type, content_hash, and source provenance fields.',
    cite: 'engine_v2/contracts/evidence_index',
  },
  canary: {
    term: 'canary',
    short:
      'A scenario-driven end-to-end test of the v2 pipeline against a known submission, scored on verdict-class and evidence-presence axes. Pass / Fail / Inconclusive verdicts logged in CANARY_LOG.md.',
    cite: 'Appendix C Section C.1',
  },
  'Canary 2': {
    term: 'Canary 2',
    short:
      'The AEE Remediation Plan canary. Initial run FAIL (false-positive ADEQUATE verdicts). C1+C2+C3 fixes landed; re-run INCONCLUSIVE because the input was too thin for retrieval to exercise C2+C3 end-to-end. Verdict not softened.',
    cite: 'Appendix C Section C.5',
  },
  INCONCLUSIVE: {
    term: 'INCONCLUSIVE',
    short:
      'A canary verdict indicating fixes were applied but the test did not exercise them end-to-end. NOT equivalent to PASS. Honest reporting; surfaced explicitly so the next canary covers the unexercised paths.',
    cite: 'Appendix C Section C.5',
  },
  KB: {
    term: 'KB',
    short:
      'Knowledge Base. The production policy database at engine/data/rraa_v3_2.db: 5,968 policy rows (5,860 active) extracted from 70 source documents. Shared by v1 and v2; read directly by both engines plus the dashboard.',
    cite: 'Part II Section 4.1; Appendix G',
  },
  'codex E-15 lesson': {
    term: 'codex E-15 lesson',
    short:
      'A standing methodology lesson: codex CLI is preferred over the codex MCP for both targeted iterative reviews and holistic strategic reviews. MCP is fallback only.',
    cite: 'feedback_codex_review_targeted_vs_holistic_2026_05_13.md',
  },
  'mutual-agreement methodology': {
    term: 'mutual-agreement methodology',
    short:
      'The /codex-review skill protocol: orchestrator and codex must reach explicit agreement on findings. When the orchestrator disagrees with a codex finding, it must quote it verbatim and ask codex to defend / revise / withdraw. Silent acceptance defeats the adversarial purpose.',
    cite: 'codex_review_mutual_agreement_methodology_2026_05_16.md',
  },
  BDeu: {
    term: 'BDeu',
    short:
      'Bayesian Dirichlet equivalent uniform score: the standard Bayesian network structure score used in BN-RRM (adjacent project). Combines fit-to-data with a complexity penalty controlled by the Equivalent Sample Size (ESS).',
    cite: 'BN-RRM MODEL_SPECIFICATION.md',
  },
  ESS: {
    term: 'ESS',
    short:
      'Equivalent Sample Size. The BDeu hyperparameter that controls how strongly the prior pulls structure scores toward sparsity. Low ESS = data-driven; high ESS = prior-driven. Tuned per BN-RRM use case.',
    cite: 'BN-RRM MODEL_SPECIFICATION.md',
  },

  // ---------------------------------------------------------------------
  // Documents / repos
  // ---------------------------------------------------------------------
  'Regulatory-Review': {
    term: 'Regulatory-Review',
    short:
      'The engine repository at C:/Projects/Regulatory-Review. Contains the engine (v1 + v2), the policy KB, the methodology paper, and the extraction pipeline.',
    cite: 'Appendix A Section A.1',
  },
  'SSTAC-Dashboard': {
    term: 'SSTAC-Dashboard',
    short:
      'The frontend repository at C:/Projects/SSTAC-Dashboard. A Next.js app that reads the engine KB directly and writes assessment results to its own regulatory-review.db.',
    cite: 'CLAUDE.md Key Locations section',
  },
  'engine-v2 worktree': {
    term: 'engine-v2 worktree',
    short:
      'Git worktree at C:/Projects/Regulatory-Review-worktrees/engine-v2 (master branch). All v2 development commits land here. Commits are NOT pushed; owner authorization required.',
    cite: 'CLAUDE.md Key Locations section',
  },
  ENGINE_SPECS: {
    term: 'ENGINE_SPECS',
    short:
      'engine/docs/active/development/ENGINE_SPECS.md. The authoritative engine v1 specification, including Section 11 "State of Knowledge" with the 14 disproven hypotheses ledger.',
    cite: 'Part III; Appendix B',
  },
  ACTIVE_DOCS: {
    term: 'ACTIVE_DOCS',
    short:
      'engine/docs/active/development/ACTIVE_DOCS.md. The current-authoritative-versions snapshot for engine v1 and v2 documentation. Currently at v3.49.',
    cite: 'CLAUDE.md',
  },
  'CLAUDE.md': {
    term: 'CLAUDE.md',
    short:
      'Project root instructions file for Claude Code AI agents. Defines AI scope, HITL framing, the v74.0 and v74.1+ locks, protected paths, and process-safety rules.',
    cite: 'C:/Projects/Regulatory-Review/CLAUDE.md',
  },
  CANARY_LOG: {
    term: 'CANARY_LOG',
    short:
      'engine_v2/docs/CANARY_LOG.md. The v2 state of knowledge ledger: Canary 0/1/2 outcomes, C1+C2+C3 fix lane, Q2 size-aware floor, D-2 PERMANENTLY RESOLVED.',
    cite: 'Appendix C',
  },
  STATE_OF_KNOWLEDGE: {
    term: 'STATE_OF_KNOWLEDGE',
    short:
      'The cross-engine quick pointer summarizing what is known, what is disproven, and what is in plan. v1 lives in ENGINE_SPECS Section 11; v2 lives in CANARY_LOG.md.',
    cite: 'CLAUDE.md State of Knowledge section',
  },
};

// Helper for the DefinedTerm component. Case-sensitive lookup; callers can
// pass either the canonical key or a display variant via children.
export function getGlossaryEntry(term: string): GlossaryEntry | undefined {
  return GLOSSARY[term];
}
