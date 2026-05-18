'use client';

// Methodology landing-page content.
//
// Shows three scenario-selector cards (v1 / v2 / transition) plus a
// brief overview of what the methodology paper covers. The tier-
// scoped sections below the cards are placeholders -- the next
// subagent task fills them with hand-curated copy from the paper.

import Link from 'next/link';
import { ExpandableSection } from '@/components/bn-rrm/shared/ExpandableSection';
import {
  TierHeader,
  TIER_BADGE_COLORS,
  TIER_LABELS,
  type AudienceTier,
} from './MethodologyView';

interface LandingContentProps {
  activeTiers: Set<AudienceTier>;
}

interface ScenarioCard {
  href: string;
  title: string;
  subtitle: string;
  accent: string;
}

const SCENARIO_CARDS: ScenarioCard[] = [
  {
    href: '/regulatory-review/methodology/v1',
    title: 'Engine v1 deep-dive',
    subtitle:
      'Keyword-heavy 4-stage shadow-additive pipeline (legacy operational).',
    accent:
      'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700',
  },
  {
    href: '/regulatory-review/methodology/v2',
    title: 'Engine v2 deep-dive',
    subtitle:
      'Embeddings + graph primary; multi-modal Docling; LightRAG substrate (active development).',
    accent:
      'border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700',
  },
  {
    href: '/regulatory-review/methodology/transition',
    title: 'v1 -> v2 transition rationale',
    subtitle:
      'What v1 taught us, why v2 was authorized, and how retirement is staged.',
    accent:
      'border-slate-200 dark:border-slate-700 hover:border-amber-300 dark:hover:border-amber-700',
  },
];

export function LandingContent({ activeTiers }: LandingContentProps) {
  return (
    <div className="space-y-5">
      {/* "Read the full paper" bridge -- always visible, independent of tier.
          Routes to the inline markdown viewer at /paper. */}
      <Link
        href="/regulatory-review/methodology/paper"
        className="block bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 transition-colors"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-0.5">
              Read the full paper
            </h3>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              The full 67k-word methodology paper rendered inline -- PLAN +
              Parts I-IX + Appendices A/B/C/D/G.
            </p>
          </div>
          <span className="text-xs text-blue-700 dark:text-blue-300 shrink-0">
            -&gt;
          </span>
        </div>
      </Link>

      {/* Scenario selector cards -- always visible, independent of tier */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {SCENARIO_CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className={`block bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-5 border-2 transition-all hover:shadow-md ${card.accent}`}
          >
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-1">
              {card.title}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {card.subtitle}
            </p>
          </Link>
        ))}
      </div>

      {/* Tier-scoped sections (placeholder copy; next subagent fills) */}
      {activeTiers.has('everyone') && <EveryonePlaceholder />}
      {activeTiers.has('practitioner') && <PractitionerPlaceholder />}
      {activeTiers.has('technical') && <TechnicalPlaceholder />}

      {activeTiers.size === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400 italic">
            Select an audience tier above to see the curated summary at that
            depth.
          </p>
        </div>
      )}
    </div>
  );
}

function EveryonePlaceholder() {
  return (
    <div className="space-y-4">
      <TierHeader tier="everyone" title="What This System Does" />
      <ExpandableSection
        title="The Regulatory Review AI Agent in one paragraph"
        defaultOpen
        badge={TIER_LABELS.everyone}
        badgeColor={TIER_BADGE_COLORS.everyone}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            The Regulatory Review AI Agent (RRAA) helps a Human-In-The-Loop
            (HITL) reviewer assess whether a regulatory submission addresses
            the policies that apply to a contaminated-sites file. It is an
            evidence-finding assistant -- it surfaces relevant policies with
            verbatim citations and helps the reviewer synthesize. It does
            NOT judge adequacy, sufficiency, or compliance; those are HITL
            professional judgments.
          </p>
          <p>
            The knowledge base behind the system contains 5,968 policies
            (5,860 active) drawn from the BC Pyramid of Compliance: Acts,
            Regulations, Protocols, Technical Guidance, External Guidance,
            and CSAP guidelines.
          </p>
          <p>
            Three scenarios cover the methodology. Pick the one that
            interests you above: <strong>v1</strong> (the keyword-heavy
            pipeline operational today), <strong>v2</strong> (the
            embeddings + knowledge-graph rebuild, currently in active
            development), or <strong>the v1 {'->'} v2 transition</strong>
            {' '}(why a rebuild was authorized in May 2026).
          </p>
        </div>
      </ExpandableSection>
    </div>
  );
}

function PractitionerPlaceholder() {
  return (
    <div className="space-y-4">
      <TierHeader
        tier="practitioner"
        title="What This Means for Reviewers"
      />
      <ExpandableSection
        title="HITL workflow + AI scope discipline"
        defaultOpen
        badge={TIER_LABELS.practitioner}
        badgeColor={TIER_BADGE_COLORS.practitioner}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            The HITL workflow centers on a three-tier discretion model:
            TIER_1_BINARY (must / shall / required), TIER_2_PROFESSIONAL
            (should / sufficient / appropriate), and TIER_3_STATUTORY (may /
            Director / discretion). The verdict-by-tier matrix is enforced
            at the database write path as a HITL-protection mechanism; it
            constrains what verdicts the HITL can save against each tier
            class. It is not an AI behavior rule -- the AI never assigns
            tiers and never writes verdicts.
          </p>
          <p>
            Two engines run side-by-side during the v2 development period.
            Engine v1 is the legacy operational path: a 4-stage shadow-
            additive pipeline (S1 deterministic harvest, S2 fast-AI
            evidence finder + S2.5 boundary pre-rank, S3 prioritizer, S4
            synthesizer). It is keyword-anchored and hit measured tuning
            ceilings of 22.6% (keywords) and ~3% (embeddings). Engine v2
            is the rebuild on a LightRAG / RAG-Anything substrate with
            embeddings + graph as primary retrieval and Docling-based
            multi-modal extraction. v2 has landed M1 (multi-modal
            extraction) and M-4 (architecture lock); the entity ontology
            was signed off by the owner on 2026-05-17 (advancing to
            v1.0.0 / HITL_SIGNED_OFF_V1_0_0), so M2 (retrieval shim) is
            now READY and M3 (persistent KB) remains in plan and blocked
            on M2 completion plus three remaining pre-M3 gates (G3
            authority injection is DONE via M-4).
          </p>
          <p>
            Open each scenario above for full procedural detail.
          </p>
        </div>
      </ExpandableSection>
    </div>
  );
}

function TechnicalPlaceholder() {
  return (
    <div className="space-y-4">
      <TierHeader tier="technical" title="Architecture Overview" />
      <ExpandableSection
        title="Two engines, two architecture locks, one knowledge base"
        defaultOpen
        badge={TIER_LABELS.technical}
        badgeColor={TIER_BADGE_COLORS.technical}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            The shared knowledge base lives at{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
              engine/data/rraa_v3_2.db
            </code>
            {' '}(220 MB SQLite; both engines read it directly). Schema
            loads in two parts:{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
              engine/db/schema_v2.sql
            </code>
            {' '}then{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
              engine/db/schema_v3_2_extensions.sql
            </code>
            .
          </p>
          <p>
            Two architecture locks coexist. The v74.0 lock at{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
              engine/scripts/core/ai_semantic_matcher.py
            </code>
            {' '}guards the v1 fusion stage (permanently rejects the{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
              low_threshold
            </code>
            {' '}parameter at runtime). The v74.1+ M-4 lock at{' '}
            <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
              engine_v2/src/rraa_v2/architecture_lock_retrieval.py
            </code>
            {' '}guards the v2 retrieval surface (query-mode allowlist,
            rerank gate, authority-coefficient bounds [1.0, 2.0]); covered
            by 33 anti-drift tests. Both locks fail-loud at runtime; do not
            collapse them.
          </p>
          <p>
            See V1Content (v1 details), V2Content (v2 details), and
            TransitionContent (the v1 {'->'} v2 decision) above.
          </p>
        </div>
      </ExpandableSection>
    </div>
  );
}
