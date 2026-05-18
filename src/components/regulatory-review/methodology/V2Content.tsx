'use client';

// Methodology / engine v2 deep-dive content.
//
// Hand-curated TSX summary of Part VI of the Regulatory Review methodology
// paper. Source files (all under C:\Projects\Regulatory-Review):
//   - engine/docs/active/methodology/body/part_VI.md (primary)
//   - engine/docs/active/methodology/appendices/appendix_C_canary_log_summary.md
//   - engine/docs/active/methodology/appendices/appendix_D_architecture_locks.md
//   - engine/docs/active/methodology/appendices/appendix_A_component_inventory.md
//
// Discipline (per task brief):
//   - M2 is IN PLAN and READY (post-2026-05-17 ontology signoff at engine-v2
//     commit `05fd767b`); M3 remains IN PLAN and BLOCKED on M2 completion +
//     three remaining pre-M3 gates (G1/G2/G4; G3 DONE via M-4).
//   - Ontology v1.0.0 / HITL_SIGNED_OFF_V1_0_0 quoted verbatim; the v0.42
//     historical state is preserved as context; no "GREEN-LIGHT" reframing.
//   - Canary 2 re-run is INCONCLUSIVE; not softened.
//   - Rollback asymmetry surfaced explicitly (Practitioner + Technical tiers).
//   - HITL framing: AI evidence-finder, NOT tier-judge.
//   - ASCII only; "->" rendered with brace-escape in JSX child text.
//
// The dashboard view is a curated summary. The full paper is the source of
// truth (linked in the SourcePointerFooter on MethodologyView).

import { ExpandableSection } from '@/components/bn-rrm/shared/ExpandableSection';
import {
  TierHeader,
  TIER_BADGE_COLORS,
  TIER_LABELS,
  type AudienceTier,
} from './MethodologyView';
import { MermaidDiagram } from './MermaidDiagram';
import { DefinedTerm } from './DefinedTerm';

// Diagram 2 -- engine v2 LightRAG / RAG-Anything 3-milestone substrate.
// Source: methodology paper Part VI Sections 24-28, Appendix C Section
// C.5 (Canary 2 re-run INCONCLUSIVE), Appendix D Section D.2 (M-4
// v74.1+ lock detail). Color discipline:
//   - green = LANDED / READY  (M1, M-4 lock, M2 ready post-signoff, ontology signed off)
//   - amber = IN PLAN / BLOCKED  (M3)
//   - pink  = lock guards
// Square TB layout per obsidian-mermaid conventions; no markdown in
// labels; classDef fills chosen for both light + dark mode legibility.
const V2_SUBSTRATE_DIAGRAM = `flowchart TB
    SOURCE["Source Documents<br/>multi-modal PDFs"]
    SOURCE --> M1

    subgraph M1["M1 -- LANDED"]
      direction TB
      DOCLING["Docling 2.77<br/>VLM + force-full-page-OCR<br/>LX5 PictureItem.annotations"]
      SIDECAR["M1.5 content_list sidecar<br/>LightRAG-shaped"]
      DOCLING --> SIDECAR
    end

    SIDECAR --> M2

    subgraph M2["M2 -- READY (post-signoff)"]
      direction TB
      LIGHTRAG["LightRAG Retrieval Shim<br/>embeddings + graph primary"]
      ONTOLOGY{{"Entity Ontology v1.0.0<br/>lifecycle_state:<br/>HITL_SIGNED_OFF_V1_0_0<br/>signed off 2026-05-17"}}
      LIGHTRAG -. depends on .-> ONTOLOGY
    end

    M2 --> M3

    subgraph M3["M3 -- IN PLAN, BLOCKED"]
      direction TB
      RAGANY["RAG-Anything<br/>multi-modal embeddings"]
      KB_GRAPH[("Postgres + Apache AGE<br/>persistent KB graph")]
      RAGANY --> KB_GRAPH
      GATES["Pre-M3 gates<br/>G1 cost re-baseline<br/>G2 200-xref HITL audit (precision &gt;= 0.90)<br/>G3 authority injection (M-4 DONE)<br/>G4 owner cost approval"]
      KB_GRAPH -. blocked on .-> GATES
    end

    M3 --> S2V2["S2 Evidence Finder v2<br/>graph-augmented retrieval"]
    S2V2 --> M4_LOCK
    S2V2 --> S3V2["S3 Prioritizer v2"]

    subgraph M4_LOCK["M-4 v74.1+ Architecture Lock -- LANDED"]
      direction TB
      QM["Query-mode lock<br/>naive / global require opt-in"]
      RR["Rerank lock<br/>enabled by default"]
      AC["Authority coefficient<br/>bounds 1.0 to 2.0"]
    end

    M4_LOCK -. guards .-> S2V2
    S3V2 --> S4V2["S4 Synthesizer v2"]
    S4V2 --> HITL[/"HITL v2_judgments write path<br/>tier-verdict matrix enforced"/]

    classDef landed fill:#d1fae5,stroke:#10b981,color:#022c22
    classDef blocked fill:#fef3c7,stroke:#f59e0b,color:#451a03
    classDef lock fill:#fce7f3,stroke:#ec4899,color:#500724
    classDef hitl fill:#dbeafe,stroke:#3b82f6,color:#0c1e3a
    class M1,M4_LOCK,DOCLING,SIDECAR,QM,RR,AC landed
    class M2,LIGHTRAG,ONTOLOGY landed
    class M3,RAGANY,KB_GRAPH,GATES blocked
    class HITL hitl
`;

interface V2ContentProps {
  activeTiers: Set<AudienceTier>;
}

export function V2Content({ activeTiers }: V2ContentProps) {
  return (
    <div className="space-y-5">
      {activeTiers.has('everyone') && <V2Everyone />}
      {activeTiers.has('practitioner') && <V2Practitioner />}
      {activeTiers.has('technical') && <V2Technical />}

      {activeTiers.size === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400 italic">
            Select an audience tier above to see the engine v2 summary at
            that depth.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tier 1: For Everyone
// ---------------------------------------------------------------------------

function V2Everyone() {
  return (
    <div className="space-y-4">
      <TierHeader tier="everyone" title="Engine v2 -- What Changes, In Plain Language" />

      <ExpandableSection
        title="What is engine v2?"
        defaultOpen
        badge={TIER_LABELS.everyone}
        badgeColor={TIER_BADGE_COLORS.everyone}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            Engine v2 is the rebuilt evidence-finding pipeline for the
            Regulatory Review AI Agent (RRAA). Where engine v1 leaned heavily
            on keyword matching, engine v2 retrieves evidence using
            embeddings (meaning-based similarity) plus a knowledge graph
            (relationships between entities), with multi-modal extraction
            (tables, figures, scanned pages) handled up front by{' '}
            <DefinedTerm term="Docling">Docling</DefinedTerm>.
          </p>
          <p>
            The intent is unchanged: the AI surfaces evidence from a
            submission, and the human reviewer (the{' '}
            <DefinedTerm term="HITL">HITL</DefinedTerm>) applies the
            professional judgment about whether a regulatory requirement is
            satisfied. v2 changes HOW evidence is found, not WHO decides.
          </p>
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
            <p className="text-xs text-green-700 dark:text-green-300">
              v2 is in active development. The HITL sign-off gate that
              unlocks v2 at production scale has NOT yet been signed. v1
              stays operational until v2 delivers.
            </p>
          </div>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="Why a rebuild at all?"
        badge={TIER_LABELS.everyone}
        badgeColor={TIER_BADGE_COLORS.everyone}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            Two things forced the rebuild decision in May 2026.
          </p>
          <p>
            First, an empirical failure: a real submission (the{' '}
            <DefinedTerm term="AEE RP">
              AEE Remediation Plan
            </DefinedTerm>, a 1.6 MB PDF) reduced to about 5 KB of usable
            extracted text under v1 defaults. Pages 4 through 7, which are
            figure-heavy, each contributed 8 characters of text -- the
            literal placeholder &quot;[Figure]&quot;. The pipeline silently
            dropped the load-bearing material.
          </p>
          <p>
            Second, an owner directive: the engine must &quot;process
            thousands of massive multi-modal documents autonomously at high
            quality.&quot; v1&apos;s keyword-driven, text-only pipeline has
            a structural ceiling that retuning cannot lift. v2 is the
            architectural response.
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="What has landed?"
        badge={TIER_LABELS.everyone}
        badgeColor={TIER_BADGE_COLORS.everyone}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            Two of the rebuild&apos;s foundation pieces have landed in code:
          </p>
          <ul className="space-y-2 ml-1 text-xs">
            <li className="flex items-start gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0 w-32">
                <DefinedTerm term="M1">M1</DefinedTerm> -- Extraction
              </span>
              <span>
                The Docling pipeline now runs a vision-language model on
                figures, forces OCR on every page, and reads the structured
                figure descriptions back into the extracted text. The same
                pages that yielded 8 characters under v1 should yield rich
                multi-modal content once re-extracted.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0 w-32">
                <DefinedTerm term="M-4">M-4</DefinedTerm> -- Lock
              </span>
              <span>
                A code-level architecture lock guards the retrieval
                surface. Three sub-locks prevent silent regressions into
                unsafe query modes, disabled reranking, or out-of-bounds
                authority weighting. 33 anti-drift tests pin the locked
                behavior.
              </span>
            </li>
          </ul>
          <p>
            Validation work (called &quot;canaries&quot;) has produced two
            PASS results so far -- a synthetic baseline and a real Stage 2
            site investigation -- plus one FAIL on the AEE Remediation Plan
            that was traced to specific bugs. Those bugs were fixed; the
            re-run did not produce a clean PASS, so its verdict is
            recorded as INCONCLUSIVE (see the next section).
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="What is still in plan?"
        badge={TIER_LABELS.everyone}
        badgeColor={TIER_BADGE_COLORS.everyone}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            Two larger milestones (M2 and M3) are in plan; M2 is now
            ready to begin after the ontology signoff on 2026-05-17,
            and M3 remains blocked on M2 plus three remaining pre-M3
            gates:
          </p>
          <ul className="space-y-2 ml-1 text-xs">
            <li className="flex items-start gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0 w-32">
                <DefinedTerm term="M2">M2</DefinedTerm> -- Retrieval
              </span>
              <span>
                Swap the engine&apos;s keyword + embedding retrieval for
                graph-plus-vector hybrid retrieval (the{' '}
                <DefinedTerm term="LightRAG">LightRAG</DefinedTerm>{' '}
                framework). READY to begin -- the human reviewer signed
                off on the{' '}
                <DefinedTerm term="entity ontology">
                  entity ontology
                </DefinedTerm>{' '}
                on 2026-05-17, advancing it to v1.0.0, which lifts
                the M2 blocker.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0 w-32">
                <DefinedTerm term="M3">M3</DefinedTerm> -- Persistent KB
              </span>
              <span>
                Build the full multi-modal knowledge graph over all 5,860
                active policies in a persistent database. BLOCKED on M2
                completion plus three remaining pre-M3 gates
                (re-baselining the cost estimate, auditing 200
                cross-references, and getting explicit cost approval).
                Authority injection is already done via M-4.
              </span>
            </li>
          </ul>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="Honest status: where the work actually sits"
        badge={TIER_LABELS.everyone}
        badgeColor={TIER_BADGE_COLORS.everyone}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            The methodology paper makes a discipline of distinguishing what
            has landed from what is planned. A few honest framings:
          </p>
          <ul className="space-y-1.5 ml-1 text-xs">
            <li className="flex items-start gap-1.5">
              <span className="text-slate-400 mt-0.5">-</span>
              <span>
                The entity ontology that M2 depends on was at
                v0.42-strawman with a recorded{' '}
                <DefinedTerm term="lifecycle_state">
                  lifecycle_state
                </DefinedTerm>{' '}
                of{' '}
                <DefinedTerm term="AI_REVISION_COMPLETE_PENDING_HITL_REVIEW">
                  AI_REVISION_COMPLETE_PENDING_HITL_REVIEW
                </DefinedTerm>
                . On 2026-05-17 the human reviewer (registered BC
                toxicologist) reviewed and signed off the HITL packet,
                advancing the ontology to v1.0.0 with lifecycle_state{' '}
                <DefinedTerm term="HITL_SIGNED_OFF_V1_0_0">
                  HITL_SIGNED_OFF_V1_0_0
                </DefinedTerm>
                . M2 is now unblocked.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-slate-400 mt-0.5">-</span>
              <span>
                Of the four pre-M3 gates, one is done (authority
                injection, via M-4). Three remain open: cost re-baseline,
                cross-reference audit, and explicit owner cost approval.
                The ontology signoff is no longer a separate blocker
                (it closed on 2026-05-17).
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-slate-400 mt-0.5">-</span>
              <span>
                The <DefinedTerm term="Canary 2">Canary 2</DefinedTerm>{' '}
                re-run is{' '}
                <DefinedTerm term="INCONCLUSIVE">INCONCLUSIVE</DefinedTerm>,
                not a soft PASS. The fixes did remove the dangerous
                false-positive verdicts, but the test never exercised two
                of the three fixes end-to-end because the input was too
                thin to retrieve against. That is honest reporting, not
                failure.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-slate-400 mt-0.5">-</span>
              <span>
                None of the engine v2 commits referenced in the paper
                have been pushed to a remote yet. They sit on a local
                worktree awaiting owner authorization.
              </span>
            </li>
          </ul>
        </div>
      </ExpandableSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tier 2: For Practitioners
// ---------------------------------------------------------------------------

function V2Practitioner() {
  return (
    <div className="space-y-4">
      <TierHeader
        tier="practitioner"
        title="Engine v2 -- Substrate, Milestones, Canary State"
      />

      <ExpandableSection
        title="LightRAG / RAG-Anything substrate"
        defaultOpen
        badge={TIER_LABELS.practitioner}
        badgeColor={TIER_BADGE_COLORS.practitioner}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            v2 is being rebuilt on two open-source frameworks from the
            same lab (HKUDS / MIT):{' '}
            <strong>
              <DefinedTerm term="LightRAG">LightRAG</DefinedTerm>
            </strong>{' '}
            (arXiv 2410.05779; pinned at v1.4.16) is the retrieval substrate;{' '}
            <strong>
              <DefinedTerm term="RAG-Anything">RAG-Anything</DefinedTerm>
            </strong>{' '}
            (pinned at v1.3.0) is the multi-modal indexer. The two are
            decoupled: LightRAG defines
            the retrieval contract (how seeds come out of an indexed
            corpus given a query); RAG-Anything defines the index
            construction contract (how a multi-modal corpus -- text,
            tables, figures, equations -- is decomposed and stored).
            Engine v2&apos;s M2 milestone consumes LightRAG; M3 consumes
            RAG-Anything on top of M2.
          </p>
          <p>
            LightRAG ships four canonical{' '}
            <DefinedTerm term="query mode">query modes</DefinedTerm>, plus
            two extensions:
          </p>
          <ul className="space-y-1 ml-1 text-xs">
            <li>
              <span className="font-mono text-slate-700 dark:text-slate-300">naive</span>{' '}
              -- pure vector retrieval; bypasses the graph. GATED behind
              explicit opt-in by M-4.
            </li>
            <li>
              <span className="font-mono text-slate-700 dark:text-slate-300">local</span>{' '}
              -- entity-anchored; pulls the query&apos;s matched entities
              and their immediate neighborhood. Permitted.
            </li>
            <li>
              <span className="font-mono text-slate-700 dark:text-slate-300">global</span>{' '}
              -- community-summary anchored; pulls LLM-authored summaries
              of graph communities. GATED behind explicit opt-in by M-4
              (ghost-evidence risk -- summaries lack verbatim provenance).
            </li>
            <li>
              <span className="font-mono text-slate-700 dark:text-slate-300">hybrid</span>{' '}
              -- combines local and global; v2&apos;s default once M2
              lands.
            </li>
            <li>
              <span className="font-mono text-slate-700 dark:text-slate-300">mix</span> +{' '}
              <span className="font-mono text-slate-700 dark:text-slate-300">bypass</span>{' '}
              -- LightRAG extensions; both permitted.
            </li>
          </ul>
          <p>
            The vector index is{' '}
            <DefinedTerm term="BGE embeddings">BGE embeddings</DefinedTerm>{' '}
            (already used in v1&apos;s pre-rank stage). The graph backend
            is NetworkX in M2&apos;s pre-spike and Postgres + AGE (Apache
            AGE on Supabase) in M3.
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="M1 -- Docling multi-modal extraction (LANDED)"
        badge={TIER_LABELS.practitioner}
        badgeColor={TIER_BADGE_COLORS.practitioner}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            M1 closes the extraction-quality gap identified by the AEE
            Remediation Plan incident: pre-M1, Docling 2.77 silently
            dropped multi-modal content from any PDF whose load-bearing
            material lived outside the narrative text track. Three
            coordinated changes:
          </p>
          <ol className="space-y-1.5 ml-4 list-decimal text-xs">
            <li>
              Enable <code className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">do_picture_description</code>{' '}
              -- runs a VLM over each PictureItem and stores the
              description in the item&apos;s annotations.
            </li>
            <li>
              Set <code className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">force_full_page_ocr=True</code>{' '}
              -- OCR runs even on pages the framework heuristic flagged
              as text-bearing (the heuristic was wrong on figure-heavy
              report pages).
            </li>
            <li>
              LX5 PictureItem.annotations reading -- the adapter now
              resolves caption refs into the document caption registry
              AND concatenates the VLM-produced annotations into the
              extracted block with a <code className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">[Figure: ...]</code>{' '}
              marker.
            </li>
          </ol>
          <p>
            M1 ships as two commits across two repositories: M1.0 at
            <code className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded ml-1">3ee6ee9d</code>{' '}
            on the main repo&apos;s <code className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">fix/lx3-section-propagation-2026-05-15</code>{' '}
            branch (the three Docling changes), and M1.5 at{' '}
            <code className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">e86c2ef7</code>{' '}
            on the engine-v2 worktree (a LightRAG-shaped content_list
            sidecar, the contract handoff to M2). The split-repo state
            is the residual of the v1 / v2 separation; the worktree will
            be merged back once v2 retires v1.
          </p>
          <p>
            <strong>Acceptance criterion:</strong> the AEE Remediation
            Plan, which yielded 5,250 chars / 54 blocks (8 chars per
            page on pages 4-7) pre-M1, should yield at least 25 KB
            post-M1. The bake-off between Granite Vision 3.3-2b and
            Qwen2.5-VL 7b on pages 4-7 is the open empirical test that
            closes M1&apos;s acceptance.
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="M-4 -- v74.1+ Architecture Lock (LANDED)"
        badge={TIER_LABELS.practitioner}
        badgeColor={TIER_BADGE_COLORS.practitioner}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            M-4 is the v2 analog to the v1 v74.0 lock: a documentation
            artifact plus code-level enforcement. The two locks coexist
            and guard different attack surfaces. M-4 guards the v2
            retrieval surface at{' '}
            <code className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
              engine_v2/src/rraa_v2/architecture_lock_retrieval.py
            </code>
            {' '}(engine-v2 master tip <code className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">0d9e1dcb</code>;
            290 lines plus 33 anti-drift tests).
          </p>
          <p>Three sub-locks, all fail-loud (raise <code className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">ValueError</code> subclasses, no defer-with-warning path):</p>
          <ol className="space-y-1.5 ml-4 list-decimal text-xs">
            <li>
              <strong>Query-mode lock.</strong> Rejects <code className="font-mono text-[11px]">mode=&apos;naive&apos;</code> and{' '}
              <code className="font-mono text-[11px]">mode=&apos;global&apos;</code> without explicit opt-in.
            </li>
            <li>
              <strong>Rerank lock.</strong> Rejects{' '}
              <code className="font-mono text-[11px]">enable_rerank=False</code>{' '}
              without explicit opt-in. The reranker is the engine&apos;s
              quality floor on retrieval ranking.
            </li>
            <li>
              <strong>Authority-coefficient bounds + boost formula.</strong>{' '}
              Rejects coefficients outside <code className="font-mono text-[11px]">[1.0, 2.0]</code> and rejects NaN. The
              boost formula applies the Pyramid of Compliance authority
              weight at retrieval rerank.
            </li>
          </ol>
          <p>
            <strong>The M-4 formula deviation from proposal Section 3.6
            is the load-bearing honesty claim of Part VI.</strong> The
            proposal as originally written would have inverted the
            Pyramid (Acts would have received the LEAST boost; CSAP the
            MOST). M-4 deliberately deviates from the proposal text by
            using the Pyramid <code className="font-mono text-[11px]">authority_value</code> directly
            rather than <code className="font-mono text-[11px]">authority_level / 5</code>. The proposal
            text was subsequently corrected on 2026-05-16. See the
            Technical tier for the side-by-side.
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="Canary state (C0 PASS / C1 PASS / C2 FAIL+rerun INCONCLUSIVE)"
        badge={TIER_LABELS.practitioner}
        badgeColor={TIER_BADGE_COLORS.practitioner}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            The canary protocol validates v2 retrieval correctness
            against representative submissions. The gate condition is
            three PASS canaries across three distinct submission types
            plus a signed sign-off line. As of 2026-05-17:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded-lg">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Canary</th>
                  <th className="text-left px-3 py-2 font-semibold">Date</th>
                  <th className="text-left px-3 py-2 font-semibold">Verdict</th>
                  <th className="text-left px-3 py-2 font-semibold">Note</th>
                </tr>
              </thead>
              <tbody className="text-slate-600 dark:text-slate-400">
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2 font-mono">C0 synthetic</td>
                  <td className="px-3 py-2">2026-05-14</td>
                  <td className="px-3 py-2 font-semibold text-green-700 dark:text-green-400">PASS</td>
                  <td className="px-3 py-2">Mandatory first step; S2 / S2.5 / S3 / S4 wiring validated across all tier classes.</td>
                </tr>
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2 font-mono">C1 Site 13254 PSI</td>
                  <td className="px-3 py-2">2026-05-14</td>
                  <td className="px-3 py-2 font-semibold text-green-700 dark:text-green-400">PASS</td>
                  <td className="px-3 py-2">41/43 NOT_FOUND is contractually correct (RP cohort vs PSI submission mismatch), not a defect. 71 evidence slices on 12 pages.</td>
                </tr>
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2 font-mono">C2 AEE RP initial</td>
                  <td className="px-3 py-2">2026-05-14</td>
                  <td className="px-3 py-2 font-semibold text-rose-700 dark:text-rose-400">FAIL</td>
                  <td className="px-3 py-2">Surfaced four bugs B1-B4: PASS/FAIL on NEUTRAL evidence, negative-IDF admission, stub-midpoint confidence, TIER_1 OBSERVATION_ONLY.</td>
                </tr>
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2 font-mono">C2 re-run</td>
                  <td className="px-3 py-2">2026-05-15</td>
                  <td className="px-3 py-2 font-semibold text-amber-700 dark:text-amber-400">INCONCLUSIVE</td>
                  <td className="px-3 py-2">Verdict-class axis HELD; evidence-presence axis FAILED due to degenerate input. C2 + C3 NEVER integration-exercised. NOT_COUNTED toward gate.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            The <strong>C1+C2+C3 fix lane</strong> (commits{' '}
            <code className="font-mono text-[11px]">a2dad048</code>{' '}
            +{' '}
            <code className="font-mono text-[11px]">08e81e45</code>{' '}
            +{' '}
            <code className="font-mono text-[11px]">ec9a5d75</code>) landed
            2026-05-15: submission_min_score floor, PASS/FAIL-on-NEUTRAL
            guard, and rubric-aggregate confidence in the real backend.{' '}
            <strong>D-2 was PERMANENTLY RESOLVED 2026-05-16</strong>{' '}
            (audit-trail commit <code className="font-mono text-[11px]">7b9cc2a9</code>):
            the TIER_1 OBSERVATION_ONLY failure mode B4 was designed to
            guard against is architecturally unreachable in the post-C1
            world.{' '}
            <strong>Q2 size-aware C1 floor</strong> (commit{' '}
            <code className="font-mono text-[11px]">5f78c004</code>)
            corrected an over-aggressive 0.0 floor on small corpora --
            corpora of {'>='} 20 chunks get 0.0; smaller get -0.1.
          </p>
          <p className="italic text-xs">
            <strong>Why INCONCLUSIVE, not soft PASS:</strong> the re-run
            ran against the SAME thin AEE RP submission.json that
            produced the FAIL (pre-M1 extraction, 5 KB / 54 blocks). All
            43 policies short-circuited at zero-seed retrieval before
            reaching S2; evidence_slices was empty. The verdict-class
            cleanup did happen via the C1 short-circuit upstream of S4,
            but C2 and C3 themselves were never given the chance to run.
            Recording the result as PASS would mis-attribute the
            cleanup; recording FAIL would falsely claim the fixes
            failed. INCONCLUSIVE is the honest verdict.
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="Indigenous content: pathway evidence, not procedural gate"
        badge={TIER_LABELS.practitioner}
        badgeColor={TIER_BADGE_COLORS.practitioner}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            Indigenous-uses content -- traditional gardens, hunting
            grounds, fishing waters, medicinal plant gathering, and
            similar uses of natural resources -- is technically relevant
            pathway evidence for contaminated-sites assessment, just like
            commercial agriculture, residential gardens, or municipal
            water supply. A contaminated site contains contaminated
            media; humans and ecological receptors interact with that
            media; exposure occurs along pathways. The AI surfaces
            Indigenous-uses content as pathway-relevant technical
            evidence like any other content. A UI metadata badge
            (content-type label such as &quot;Indigenous uses content&quot;)
            signals that a chunk references Indigenous uses so the HITL
            can spot it during review. The badge is informational, not
            gating.
          </p>
          <p>
            <strong>What the AI does NOT do.</strong> The AI does not
            auto-elevate the chunk into any tier, does not auto-classify
            it as procedurally special, does not auto-redact or refuse
            content, and does not speak in procedural / consultation /
            regulator voice about it. Procedural language such as
            &quot;SDM escalation required&quot; or &quot;HITL professional
            judgment required&quot; is wrong because it implies the AI is
            making a regulatory determination (it is not) and implies
            Indigenous content is procedurally special-and-restricted in
            this app (in this app it is technical pathway content).
          </p>
          <p>
            <strong>What is OUT OF SCOPE for the AI.</strong> Additional
            regulatory and consultation considerations under Section 35
            of the Constitution Act, the Declaration on the Rights of
            Indigenous Peoples Act (DRIPA), the Honour of the Crown
            doctrine, and any consultation duties are handled by the
            HITL plus the in-person Indigenous consultation process.
            They are explicitly out of scope for this AI-assisted
            application. The AI does not flag chunks for Section 35 /
            DRIPA escalation, does not generate consultation-status
            determinations, and does not author HITL workflow text in
            those terms.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-500 italic">
            Sources: methodology paper Part VII Section 34
            (parts_VII_VIII_IX.md);{' '}
            <code className="font-mono text-[11px]">CLAUDE.md</code>{' '}
            &quot;Indigenous Content (content-type, not procedural
            gate)&quot; section; standing memory{' '}
            <code className="font-mono text-[11px] break-all">
              feedback_no_tier_judgment_for_ai.md
            </code>{' '}
            (2026-05-12, HIGH AUTHORITY).
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="M2 READY (post-signoff); M3 still BLOCKED"
        badge={TIER_LABELS.practitioner}
        badgeColor={TIER_BADGE_COLORS.practitioner}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            <strong>M2 (LightRAG retrieval shim) is READY (post-signoff)</strong>{' '}
            -- Amendment A-8 originally blocked M2 entity-extraction
            code until the ontology lifecycle state advanced to{' '}
            <code className="font-mono text-[11px]">HITL_SIGNED_OFF_V1_0_0</code>.
            On 2026-05-17 the owner (registered BC toxicologist) signed
            off at engine-v2 worktree commit{' '}
            <code className="font-mono text-[11px]">05fd767b</code>,
            advancing the ontology to v1.0.0. The JSON header now reads:
          </p>
          <pre className="text-[11px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-2 overflow-x-auto">
{`"ontology_version": "v1.0.0",
"lifecycle_state": "HITL_SIGNED_OFF_V1_0_0",
"signoff_record": {
  "signed_off_by": "Jasen Nelson (registered BC toxicologist)",
  "signed_off_on": "2026-05-17",
  "signoff_commit": "05fd767b",
  "m2_authorization": "M2 entity-extraction code is UNBLOCKED per Amendment A-8 effective signoff date."
}`}
          </pre>
          <p>
            The HITL signoff packet was reviewed and accepted by the
            owner during the signoff round at commit{' '}
            <code className="font-mono text-[11px]">05fd767b</code>;
            the three constituent commits remain in the audit trail:
            PART_A <code className="font-mono text-[11px]">2a75c385</code>,
            PART_B <code className="font-mono text-[11px]">187a7f10</code>,
            INDEX <code className="font-mono text-[11px]">00cc9fee</code>.
            The 2-day pre-M2 NetworkX spike (Amendment A-6; 1 canary,
            no prod wiring) is AUTHORIZED + READY to proceed.
          </p>
          <p>
            <strong>M3 (RAG-Anything + persistent KB on Postgres + AGE)
            is BLOCKED on M2 completion plus three remaining pre-M3
            gates</strong> (Part V Section 23). The ontology signoff is
            no longer a separate blocker; M3 inherits the signoff via
            its M2 prerequisite. Remaining pre-M3 gates:
          </p>
          <ul className="space-y-1 ml-1 text-xs">
            <li><strong>G1</strong> -- empirical KB cost re-baseline (ingest 100 policies, extrapolate to 5,860): OPEN. The original cost estimate was understated by 4-5x.</li>
            <li><strong>G2</strong> -- HITL audit of 200 stratified cross-references at precision {'>='} 0.90: OPEN. Audit corpus is the existing 1,991 rows in <code className="font-mono text-[11px]">policy_cross_references</code>.</li>
            <li><strong>G3</strong> -- authority-level injection spec&apos;d in the architecture lock: <strong>DONE via M-4</strong>.</li>
            <li><strong>G4</strong> -- explicit owner cost approval ($200-600 + 80-150 hours): OPEN; awaits G1 output.</li>
          </ul>
          <p>
            <strong>Rollback asymmetry:</strong> engine code rolls back
            via git revert and redeploy; the persistent KB graph does
            NOT roll back the same way. Once the graph is ingested under
            a given (prompt-version, model-version, ontology-version)
            triple, the entities + relations ARE the production
            artifact. M3 must take on build-time provenance recording,
            re-ingestion planning, and per-version namespace staging
            before the persistent KB ships. This is a load-bearing
            operational risk, not a footnote.
          </p>
        </div>
      </ExpandableSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tier 3: Technical
// ---------------------------------------------------------------------------

function V2Technical() {
  return (
    <div className="space-y-4">
      <TierHeader
        tier="technical"
        title="Engine v2 -- File Inventory, Locks, Formula, Ontology State"
      />

      <ExpandableSection
        title="v2 LightRAG / RAG-Anything substrate (architecture diagram)"
        defaultOpen
        badge={TIER_LABELS.technical}
        badgeColor={TIER_BADGE_COLORS.technical}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <MermaidDiagram
            chart={V2_SUBSTRATE_DIAGRAM}
            ariaLabel="Engine v2 3-milestone substrate: M1 LANDED (Docling 2.77 VLM + force-full-page-OCR + LX5 PictureItem annotations + M1.5 content_list sidecar); M2 IN PLAN and BLOCKED on HITL signoff of the entity ontology v0.42 (AI_REVISION_COMPLETE_PENDING_HITL_REVIEW); M3 IN PLAN and BLOCKED on four pre-M3 gates (G1 cost re-baseline, G2 200-cross-reference HITL audit at precision greater-than-or-equal 0.90, G3 authority injection landed via M-4, G4 owner cost approval). The M-4 v74.1+ architecture lock (LANDED) guards S2 evidence finder v2 retrieval via query-mode lock, rerank lock, and authority coefficient bounds 1.0 to 2.0. Output flows to the HITL v2_judgments write path with tier-verdict matrix enforcement."
          />
          <p className="text-xs italic">
            Substrate as documented in Part VI Sections 24-28 of the
            methodology paper. The M-4 v74.1+ architecture lock detail
            is in Appendix D Section D.2. The Canary 2 re-run
            INCONCLUSIVE verdict (degenerate input on AEE RP under v1
            text-only extraction; cascade hypothesis untested on the
            evidence-presence axis) is in Appendix C Section C.5. The
            four pre-M3 gates G1-G4 (KB cost re-baseline, 200-
            cross-reference HITL audit, authority injection, owner cost
            approval) gate M3 entry.
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="v2 file inventory (Appendix A Section A.2)"
        badge={TIER_LABELS.technical}
        badgeColor={TIER_BADGE_COLORS.technical}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            All paths prefixed <code className="font-mono text-[11px]">WT:</code> resolve
            from the engine-v2 worktree root{' '}
            <code className="font-mono text-[11px]">
              C:/Projects/Regulatory-Review-worktrees/engine-v2/
            </code>. Paths without prefix resolve from the main repo;
            paths prefixed <code className="font-mono text-[11px]">DASH:</code> resolve
            from the SSTAC-Dashboard repo. SHA-256 hashes captured
            2026-05-17.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded-lg">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Row</th>
                  <th className="text-left px-3 py-2 font-semibold">Path</th>
                  <th className="text-left px-3 py-2 font-semibold">Role</th>
                </tr>
              </thead>
              <tbody className="text-slate-600 dark:text-slate-400">
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2">15</td>
                  <td className="px-3 py-2 font-mono text-[11px]">WT:engine_v2/scripts/run_owner_scenario.py</td>
                  <td className="px-3 py-2">v2 canary runner (1395 lines)</td>
                </tr>
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2">16</td>
                  <td className="px-3 py-2 font-mono text-[11px]">WT:engine_v2/src/rraa_v2/architecture_lock_retrieval.py</td>
                  <td className="px-3 py-2">M-4 architecture lock (290 lines)</td>
                </tr>
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2">17-20</td>
                  <td className="px-3 py-2 font-mono text-[11px]">WT:engine_v2/src/rraa_v2/stages/{`{s2_evidence_finder, s2_5_boundary, s3_prioritizer, s4_synthesizer}.py`}</td>
                  <td className="px-3 py-2">v2 pipeline stages (634 / 364 / 909 / 2337 lines)</td>
                </tr>
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2">21-26</td>
                  <td className="px-3 py-2 font-mono text-[11px]">WT:engine_v2/contracts/*.schema.json</td>
                  <td className="px-3 py-2">Frozen contracts: evidence_index 0.0.1, s4_output 0.0.1, submission_content_list 0.1.0</td>
                </tr>
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2">27</td>
                  <td className="px-3 py-2 font-mono text-[11px]">WT:engine_v2/data/lightrag_entity_ontology_v1.json</td>
                  <td className="px-3 py-2">Ontology v1.0.0 (1784 lines; HITL_SIGNED_OFF_V1_0_0 2026-05-17; M2 unblocked via signoff commit 05fd767b)</td>
                </tr>
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2">28</td>
                  <td className="px-3 py-2 font-mono text-[11px]">WT:engine_v2/docs/STATE_OF_KNOWLEDGE.md</td>
                  <td className="px-3 py-2">v2 State of Knowledge (277 lines)</td>
                </tr>
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2">29</td>
                  <td className="px-3 py-2 font-mono text-[11px]">WT:engine_v2/docs/CANARY_LOG.md</td>
                  <td className="px-3 py-2">Canary log of record (455 lines)</td>
                </tr>
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2">35</td>
                  <td className="px-3 py-2 font-mono text-[11px]">WT:engine_v2/tests/test_anti_drift_retrieval.py</td>
                  <td className="px-3 py-2">33 anti-drift tests pinning M-4 (301 lines)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs">
            <strong>SHA-256 pinned (capture 2026-05-17):</strong>
          </p>
          <ul className="text-[11px] font-mono space-y-1 ml-1">
            <li>architecture_lock_retrieval.py: <span className="text-slate-700 dark:text-slate-300">643cd9a6...8b9af6e7</span></li>
            <li>lightrag_entity_ontology_v1.json (v1.0.0, post-signoff): <span className="text-slate-700 dark:text-slate-300">70da8452...afad477a</span></li>
            <li>test_anti_drift_retrieval.py: <span className="text-slate-700 dark:text-slate-300">c7a7656a...28cd72fdf</span></li>
            <li>run_owner_scenario.py: <span className="text-slate-700 dark:text-slate-300">7fd30512...e209769d2c</span></li>
          </ul>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="M-4 implementation: the three sub-locks (Appendix D Sections D.2 + D.3)"
        badge={TIER_LABELS.technical}
        badgeColor={TIER_BADGE_COLORS.technical}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            Module-level anchor at{' '}
            <code className="font-mono text-[11px]">architecture_lock_retrieval.py:74-89</code>:
          </p>
          <pre className="text-[11px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-2 overflow-x-auto">
{`RETRIEVAL_LOCK_V74_1_ENABLED: bool = True
assert RETRIEVAL_LOCK_V74_1_ENABLED, (
    "RETRIEVAL_LOCK_V74_1_ENABLED is mandatory. ..."
)`}
          </pre>
          <p><strong>Sub-lock 1: query-mode lock</strong> (lines 108-145). Gated set:</p>
          <pre className="text-[11px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-2 overflow-x-auto">
{`RETRIEVAL_GATED_MODES: frozenset[str] = frozenset({"naive", "global"})

class QueryModeNotPermitted(ValueError):
    """Raised when a caller passes a gated query mode
    without explicit_opt_in=True."""

def assert_query_mode_allowed(
    mode: str, *, explicit_opt_in: bool = False,
) -> None: ...`}
          </pre>
          <p>ValueError f-string (verbatim from lines 138-145):</p>
          <blockquote className="text-xs italic border-l-2 border-slate-300 dark:border-slate-600 pl-3">
            f&quot;query mode {'{mode!r}'} requires explicit_opt_in=True.
            Gated modes: {'{sorted(RETRIEVAL_GATED_MODES)}'}. See
            architecture_lock_retrieval.py module docstring for the
            rationale; if you have a justified niche use, pass
            explicit_opt_in=True and document the justification in the
            calling code&apos;s commit message.&quot;
          </blockquote>
          <p><strong>Sub-lock 2: rerank lock</strong> (lines 152-182).</p>
          <pre className="text-[11px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-2 overflow-x-auto">
{`class RerankDisabledWithoutOptIn(ValueError): ...

def assert_rerank_enabled(
    enable_rerank: bool, *, explicit_opt_in: bool = False,
) -> None: ...`}
          </pre>
          <p>
            <strong>Sub-lock 3: authority-coefficient bounds</strong>{' '}
            (lines 189-290). Bounds <code className="font-mono text-[11px]">[1.0, 2.0]</code>;
            rejects NaN explicitly because NaN comparisons always return
            False, so a bare interval check lets NaN through silently.
          </p>
          <p>
            Coefficient semantics: 1.0 = baseline (identity, returns
            <code className="font-mono text-[11px]"> base_score</code> unchanged); 2.0 = maximum
            boost (Acts 2x, CSAP 1.6x, External 1.35x). Values {'<'} 1.0
            invert the Pyramid; values {'>'} 2.0 collapse retrieval onto
            Acts-only and cross the AI-evidence-finder scope boundary.
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="M-4 formula: side-by-side (Appendix D Section D.3.1)"
        defaultOpen
        badge={TIER_LABELS.technical}
        badgeColor={TIER_BADGE_COLORS.technical}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            <strong>The load-bearing honesty section of Part VI.</strong>{' '}
            The M-4 implementation INTENTIONALLY deviates from the formula
            specified in the LightRAG/RAG-Anything architecture proposal
            v2 Section 3.6. The deviation was caught before M-4 shipped;
            the proposal text was subsequently corrected on 2026-05-16.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded-lg">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Source</th>
                  <th className="text-left px-3 py-2 font-semibold">Formula</th>
                </tr>
              </thead>
              <tbody className="text-slate-600 dark:text-slate-400">
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2">Proposal v2 Section 3.6 (ORIGINAL, NOT IMPLEMENTED)</td>
                  <td className="px-3 py-2 font-mono text-[11px]">boosted = base_score * (1.0 + (authority_level / 5) * (coefficient - 1.0))</td>
                </tr>
                <tr className="border-t border-slate-200 dark:border-slate-700 bg-emerald-50 dark:bg-emerald-900/20">
                  <td className="px-3 py-2">M-4 actual implementation (LANDED, line 289)</td>
                  <td className="px-3 py-2 font-mono text-[11px]">boosted = base_score * (1.0 + authority_value * (coefficient - 1.0))</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            <code className="font-mono text-[11px]">authority_level</code>{' '}
            is the integer Pyramid index (0 for Acts; 5 for CSAP);
            <code className="font-mono text-[11px]"> authority_value</code>{' '}
            is the float weight from
            <code className="font-mono text-[11px]"> AUTHORITY_VALUE_BY_LEVEL</code> (lines 200-207):
          </p>
          <pre className="text-[11px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-2 overflow-x-auto">
{`AUTHORITY_VALUE_BY_LEVEL = {
    "ACTS":               1.0,   # Level 0 -- statute (highest)
    "REGULATIONS":        0.9,   # Level 1
    "PROTOCOLS":          0.8,   # Level 2
    "TECHNICAL_GUIDANCE": 0.7,   # Level 3
    "EXTERNAL":           0.35,  # Level 4
    "CSAP":               0.6,   # Level 5
}`}
          </pre>
          <p>
            <strong>Why the proposal formula is wrong.</strong>{' '}
            Substituting at coefficient = 2.0:
          </p>
          <ul className="text-xs space-y-0.5 ml-2">
            <li>Acts (level 0): 1.0 + (0/5) * 1.0 = <strong>1.0 -- NO boost</strong></li>
            <li>CSAP (level 5): 1.0 + (5/5) * 1.0 = <strong>2.0 -- MAX boost</strong></li>
          </ul>
          <p>
            That INVERTS the Pyramid of Compliance. Acts (highest source
            of authority -- statute) would receive the LEAST boost; CSAP
            (lowest authority tier) would receive the MOST.
          </p>
          <p>
            <strong>Why the M-4 formula is correct.</strong> At
            coefficient = 2.0 with{' '}
            <code className="font-mono text-[11px]">authority_value</code>:
          </p>
          <ul className="text-xs space-y-0.5 ml-2">
            <li>Acts (1.0): factor 2.0 -- <strong>2x boost</strong></li>
            <li>Regs (0.9): factor 1.9</li>
            <li>Protocols (0.8): factor 1.8</li>
            <li>Tech Guidance (0.7): factor 1.7</li>
            <li>CSAP (0.6): factor 1.6</li>
            <li>External (0.35): factor 1.35</li>
          </ul>
          <p>
            Acts get the most boost; External gets the least. The
            Pyramid numeric-authority ordering (by `authority_value`) is
            preserved at every coefficient in
            <code className="font-mono text-[11px]"> [1.0, 2.0]</code>.
            Note that this is the numeric-calibration axis, not the
            source-hierarchy ordering axis: the CLAUDE.md two-axes note
            explains that External (0.35) is numerically lower than CSAP
            (0.6) despite External being a &ldquo;higher&rdquo; hierarchy level than
            CSAP. M-4 preserves the calibration-axis ordering; both axes
            are documented intentionally.
          </p>
          <p className="text-xs italic">
            The deviation is documented this prominently because it is
            the canonical example of why an architecture lock is a
            code-level artifact rather than a documentation-level
            artifact. If M-4 had implemented the proposal formula
            verbatim, the bug would have been live; the lock catches
            the inversion only because the implementation chose to
            deviate.
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="Ontology current state (Part VI Section 27.2)"
        badge={TIER_LABELS.technical}
        badgeColor={TIER_BADGE_COLORS.technical}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            The previously-blocking artifact for M2 is{' '}
            <code className="font-mono text-[11px]">
              WT:engine_v2/data/lightrag_entity_ontology_v1.json
            </code>{' '}
            (1784 lines; SHA-256{' '}
            <code className="font-mono text-[11px]">70da8452...afad477a</code>).
            The canonical truth is the JSON header. As of the 2026-05-17
            owner HITL signoff at engine-v2 worktree commit{' '}
            <code className="font-mono text-[11px]">05fd767b</code>, the
            relevant fields read:
          </p>
          <pre className="text-[11px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-2 overflow-x-auto">
{`{
  "ontology_version": "v1.0.0",
  "lifecycle_state": "HITL_SIGNED_OFF_V1_0_0",
  "signoff_record": {
    "signed_off_by": "Jasen Nelson (registered BC toxicologist)",
    "signed_off_on": "2026-05-17",
    "signoff_commit": "05fd767b",
    "m2_authorization": "M2 entity-extraction code is UNBLOCKED per Amendment A-8 effective signoff date."
  },
  ...
}`}
          </pre>
          <p>
            The <code className="font-mono text-[11px]">lifecycle_state</code> enum is verbatim
            from the JSON. The lifecycle state required for M2 to unblock
            was <code className="font-mono text-[11px]">HITL_SIGNED_OFF_V1_0_0</code>;
            that state was reached on 2026-05-17. The pre-signoff
            v0.42-strawman JSON is preserved at{' '}
            <code className="font-mono text-[11px]">WT:engine_v2/data/archive/lightrag_entity_ontology_v0_42_pre_signoff.json</code>.
          </p>
          <p>
            Three iteration arcs preceded the current state:
          </p>
          <ul className="text-xs space-y-1 ml-1">
            <li>
              <strong>v0.10 {'->'} v0.40</strong> (2026-05-16) -- 30
              versions iterated through 1 Opus adversarial holistic + 4
              codex CLI holistic reviews + 27 codex CLI targeted rounds +
              1 codex-unavailable Opus-fallback round + 2 mutual-agreement
              argument rounds. Closed via R-HOLISTIC-FIX-28.
            </li>
            <li>
              <strong>v0.40 {'->'} v0.42</strong> (2026-05-17) -- via
              R-HOLISTIC-FIX-29; cleared 29 unique FIX-N occurrences in
              the changelog. NOTE: FIX-28 is NOT present in the v0.42
              changelog, so the v0.40 prior holistic-review verdict did
              not carry forward as an affirmative status on v0.42. The
              honest framing at v0.42 was the lifecycle_state enum
              verbatim: AI_REVISION_COMPLETE_PENDING_HITL_REVIEW.
            </li>
            <li>
              <strong>v0.42 {'->'} v1.0.0</strong> (2026-05-17) -- via
              owner HITL signoff at engine-v2 worktree commit{' '}
              <code className="font-mono text-[11px]">05fd767b</code>.
              The owner (Jasen Nelson, registered BC toxicologist)
              reviewed and accepted the HITL signoff packet (PART_A +
              PART_B + INDEX) and advanced the ontology to v1.0.0 with
              lifecycle_state HITL_SIGNED_OFF_V1_0_0. M2 entity-
              extraction code is UNBLOCKED per Amendment A-8.
            </li>
          </ul>
          <p>
            The HITL signoff packet (three engine-v2 worktree commits)
            was reviewed and accepted by the owner during the signoff
            round at <code className="font-mono text-[11px]">05fd767b</code>:
          </p>
          <ul className="text-xs font-mono ml-1 space-y-0.5">
            <li>PART_A: <span className="text-slate-700 dark:text-slate-300">2a75c385</span> (reviewed + accepted 2026-05-17)</li>
            <li>PART_B: <span className="text-slate-700 dark:text-slate-300">187a7f10</span> (reviewed + accepted 2026-05-17)</li>
            <li>INDEX: <span className="text-slate-700 dark:text-slate-300">00cc9fee</span> (reviewed + accepted 2026-05-17; the earlier candidate INDEX <span className="text-slate-500">fa9fd791</span> is the Phase 2A SQL/validator merge, NOT the packet INDEX)</li>
          </ul>
          <p>
            Per Amendment A-8, no M2 entity-extraction code may land
            until the owner signs off and the lifecycle_state advances.
            That gate closed on 2026-05-17: the AI-evidence-finder scope
            was preserved (the AI did not start writing entity
            extractors against an unreviewed ontology), and the ontology
            is now HITL-approved at v1.0.0, so M2 entity-extraction code
            is structurally authorized to land.
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="Canary commits and audit trail (Appendix C Sections C.4 + C.6 + C.7)"
        badge={TIER_LABELS.technical}
        badgeColor={TIER_BADGE_COLORS.technical}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            All commits are on engine-v2 worktree master; none pushed to
            origin as of capture 2026-05-17.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded-lg">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Lane</th>
                  <th className="text-left px-3 py-2 font-semibold">Commit</th>
                  <th className="text-left px-3 py-2 font-semibold">Change</th>
                </tr>
              </thead>
              <tbody className="text-slate-600 dark:text-slate-400">
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2">C1 / B2a</td>
                  <td className="px-3 py-2 font-mono text-[11px]">a2dad048</td>
                  <td className="px-3 py-2"><code className="font-mono text-[11px]">submission_min_score</code> default <code className="font-mono text-[11px]">float(&quot;-inf&quot;)</code> {'->'} <code className="font-mono text-[11px]">0.0</code>; env override <code className="font-mono text-[11px]">RRAA_V2_SUBMISSION_MIN_SCORE</code>.</td>
                </tr>
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2">C2 / B1</td>
                  <td className="px-3 py-2 font-mono text-[11px]">08e81e45</td>
                  <td className="px-3 py-2">S4 PASS/FAIL-on-NEUTRAL guard at <code className="font-mono text-[11px]">s4_synthesizer.py:~1898</code>; gated on <code className="font-mono text-[11px]">B1_GUARD_ENABLED</code>. Telemetry: <code className="font-mono text-[11px]">_normalization_telemetry.b1_guard.pass_fail_on_neutral_rerouted</code>.</td>
                </tr>
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2">C3 / B3</td>
                  <td className="px-3 py-2 font-mono text-[11px]">ec9a5d75</td>
                  <td className="px-3 py-2">Real-backend confidence from rubric axes at <code className="font-mono text-[11px]">s4_synthesizer.py:~1747</code>; <code className="font-mono text-[11px]">confidence_method</code> {'->'} <code className="font-mono text-[11px]">&quot;rubric_aggregate_v1&quot;</code>; gated on <code className="font-mono text-[11px]">C3_CONFIDENCE_FROM_RUBRIC_ENABLED</code>.</td>
                </tr>
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2">Q2</td>
                  <td className="px-3 py-2 font-mono text-[11px]">5f78c004</td>
                  <td className="px-3 py-2">Size-aware C1 floor: <code className="font-mono text-[11px]">SUBMISSION_MIN_SCORE_SMALL_CORPUS_THRESHOLD=20</code> + <code className="font-mono text-[11px]">SUBMISSION_MIN_SCORE_SMALL_CORPUS_VALUE=-0.1</code>. {'>='}20 chunks {'->'} 0.0; smaller {'->'} -0.1.</td>
                </tr>
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2">D-2</td>
                  <td className="px-3 py-2 font-mono text-[11px]">7b9cc2a9</td>
                  <td className="px-3 py-2">Audit-trail commit: B4 (TIER_1 OBSERVATION_ONLY reroute) PERMANENTLY MOOT. A8 stays as a regression-detection WARN. No B4 commit authored.</td>
                </tr>
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2">M-4</td>
                  <td className="px-3 py-2 font-mono text-[11px]">0d9e1dcb</td>
                  <td className="px-3 py-2">v74.1+ architecture lock module + 33 anti-drift tests.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Semantic assertions A7-A10 (added 2026-05-15 post-Canary-2
            FAIL retro; Appendix C Section C.4.4): A7 BLOCKER -- PASS/FAIL
            requires polarized evidence; A8 WARN -- TIER_1 no
            OBSERVATION_ONLY (permanent regression-detection); A9 BLOCKER
            -- live backend confidence_method must be{' '}
            <code className="font-mono text-[11px]">rubric_aggregate_v1</code> or{' '}
            <code className="font-mono text-[11px]">..._no_axes</code>; A10 BLOCKER --
            submission_min_score {'>='} 0.0 for corpora{'>='}20 chunks OR{' '}
            {'>='} -0.1 AND {'<'} 0.0 for smaller; NEVER{' '}
            <code className="font-mono text-[11px]">float(&quot;-inf&quot;)</code>.
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="Dashboard integration (Part VI Section 31.2)"
        badge={TIER_LABELS.technical}
        badgeColor={TIER_BADGE_COLORS.technical}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            The v2 engine has two operational entry points: the canary
            runner (offline; Appendix A Section A.2 row 15) and the
            dashboard adapter (Appendix A Section A.3 row 62).
          </p>
          <p>
            The dashboard adapter is the Next.js route{' '}
            <code className="font-mono text-[11px]">
              DASH:src/app/api/engine-v2/projects/[id]/evaluate/route.ts
            </code>. Its responsibilities:
          </p>
          <ol className="text-xs space-y-1 ml-4 list-decimal">
            <li>
              Authenticate the request via the page-level auth guard at{' '}
              <code className="font-mono text-[11px]">DASH:src/lib/agentic-os/page-auth-guard.ts</code>{' '}
              (Appendix A Section A.3 row 43) -- defense-in-depth around
              the RSC cache bug fix.
            </li>
            <li>
              Set <code className="font-mono text-[11px]">RRAA_V2_SUBMISSION_RETRIEVAL_ENABLED=1</code>{' '}
              so the engine takes the v2 retrieval path rather than the
              legacy corpus-leak path (the historical bug surfaced during
              Canary 1; fix commit <code className="font-mono text-[11px]">ea4fd23</code>).
            </li>
            <li>
              Spawn <code className="font-mono text-[11px]">WT:engine_v2/scripts/run_owner_scenario.py</code>{' '}
              as a subprocess (the engine and dashboard share the v2
              worktree on disk; the dashboard does not vendor a copy).
            </li>
            <li>
              Stream stdout / stderr back to the dashboard&apos;s
              evaluation log.
            </li>
            <li>
              On completion, ingest the per-policy{' '}
              <code className="font-mono text-[11px]">eval_result.json</code> files into
              Supabase tables{' '}
              <code className="font-mono text-[11px]">v2_evaluations</code> and{' '}
              <code className="font-mono text-[11px]">v2_per_policy_results</code>.
            </li>
          </ol>
          <p>
            HITL writes pass through the{' '}
            <code className="font-mono text-[11px]">v2_judgments</code> table with
            tier-verdict matrix enforcement (Appendix A Section A.3 rows
            44 + 45):
          </p>
          <ul className="text-xs space-y-1 ml-1">
            <li>
              Server-side:{' '}
              <code className="font-mono text-[11px]">assertVerdictAllowedForTier()</code> in{' '}
              <code className="font-mono text-[11px]">DASH:src/lib/engine-v2/types_lane2.ts</code>.
            </li>
            <li>
              Database CHECK constraint:{' '}
              <code className="font-mono text-[11px]">v2_judgments_tier_verdict_check</code>{' '}
              in{' '}
              <code className="font-mono text-[11px]">DASH:supabase/engine_v2/database_schema_engine_v2_lane2b_patch.sql</code>.
            </li>
            <li>
              UPDATE trigger archives prior verdicts to{' '}
              <code className="font-mono text-[11px]">v2_judgment_history</code>.
            </li>
          </ul>
          <p>
            The tier-verdict matrix is a HITL-protection mechanism, not
            an AI behavior rule. The AI never writes through{' '}
            <code className="font-mono text-[11px]">v2_judgments</code>; it surfaces
            evidence for the HITL to act on. The matrix enforces that a
            TIER_1_BINARY judgment may save ADEQUATE / INADEQUATE /
            DEFICIENT / REQUIRES_REVIEW; TIER_2_PROFESSIONAL allows only
            DEFICIENT / REQUIRES_REVIEW; TIER_3_STATUTORY allows only
            OBSERVATION_ONLY. Tiers are HITL-classified; the AI does not
            classify tiers.
          </p>
        </div>
      </ExpandableSection>
    </div>
  );
}
