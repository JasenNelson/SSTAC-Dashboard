'use client';

// Methodology / v1 -> v2 transition rationale content.
//
// Source of truth (every claim below is a curated summary of a section
// in the canonical methodology paper):
//   - body Part IV Section 17 (architectural-vs-tuning ceiling) at
//     Regulatory-Review/engine/docs/active/methodology/body/parts_IV_V.md
//   - body Part V Sections 18-23 (the v1 -> v2 decision) at the same
//     file
//   - Appendix B Section B.0.1 (v1 baseline measurements) and B.1
//     (architectural-vs-tuning ceiling) at
//     Regulatory-Review/engine/docs/active/methodology/appendices/appendix_B_disproven_hypotheses.md
//   - memory anchor engine_v2_lightrag_raganything_architecture_proposal_v2_2026_05_16.md
//   - memory anchor engine_v2_lightrag_architecture_holistic_review_2026_05_16.md
//   - memory anchor engine_v2_docling_multimodal_gap_survey_2026_05_16.md
//
// Visual + tier pattern mirrors AiAssistedDevelopmentView.tsx (commit
// c172727). Multiple tiers can be active simultaneously here (Set
// state lives in MethodologyView); the three section trees below
// render only when their tier is in the active set.
//
// Discipline notes (NON-NEGOTIABLE for this file):
//   - The architectural-vs-tuning ceiling distinction (Everyone section
//     "The architectural-vs-tuning ceiling distinction" and Practitioner
//     section "The May 2026 owner directive") is THE LOAD-BEARING
//     STRUCTURAL CLAIM of the whole paper. Surface prominently, never
//     bury.
//   - The KB cost 4-5x understatement is surfaced in BOTH the
//     Practitioner tier (Amendment A-1) AND the Technical tier
//     (dedicated section). Do not strip either copy.
//   - Ontology lifecycle_state is the verbatim enum from the JSON. As
//     of 2026-05-17 signoff at commit `05fd767b` the state is
//     HITL_SIGNED_OFF_V1_0_0 (advanced from v0.42-strawman /
//     AI_REVISION_COMPLETE_PENDING_HITL_REVIEW). Never write
//     "GREEN-LIGHT" in v0.42 context; for v1.0.0 use the signed-off
//     enum verbatim.
//   - v2 is NOT delivered. Use planned / blocked / pending language.
//   - HITL framing: evidence-finder, NOT tier-judge.

import { ExpandableSection } from '@/components/bn-rrm/shared/ExpandableSection';
import {
  TierHeader,
  TIER_BADGE_COLORS,
  TIER_LABELS,
  type AudienceTier,
} from './MethodologyView';
import { MermaidDiagram } from './MermaidDiagram';
import { DefinedTerm } from './DefinedTerm';

// Diagram 3 -- M-4 architecture lock authority-coefficient formula deviation.
// Source: methodology paper Appendix D Section D.3 (formula deviation) +
// Part V Section 21.3 (Pyramid of Compliance) + Part VI Section 26.3
// (M-4 implementation). The diagram shows the original v2 proposal
// Section 3.6 WRONG formula side-by-side with the M-4 actual LANDED
// formula. Color discipline:
//   - red   = original WRONG formula (proposal v2 Section 3.6)
//   - green = M-4 actual LANDED formula
// LR layout to put the two formulas side-by-side; ASCII-safe math
// expressions (no Unicode math glyphs).
const M4_FORMULA_DIAGRAM = `flowchart LR
    subgraph WRONG["Proposal v2 Section 3.6 -- ORIGINAL (wrong)"]
      direction TB
      W1["boosted = base_score * (1 + (authority_level / 5) * (coef - 1))"]
      W2["Acts level=0: 1.0x boost<br/>Regs level=1: 1.2x<br/>Protocols level=2: 1.4x<br/>Tech Guidance level=3: 1.6x<br/>External level=4: 1.8x<br/>CSAP level=5: 2.0x"]
      WX["INVERTS Pyramid:<br/>Acts get LEAST boost<br/>CSAP get MOST boost"]
      W1 --> W2 --> WX
    end

    M4["M-4 commit 0d9e1dcb<br/>+33 anti-drift tests<br/>(test_anti_drift_retrieval.py)"]

    subgraph RIGHT["M-4 LANDED -- ACTUAL (correct)"]
      direction TB
      R1["boosted = base_score * (1 + authority_value * (coef - 1))"]
      R2["Acts value=1.00: 2.0x boost<br/>Regs value=0.90: 1.9x<br/>Protocols value=0.80: 1.8x<br/>Tech Guidance value=0.70: 1.7x<br/>CSAP value=0.60: 1.6x<br/>External value=0.35: 1.35x"]
      RX["HONORS Pyramid:<br/>Acts get MOST boost<br/>External get LEAST"]
      R1 --> R2 --> RX
    end

    WRONG -. deviation captured at .-> M4
    M4 -. implements .-> RIGHT

    classDef wrong fill:#fee2e2,stroke:#dc2626,color:#450a0a
    classDef right fill:#d1fae5,stroke:#10b981,color:#022c22
    classDef pivot fill:#fce7f3,stroke:#ec4899,color:#500724
    class W1,W2,WX wrong
    class R1,R2,RX right
    class M4 pivot
`;

interface TransitionContentProps {
  activeTiers: Set<AudienceTier>;
}

export function TransitionContent({ activeTiers }: TransitionContentProps) {
  return (
    <div className="space-y-5">
      {activeTiers.has('everyone') && <TransitionEveryone />}
      {activeTiers.has('practitioner') && <TransitionPractitioner />}
      {activeTiers.has('technical') && <TransitionTechnical />}

      {activeTiers.size === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400 italic">
            Select an audience tier above to see the v1 {'->'} v2 transition
            summary at that depth.
          </p>
        </div>
      )}

      <TransitionFooter />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tier 1: Everyone (green)
// ---------------------------------------------------------------------------

function TransitionEveryone() {
  return (
    <div className="space-y-4">
      <TierHeader tier="everyone" title="Why a Rebuild?" />

      <ExpandableSection
        title="Why a rebuild?"
        defaultOpen
        badge={TIER_LABELS.everyone}
        badgeColor={TIER_BADGE_COLORS.everyone}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            Engine v1 -- the original Regulatory Review engine -- is the
            keyword-heavy 4-stage pipeline that has been running on
            submissions since launch. It works, but it hit a ceiling.
            Across more than a dozen tuning experiments (different
            keyword strategies, different embedding thresholds,
            different rerankers, different prioritizers) the engine
            kept landing on the same pass-rate numbers: about 22.6% on
            keywords-only and about 3% on embeddings-only. Every
            campaign that tried to push past those numbers came back
            with the same answer: parameters can be re-tuned, but the
            ceiling does not move.
          </p>
          <p>
            Then a more fundamental problem surfaced. On
            <strong> 2026-05-16</strong>, while running a real submission
            (the{' '}
            <DefinedTerm term="AEE RP">AEE Remediation Plan</DefinedTerm>
            {' '}-- a 7-page PDF) through the current text extractor, pages
            4 through 7 each yielded
            <strong> 8 characters of text</strong>. Eight. Those pages
            are the site plan, the cross-sections, and the soil
            analytical results -- the load-bearing content a
            toxicologist actually needs. Under the default settings of
            the document extractor, every figure on those pages
            collapsed to a single
            <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded mx-0.5">[Figure]</code>
            placeholder. No amount of keyword or embedding tuning can
            retrieve content from 8 characters per page; the content is
            simply not in the text channel v1 reads from.
          </p>
          <p>
            That second problem -- not the tuning ceiling -- is what
            authorized the rebuild. The owner directive was to
            <em> &quot;process thousands of massive multi-modal
            documents autonomously at high quality.&quot;</em> A
            text-only engine cannot do that. Engine v2 was authorized
            to address the gap by reading the channels v1 cannot read:
            figures, tables, OCR text inside images, and a graph of
            relationships between policies.
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="The architectural-vs-tuning ceiling distinction"
        defaultOpen
        badge={TIER_LABELS.everyone}
        badgeColor={TIER_BADGE_COLORS.everyone}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            This is the load-bearing idea behind the whole transition.
            It is worth saying carefully, because the two ceilings are
            often confused.
          </p>
          <p>
            A <strong>tuning ceiling</strong> is what you hit when you
            adjust parameters inside an existing design. Different
            keyword lists, different score thresholds, different
            re-rankers. v1&apos;s tuning ceiling is roughly 22.6% on
            keywords-only and 3% on embeddings-only. Those numbers are
            measured, not estimated, and they describe what v1 can
            reach when its dials are turned in any combination
            currently understood. The 14 disproven hypotheses captured
            in Appendix B of the methodology paper are all tuning
            experiments. Their collective falsification bounds the
            tuning envelope.
          </p>
          <p>
            An <strong>architectural ceiling</strong> is different. It
            is the ceiling imposed by what the system can SEE at all
            -- not by how well it ranks what it sees. v1 reads text.
            When the load-bearing content is in a figure (a site plan,
            a cross-section, a chromatogram, a soil-results table that
            is an embedded image), v1 cannot read it. There is no dial
            to turn that fixes a missing channel. The AEE RP
            8-chars-per-page incident is the empirical demonstration:
            real submission, real adapter run, real char counts, real
            load-bearing content invisible to v1.
          </p>
          <p>
            Engine v2 was authorized specifically to address the
            <em> architectural</em> ceiling, not v1&apos;s tuning
            ceiling. v2 changes the substrate so the engine can read
            figures, tables, and OCR text inside images via a
            vision-language model, and so it can traverse a graph of
            policy relationships rather than just match keywords. v2 is
            not &quot;v1 with better dials&quot;; it is a different
            substrate that reads channels v1 cannot read.
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="What was decided in May 2026"
        badge={TIER_LABELS.everyone}
        badgeColor={TIER_BADGE_COLORS.everyone}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            On <strong>2026-05-16</strong>, the project owner authorized
            an engine v2 redesign on the basis of a written
            architecture proposal (the{' '}
            <DefinedTerm term="LightRAG">LightRAG</DefinedTerm> /{' '}
            <DefinedTerm term="RAG-Anything">RAG-Anything</DefinedTerm>{' '}
            3-milestone arc:{' '}
            <DefinedTerm term="M1">M1</DefinedTerm> multi-modal extraction,{' '}
            <DefinedTerm term="M2">M2</DefinedTerm> graph retrieval,{' '}
            <DefinedTerm term="M3">M3</DefinedTerm> persistent policy
            knowledge graph). The owner&apos;s
            strategic framing was recorded verbatim in the proposal:
            <em> &quot;process thousands of massive multi-modal documents
            autonomously at high quality.&quot;</em> That is the goal,
            not a delivered capability.
          </p>
          <p>
            The authorization is <strong>contingent</strong>. A holistic
            independent review of the original proposal raised 10
            amendments -- changes the proposal had to fold in before
            implementation could proceed. The HITL approved the v2
            redesign on the condition that the 10 amendments hold. The
            current proposal version is the post-amendment version;
            implementation is proceeding against it.
          </p>
          <p>
            What that means in plain language: v2 was not approved as a
            blank check. Specific quality and cost gates have to be
            cleared before the most expensive parts of v2 (the
            persistent knowledge graph) commit. Three of those gates are
            still open; one is closed.
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="What did NOT change"
        badge={TIER_LABELS.everyone}
        badgeColor={TIER_BADGE_COLORS.everyone}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            Five things stayed the same across the v1 to v2 transition
            -- and that is deliberate.
          </p>
          <ul className="space-y-2 ml-1 text-xs">
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">-</span>
              <span>
                <strong>The policy knowledge base.</strong> The same
                5,968 extracted policies (5,860 active) feed both
                engines. v1 and v2 read the same database directly.
                There is no parallel{' '}
                <DefinedTerm term="KB">KB</DefinedTerm>, no &quot;v2
                policies&quot; vs &quot;v1 policies&quot;.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">-</span>
              <span>
                <strong>
                  The{' '}
                  <DefinedTerm term="Pyramid of Compliance">
                    Pyramid of Compliance
                  </DefinedTerm>
                  .
                </strong>{' '}
                The authority hierarchy (Acts at the top, then
                Regulations, Protocols, Technical Guidance, External
                Guidance, CSAP Guidelines) is preserved verbatim in v2.
                v2 even pins the numeric authority values into its
                retrieval lock at the code level so they cannot drift
                across sessions.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">-</span>
              <span>
                <strong>The{' '}
                <DefinedTerm term="HITL">HITL</DefinedTerm> framing.
                </strong> The AI is an
                evidence-finder for the human reviewer. The AI surfaces
                relevant evidence with verbatim citations; the human
                applies professional judgment and legal discretion. The
                AI does not make adequacy, compliance, sufficiency, or
                tier determinations. This framing is unchanged from v1
                to v2.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">-</span>
              <span>
                <strong>
                  The{' '}
                  <DefinedTerm term="v74.0 architecture lock">
                    v74.0 architecture lock
                  </DefinedTerm>
                  .
                </strong>{' '}
                v1&apos;s anti-drift lock on the semantic-matcher fusion
                stage still applies. (A complementary{' '}
                <DefinedTerm term="v74.1+ M-4 lock">v74.1+ lock</DefinedTerm>{' '}
                was added on v2&apos;s retrieval surface; the two coexist.)
                Lessons learned about preventing parameter drift carry
                forward.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">-</span>
              <span>
                <strong>Indigenous content framing.</strong>{' '}
                Indigenous-uses content (traditional gardens, hunting
                grounds, fishing waters, medicinal plant gathering, and
                similar uses of natural resources) is technically
                relevant pathway evidence for contaminated-sites
                assessment -- just like commercial agriculture,
                residential gardens, or municipal water supply. The AI
                surfaces it like any other pathway content; a UI
                metadata badge (content-type label such as
                &quot;Indigenous uses content&quot;) signals the chunk
                references Indigenous uses so the HITL can spot it
                during review. The AI does NOT auto-elevate,
                auto-classify, auto-redact, or speak in procedural /
                consultation / regulator voice. Additional regulatory
                and consultation considerations under Section 35 of the
                Constitution Act, DRIPA, and the Honour of the Crown
                are handled by the HITL plus the in-person Indigenous
                consultation process -- explicitly out of scope for
                this AI-assisted application. This framing is unchanged
                from v1 to v2. Sources: methodology paper Part VII
                Section 34;{' '}
                <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded">
                  CLAUDE.md
                </code>{' '}
                &quot;Indigenous Content (content-type, not procedural
                gate)&quot;; standing memory{' '}
                <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded break-all">
                  feedback_no_tier_judgment_for_ai.md
                </code>
                .
              </span>
            </li>
          </ul>
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
            <p className="text-xs text-green-700 dark:text-green-300">
              v1 remains operational while v2 is built. v1 retires only
              once v2 delivers on the architectural question. If v2
              fails to deliver, the project may pivot rather than
              retire v1 prematurely.
            </p>
          </div>
        </div>
      </ExpandableSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tier 2: Practitioner (blue)
// ---------------------------------------------------------------------------

function TransitionPractitioner() {
  return (
    <div className="space-y-4">
      <TierHeader
        tier="practitioner"
        title="Transition Plan -- For Practitioners"
      />

      <ExpandableSection
        title="The May 2026 owner directive"
        defaultOpen
        badge={TIER_LABELS.practitioner}
        badgeColor={TIER_BADGE_COLORS.practitioner}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            On <strong>2026-05-16</strong>, the project owner authorized
            the v2 redesign on the basis of an architecture proposal
            (memory anchor{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded break-all">
              engine_v2_lightrag_raganything_architecture_proposal_v2_2026_05_16.md
            </code>
            ). The TL;DR of that proposal records the owner&apos;s
            strategic framing verbatim:
          </p>
          <blockquote className="border-l-4 border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 italic text-sm">
            &quot;process thousands of massive multi-modal documents
            autonomously at high quality.&quot;
          </blockquote>
          <p>
            That phrase is the OWNER framing -- not an AI paraphrase --
            and it is the GOAL, not a delivered capability. Body Part V
            Section 18 of the methodology paper is careful to cite it
            exactly and not to extrapolate it into claims about what v2
            has shipped.
          </p>
          <p>
            The authorization is <strong>contingent</strong>. HITL
            approved v2 on the condition that 10 amendments raised by
            the holistic independent review hold. The proposal v2 is
            the post-amendment version; the owner authorized v2, not
            v1 of the proposal. M1 (multi-modal extraction) is
            currently in progress against v2&apos;s specifications. M2
            (LightRAG retrieval shim) and M3 (persistent KB graph) are
            BLOCKED on pre-conditions tied to specific amendments.
          </p>
          <p>
            The authority structure is therefore: HITL approved on
            2026-05-16, contingent on the 10 amendments; the amendments
            translate into specific pre-M2 and pre-M3 gates; the gates
            are tracked in the proposal and in the engine v2 canary log.
            The contract is the amendments.
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="The 5 alternative frameworks dispatched"
        badge={TIER_LABELS.practitioner}
        badgeColor={TIER_BADGE_COLORS.practitioner}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            The holistic Opus review recorded the alternative frameworks
            that were considered as the v2 retrieval substrate and the
            one-line dispatch reason for each. The proposal&apos;s
            &quot;Why not X&quot; section captures the same dispatches
            (amendment A-10). Body Part V Section 20 of the methodology
            paper carries the long form. Summary:
          </p>
          <ul className="space-y-2 ml-1 text-xs">
            <li className="flex items-start gap-2">
              <span className="text-rose-500 mt-0.5">[no]</span>
              <span>
                <strong>Microsoft GraphRAG.</strong> Leans on{' '}
                <em>community summaries</em> generated by an LLM at
                ingestion time. A community summary surfaced as
                evidence without provenance back to a verbatim source
                is AI-authored interpretive content masquerading as
                evidence -- a ghost-evidence risk that directly
                conflicts with the &quot;AI is evidence-finder, not
                tier-judge&quot; rule. The v2 retrieval lock
                additionally rejects{' '}
                <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded">
                  mode=&quot;global&quot;
                </code>{' '}
                (which builds community summaries) without explicit
                opt-in.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-rose-500 mt-0.5">[no]</span>
              <span>
                <strong>Anthropic Contextual Retrieval.</strong> Pre-prompts
                each chunk with surrounding context before embedding --
                a lighter intervention with comparable accuracy on many
                benchmarks. NOT multi-modal. Worth noting as a
                conditional FALLBACK if M2 LightRAG quality
                disappoints; does not address the architectural ceiling
                on its own.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-rose-500 mt-0.5">[no]</span>
              <span>
                <strong>Vespa.ai.</strong> Production-grade hybrid
                retrieval engine. NOT graph-based and has limited
                multi-modal capability. Addresses operational concerns
                LightRAG + RAG-Anything already address (per-evaluation
                JSON in M2, Postgres+AGE in M3) without the
                graph-substrate or first-class multi-modal ingestion
                the owner&apos;s goal requires.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-rose-500 mt-0.5">[no]</span>
              <span>
                <strong>NVIDIA NeMo Retriever.</strong> API-only /
                proprietary on NVIDIA&apos;s GPU cloud. The
                engine&apos;s cost-control discipline (the Decision 14
                memory guard via{' '}
                <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded">
                  safe_run_python.ps1
                </code>
                ) is built around locally-runnable models;
                external-API-only retrieval would require a separate
                cost-approval workflow and would couple retrieval to a
                vendor.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-rose-500 mt-0.5">[no]</span>
              <span>
                <strong>Self-built GraphRAG on Supabase + pgvector.</strong>{' '}
                Approximately <strong>100x more engineering</strong>{' '}
                than wrapping LightRAG, per the holistic-review
                estimate. LightRAG&apos;s M3 already targets Postgres+AGE
                on the existing Supabase project as its graph-storage
                backend, so re-implementing what LightRAG provides on
                the same backend duplicates the work for no
                architectural gain.
              </span>
            </li>
          </ul>
          <p className="text-xs text-slate-500 dark:text-slate-500 italic mt-1">
            Decision substrate: <strong>LightRAG / RAG-Anything</strong>{' '}
            (HKUDS, MIT-licensed, actively maintained). LightRAG
            provides the graph-augmented RAG substrate with chunk-level
            provenance; RAG-Anything provides the first-class
            multi-modal ingestion layer. The three milestones M1, M2,
            M3 sequence the integration from low-risk to high-risk and
            keep each milestone independently shippable.
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="The 10 amendments (A-1 through A-10)"
        badge={TIER_LABELS.practitioner}
        badgeColor={TIER_BADGE_COLORS.practitioner}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            The holistic Opus review identified 10 amendments to the v1
            proposal. The proposal v2 is the version that folds them
            in; the owner authorized v2, not v1. Body Part V Section 21
            of the methodology paper carries the long form. Summary:
          </p>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-1">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
              A-1: KB cost re-baseline (UNDERSTATEMENT ~4-5x).
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              The v1 proposal estimated approximately{' '}
              <strong>18,000 LLM calls / $50-100 / 10-20h</strong> for
              KB ingestion. The holistic re-baseline produced
              empirically-grounded ranges:{' '}
              <strong>30,000-50,000 LLM calls / $200-600 / 80-150h</strong>.
              That is a <strong>4-5x understatement</strong> on every
              axis. Surfaced explicitly here, NOT buried in an
              appendix, because honest cost reporting is load-bearing
              for the explicit owner-cost-approval gate G4. Amendment
              A-1 requires a sub-sample empirical test (ingest 100
              policies, extrapolate to 5,860 active rows) before M3 KB
              build is authorized.
            </p>
          </div>
          <ul className="space-y-1.5 ml-1 text-xs">
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">-</span>
              <span>
                <strong>A-2: VLM bake-off on AEE RP pages 4-7.</strong>{' '}
                Quality-unverified VLM defaults are not acceptable on
                regulatory content. Granite Vision 3.3-2b vs Qwen2.5-VL
                7b on the binding pages; M1 is not accepted until the
                bake-off completes.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">-</span>
              <span>
                <strong>A-3: Authority-level injection spec (bounded
                coefficient [1.0, 2.0]).</strong> Closes a v74.0-style
                drift risk by specifying the injection point, the
                formula, and the bounds at the code level. LANDED as
                part of the M-4 v74.1+ architecture lock.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">-</span>
              <span>
                <strong>A-4: 200-sample HITL audit of cross-references
                at precision &gt;= 0.90.</strong> The 1,991 rows in{' '}
                <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded">
                  policy_cross_references
                </code>{' '}
                were AI-extracted in prior phases; once they become
                graph edges in M3, retrievers traverse them as
                authoritative. Required before M3 KB build.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-rose-500 mt-0.5">-</span>
              <span>
                <strong>A-5: Drop the{' '}
                <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded">
                  supersedes
                </code>{' '}
                edge.</strong> Identified as an AI regulatory
                determination in disguise: &quot;Policy A supersedes
                Policy B&quot; is a regulatory determination, not a
                content fact. The edge stays only when the source
                document verbatim says so. Near-miss almost added; the
                amendment dropped it.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">-</span>
              <span>
                <strong>A-6: Pre-M2 NetworkX spike (2 days, 1 canary,
                no prod wiring).</strong> Empirically verifies
                entity-extraction quality BEFORE the 60-90h M2 budget
                commits. Gated on amendment A-8 (ontology signoff).
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">-</span>
              <span>
                <strong>A-7: Background-job KB ingestion (batched
                contract).</strong> Upload-complete background job
                with a UI badge; batched at 100 policies per{' '}
                <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded">
                  safe_run_python.ps1
                </code>{' '}
                invocation with resume-from-cache, so the Decision 14
                memory guard does not kill an 80-150h ingest mid-run.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">-</span>
              <span>
                <strong>A-8: HITL-owned entity ontology -- ORIGINALLY
                BLOCKED M2; UNBLOCKED 2026-05-17.</strong> The ontology
                at{' '}
                <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded break-all">
                  engine_v2/data/lightrag_entity_ontology_v1.json
                </code>{' '}
                was originally required to be HITL-signed-off before any
                M2 entity-extraction code could run against real
                policies. The owner (registered BC toxicologist) signed
                off on 2026-05-17 at engine-v2 worktree commit{' '}
                <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded">
                  05fd767b
                </code>
                , advancing the ontology to v1.0.0 /
                HITL_SIGNED_OFF_V1_0_0. M2 entity-extraction code is
                now UNBLOCKED per Amendment A-8.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">-</span>
              <span>
                <strong>A-9: evidence_packet 0.2.0 schema bump.</strong>{' '}
                Adds modality enum (figure_caption, table_cells,
                equation_latex, text) with{' '}
                <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded">
                  source_id
                </code>{' '}
                /{' '}
                <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded">
                  file_path
                </code>{' '}
                provenance preserved from M2. Must land WITH M3, not
                retrofitted afterward.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">-</span>
              <span>
                <strong>A-10: &quot;Why not X&quot; appendix.</strong>{' '}
                Authorship amendment: the proposal must record the
                dispatch rationale for the 5 alternative frameworks
                inline, so a future reader (codex or HITL) can
                re-derive the substrate choice without re-running the
                dispatch. LANDED in proposal v2.
              </span>
            </li>
          </ul>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="The 4 pre-M3 gates"
        badge={TIER_LABELS.practitioner}
        badgeColor={TIER_BADGE_COLORS.practitioner}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            The 10 amendments translate into specific empirical or
            governance checks before M3 (the persistent policy KB
            graph) is authorized. Four gates bind M3. Body Part V
            Section 23 of the methodology paper carries the long form.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded-lg">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Gate</th>
                  <th className="text-left px-3 py-2 font-semibold">
                    Description
                  </th>
                  <th className="text-left px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="text-slate-600 dark:text-slate-400">
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2 font-mono">G1</td>
                  <td className="px-3 py-2">
                    Empirical KB cost re-baseline. Ingest 100
                    representative policies; measure actual LLM call
                    count and wall-clock; extrapolate to 5,860 active
                    rows. The output is the number that goes to the
                    owner under G4.
                  </td>
                  <td className="px-3 py-2 text-amber-600 dark:text-amber-400 font-semibold">
                    PENDING
                  </td>
                </tr>
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2 font-mono">G2</td>
                  <td className="px-3 py-2">
                    HITL audit of 200 stratified cross-references at
                    precision &gt;= 0.90. Cross-ref provenance backfill
                    spec at{' '}
                    <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded break-all">
                      engine_v2/docs/cross_ref_provenance_backfill_spec_2026_05_17.md
                    </code>
                    . HITL labels each sample accept / reject; AI
                    surfaces samples, AI does not judge.
                  </td>
                  <td className="px-3 py-2 text-amber-600 dark:text-amber-400 font-semibold">
                    PENDING
                  </td>
                </tr>
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2 font-mono">G3</td>
                  <td className="px-3 py-2">
                    Authority-level injection spec&apos;d in{' '}
                    <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded">
                      architecture_lock_retrieval.py
                    </code>{' '}
                    with bounded coefficient [1.0, 2.0] and explicit
                    boost formula. Landed via M-4.
                  </td>
                  <td className="px-3 py-2 text-emerald-600 dark:text-emerald-400 font-semibold">
                    DONE
                  </td>
                </tr>
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2 font-mono">G4</td>
                  <td className="px-3 py-2">
                    Explicit owner cost approval. The cost ranges going
                    to the owner are <strong>$200-600</strong> Claude
                    Haiku 3.5 fees and <strong>80-150h</strong> local
                    Ollama qwen2.5:14b wall-clock. G4 depends on G1
                    producing empirically-grounded numbers.
                  </td>
                  <td className="px-3 py-2 text-amber-600 dark:text-amber-400 font-semibold">
                    PENDING G1
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-500 italic mt-1">
            M2 (LightRAG retrieval shim) was BLOCKED on amendment A-8
            (HITL-owned entity ontology signoff); that gate closed on
            2026-05-17 (signoff at engine-v2 commit{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded">
              05fd767b
            </code>
            ; ontology v1.0.0 / HITL_SIGNED_OFF_V1_0_0), so M2 is now
            READY. M3 (persistent KB graph) remains BLOCKED on
            G1 + G2 + G4 closing. G3 is closed via M-4. The block is a
            quality-first discipline: drafting work that does not
            commit irreversible artifacts proceeds; spending KB build
            cost does not.
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="Honest reporting (open items + near-misses)"
        badge={TIER_LABELS.practitioner}
        badgeColor={TIER_BADGE_COLORS.practitioner}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            The methodology paper names the inconvenient findings as
            plainly as the convenient ones. A few items a reviewer
            should not have to dig for:
          </p>
          <ul className="space-y-1.5 ml-1 text-xs">
            <li className="flex items-start gap-1.5">
              <span className="text-slate-400 mt-0.5">-</span>
              <span>
                <strong>AEE RP 8-chars-per-page incident.</strong> Real
                submission, real adapter run; pages 4-7 each yielded 8
                characters of text under default extractor settings.
                The technical-tier section below carries the per-page
                breakdown. This is the binding evidence for the
                architectural ceiling -- not a hypothetical.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-slate-400 mt-0.5">-</span>
              <span>
                <strong>Canary 2 re-run INCONCLUSIVE.</strong> The
                second engine v2 canary on a small (~5KB)
                figure-heavy submission failed initially; the C1 +
                C2 + C3 fix lane was applied; the re-run was
                INCONCLUSIVE because the submission had no body
                content to retrieve. The result is recorded in the
                v2 canary log as INCONCLUSIVE, not as a pass.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-slate-400 mt-0.5">-</span>
              <span>
                <strong>KB cost 4-5x understatement.</strong> Surfaced
                in the A-1 amendment box above and again in the
                technical tier. The v1 proposal&apos;s
                $50-100 / 10-20h figure was wrong by a factor of
                ~4-5x. The honest figure ($200-600 / 80-150h) is what
                goes to the owner under G4.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-slate-400 mt-0.5">-</span>
              <span>
                <strong>The{' '}
                <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded">
                  supersedes
                </code>{' '}
                edge near-miss.</strong> The original proposal&apos;s M3
                edge ontology included a{' '}
                <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded">
                  supersedes
                </code>{' '}
                edge type. The holistic review identified it as an AI
                regulatory determination in disguise. Amendment A-5
                dropped it. Had the review not caught this, v2 would
                have encoded an irreversible AI tier-judgment into the
                persistent graph.
              </span>
            </li>
          </ul>
        </div>
      </ExpandableSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tier 3: Technical (violet)
// ---------------------------------------------------------------------------

function TransitionTechnical() {
  return (
    <div className="space-y-4">
      <TierHeader tier="technical" title="Transition -- Technical Detail" />

      <ExpandableSection
        title="M-4 authority-coefficient formula deviation (diagram)"
        defaultOpen
        badge={TIER_LABELS.technical}
        badgeColor={TIER_BADGE_COLORS.technical}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <MermaidDiagram
            chart={M4_FORMULA_DIAGRAM}
            ariaLabel="M-4 architecture lock authority-coefficient formula deviation. Original proposal v2 Section 3.6 formula boosted = base_score times (1 + authority_level divided by 5 times (coefficient - 1)) INVERTS the Pyramid of Compliance: Acts at level 0 get only 1.0x boost while CSAP at level 5 gets 2.0x. M-4 commit 0d9e1dcb (with 33 anti-drift tests in test_anti_drift_retrieval.py) implements the corrected formula boosted = base_score times (1 + authority_value times (coefficient - 1)) using the Pyramid authority values directly (Acts 1.00, Regs 0.90, Protocols 0.80, Tech Guidance 0.70, CSAP 0.60, External 0.35). The corrected formula HONORS the Pyramid: Acts get the most boost (2.0x at coefficient max), External gets the least (1.35x)."
          />
          <p className="text-xs italic">
            Formula deviation captured in Appendix D Section D.3.1. The
            proposal v2 Section 3.6 text was CORRECTED on 2026-05-16
            (verified live by codex; both the proposal memory anchor and
            the M-4 implementation now use `authority_value` and align
            with the Pyramid); see Appendix D Section D.3.4 for the
            audit trail. The historical (inverted) formula is preserved
            in the diagram + appendix purely as a record of what almost
            shipped. Anti-drift tests are at{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
              engine_v2/tests/test_anti_drift_retrieval.py
            </code>
            {' '}(33 tests, all pinning the M-4 actual formula).
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="The 8-chars-per-page incident (AEE RP pages 4-7)"
        badge={TIER_LABELS.technical}
        badgeColor={TIER_BADGE_COLORS.technical}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            The architecturally-binding empirical demonstration of the
            v1 -&gt; v2 transition surfaced on <strong>2026-05-16</strong>{' '}
            during engine v2 multi-modal extraction work. The AEE
            Remediation Plan canary submission -- a 1.6 MB PDF over 7
            pages -- was processed through the Docling 2.77 extraction
            adapter that v1 and v2 share. The total submission text
            extracted was <strong>5,250 characters</strong>. Per-page
            distribution:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded-lg font-mono">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="text-left px-3 py-2">Page</th>
                  <th className="text-left px-3 py-2">Chars</th>
                  <th className="text-left px-3 py-2">Content</th>
                </tr>
              </thead>
              <tbody className="text-slate-600 dark:text-slate-400">
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2">1</td>
                  <td className="px-3 py-2">1,670</td>
                  <td className="px-3 py-2">Cover + intro</td>
                </tr>
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2">2</td>
                  <td className="px-3 py-2">2,377</td>
                  <td className="px-3 py-2">
                    Legal parcels, background, body
                  </td>
                </tr>
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2">3</td>
                  <td className="px-3 py-2">1,065</td>
                  <td className="px-3 py-2">More body</td>
                </tr>
                <tr className="border-t border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-900/10">
                  <td className="px-3 py-2 font-semibold">4</td>
                  <td className="px-3 py-2 font-semibold">8</td>
                  <td className="px-3 py-2">
                    Site Plan (literal &quot;[Figure]&quot; placeholder)
                  </td>
                </tr>
                <tr className="border-t border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-900/10">
                  <td className="px-3 py-2 font-semibold">5</td>
                  <td className="px-3 py-2 font-semibold">8</td>
                  <td className="px-3 py-2">Cross-Section A-A&apos;</td>
                </tr>
                <tr className="border-t border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-900/10">
                  <td className="px-3 py-2 font-semibold">6</td>
                  <td className="px-3 py-2 font-semibold">8</td>
                  <td className="px-3 py-2">Cross-Section B-B&apos;</td>
                </tr>
                <tr className="border-t border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-900/10">
                  <td className="px-3 py-2 font-semibold">7</td>
                  <td className="px-3 py-2 font-semibold">8</td>
                  <td className="px-3 py-2">
                    Cross-Section C-C&apos; / Soil Analytical Results
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            <strong>Per-page density gap:</strong> pages 1-3 averaged
            ~1,704 chars; pages 4-7 averaged 8 chars. That is a{' '}
            <strong>~213x density gap per page</strong> (body Part V
            Section 19.1). Pages 4-7 are the load-bearing pages for a
            toxicologist&apos;s CSR review: site plan, cross-sections,
            soil analytical results table.
          </p>
          <p>
            <strong>Root cause:</strong> Docling 2.77 defaults map every{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded">
              PictureItem
            </code>{' '}
            to the literal token{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded">
              [Figure]
            </code>{' '}
            when{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded">
              do_picture_description=False
            </code>{' '}
            and{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded">
              force_full_page_ocr=False
            </code>
            . Adapter loss at{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded">
              docling_to_schema.py:201-204
            </code>{' '}
            drops{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded">
              PictureItem.annotations
            </code>{' '}
            and caption refs.
          </p>
          <p>
            <strong>M1 remediation:</strong> enable VLM picture
            description + force full-page OCR + read{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded">
              PictureItem.annotations
            </code>{' '}
            + resolve caption refs. Estimated expansion of submission
            text on this PDF: <strong>~5 KB -&gt; ~25 KB</strong>.
            Full survey at memory anchor{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded break-all">
              engine_v2_docling_multimodal_gap_survey_2026_05_16.md
            </code>
            . The incident is binding because it is empirical: real
            submission, real adapter run, real char counts, real
            load-bearing content invisible to v1. Not a hypothetical
            about what BM25 cannot do.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-500 italic">
            Cross-reference to v1 baseline measurements at Appendix B
            Section B.0.1: S1 deterministic-harvest DET/policy mean
            1,487; S1 keyword-driven share 94%; S1 noise rate 60.1%;
            wall-time 1,300-1,400s typical / &lt;=2,000s target. The
            tuning ceilings 22.6% (keywords-only) and ~3%
            (embeddings-only at the 0.8 threshold) are measured from
            this baseline. The architectural ceiling described above is
            a different ceiling and on a different axis.
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="KB cost re-baseline (4-5x understatement)"
        defaultOpen
        badge={TIER_LABELS.technical}
        badgeColor={TIER_BADGE_COLORS.technical}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            Amendment A-1 (body Part V Section 21.1) re-baselined the
            KB ingestion cost empirically. The v1 proposal&apos;s
            original arithmetic underestimated by approximately{' '}
            <strong>4-5x on every axis</strong>. Side-by-side:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded-lg">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Axis</th>
                  <th className="text-left px-3 py-2 font-semibold">
                    v1 proposal (original)
                  </th>
                  <th className="text-left px-3 py-2 font-semibold">
                    Holistic re-baseline (v2)
                  </th>
                  <th className="text-left px-3 py-2 font-semibold">Factor</th>
                </tr>
              </thead>
              <tbody className="text-slate-600 dark:text-slate-400">
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2">LLM calls</td>
                  <td className="px-3 py-2 font-mono">~18,000</td>
                  <td className="px-3 py-2 font-mono">30,000 - 50,000</td>
                  <td className="px-3 py-2 font-mono">~1.7x - 2.8x</td>
                </tr>
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2">Claude Haiku 3.5 fees</td>
                  <td className="px-3 py-2 font-mono">$50 - $100</td>
                  <td className="px-3 py-2 font-mono">$200 - $600</td>
                  <td className="px-3 py-2 font-mono">~4x - 6x</td>
                </tr>
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2">
                    Ollama qwen2.5:14b wall-clock (local)
                  </td>
                  <td className="px-3 py-2 font-mono">10 - 20 h</td>
                  <td className="px-3 py-2 font-mono">80 - 150 h</td>
                  <td className="px-3 py-2 font-mono">~7.5x - 8x</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            <strong>Where the original understatement came from.</strong>{' '}
            Two factors. First, the original estimate assumed one LLM
            call per chunk; LightRAG performs <strong>2 LLM calls per
            chunk</strong> during entity / relation extraction (one for
            entities, one for relations). Second, the original estimate
            did not include the per-community summary calls that the
            graph-building step performs. The holistic re-baseline
            folds both in and produces ranges rather than point
            estimates, because the chunk-token-size override and the
            community-count are both data-dependent.
          </p>
          <p>
            <strong>Why this is load-bearing.</strong> The
            owner-cost-approval gate G4 (body Part V Section 23.4) is
            EXPLICIT, not implicit -- the holistic review&apos;s Q6
            disposition placed cost approval outside the 2026-05-16
            authorization umbrella. The number going to the owner under
            G4 must be empirically grounded, not arithmetic-estimated.
            That is why amendment A-1 mandates a sub-sample test
            (ingest 100 representative policies, measure, extrapolate
            to 5,860 active rows) BEFORE M3 KB build can proceed. G1
            is the test; G4 consumes its output.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-500 italic">
            Cross-reference: memory anchor{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded break-all">
              engine_v2_lightrag_architecture_holistic_review_2026_05_16.md
            </code>{' '}
            Section 4.1. The understatement is surfaced explicitly in
            body Part V Section 21.1, NOT buried in an appendix.
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="M-4 formula deviation from proposal v2 Section 3.6"
        badge={TIER_LABELS.technical}
        badgeColor={TIER_BADGE_COLORS.technical}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            The M-4 v74.1+ architecture lock (file{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded break-all">
              engine_v2/src/rraa_v2/architecture_lock_retrieval.py
            </code>
            , engine-v2 worktree master tip{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded">
              0d9e1dcb
            </code>
            ) lands amendment A-3&apos;s authority-level injection. The
            formula in the implementation deliberately deviates from
            the formula in proposal v2 Section 3.6. The deviation is
            captured in the M-4 commit body and should be propagated
            back into the proposal text in a follow-up docs commit.
          </p>
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-3 font-mono text-xs">
            <div>
              <div className="text-slate-500 mb-1">
                Proposal v2 Section 3.6 (INVERTS the Pyramid):
              </div>
              <div className="text-slate-700 dark:text-slate-300">
                boosted = base_score * (1.0 + (authority_level / 5) * (coefficient - 1.0))
              </div>
            </div>
            <div>
              <div className="text-slate-500 mb-1">
                M-4 implementation (honors the Pyramid):
              </div>
              <div className="text-slate-700 dark:text-slate-300">
                boosted = base_score * (1.0 + authority_value * (coefficient - 1.0))
              </div>
            </div>
          </div>
          <p>
            The proposal formula uses{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded">
              authority_level / 5
            </code>{' '}
            where{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded">
              authority_level
            </code>{' '}
            is the integer level 0-5 from the Pyramid (Acts = 0, ...,
            CSAP = 5). That formulation gives <strong>Acts the LEAST
            boost</strong> and <strong>CSAP the MOST</strong> -- the
            inverse of the intended semantic. The M-4 implementation
            uses{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded">
              authority_value
            </code>{' '}
            directly from the Pyramid of Compliance table (Acts = 1.0,
            Regs = 0.9, Protocols = 0.8, Tech Guidance = 0.7, CSAP =
            0.6, External = 0.35) so the boost magnitude follows the
            intended ordering.
          </p>
          <p>
            <strong>Worked example at coefficient = 2.0</strong>{' '}
            (maximum allowed by the bound{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded">
              [1.0, 2.0]
            </code>
            ; coefficient = 1.0 is baseline identity):
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded-lg">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Level</th>
                  <th className="text-left px-3 py-2 font-semibold">
                    authority_value
                  </th>
                  <th className="text-left px-3 py-2 font-semibold">
                    M-4 multiplier
                  </th>
                  <th className="text-left px-3 py-2 font-semibold">
                    Proposal-v2 multiplier
                  </th>
                </tr>
              </thead>
              <tbody className="text-slate-600 dark:text-slate-400 font-mono">
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2">Acts (L0)</td>
                  <td className="px-3 py-2">1.00</td>
                  <td className="px-3 py-2 text-emerald-600 dark:text-emerald-400">
                    2.00x
                  </td>
                  <td className="px-3 py-2 text-rose-600 dark:text-rose-400">
                    1.00x
                  </td>
                </tr>
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2">Regulations (L1)</td>
                  <td className="px-3 py-2">0.90</td>
                  <td className="px-3 py-2">1.90x</td>
                  <td className="px-3 py-2">1.20x</td>
                </tr>
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2">Protocols (L2)</td>
                  <td className="px-3 py-2">0.80</td>
                  <td className="px-3 py-2">1.80x</td>
                  <td className="px-3 py-2">1.40x</td>
                </tr>
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2">Tech Guidance (L3)</td>
                  <td className="px-3 py-2">0.70</td>
                  <td className="px-3 py-2">1.70x</td>
                  <td className="px-3 py-2">1.60x</td>
                </tr>
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2">External (L4)</td>
                  <td className="px-3 py-2">0.35</td>
                  <td className="px-3 py-2">1.35x</td>
                  <td className="px-3 py-2">1.80x</td>
                </tr>
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2">CSAP (L5)</td>
                  <td className="px-3 py-2">0.60</td>
                  <td className="px-3 py-2 text-emerald-600 dark:text-emerald-400">
                    1.60x
                  </td>
                  <td className="px-3 py-2 text-rose-600 dark:text-rose-400">
                    2.00x
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-500 italic">
            Note on External (L4) vs CSAP (L5): the Pyramid ordering
            and the numeric authority_value are on two different axes
            (see CLAUDE.md note). Hierarchy ordering: Acts &gt; Regs
            &gt; Protocols &gt; Tech Guidance &gt; External &gt; CSAP.
            Numeric values were calibrated separately for retrieval
            ranking and reflect citation-frequency / regulatory-relevance
            characteristics. Both axes preserved; values pinned in
            architecture_lock_retrieval.py with anti-drift test
            test_authority_value_by_level_pinned.
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="Ontology gate (Amendment A-8) -- SATISFIED 2026-05-17"
        badge={TIER_LABELS.technical}
        badgeColor={TIER_BADGE_COLORS.technical}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            Amendment A-8 (body Part V Section 21.8) was the
            non-negotiable blocking gate that prevented M2
            entity-extraction code from running before the HITL
            (registered toxicologist) signed off the LLM-extraction
            entity ontology. The owner signed off on 2026-05-17 at
            engine-v2 worktree commit{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded">
              05fd767b
            </code>
            , advancing the ontology to v1.0.0 /
            HITL_SIGNED_OFF_V1_0_0. M2 entity-extraction code is now
            UNBLOCKED. The block protected against encoding an
            unreviewed entity type into a persistent graph -- exactly
            the kind of irreversible AI-encoded determination that
            amendment A-5 (drop{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded">
              supersedes
            </code>
            ) was authored to prevent. With v1.0.0 signed off, the
            ontology IS now HITL-approved.
          </p>
          <p>
            <strong>Current state</strong> (verbatim from the JSON
            header of{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded break-all">
              engine_v2/data/lightrag_entity_ontology_v1.json
            </code>
            ):
          </p>
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg p-3 font-mono text-xs space-y-1">
            <div className="text-slate-600 dark:text-slate-400">
              <span className="text-slate-500">ontology_version:</span>{' '}
              <span className="text-emerald-600 dark:text-emerald-300">
                v1.0.0
              </span>
            </div>
            <div className="text-slate-600 dark:text-slate-400">
              <span className="text-slate-500">lifecycle_state:</span>{' '}
              <span className="text-emerald-600 dark:text-emerald-300">
                HITL_SIGNED_OFF_V1_0_0
              </span>
            </div>
            <div className="text-slate-600 dark:text-slate-400">
              <span className="text-slate-500">signoff_record.signed_off_by:</span>{' '}
              <span className="text-slate-700 dark:text-slate-300">
                Jasen Nelson (registered BC toxicologist)
              </span>
            </div>
            <div className="text-slate-600 dark:text-slate-400">
              <span className="text-slate-500">signoff_record.signed_off_on:</span>{' '}
              <span className="text-slate-700 dark:text-slate-300">
                2026-05-17
              </span>
            </div>
            <div className="text-slate-600 dark:text-slate-400">
              <span className="text-slate-500">signoff_record.signoff_commit:</span>{' '}
              <span className="text-slate-700 dark:text-slate-300">
                05fd767b
              </span>
            </div>
          </div>
          <p>
            The body text uses these enums verbatim. The advancement to
            v1.0.0 / HITL_SIGNED_OFF_V1_0_0 is the lifecycle_state
            transition required for M2 unblock per Amendment A-8.
            Pre-signoff v0.42-strawman is preserved at{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded break-all">
              engine_v2/data/archive/lightrag_entity_ontology_v0_42_pre_signoff.json
            </code>
            .
          </p>
          <p>
            <strong>Three iteration arcs got the ontology to v1.0.0.</strong>
          </p>
          <ul className="space-y-1.5 ml-1 text-xs">
            <li className="flex items-start gap-1.5">
              <span className="text-violet-500 mt-0.5">-</span>
              <span>
                <strong>Arc 1: v0.10 -&gt; v0.40</strong> (pre-HOLISTIC #5).
                Closed through codex CLI targeted reviews and reached
                the state recorded in the predecessor handoff{' '}
                <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded break-all">
                  engine_v2_ontology_v0_40_handoff_2026_05_16_eod_v2.md
                </code>
                . (The FIX-28 framing that appears in some prose
                summaries is a prose-summary artifact; FIX-28
                occurrences are zero in the v0.42 JSON changelog.
                Body prose cites ACTIVE_DOCS.md line 53 verbatim rather
                than restating it.)
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-violet-500 mt-0.5">-</span>
              <span>
                <strong>Arc 2: v0.40 -&gt; v0.42</strong> (HOLISTIC #5
                closure). Folded in R-HOLISTIC-FIX-29 plus targeted P2
                follow-up wording corrections. The HITL signoff packet
                (PART_A + PART_B + INDEX) was authored as engine-v2
                worktree commits{' '}
                <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded">
                  2a75c385
                </code>{' '}
                +{' '}
                <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded">
                  187a7f10
                </code>{' '}
                +{' '}
                <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded">
                  00cc9fee
                </code>
                .
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-emerald-500 mt-0.5">-</span>
              <span>
                <strong>Arc 3: v0.42 -&gt; v1.0.0</strong> (owner HITL
                signoff, 2026-05-17). The owner reviewed and accepted
                the HITL signoff packet (Arc 2 commits) and signed off
                at engine-v2 worktree commit{' '}
                <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded">
                  05fd767b
                </code>
                , advancing the ontology to v1.0.0 with lifecycle_state
                HITL_SIGNED_OFF_V1_0_0 and recording{' '}
                <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded">
                  signoff_record
                </code>{' '}
                in the JSON. M2 entity-extraction code is UNBLOCKED per
                Amendment A-8 effective signoff date.
              </span>
            </li>
          </ul>
          <p>
            <strong>Downstream consequence.</strong> Amendment A-6
            (pre-M2 NetworkX spike, 2 days, 1 canary, no prod wiring)
            was gated on ontology signoff. That gate closed on
            2026-05-17, so the pre-M2 spike is AUTHORIZED + READY to
            proceed. M2 entity-extraction code is structurally
            authorized to land. M3 in turn does not start until M2
            closes and the three remaining pre-M3 gates (G1 + G2 + G4)
            close; G3 is closed via M-4. The ontology signoff is no
            longer a separate downstream blocker.
          </p>
        </div>
      </ExpandableSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Source-pointer footer
// ---------------------------------------------------------------------------

function TransitionFooter() {
  return (
    <div className="mt-6 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
      <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
        Full methodology paper
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        The view above is a curated summary. The full peer-reviewer-grade
        treatment of the v1 {'->'} v2 transition lives in the
        Regulatory-Review repository at{' '}
        <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded break-all">
          engine/docs/active/methodology/body/parts_IV_V.md
        </code>{' '}
        (Part IV Section 17 -- architectural-vs-tuning ceiling; Part V
        Sections 18-23 -- the v1 {'->'} v2 decision, the 10 amendments,
        and the four pre-M3 gates). Cross-references: Appendix B
        Sections B.0.1 (v1 baseline measurements) + B.1 (the
        architectural-vs-tuning ceiling); memory anchors{' '}
        <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded break-all">
          engine_v2_lightrag_raganything_architecture_proposal_v2_2026_05_16.md
        </code>
        ,{' '}
        <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded break-all">
          engine_v2_lightrag_architecture_holistic_review_2026_05_16.md
        </code>
        , and{' '}
        <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded break-all">
          engine_v2_docling_multimodal_gap_survey_2026_05_16.md
        </code>
        . Every empirical claim in this view traces to one of those
        sources; the dashboard never overrides them.
      </p>
    </div>
  );
}
