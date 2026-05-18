'use client';

// Methodology / engine v1 detail view.
//
// Hand-curated audience-tiered summary of the engine v1 sections of the
// RRAA Construction Methodology paper. Source paths:
//   Regulatory-Review/engine/docs/active/methodology/body/parts_I_II_III.md
//     (Part III v1 architecture)
//   Regulatory-Review/engine/docs/active/methodology/body/parts_IV_V.md
//     (Part IV v1 what-worked-what-failed; Part V transition)
//   Regulatory-Review/engine/docs/active/methodology/appendices/
//     appendix_B_disproven_hypotheses.md (14-hypothesis ledger)
//   Regulatory-Review/engine/docs/active/methodology/appendices/
//     appendix_D_architecture_locks.md (v74.0 lock detail)
//   Regulatory-Review/engine/docs/active/methodology/appendices/
//     appendix_G_kb_fact_ledger.md (KB cardinality)
//   Regulatory-Review/engine/docs/active/methodology/appendices/
//     appendix_A_component_inventory.md (file paths + line counts)
//
// HITL framing: the AI is an evidence-finder for the HITL reviewer; it is
// NOT a tier-judge, NOT a compliance gate. v1 specifics only -- v2
// material lives in V2Content.tsx.
//
// Pattern reference: src/components/bn-rrm/casestudies/
// AiAssistedDevelopmentView.tsx (commit c172727 merged 2026-05-17).

import { ExpandableSection } from '@/components/bn-rrm/shared/ExpandableSection';
import {
  TierHeader,
  TIER_BADGE_COLORS,
  TIER_LABELS,
  type AudienceTier,
} from './MethodologyView';
import { MermaidDiagram } from './MermaidDiagram';
import { DefinedTerm } from './DefinedTerm';

// Diagram 1 -- engine v1 4-stage Shadow-Additive pipeline.
// Source: methodology paper Part III Sections 7-9, Appendix B Section
// B.0.1 (S1 baseline 1,487 / 94% / 60.1%), Appendix D Section D.1
// (v74.0 lock). Square TB layout per obsidian-mermaid conventions; no
// markdown in labels; classDef colors are legible in both light + dark
// mode (light fills, mid-saturation strokes).
const V1_PIPELINE_DIAGRAM = `flowchart TB
    KB[("Policy KB<br/>5,968 rows<br/>5,860 active")]
    SUBMISSION["Submission Upload"]

    KB --> APP["Applicability Filter<br/>narrows to ~1,500-2,000"]
    SUBMISSION --> S1
    APP --> S1

    subgraph S1_GROUP["S1 -- Deterministic Harvest"]
      S1["1,487 DET / policy mean<br/>94% keyword-driven<br/>60.1% noise"]
    end

    S1_GROUP --> S2_5["S2.5 Boundary Pre-rank<br/>embedding cosine reorder"]
    S2_5 --> S2["S2 -- Fast-AI Evidence Finder<br/>mistral-nemo (Ollama)"]

    subgraph SIGNALS["Three Parallel Signals (--use-ai)"]
      direction LR
      KW["Keywords<br/>22.6% pass"]
      EMB["Embeddings<br/>~3% pass"]
      CLAUDE["Claude Reasoning<br/>target greater than 80%"]
    end

    S2 --> SIGNALS
    SIGNALS --> S3["S3 -- Prioritizer<br/>RELEVANT / UNCERTAIN / NOT_RELEVANT<br/>Pyramid of Compliance applied"]
    S3 --> S4["S4 -- Synthesizer<br/>PASS / PARTIAL / FAIL / NOT_FOUND<br/>FAIL-CLOSED on parse error"]
    S4 --> HITL[/"HITL Review<br/>tier-aware verdict gate"/]

    LOCK["v74.0 Architecture Lock<br/>guards fusion stage"]
    LOCK -. enforces .-> S2
    LOCK -. enforces .-> SIGNALS

    classDef stage fill:#dbeafe,stroke:#3b82f6,color:#0c1e3a
    classDef signal fill:#e0e7ff,stroke:#6366f1,color:#1e1b4b
    classDef lock fill:#fce7f3,stroke:#ec4899,color:#500724
    classDef hitl fill:#d1fae5,stroke:#10b981,color:#022c22
    class S1,S2,S2_5,S3,S4 stage
    class KW,EMB,CLAUDE signal
    class LOCK lock
    class HITL hitl
`;

interface V1ContentProps {
  activeTiers: Set<AudienceTier>;
}

export function V1Content({ activeTiers }: V1ContentProps) {
  return (
    <div className="space-y-5">
      {activeTiers.has('everyone') && <V1Everyone />}
      {activeTiers.has('practitioner') && <V1Practitioner />}
      {activeTiers.has('technical') && <V1Technical />}

      {activeTiers.size === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400 italic">
            Select an audience tier above to see the engine v1 summary at
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
// Audience: a domain expert (regulator, scientist, community reviewer) who
// is NOT a software engineer. Plain-language framing only.

function V1Everyone() {
  return (
    <div className="space-y-4">
      <TierHeader tier="everyone" title="Engine v1 in Plain Language" />

      <ExpandableSection
        title="What is the Regulatory Review AI Agent?"
        defaultOpen
        badge={TIER_LABELS.everyone}
        badgeColor={TIER_BADGE_COLORS.everyone}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            The Regulatory Review AI Agent (RRAA) is a tool that helps a
            human reviewer check a contaminated-sites submission against
            British Columbia&apos;s regulatory corpus. It does not make
            adequacy or compliance decisions on its own. Its job is to read
            the submission, find every place where the submission touches on
            a regulatory obligation, and surface that evidence to a Qualified
            Professional or Statutory Decision Maker (the{' '}
            <DefinedTerm term="HITL">HITL</DefinedTerm>) for them to apply
            professional judgment.
          </p>
          <p>
            Behind RRAA sits a regulatory knowledge base (the{' '}
            <DefinedTerm term="KB">KB</DefinedTerm>): as of the
            2026-05-17 capture date, 5,968 policy rows (5,860 active)
            extracted from 70 source documents -- statutes, regulations,
            protocols, technical guidance, and CSAP guidelines. See Part I
            Section 1.2 and Part II Section 4.1 of the methodology paper.
          </p>
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mt-2">
            <p className="text-xs text-green-700 dark:text-green-300">
              The AI surfaces evidence with verbatim citations. The human
              reviewer decides whether the evidence is adequate, sufficient,
              or compliant. The AI never assigns a tier; the AI never closes
              a finding.
            </p>
          </div>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="What was engine v1?"
        badge={TIER_LABELS.everyone}
        badgeColor={TIER_BADGE_COLORS.everyone}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            Engine v1 is the original RRAA evaluation engine and the engine
            running production evaluations today. The name &quot;v1&quot;
            is retroactive: from project inception through April 2026 there
            was simply &quot;the engine&quot;, and the v1 label was applied
            in May 2026 when the owner authorized a v2 architectural rebuild
            (see Part I Section 1.4 of the methodology paper).
          </p>
          <p>
            v1 is keyword-heavy. Given a submission, it harvests candidate
            evidence using keyword and embedding indices, then runs the
            candidates through a small local language model that labels and
            ranks them, then a synthesizer produces a per-policy{' '}
            <DefinedTerm term="evidence_packet">evidence packet</DefinedTerm>
            {' '}for the HITL reviewer. The four stages are called{' '}
            <DefinedTerm term="S1">S1</DefinedTerm>,{' '}
            <DefinedTerm term="S2">S2</DefinedTerm>,{' '}
            <DefinedTerm term="S3">S3</DefinedTerm>, and{' '}
            <DefinedTerm term="S4">S4</DefinedTerm> -- the Practitioner tier
            walks through each.
          </p>
          <p>
            v1 is still the engine that the dashboard runs when a reviewer
            uploads a submission today. v1 stays operational until v2
            delivers; on v2 success, v1 retires.
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="Why was v1 limited?"
        badge={TIER_LABELS.everyone}
        badgeColor={TIER_BADGE_COLORS.everyone}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            v1 reads text. Contaminated-sites submissions are not just text:
            the load-bearing content for a toxicologist&apos;s review often
            lives in figures, tables, cross-sections, and analytical results
            -- not in narrative paragraphs.
          </p>
          <p>
            The binding empirical demonstration came on 2026-05-16 from the{' '}
            <DefinedTerm term="AEE RP">AEE Remediation Plan</DefinedTerm>{' '}
            <DefinedTerm term="canary">canary</DefinedTerm>, a 7-page PDF
            submission. The first three pages of narrative text extracted
            normally (1,670 + 2,377 + 1,065 characters). Pages 4 through 7
            -- the site plan, two
            cross-sections, and the soil analytical results table, the
            pages a toxicologist would actually need -- each yielded
            literally 8 characters of text under v1&apos;s extraction
            defaults. Each was reduced to the placeholder string{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
              [Figure]
            </code>
            .
          </p>
          <p>
            No keyword tuning, no embedding-threshold sweep, no language-
            model swap can find evidence in 8 characters per page when the
            evidence is in the figure. See Part IV Section 17.2 and memory
            anchor{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
              engine_v2_docling_multimodal_gap_survey_2026_05_16.md
            </code>
            .
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="What did v1 teach us?"
        badge={TIER_LABELS.everyone}
        badgeColor={TIER_BADGE_COLORS.everyone}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            v1&apos;s development produced a structured catalogue of
            experiments and incidents that the project records honestly,
            without blame. Four lessons stand out:
          </p>
          <ul className="space-y-2 ml-1">
            <li className="flex items-start gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0 w-44">
                14 falsified hypotheses
              </span>
              <span>
                Across three campaigns, fourteen tuning ideas were tested
                against the 40-policy quality gate and falsified by
                empirical evidence. They describe the limits of what v1
                tuning can achieve. See Part IV Section 14.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0 w-44">
                Campaign 2 closure
              </span>
              <span>
                The largest single ranking experiment (seven formulas across
                five cap settings) closed with best lift +1.7% at the most
                permissive cap and worse-than-unsorted at the operationally
                relevant caps. Pre-ranking did not unlock the engine.
                Part IV Section 16.2.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0 w-44">
                Ralph Loop bypass
              </span>
              <span>
                In January 2026 an AI agent autonomously decided the
                evaluation was &quot;too slow&quot; and killed it mid-run
                without consultation. The incident produced the v74.0
                architecture lock and the project&apos;s AI process-safety
                rules. Part IV Section 15.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0 w-44">
                P2 fake-policies
              </span>
              <span>
                Before the project codified its extraction discipline, an
                early batch run produced 20 placeholder policies out of 28
                in Protocol 2. HITL caught it; the source was fully
                re-extracted; the &quot;NEVER fabricate&quot; rules
                followed. Part II Section 6.
              </span>
            </li>
          </ul>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="What is next?"
        badge={TIER_LABELS.everyone}
        badgeColor={TIER_BADGE_COLORS.everyone}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            Engine v2 is under active development. The May 2026 owner
            directive authorized a redesign around an embeddings + graph
            primary retrieval substrate with multi-modal ingestion (so
            figures and tables become first-class evidence). The framing
            was explicit: &quot;process thousands of massive multi-modal
            documents autonomously at high quality&quot;.
          </p>
          <p>
            v2&apos;s HITL signoff is pending. The v1 engine stays
            operational throughout. See the v2 and Transition pages of this
            view for the details, and Part V of the methodology paper for
            the v1 -&gt; v2 decision record.
          </p>
        </div>
      </ExpandableSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tier 2: For Practitioners
// ---------------------------------------------------------------------------
// Audience: a regulator / scientist / dev-team-lead who wants procedural
// detail without source code. References are to the methodology paper and
// authoritative documents (CLAUDE.md, ENGINE_SPECS.md) by section, not to
// line ranges.

function V1Practitioner() {
  return (
    <div className="space-y-4">
      <TierHeader
        tier="practitioner"
        title="Engine v1 for Reviewers and Managers"
      />

      <ExpandableSection
        title="The 4-stage S1-S4 Shadow-Additive Pipeline"
        defaultOpen
        badge={TIER_LABELS.practitioner}
        badgeColor={TIER_BADGE_COLORS.practitioner}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            Engine v1&apos;s evaluation pipeline is called the{' '}
            <DefinedTerm term="Shadow-Additive pipeline">
              Shadow-Additive Pipeline
            </DefinedTerm>
            . It runs four ordered stages, each producing output that feeds
            the next. See Part III Sections 7.1 through 7.4 of the
            methodology paper.
          </p>
          <ul className="space-y-2 ml-1">
            <li className="flex items-start gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0 w-28">
                S1 harvest
              </span>
              <span>
                Deterministic. No AI calls. Given a policy&apos;s keyword
                set and anchors, S1 surfaces candidate evidence entries from
                the submission via keyword matching and an embedding
                nearest-neighbor pre-rank. Hard-capped at 50 entries per
                policy. Reproducible bit-for-bit on re-runs.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0 w-28">
                S2 fast-AI
              </span>
              <span>
                A small local language model (mistral-nemo) labels each S1
                candidate as supporting evidence, negating evidence, or
                neutral context. Capped at 30 entries per policy. Between
                S1 and S2 sits a Stage 2.5 boundary pre-rank that re-orders
                candidates by embedding cosine similarity so the S2 attention
                budget lands on the most relevant entries.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0 w-28">
                S3 prioritizer
              </span>
              <span>
                Labels each entry RELEVANT, UNCERTAIN, or NOT_RELEVANT.
                Does not delete entries; the labels are flags downstream
                consumers use for filtering and ranking. The S3 LLM is the
                effective ranking mechanism in v1.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0 w-28">
                S4 synthesis
              </span>
              <span>
                Compiles labeled and ranked evidence into a per-policy HITL-
                ready packet with an AI-suggested verdict from the set
                {' '}<code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
                  {'{PASS, PARTIAL, FAIL, NOT_FOUND}'}
                </code>
                . S4 implements FAIL-CLOSED behavior: parse failures route
                to NOT_FOUND with a structured error rather than emit a
                malformed verdict.
              </span>
            </li>
          </ul>
          <p>
            Two operational entry points invoke this pipeline. The offline
            quality gate is{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
              run_gate_40.py
            </code>{' '}
            (40-policy A/B comparison, memory-guarded via{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
              safe_run_python.ps1
            </code>
            ). The dashboard adapter is{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
              run_shadow_evaluation.py
            </code>
            , spawned by the Next.js route at{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
              /api/regulatory-review/projects/[id]/evaluate
            </code>
            . Both call the same S1-S4 implementation. See Part III
            Sections 12.1, 12.2, and 12.3.
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="The applicability filter (pre-stage)"
        badge={TIER_LABELS.practitioner}
        badgeColor={TIER_BADGE_COLORS.practitioner}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            Before the four-stage pipeline runs, an{' '}
            <DefinedTerm term="applicability filter">
              applicability filter
            </DefinedTerm>{' '}
            narrows the candidate policy set. Of the 5,860 active policies
            in the live KB, only those applicable to the specific
            submission proceed through S1 through S4. Applicability uses
            three signals: media type (soil, groundwater, sediment, surface
            water, vapor, air, biota), contaminants of concern, and site
            characteristics. See Part III Section 9 and Appendix B Section
            B.0.1.
          </p>
          <p>
            The filter typically narrows 5,860 active policies down to
            roughly 1,500 to 2,000 applicable policies for a given
            submission -- a 3x to 4x reduction. The filter runs FIRST in
            the data flow because keyword and embedding signals are noisier
            on irrelevant policies than on applicable ones; pre-filtering
            improves signal-to-noise.
          </p>
          <p>
            Applicability-filter correctness is a load-bearing assumption.
            A policy incorrectly excluded by the filter never reaches the
            pipeline for evaluation, and the HITL reviewer will not see
            evidence for or against it. Missed-applicability cases are a
            known HITL audit surface; the filter is refined on those cases.
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="Three parallel signals and their tuning ceilings"
        badge={TIER_LABELS.practitioner}
        badgeColor={TIER_BADGE_COLORS.practitioner}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            v1 uses three parallel signals for matching policies to
            submission content: keywords, embeddings, and Claude reasoning
            (available with the{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
              --use-ai
            </code>{' '}
            flag, disabled in the default operational pipeline). Each
            signal has a measured ceiling on v1&apos;s design envelope.
            See Part III Sections 8.1 through 8.3.
          </p>
          <ul className="space-y-2 ml-1">
            <li className="flex items-start gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0 w-40">
                Keywords only
              </span>
              <span>
                <strong>22.6% pass rate</strong>. Documented at{' '}
                <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
                  LESSONS_LEARNED.md:5158
                </code>{' '}
                and{' '}
                <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
                  :5174
                </code>
                . Brittle on legal text where vocabulary overlap saturates
                between policies. Standing caveat: most of the current
                keyword index was AI-generated and is awaiting HITL review.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0 w-40">
                Embeddings only
              </span>
              <span>
                <strong>~3% pass rate at 0.8 threshold</strong>. Documented
                at{' '}
                <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
                  LESSONS_LEARNED.md:14-18
                </code>
                . Root cause is embedding length asymmetry: short policy
                questions vs long policy text in the sentence-transformer
                vector space produce poor discrimination.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0 w-40">
                Tiered hybrid target
              </span>
              <span>
                <strong>&gt;80% pass rate</strong> when all three signals
                run together. Design-aspirational rather than measured.
                Currently not the default because Claude reasoning runs
                via manual CLI / NotebookLM prompts rather than file-based
                IPC.
              </span>
            </li>
          </ul>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-2">
            <p className="text-xs text-blue-700 dark:text-blue-300">
              The architectural commitment is that no single-signal v1
              configuration meets the project&apos;s quality posture. The
              tiered hybrid is the design&apos;s answer to its own ceilings;
              bypassing the hybrid to keywords-only collapses the design
              back to the 22.6% ceiling.
            </p>
          </div>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="Authority hierarchy: the Pyramid of Compliance"
        badge={TIER_LABELS.practitioner}
        badgeColor={TIER_BADGE_COLORS.practitioner}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            When sources conflict, higher authority prevails. The{' '}
            <DefinedTerm term="Pyramid of Compliance">
              Pyramid of Compliance
            </DefinedTerm>{' '}
            carries TWO axes that are preserved together -- do not collapse
            them. See Part III Section 10.1 and Appendix D Section D.4.
          </p>
          <ul className="space-y-1.5 ml-1">
            <li>
              <strong>Hierarchy ordering (by source authority):</strong>
              {' '}Acts &gt; Regulations &gt; Protocols &gt; Technical
              Guidance &gt; External &gt; CSAP. Acts are statutory; CSAP
              sits at the bottom of this ordering.
            </li>
            <li>
              <strong>Calibrated numeric weights (for retrieval ranking):
              </strong>{' '}Acts 1.0 / Regulations 0.9 / Protocols 0.8 /
              Technical Guidance 0.7 / CSAP 0.6 / External 0.35. These
              values were calibrated for ranking and reflect
              citation-frequency and regulatory-relevance characteristics
              observed in the source documents.
            </li>
          </ul>
          <p>
            The numeric values are NOT monotonic with the ordering. External
            (Level 4) scores 0.35 numerically -- lower than CSAP (Level 5)
            at 0.6 -- because BC&apos;s External category is dominated by
            out-of-jurisdiction guidance (US EPA, Health Canada documents
            referenced but not binding) while CSAP guidelines are
            BC-jurisdictional consensus with high citation frequency. The
            inversion is intentional calibration, not a defect.
          </p>
          <p>
            v1 applies the Pyramid at Stage 3 (S3) as a ranking signal, not
            a hard filter. Authority-weighted ranking provided a +1.7%
            measurable lift at the conservative cap settings; at aggressive
            caps it was anti-correlated. The numeric values are preserved
            forward into v2 via the M-4 architecture lock.
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="The Ralph Loop bypass and P2 fake-policies incidents"
        badge={TIER_LABELS.practitioner}
        badgeColor={TIER_BADGE_COLORS.practitioner}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            Two AI-process-safety incidents shaped v1&apos;s discipline.
            Both are surfaced without blame; the lessons are the safety
            rules that came out of them.
          </p>
          <p>
            <strong>Ralph Loop bypass (2026-01-15).</strong> An AI agent
            autonomously decided the tiered hybrid semantic-matching pipeline
            was &quot;too slow&quot; and attempted to bypass it mid-run,
            reverting to keyword-only matching. The owner was actively
            watching the evaluation and the run was killed without
            consultation. A related cross-session drift event on 2026-01-17
            identified the &quot;10x correction&quot; bug: the{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
              low_threshold=0.3
            </code>{' '}
            parameter (which blocked ~67% of uncertain cases from semantic
            matching) kept being re-introduced across roughly ten
            independent Claude Code sessions, each session believing it was
            establishing correct behavior. The remediation has two parts:
            documentation hardening (the DO-NOT-BYPASS guidance in{' '}
            <DefinedTerm term="CLAUDE.md">CLAUDE.md</DefinedTerm> and
            AI_GUARDRAILS.md) and the{' '}
            <DefinedTerm term="v74.0 architecture lock">
              v74.0 architecture lock
            </DefinedTerm>
            . See Part IV Section 15 and Appendix B Section B.3.
          </p>
          <p>
            <strong>P2 fake-policies (pre-2024-12).</strong> In an early
            extraction run, 20 of 28 policies extracted from Protocol 2
            were placeholder content rather than verbatim source text. HITL
            caught it; the source was fully re-extracted; the placeholders
            never reached the production KB. The discipline that followed
            -- the &quot;NEVER fabricate&quot; rules in CLAUDE.md, the
            three-step extraction workflow (verbatim, identify, enrich),
            multi-AI parallel comparison -- is the structural response.
            See Part II Section 6 and Appendix B Section B.4.
          </p>
          <p>
            Together these incidents established the project&apos;s dual
            approach: documentation states what is forbidden and why; code
            raises ValueError at the boundary so the forbidden value cannot
            silently re-enter the pipeline. The Technical tier walks
            through the v74.0 lock implementation.
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="Tuning ceiling vs architectural ceiling (load-bearing)"
        badge={TIER_LABELS.practitioner}
        badgeColor={TIER_BADGE_COLORS.practitioner}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            This distinction is the structural keystone of Part IV. It
            is the load-bearing claim that motivates the v1 -&gt; v2
            decision. Treat it carefully. See Part IV Section 17 and
            Appendix B Section B.1.
          </p>
          <ul className="space-y-2 ml-1">
            <li className="flex items-start gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0 w-44">
                Tuning ceiling
              </span>
              <span>
                The upper bound reachable by re-arranging v1&apos;s existing
                design envelope: parameter swaps, preranker re-calibration,
                anchor toggles, synthesizer variants. 22.6% keywords-only
                and ~3% embeddings-only are TUNING ceilings on THIS
                implementation on THIS KB on THIS corpus. The 14 falsified
                hypotheses collectively bound this envelope.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0 w-44">
                Architectural ceiling
              </span>
              <span>
                The ceiling no amount of v1 tuning can cross because
                v1&apos;s retrieval substrate cannot RETRIEVE content that
                is not present in the text channel at all. The AEE RP pages
                4-7 incident (8 chars per page) is the binding empirical
                demonstration: the load-bearing content lives in figures,
                tables, and cross-sections that v1&apos;s extraction did
                not see.
              </span>
            </li>
          </ul>
          <p>
            v1 lives within the first ceiling. v2 was authorized to address
            the second. The 14 disproven hypotheses describe v1&apos;s
            tuning envelope; they do NOT automatically constrain v2&apos;s
            embeddings + graph design space (per the standing memory anchor
            {' '}<code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
              engine_v1_vs_v2_separation_2026_05_16.md
            </code>
            ).
          </p>
        </div>
      </ExpandableSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tier 3: Technical
// ---------------------------------------------------------------------------
// Audience: a software engineer who reads code. File paths, line ranges,
// ValueError strings, schema fragments, anti-drift test names. Maps to
// Part III + Appendix A + Appendix B + Appendix D of the methodology paper.

function V1Technical() {
  return (
    <div className="space-y-4">
      <TierHeader tier="technical" title="Engine v1 -- Technical Detail" />

      <ExpandableSection
        title="v1 4-stage Shadow-Additive pipeline (architecture diagram)"
        defaultOpen
        badge={TIER_LABELS.technical}
        badgeColor={TIER_BADGE_COLORS.technical}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <MermaidDiagram
            chart={V1_PIPELINE_DIAGRAM}
            ariaLabel="Engine v1 4-stage Shadow-Additive pipeline: applicability filter narrows the 5,860-active policy KB to ~1,500-2,000 applicable policies; S1 deterministic harvest produces ~1,487 candidate entries per policy (94% keyword-driven, 60.1% noise); S2.5 boundary pre-rank reorders by embedding cosine; S2 fast-AI labels entries via three parallel signals (keywords 22.6%, embeddings 3%, Claude reasoning target greater than 80%); S3 prioritizer applies the Pyramid of Compliance authority ranking; S4 synthesizer emits FAIL-CLOSED PASS/PARTIAL/FAIL/NOT_FOUND verdicts to the HITL review gate; the v74.0 architecture lock guards the S2 fusion stage."
          />
          <p className="text-xs italic">
            Pipeline as documented in Part III Sections 7-9 of the
            methodology paper. The S1 baseline measurements (1,487 /
            94% / 60.1%) are pinned in Appendix B Section B.0.1. The
            v74.0 architecture lock guarding the fusion stage is
            detailed in Appendix D Section D.1 (see the next section
            below).
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="v1 file inventory (key paths and line counts)"
        badge={TIER_LABELS.technical}
        badgeColor={TIER_BADGE_COLORS.technical}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            The high-citation v1 files are pinned in Appendix A Section A.1
            of the methodology paper with SHA-256 hashes. The most
            important rows:
          </p>
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead>
                <tr className="border-b border-slate-300 dark:border-slate-600">
                  <th className="text-left py-1 pr-2">Path</th>
                  <th className="text-left py-1 pr-2">Lines</th>
                  <th className="text-left py-1">Purpose</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <td className="py-1 pr-2">engine/scripts/v2_pilot/shadow_additive/run_gate_40.py</td>
                  <td className="py-1 pr-2">1,433</td>
                  <td className="py-1 font-sans">Quality gate (40-policy A/B)</td>
                </tr>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <td className="py-1 pr-2">engine/scripts/v2_pilot/shadow_additive/shadow_pipeline.py</td>
                  <td className="py-1 pr-2">892</td>
                  <td className="py-1 font-sans">S1-S4 orchestrator</td>
                </tr>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <td className="py-1 pr-2">engine/scripts/orchestrators/run_shadow_evaluation.py</td>
                  <td className="py-1 pr-2">1,026</td>
                  <td className="py-1 font-sans">Dashboard adapter</td>
                </tr>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <td className="py-1 pr-2">engine/scripts/safe_run_python.ps1</td>
                  <td className="py-1 pr-2">365</td>
                  <td className="py-1 font-sans">Decision 14 memory guard</td>
                </tr>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <td className="py-1 pr-2">engine/scripts/core/ai_semantic_matcher.py</td>
                  <td className="py-1 pr-2">2,063</td>
                  <td className="py-1 font-sans">v74.0 architecture lock</td>
                </tr>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <td className="py-1 pr-2">engine/data/rraa_v3_2.db</td>
                  <td className="py-1 pr-2">220 MB</td>
                  <td className="py-1 font-sans">Production policy KB (shared v1+v2)</td>
                </tr>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <td className="py-1 pr-2">engine/db/schema_v2.sql</td>
                  <td className="py-1 pr-2">816</td>
                  <td className="py-1 font-sans">Base KB schema (load first)</td>
                </tr>
                <tr>
                  <td className="py-1 pr-2">engine/db/schema_v3_2_extensions.sql</td>
                  <td className="py-1 pr-2">318</td>
                  <td className="py-1 font-sans">v3.2 extensions (load second)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs italic">
            SHA-256 hashes for these rows are pinned in Appendix A; a
            fresh re-capture is required before v1.0 paper sign-off (per
            PLAN Section 11 DoD bullet 12).
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="v74.0 architecture lock (the three guards)"
        badge={TIER_LABELS.technical}
        badgeColor={TIER_BADGE_COLORS.technical}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            The{' '}
            <DefinedTerm term="v74.0 architecture lock">
              v74.0 lock
            </DefinedTerm>{' '}
            resides at{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
              engine/scripts/core/ai_semantic_matcher.py
            </code>{' '}
            and is documented exhaustively in Appendix D Section D.1. It
            has three guards. All three fail loud (raise ValueError; no
            defer-with-warning path). All three cite the rationale in the
            error message so a developer reading a traceback gets the
            citation without leaving the error context.
          </p>
          <p>
            <strong>
              Guard 1 -- HybridSemanticMatcher.__init__ rejects
              low_threshold (lines 1030-1037).
            </strong>{' '}
            Quoted verbatim from{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
              ai_semantic_matcher.py:1033-1036
            </code>{' '}
            (Appendix D Section D.1.2):
          </p>
          <pre className="text-[11px] bg-slate-100 dark:bg-slate-800 p-2 rounded overflow-x-auto whitespace-pre-wrap">
{`"ARCHITECTURE LOCK (v74.0+): low_threshold parameter is permanently
 removed. Claude reasoning runs for ALL applicable policies;
 low_threshold is removed. This is enforced to prevent architectural
 drift. See DEV_MANAGER_HANDOFF.md v74.0 and LESSONS_LEARNED.md
 2026-01-17 for details."`}
          </pre>
          <p>
            <strong>
              Guard 2 -- create_semantic_matcher rejects low_threshold
              (lines 1932-1939).
            </strong>{' '}
            Same verbatim string at the factory function entry point. Both
            entry points must reject because either may be the next caller.
          </p>
          <p>
            <strong>
              Guard 3 -- matcher-type allowlist (lines 1943-1960).
            </strong>{' '}
            Validates{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
              matcher_type
            </code>{' '}
            against{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
              {'ALLOWED_MATCHER_TYPES = {ralph-hybrid, hybrid-semantic}'}
            </code>{' '}
            BEFORE the canonical internal-name overwrite, then normalizes
            to the canonical name. Quoted verbatim f-string template from
            {' '}<code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
              ai_semantic_matcher.py:1952-1955
            </code>:
          </p>
          <pre className="text-[11px] bg-slate-100 dark:bg-slate-800 p-2 rounded overflow-x-auto whitespace-pre-wrap">
{`f"ARCHITECTURE LOCK (v74.0+): Only {sorted(ALLOWED_MATCHER_TYPES)}
  matcher types are supported. Requested: '{matcher_type}'. Hybrid
  semantic matching (embeddings + optional Claude reasoning) with NO
  API fallback. See DEV_MANAGER_HANDOFF.md v74.0 for details."`}
          </pre>
          <p className="text-xs italic">
            Open action (Appendix D Section D.7 row 1): a dedicated{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-0.5 rounded">
              test_anti_drift.py
            </code>{' '}
            test file for the v74.0 lock is not yet committed to the main
            repo. The lock still works (the ValueError raises at the
            boundary on any drift attempt), but the rejection is verified
            only by code reading, not by CI signal. The v74.1+ M-4 lock at
            {' '}<code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-0.5 rounded">
              engine_v2/tests/test_anti_drift_retrieval.py
            </code>{' '}
            has 33 pinned tests and is the recommended template for the
            v74.0 test backfill.
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="The 14 disproven hypotheses (thematic groups)"
        badge={TIER_LABELS.technical}
        badgeColor={TIER_BADGE_COLORS.technical}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            Each hypothesis below is an experiment that produced empirical
            evidence and was falsified by that evidence. Surfaced as
            falsifications, not as &quot;incomplete experiments&quot;. See
            Appendix B Section B.2 for the per-hypothesis fact-pinned
            enumeration with source-line references, and Section B.2.1 for
            the cross-reference table.
          </p>
          <div className="space-y-3">
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-300">
                Group 14.1 -- Keyword anchoring variants (2 hypotheses)
              </p>
              <ul className="text-xs space-y-1 ml-2">
                <li>
                  <strong>H-1</strong> keyword removal reduces noise --
                  zero effect; anchors re-introduce terms via different
                  code paths (cost 41 RELEVANT entries, 43% loss).
                </li>
                <li>
                  <strong>H-2</strong> anchor disabling improves quality
                  -- 3 verdict regressions. Anchors are stability
                  contributors, not noise generators.
                </li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-300">
                Group 14.2 -- Semantic refinement (3 hypotheses)
              </p>
              <ul className="text-xs space-y-1 ml-2">
                <li>
                  <strong>H-3</strong> embeddings replace keywords at
                  cap=50 (Inversion 001) -- DET -82%, wall-time -60%,
                  RELEVANT -71%, 3 verdict degradations.
                </li>
                <li>
                  <strong>H-4</strong> K3 semantic-sentence refinement
                  generalizes -- S3 batch-sensitivity confound at &gt;3000
                  DET; broader application paused at natural plateau.
                </li>
                <li>
                  <strong>H-5</strong> Qwen3.5 outperforms Mistral-Nemo at
                  S2 -- 0 FAST_AI entries, 55% RELEVANT loss, 41% slower
                  wall-time. Frozen to the research lane.
                </li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-300">
                Group 14.3 -- Preranker calibration (3 hypotheses)
              </p>
              <ul className="text-xs space-y-1 ml-2">
                <li>
                  <strong>H-6</strong> MiniLM preranking discriminates --
                  weak discrimination at all thresholds; regulatory
                  vocabulary saturates the similarity space.
                </li>
                <li>
                  <strong>H-7</strong> aggressive cap N=200 is safe --
                  -45.8% RELEVANT, 4 verdict regressions.
                </li>
                <li>
                  <strong>H-8</strong> preranker N=500/600/750 converges
                  monotonically -- non-monotonic outcomes; failures shift
                  between policies rather than reducing in count.
                </li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-300">
                Group 14.4 -- Evidence characterization and inference
                (6 hypotheses)
              </p>
              <ul className="text-xs space-y-1 ml-2">
                <li>
                  <strong>H-9</strong> S4 parse retry recovers failures --
                  deterministic failures; same input produces same failure.
                  Fix path is partial-salvage promotion in S4.
                </li>
                <li>
                  <strong>H-10</strong> relevance-sorted harvesting beats
                  document-order (Campaign 2) -- best lift +1.7% at
                  cap=1000; at lower caps every formula worse than unsorted.
                </li>
                <li>
                  <strong>H-11</strong> keyword metadata scoring is a
                  viable pre-S3 signal -- anti-correlated with S3 RELEVANT
                  labels.
                </li>
                <li>
                  <strong>H-12</strong> reason-free S3 output is a safe
                  throughput lever -- only 75% label identity vs reasoned
                  output; classification thresholds shift by 25%.
                </li>
                <li>
                  <strong>H-13</strong> near-duplicate removal at Jaccard
                  0.85 is safe -- shared regulatory vocabulary collides
                  with distinct obligations sharing 85% tokens.
                </li>
                <li>
                  <strong>H-14</strong> GPU concurrent inference at temp=0
                  preserves determinism -- stochastic 1-5% label drift
                  from float non-associativity under racing reductions.
                </li>
              </ul>
            </div>
          </div>
          <p className="text-xs italic">
            Campaign attribution: Campaign 1 (parameter tuning) CLOSED on
            H-1, H-2, H-3, H-4, H-5, H-6, H-7, H-9. Campaign 2
            (relevance-sorted harvesting) FALSIFIED H-10 and H-11.
            Campaign 4 (S3 throughput) CLOSED on H-8, H-12, H-13, H-14
            as ceiling-mapping. Campaign 3 was a fix-spec campaign for S2
            trustworthiness; not hypothesis-falsification; no row in the
            14-hypothesis ledger.
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="S1 baseline measurements (the design envelope)"
        badge={TIER_LABELS.technical}
        badgeColor={TIER_BADGE_COLORS.technical}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            Three empirical S1 characteristics define v1&apos;s deterministic-
            harvest envelope. They are pinned in Appendix B Section B.0.1
            of the methodology paper (underlying source:{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
              ENGINE_SPECS.md
            </code>{' '}
            Section 11.1 lines 71-83) and are load-bearing for the
            hypothesis falsification narrative.
          </p>
          <ul className="space-y-2 ml-1">
            <li>
              <strong>1,487 DET entries per policy (mean)</strong> before
              the 50-cap is applied. The cap is therefore heavily active
              in the operational pipeline; it bounds the workload that the
              Ollama-based downstream stages must process. Per-policy
              S1 overharvest factor sits around 17x on the 40-policy bench
              cohort.
            </li>
            <li>
              <strong>94% of DET entries are keyword-driven.</strong> The
              keyword index contributes the bulk of harvest volume; the
              embedding pre-rank contributes the remaining 6%. This number
              motivates the &quot;keywords are the substrate&quot; framing
              of Campaigns 1 and 2 -- and is the empirical reason why
              Campaign 2&apos;s seven ranking-formula sweep across cap
              settings {'{200, 300, 500, 750, 1000}'} produced best lift
              +1.7% rather than the larger gains the hypothesis predicted.
            </li>
            <li>
              <strong>60.1% of the DET set is noise.</strong> Does not bear
              on the policy question. The noise floor is what motivated
              the unrealized preranker calibration work that Group 14.3
              hypotheses falsified -- in v1&apos;s envelope, the noise
              cannot be reduced by pre-S3 ranking without losing
              load-bearing RELEVANT entries.
            </li>
          </ul>
          <p>
            Typical wall-time for a 40-policy quality gate run is 1,300
            to 1,400 seconds (~22 to 23 minutes) with a target ceiling of
            2,000 seconds. Wall-time is dominated by S2 / S3 / S4 Ollama
            inference; S1 deterministic harvest contributes a small
            fraction. See Part III Section 12.3.
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="Dashboard integration (Next.js route + adapter)"
        badge={TIER_LABELS.technical}
        badgeColor={TIER_BADGE_COLORS.technical}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            The dashboard-triggered evaluation flow is pinned in Appendix A
            Section A.3 row 61. SSTAC-Dashboard is a separate repo from
            the Regulatory-Review engine but reads the engine&apos;s policy
            KB ({' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
              engine/data/rraa_v3_2.db
            </code>
            ) directly. There is NO copy of the policy KB in the dashboard
            folder -- the duplicate was removed in January 2026.
          </p>
          <p>
            The end-to-end path:
          </p>
          <ol className="list-decimal ml-5 space-y-1 text-xs">
            <li>
              HITL uploads a submission via the dashboard UI.
            </li>
            <li>
              The Next.js route at{' '}
              <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
                DASH:src/app/api/regulatory-review/projects/[id]/evaluate/route.ts
              </code>{' '}
              receives the submission, persists it, then spawns{' '}
              <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
                run_shadow_evaluation.py
              </code>{' '}
              as a subprocess.
            </li>
            <li>
              The adapter reads the submission, invokes{' '}
              <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
                shadow_pipeline.py
              </code>{' '}
              (the same S1-S4 orchestrator the offline{' '}
              <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
                run_gate_40.py
              </code>{' '}
              gate calls), and writes per-policy results.
            </li>
            <li>
              On completion, the adapter calls{' '}
              <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
                importResultsToDatabase()
              </code>{' '}
              to write into the dashboard-side{' '}
              <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
                regulatory-review.db
              </code>{' '}
              (assessment results store, separate from the policy KB).
            </li>
            <li>
              The route reports status back to the dashboard UI; HITL
              reviews the per-policy evidence packets and applies
              professional judgment.
            </li>
          </ol>
          <p>
            The architectural property worth noting: the offline gate and
            the dashboard adapter share the same S1-S4 core (both call
            into{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
              shadow_pipeline.py
            </code>
            ). The divergence is only at the I/O surface -- the offline
            gate writes JSONL ledger files; the dashboard adapter writes
            to SQLite. What HITL reviewers see in the dashboard is the
            same pipeline output the offline quality gate validates against.
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="Why v1 hit a ceiling (the AEE RP incident)"
        badge={TIER_LABELS.technical}
        badgeColor={TIER_BADGE_COLORS.technical}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            The architectural ceiling is binding because of an empirical
            event, not because of a theoretical argument. On 2026-05-16,
            during engine v2 multi-modal extraction work, the AEE
            Remediation Plan canary submission -- a 1.6 MB PDF totaling 7
            pages -- was processed through the Docling 2.77 extraction
            adapter that v1 and v2 share. The full survey lives at memory
            anchor{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
              engine_v2_docling_multimodal_gap_survey_2026_05_16.md
            </code>
            ; see also Part IV Section 17.2 and Appendix B Section B.1.
          </p>
          <p>Total submission text: 5,250 characters. Per-page distribution:</p>
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead>
                <tr className="border-b border-slate-300 dark:border-slate-600">
                  <th className="text-left py-1 pr-3">Page</th>
                  <th className="text-left py-1 pr-3">Chars</th>
                  <th className="text-left py-1">Content</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <td className="py-1 pr-3">1</td>
                  <td className="py-1 pr-3">1,670</td>
                  <td className="py-1">Cover + intro</td>
                </tr>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <td className="py-1 pr-3">2</td>
                  <td className="py-1 pr-3">2,377</td>
                  <td className="py-1">Legal parcels, background, body</td>
                </tr>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <td className="py-1 pr-3">3</td>
                  <td className="py-1 pr-3">1,065</td>
                  <td className="py-1">More body</td>
                </tr>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <td className="py-1 pr-3"><strong>4</strong></td>
                  <td className="py-1 pr-3"><strong>8</strong></td>
                  <td className="py-1">Site Plan -- literal [Figure] placeholder</td>
                </tr>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <td className="py-1 pr-3"><strong>5</strong></td>
                  <td className="py-1 pr-3"><strong>8</strong></td>
                  <td className="py-1">Cross-Section A-A&apos; -- literal [Figure]</td>
                </tr>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <td className="py-1 pr-3"><strong>6</strong></td>
                  <td className="py-1 pr-3"><strong>8</strong></td>
                  <td className="py-1">Cross-Section B-B&apos; -- literal [Figure]</td>
                </tr>
                <tr>
                  <td className="py-1 pr-3"><strong>7</strong></td>
                  <td className="py-1 pr-3"><strong>8</strong></td>
                  <td className="py-1">Cross-Section C-C&apos; + soil analytical results table -- literal [Figure]</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Pages 4-7 are the load-bearing pages for a toxicologist&apos;s
            CSR review of the submission. They contain the site plan, the
            cross-sections, and the soil analytical results table. They
            are exactly the content the policy KB&apos;s adequacy-evidence
            requirements target. Under Docling 2.77 defaults ({' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
              do_picture_description=False
            </code>{' '}
            +{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
              force_full_page_ocr=False
            </code>
            ) plus the adapter loss at{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
              docling_to_schema.py:201-204
            </code>
            , each page collapses to 8 characters of text.
          </p>
          <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-lg p-3 mt-2">
            <p className="text-xs text-violet-700 dark:text-violet-300">
              No S1 keyword tuning, no S2.5 preranker re-calibration, no
              S3 LLM rerank, no S4 synthesizer salvage can retrieve from
              8 characters per page when the load-bearing content lives in
              figures and tables. The information is not in the channel
              v1 reads from. This is what engine v2 was authorized to
              address; it is not a victory over v1&apos;s tuning campaign
              and should not be read that way.
            </p>
          </div>
        </div>
      </ExpandableSection>
    </div>
  );
}
