'use client';

// Regulatory Review methodology view.
//
// Scope: this view surfaces the curated dashboard summary of the
// Regulatory Review methodology paper -- engine v1 (legacy operational),
// engine v2 (active development), and the v1 -> v2 transition rationale.
// The full paper lives at Regulatory-Review/engine/docs/active/
// methodology/ in the engine repo; this view is a hand-curated
// summary by scenario + audience tier.
//
// Routes:
//   /regulatory-review/methodology              -> scenario="landing"
//   /regulatory-review/methodology/v1           -> scenario="v1"
//   /regulatory-review/methodology/v2           -> scenario="v2"
//   /regulatory-review/methodology/transition   -> scenario="transition"
//
// Tier pattern mirrors AiAssistedDevelopmentView (Everyone green /
// Practitioner blue / Technical violet) for visual parity across the
// dashboard's curated-methodology surfaces. Unlike Jermilova's
// single-select toggle, multiple tiers can be open simultaneously
// here (per scaffold spec): tier state is a Set<AudienceTier>.
//
// Content placeholders: the scenario-specific content components
// (LandingContent / V1Content / V2Content / TransitionContent) ship
// as stubs in this scaffold task. The next subagent task hand-curates
// the actual summaries pulled from the methodology paper.

import { useState } from 'react';
import Link from 'next/link';
import { LandingContent } from './LandingContent';
import { V1Content } from './V1Content';
import { V2Content } from './V2Content';
import { TransitionContent } from './TransitionContent';
import { cn } from '@/utils/cn';

// ---------------------------------------------------------------------------
// Types + tier styling (mirrors AiAssistedDevelopmentView)
// ---------------------------------------------------------------------------

export type MethodologyScenario = 'landing' | 'v1' | 'v2' | 'transition';

export type AudienceTier = 'everyone' | 'practitioner' | 'technical';

export const TIER_BADGE_COLORS: Record<AudienceTier, string> = {
  everyone:
    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  practitioner:
    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  technical:
    'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
};

export const TIER_LABELS: Record<AudienceTier, string> = {
  everyone: 'For Everyone',
  practitioner: 'For Practitioners',
  technical: 'Technical',
};

export const TIER_ACCENT_COLORS: Record<AudienceTier, string> = {
  everyone: 'bg-green-500',
  practitioner: 'bg-blue-500',
  technical: 'bg-violet-500',
};

interface MethodologyViewProps {
  scenario: MethodologyScenario;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function MethodologyView({ scenario }: MethodologyViewProps) {
  // Multi-select tier state: a Set so multiple tiers can be open at once,
  // matching the scaffold spec. Default: everyone tier open.
  const [activeTiers, setActiveTiers] = useState<Set<AudienceTier>>(
    () => new Set<AudienceTier>(['everyone']),
  );

  function toggleTier(tier: AudienceTier) {
    setActiveTiers((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) {
        next.delete(tier);
      } else {
        next.add(tier);
      }
      return next;
    });
  }

  const scenarioMeta = getScenarioMeta(scenario);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-5">
      <header className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Regulatory Review Methodology
        </p>
        <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">
          {scenarioMeta.title}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {scenarioMeta.subtitle}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-500 italic">
          Audience-tiered dashboard summary. The full methodology paper is
          the source of truth (linked in the footer).
        </p>
      </header>

      {/* Tier selector. Multiple tiers may be active simultaneously --
          click a tier to toggle it on/off. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <TierButton
          tier="everyone"
          title="For Everyone"
          subtitle="Communities and curious readers"
          active={activeTiers.has('everyone')}
          onClick={() => toggleTier('everyone')}
        />
        <TierButton
          tier="practitioner"
          title="For Practitioners"
          subtitle="Managers and regulators"
          active={activeTiers.has('practitioner')}
          onClick={() => toggleTier('practitioner')}
        />
        <TierButton
          tier="technical"
          title="Technical"
          subtitle="Scientists and QPs"
          active={activeTiers.has('technical')}
          onClick={() => toggleTier('technical')}
        />
      </div>

      {/* Scenario content. Each content component receives the active
          tier set and renders only the sections that match. */}
      <div className="space-y-5">
        {scenario === 'landing' && (
          <LandingContent activeTiers={activeTiers} />
        )}
        {scenario === 'v1' && <V1Content activeTiers={activeTiers} />}
        {scenario === 'v2' && <V2Content activeTiers={activeTiers} />}
        {scenario === 'transition' && (
          <TransitionContent activeTiers={activeTiers} />
        )}
      </div>

      <SourcePointerFooter scenario={scenario} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getScenarioMeta(scenario: MethodologyScenario): {
  title: string;
  subtitle: string;
} {
  switch (scenario) {
    case 'landing':
      return {
        title: 'Methodology Overview',
        subtitle:
          'How the Regulatory Review AI Agent (RRAA) finds evidence and ' +
          'helps a human reviewer apply professional judgment. Pick a ' +
          'scenario below to dive deeper.',
      };
    case 'v1':
      return {
        title: 'Engine v1 -- Keyword-heavy 4-stage Shadow-Additive Pipeline',
        subtitle:
          'The original engine. Keyword-driven harvest, fast-AI evidence ' +
          'finder, prioritizer, synthesizer. Legacy operational; ' +
          'retirement path once v2 delivers.',
      };
    case 'v2':
      return {
        title: 'Engine v2 -- Embeddings + Graph Primary',
        subtitle:
          'Active development. Multi-modal Docling extraction, ' +
          'embeddings + graph retrieval, LightRAG / RAG-Anything substrate. ' +
          'Goal-aligned for thousands of massive multi-modal documents.',
      };
    case 'transition':
      return {
        title: 'v1 -> v2 Transition',
        subtitle:
          'Why v1 is being retired, why v2 was authorized, and how the ' +
          'transition is staged. v1 stays operational until v2 delivers.',
      };
  }
}

function TierButton({
  tier,
  title,
  subtitle,
  active,
  onClick,
}: {
  tier: AudienceTier;
  title: string;
  subtitle: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-testid={`methodology-tier-${tier}`}
      className={cn(
        'text-left rounded-lg border-2 p-4 transition-all',
        active
          ? cn(
              'shadow-md',
              tier === 'everyone' &&
                'border-green-500 dark:border-green-400 bg-green-50 dark:bg-green-900/20',
              tier === 'practitioner' &&
                'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20',
              tier === 'technical' &&
                'border-violet-500 dark:border-violet-400 bg-violet-50 dark:bg-violet-900/20',
            )
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm',
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className={cn(
            'w-2.5 h-2.5 rounded-full',
            TIER_ACCENT_COLORS[tier],
          )}
        />
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {title}
        </span>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
    </button>
  );
}

export function TierHeader({
  tier,
  title,
}: {
  tier: AudienceTier;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'w-1.5 h-6 rounded-full',
          TIER_ACCENT_COLORS[tier],
        )}
      />
      <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
        {title}
      </h3>
    </div>
  );
}

function SourcePointerFooter({ scenario }: { scenario: MethodologyScenario }) {
  const pathHint = (() => {
    switch (scenario) {
      case 'v1':
        return 'engine/docs/active/methodology/body/parts_I_II_III.md + parts_IV_V.md';
      case 'v2':
        return 'engine/docs/active/methodology/body/part_VI.md';
      case 'transition':
        return 'engine/docs/active/methodology/body/parts_IV_V.md (Part V)';
      case 'landing':
      default:
        return 'engine/docs/active/methodology/PLAN.md + appendices/*.md + body/*.md';
    }
  })();

  return (
    <footer className="mt-8 pt-4 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-500 space-y-2">
      <p>
        The dashboard view above is a curated summary.{' '}
        <Link
          href="/regulatory-review/methodology/paper"
          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 underline"
        >
          Read the full paper inline
        </Link>
        . Source files in the engine repository:
      </p>
      <code className="block text-[11px] bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
        Regulatory-Review/{pathHint}
      </code>
      <p className="italic">
        Nothing in this view supersedes the source paper.
      </p>
    </footer>
  );
}
