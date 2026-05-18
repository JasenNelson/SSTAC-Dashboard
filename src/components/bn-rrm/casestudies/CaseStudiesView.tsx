'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/utils/cn';
import { usePackStore } from '@/stores/bn-rrm/packStore';
import { TrainingSites } from './TrainingSites';
import { ExternalSites } from './ExternalSites';
import { MethodComparison } from './MethodComparison';
import { PublishedComparison } from './PublishedComparison';
import { HowItWorksView } from './HowItWorksView';
import { AiAssistedDevelopmentView, type AudienceTier } from './AiAssistedDevelopmentView';

type CaseStudySection =
  | 'training'
  | 'external'
  | 'methods'
  | 'benchmark'
  | 'how-it-works'
  | 'ai-assisted';

interface SectionDef {
  id: CaseStudySection;
  label: string;
  description: string;
}

const baseSections: SectionDef[] = [
  { id: 'training', label: 'Training Sites', description: 'BN-RRM vs WOE for 8 training sites' },
  { id: 'external', label: 'External Sites', description: 'Non-training site comparisons' },
  { id: 'methods', label: 'Method Comparison', description: 'BN-RRM vs WOE, SQT, SQG approaches' },
];

const howItWorksSection: SectionDef = {
  id: 'how-it-works',
  label: 'How It Works',
  description: 'Understand the Mackenzie Mercury model',
};

const benchmarkSection: SectionDef = {
  id: 'benchmark',
  label: 'Published Benchmark',
  description: 'Comparison with Jermilova et al. 2025',
};

const aiAssistedSection: SectionDef = {
  id: 'ai-assisted',
  label: 'AI-assisted BN-RRM development',
  description: 'How the Jermilova model was reconstructed in Python',
};

// The AI-assisted-development view's content is specific to the Jermilova
// reconstruction (Mackenzie Mercury BN; uses Jermilova-specific kappa
// numbers, comparison-protocol dimensions, methodology-paper source path).
// Restrict the tab to that exact pack so a hypothetical future
// scope_type=benchmark pack does not inherit Jermilova-specific content.
// Codex holistic 2026-05-17 P3.
const JERMILOVA_PACK_ID = 'bnrrm-casestudy-jermilova2025-mackenzie-hg';

export function CaseStudiesView() {
  const packManifest = usePackStore((s) => s.packManifest);
  const isBenchmark = packManifest?.scope_type === 'benchmark';
  const isJermilova = packManifest?.pack_id === JERMILOVA_PACK_ID;

  // Build section list. Benchmark packs show how-it-works + published
  // benchmark; only the Jermilova pack additionally surfaces the
  // AI-assisted-development tab (its content is Jermilova-specific).
  // Training Sites / External Sites / Method Comparison are
  // sediment-model-specific (general / site-specific packs).
  const sections: SectionDef[] = useMemo(() => {
    if (isBenchmark) {
      return isJermilova
        ? [howItWorksSection, benchmarkSection, aiAssistedSection]
        : [howItWorksSection, benchmarkSection];
    }
    return baseSections;
  }, [isBenchmark, isJermilova]);

  // For benchmark packs, default to the how-it-works section
  const [activeSection, setActiveSection] = useState<CaseStudySection>(
    isBenchmark ? 'how-it-works' : 'training'
  );

  // AI-assisted tier state lives here so the render branch can switch
  // between the narrow cap (tiers 1-3) and the full-width shell (tier 4
  // TWG Review). AiAssistedDevelopmentView accepts these as controlled
  // props; if neither is provided, it falls back to internal state for
  // legacy / test usage. Reset to 'everyone' whenever activeSection
  // flips off 'ai-assisted' so a stale TWG-Review selection cannot
  // strand a future re-entry on the wrong tier (a tiny UX nicety that
  // also keeps the render-branch invariant clean).
  const [activeTier, setActiveTier] = useState<AudienceTier>('everyone');

  // Reset activeSection when the pack changes so a section selected under
  // one pack does not "stick" onto another pack. Codex holistic 2026-05-17
  // P2: without this guard, switching from the Jermilova benchmark pack
  // (with 'ai-assisted' active) to a general/site pack would leave
  // activeSection='ai-assisted' and the render branch -- still
  // unconditional -- would show Jermilova-specific content over the
  // wrong pack. Inverse case (selecting a section that exists under both
  // pack types) is also handled by snapping back to the first available
  // section for that pack family. We compute the valid default per pack
  // family, then promote only if the current activeSection is no longer
  // valid for the new sections array.
  useEffect(() => {
    const sectionIds = sections.map((s) => s.id);
    if (!sectionIds.includes(activeSection)) {
      setActiveSection(sections[0]?.id ?? (isBenchmark ? 'how-it-works' : 'training'));
    }
  }, [sections, activeSection, isBenchmark]);

  // Reset the AI-assisted tier when activeSection leaves 'ai-assisted'.
  // Keeps the tier-aware render branch's invariant clean (a stale
  // activeTier='twg-review' carried into a section change cannot affect
  // the other section render paths, but tidying it here avoids surprises
  // if a future caller reads activeTier across section boundaries).
  useEffect(() => {
    if (activeSection !== 'ai-assisted' && activeTier !== 'everyone') {
      setActiveTier('everyone');
    }
  }, [activeSection, activeTier]);

  return (
    // print:overflow-visible cascade so window.print() from the embedded
    // TWG Review tier captures the full methodology body (MDN: ancestor
    // overflow:hidden clips at its padding box; descendant
    // print:overflow-visible cannot override it). Codex R3 P1-2.
    <div className="flex-1 flex overflow-hidden print:block print:overflow-visible print:h-auto">
      {/* Sidebar. print:hidden -- the section nav isn't part of the
          document content. */}
      <div className="w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 p-4 shrink-0 print:hidden">
        <div className="mb-5">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Case Studies</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Descriptive comparison with report-stated risk assessments
          </p>
        </div>
        <nav className="space-y-1">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={cn(
                'w-full flex flex-col px-3 py-2.5 rounded-lg text-left transition-colors',
                activeSection === section.id
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
              )}
            >
              <span className="text-sm font-medium">{section.label}</span>
              <span className="text-xs opacity-70 mt-0.5">{section.description}</span>
            </button>
          ))}
        </nav>

        {/* Boundary note */}
        <div className="mt-6 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Comparison Scope</div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Report-stated classifications are external reference labels,
            not BN training targets or ground truth.
          </p>
        </div>
      </div>

      {/* Content area. The ai-assisted section is special: its TWG Review
          tier renders a 3-column workspace (TOC + methodology MD +
          per-section comments) that needs the full available width.
          Splitting the render branch by section lets the ai-assisted
          path use a flex column WITHOUT the max-w-4xl cap, while all
          other sections retain the narrow reading cap that suits their
          curated card content. AiAssistedDevelopmentView itself
          re-imposes the narrow cap on tiers 1-3 + the tier-selector row
          so only the TWG tier escapes the cap. Each render branch is
          additionally guarded so a stale activeSection (from a brief
          moment between pack switch + useEffect reset) cannot render a
          section type for the wrong pack family. Codex holistic
          2026-05-17 P2. */}
      {activeSection === 'ai-assisted' && isJermilova ? (
        <div className="flex-1 overflow-hidden flex flex-col p-6 print:overflow-visible print:h-auto print:p-0">
          <AiAssistedDevelopmentView
            activeTier={activeTier}
            onTierChange={setActiveTier}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto">
            {activeSection === 'how-it-works' && isBenchmark && <HowItWorksView />}
            {activeSection === 'benchmark' && isBenchmark && <PublishedComparison />}
            {activeSection === 'training' && !isBenchmark && <TrainingSites />}
            {activeSection === 'external' && !isBenchmark && <ExternalSites />}
            {activeSection === 'methods' && !isBenchmark && <MethodComparison />}
          </div>
        </div>
      )}
    </div>
  );
}
