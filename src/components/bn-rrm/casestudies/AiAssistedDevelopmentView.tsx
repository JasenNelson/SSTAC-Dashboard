'use client';

// AI-assisted BN-RRM development view.
//
// Scope: this view documents the AI-assisted DEVELOPMENT METHODOLOGY by
// which the dashboard's Jermilova benchmark pack was reconstructed -- the
// Python toolchain, the HITL / AI / codex review workflow, the validation
// design, and the honest-reporting items the construction process surfaced.
//
// It is rendered as a third section in the Case Studies tab (below
// "How It Works" + "Published Benchmark") ONLY when the Jermilova benchmark
// pack is selected (CaseStudiesView gates by packManifest.scope_type ===
// 'benchmark', which currently identifies the bnrrm-casestudy-jermilova2025-
// mackenzie-hg pack).
//
// Why this is its own view (not a section inside HowItWorksView): HowItWorks
// covers the model itself (DAG, Sources->Stressors->Effects->Impacts, what
// the outputs mean). This view covers the PROCESS by which the model was
// built. Different audience entry points (a regulator reading How It Works
// is asking "what does this model say?"; a peer-reviewer reading this view
// is asking "how was the model built? what AI was used? what divergences
// from the published baseline did the reconstruction introduce?").
//
// Source of truth: every claim here is a curated summary of a section in
// the canonical methodology paper at
// C:\Projects\Regulatory-Review\2026_Database_Development\data_acquisition\
// bnrrm_extraction\bn_learning\external_case_studies\jermilova_2025_mackenzie_hg\
// methodology_paper\JERMILOVA_BNRRM_CONSTRUCTION_METHODOLOGY.md
// (~57k words / 7.4k lines; ASCII-clean per ascii_lint.py). Pointer to that
// file is in the footer; nothing in this view supersedes the source.

import { useEffect, useState } from 'react';
import { ExpandableSection } from '@/components/bn-rrm/shared/ExpandableSection';
import { InfoTooltip } from '@/components/bn-rrm/shared/InfoTooltip';
import JermilovaReviewPortal from '@/components/document-reviews/JermilovaReviewPortal';
import { cn } from '@/utils/cn';

// ---------------------------------------------------------------------------
// Audience tier type + badge colors (mirrors HowItWorksView for consistency)
// ---------------------------------------------------------------------------

type AudienceTier =
  | 'everyone'
  | 'practitioner'
  | 'technical'
  | 'twg-review'
  | null;

const TIER_BADGE_COLORS: Record<string, string> = {
  everyone:
    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  practitioner:
    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  technical:
    'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  'twg-review':
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};

const TIER_LABELS: Record<string, string> = {
  everyone: 'For Everyone',
  practitioner: 'For Practitioners',
  technical: 'Technical',
  'twg-review': 'TWG Review',
};

const TIER_ACCENT_COLORS: Record<string, string> = {
  everyone: 'bg-green-500',
  practitioner: 'bg-blue-500',
  technical: 'bg-violet-500',
  'twg-review': 'bg-amber-500',
};

// ---------------------------------------------------------------------------
// Public entry point: AiAssistedDevelopmentView
// ---------------------------------------------------------------------------

export function AiAssistedDevelopmentView() {
  const [activeTier, setActiveTier] = useState<AudienceTier>('everyone');

  return (
    <div className="space-y-5">
      <header className="space-y-1.5">
        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
          AI-assisted BN-RRM Development
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          A construction record of how the Jermilova et al. 2025 Mackenzie
          mercury BN-RRM was reconstructed in Python and surfaced in this
          dashboard. Audience-tiered: pick the depth that fits your role.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-500 italic">
          The dashboard view below is a curated summary. The full
          peer-reviewer-grade construction record lives in the methodology
          paper (linked in the footer) -- ~57k words across nine Parts and
          six appendices.
        </p>
      </header>

      {/* Tier selector. TWG Review is the 4th tier: it is NOT just a
          reading depth, it is the collaborative-review portal that opens
          the full 57k-word methodology paper with section-by-section
          comments + save/submit (writes to document_reviews per-user RLS).
          See JermilovaReviewPortal for the data flow. */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <TierButton
          tier="everyone"
          title="For Everyone"
          subtitle="Communities and curious readers"
          active={activeTier === 'everyone'}
          onClick={() =>
            setActiveTier(activeTier === 'everyone' ? null : 'everyone')
          }
        />
        <TierButton
          tier="practitioner"
          title="For Practitioners"
          subtitle="Managers and regulators"
          active={activeTier === 'practitioner'}
          onClick={() =>
            setActiveTier(
              activeTier === 'practitioner' ? null : 'practitioner'
            )
          }
        />
        <TierButton
          tier="technical"
          title="Technical"
          subtitle="Scientists and QPs"
          active={activeTier === 'technical'}
          onClick={() =>
            setActiveTier(activeTier === 'technical' ? null : 'technical')
          }
        />
        <TierButton
          tier="twg-review"
          title="TWG Review"
          subtitle="Collaborative section-by-section feedback"
          active={activeTier === 'twg-review'}
          onClick={() =>
            setActiveTier(activeTier === 'twg-review' ? null : 'twg-review')
          }
        />
      </div>

      {activeTier === 'everyone' && <EveryoneContent />}
      {activeTier === 'practitioner' && <PractitionerContent />}
      {activeTier === 'technical' && <TechnicalContent />}
      {activeTier === 'twg-review' && <TwgReviewContent />}

      {/* The source-pointer footer is hidden in the TWG Review tier: that
          tier already shows the full methodology content inline (no need
          to redirect the reader to a separate canonical path). The first
          three tiers are curated summaries and rely on the footer to
          point at the source of truth. */}
      {activeTier !== 'twg-review' && <SourcePointerFooter />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tier 4: TWG Review (collaborative review portal)
// ---------------------------------------------------------------------------
//
// Fetches the methodology MD from /public/bn-rrm/jermilova-methodology.md
// on first render (the file is committed into the dashboard repo as a
// versioned snapshot; see public/bn-rrm/ and the migration commit). Once
// loaded, mounts JermilovaReviewPortal which handles auth, draft state,
// per-key cross-tab merge, save-edit-resubmit, etc.
//
// The standalone route at /bn-rrm/jermilova-review reads the same MD
// server-side. This in-page tier is the primary entry point per the
// owner's UX preference; the standalone route is the deep-link
// alternative.

function TwgReviewContent() {
  const [methodologyContent, setMethodologyContent] = useState<string | null>(
    null,
  );
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch('/bn-rrm/jermilova-methodology.md', {
          cache: 'force-cache',
        });
        if (cancelled) return;
        if (!resp.ok) {
          setFetchError(`HTTP ${resp.status} fetching methodology paper`);
          return;
        }
        const text = await resp.text();
        if (cancelled) return;
        setMethodologyContent(text);
      } catch (err) {
        if (cancelled) return;
        setFetchError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (fetchError) {
    return (
      <div className="p-6 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg space-y-1">
        <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
          Could not load the methodology paper.
        </p>
        <p className="text-xs text-rose-700 dark:text-rose-300">{fetchError}</p>
        <p className="text-xs text-rose-700 dark:text-rose-300">
          The TWG Review tab requires the MD snapshot at{' '}
          <code className="text-[11px] bg-rose-100 dark:bg-rose-900/50 px-1 rounded">
            /bn-rrm/jermilova-methodology.md
          </code>
          . If this is a fresh deploy, confirm the dashboard repo includes
          the public/bn-rrm/jermilova-methodology.md snapshot.
        </p>
      </div>
    );
  }

  if (methodologyContent === null) {
    return (
      <div className="flex items-center gap-3 p-6 text-slate-500 dark:text-slate-400">
        <div className="w-5 h-5 border-2 border-slate-300 dark:border-slate-600 border-t-amber-500 rounded-full animate-spin" />
        <span className="text-sm">Loading methodology paper...</span>
      </div>
    );
  }

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden h-[calc(100vh-20rem)] min-h-[600px]">
      <JermilovaReviewPortal
        methodologyContent={methodologyContent}
        showLeftPanel
        showRightPanel
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tier 1: For Everyone
// ---------------------------------------------------------------------------

function EveryoneContent() {
  return (
    <div className="space-y-4">
      <TierHeader tier="everyone" title="What Does AI-assisted Mean Here?" />

      <ExpandableSection
        title="The Big Picture"
        defaultOpen
        badge={TIER_LABELS.everyone}
        badgeColor={TIER_BADGE_COLORS.everyone}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            The Jermilova BN-RRM you see in the &quot;How It Works&quot; and
            &quot;Published Benchmark&quot; tabs was rebuilt from the public
            data of the original 2025 paper. This rebuild was done with help
            from AI tools, under the direction of a human scientist who made
            every important decision.
          </p>
          <p>
            Three parties were involved:
          </p>
          <ul className="space-y-2 ml-1">
            <li className="flex items-start gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0 w-32">
                The scientist
              </span>
              <span>
                Reads the original paper, decides what to reproduce + what
                to change, accepts or rejects everything the AI suggests, and
                signs off on the final results.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0 w-32">
                The AI helper
              </span>
              <span>
                Reads code + data, drafts Python pipelines, writes the
                construction record, proposes fixes when something looks
                wrong. Never decides alone.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0 w-32">
                A second AI reviewer
              </span>
              <span>
                A different AI (Codex) reads everything the first AI
                produced + pushes back when it spots mistakes. The two AIs
                argue; the scientist arbitrates.
              </span>
            </li>
          </ul>
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mt-2">
            <p className="text-xs text-green-700 dark:text-green-300">
              No model output you see in this dashboard was generated by AI
              choosing on its own. Every number traces back to the original
              public dataset + a scientist-approved Python pipeline.
            </p>
          </div>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="Why Build a Reconstruction At All?"
        badge={TIER_LABELS.everyone}
        badgeColor={TIER_BADGE_COLORS.everyone}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            The 2025 Jermilova paper published its model as Netica
            (.neta) binary files plus a conceptual diagram -- a
            comparison reference rather than something this dashboard
            could consume directly. To use the model in this dashboard
            -- and to compare it with other models in a fair way -- the
            CPTs had to be rebuilt as open, inspectable tables from the
            public FRDR data + the published equations.
          </p>
          <p>
            That rebuild is what the &quot;construction record&quot;
            documents: every choice, every borrowed parameter, every
            place the reconstruction took a small detour from the
            published baseline, and what each detour means for the
            results.
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="What &quot;Honest Reporting&quot; Looks Like Here"
        badge={TIER_LABELS.everyone}
        badgeColor={TIER_BADGE_COLORS.everyone}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            A well-built model record names its own limits as plainly as its
            strengths. A few examples from this reconstruction:
          </p>
          <ul className="space-y-1.5 ml-1 text-xs">
            <li className="flex items-start gap-1.5">
              <span className="text-slate-400 mt-0.5">-</span>
              <span>
                One of the validation tests (predicting fish-mercury
                categories for individual observations held out of
                training) scored at moderate agreement; a companion test
                (predicting water-mercury categories the same way)
                scored zero because most water samples fall in one
                category and the model just learns to guess that
                category. (The validation does NOT test transfer to a
                station or basin -- it is held-out-observation only, per
                the methodology paper&apos;s target-CPT-only LOO design.)
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-slate-400 mt-0.5">-</span>
              <span>
                The reconstruction was supposed to be compared with the
                published model across five different angles. Only one was
                fully done; one was partial; three are open follow-ups.
                The record lists them.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-slate-400 mt-0.5">-</span>
              <span>
                When the human-exposure scenario uses specific assumptions
                (how much fish a person eats per day, what fraction of
                mercury is the toxic form), the record states the numbers
                in plain view rather than burying them in code.
              </span>
            </li>
          </ul>
          <p className="text-xs text-slate-500 dark:text-slate-500 italic">
            The dashboard surfaces these caveats; the full Part V
            (Validation) and Part VII (Comparison) of the methodology paper
            explain each one in depth.
          </p>
        </div>
      </ExpandableSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tier 2: For Practitioners
// ---------------------------------------------------------------------------

function PractitionerContent() {
  return (
    <div className="space-y-4">
      <TierHeader
        tier="practitioner"
        title="How the Pipeline Was Built + Validated"
      />

      <ExpandableSection
        title="End-to-end Pipeline (FRDR Data to Dashboard Pack)"
        defaultOpen
        badge={TIER_LABELS.practitioner}
        badgeColor={TIER_BADGE_COLORS.practitioner}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            The reconstruction follows a seven-milestone pipeline (M1 to M7).
            Each milestone produces specific artifacts that the next stage
            consumes; nothing is hand-edited downstream.
          </p>
          <ol className="space-y-2 list-decimal list-inside ml-1 text-xs">
            <li>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                M1 -- FRDR data acquisition.
              </span>{' '}
              Download the public FRDR dataset (DOI 10.20383/103.0957 v2);
              verify file integrity by SHA-256; count input records vs the
              subset eligible for LOO cross-validation.
            </li>
            <li>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                M2 -- DAG specification + comparison protocol (frozen).
              </span>{' '}
              Specify the 14-node DAG, the FRDR-to-node crosswalk, the
              Table S4-borrowed discretization (e.g. freshwater THg
              low / medium / high at &lt;10 / 10-26 / &gt;26 ng/L,
              anchored on the CCME 26 ng/L criterion; fish-tissue Hg
              cut-points at 0.5 ug/g ww (Health Canada commercial
              guideline) and 0.77 ug/g ww (Dillon 2010 LL.3 EC20) -- a
              single scheme not by species; fish-length cut-points ARE
              species-specific at 450 mm or 600 mm depending on species),
              and FREEZE the comparison protocol against the published
              model. The freeze prevents the reconstruction from later
              shaping the comparison to favor itself.
            </li>
            <li>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                M3 -- Architecture spike.
              </span>{' '}
              Build a minimal end-to-end skeleton (FRDR -&gt; DAG -&gt;
              empty CPT -&gt; inference -&gt; export) to validate the
              pipeline shape before investing in the fitting maths.
            </li>
            <li>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                M4 -- CPT fitting + validation + sensitivity.
              </span>{' '}
              Three fitting strategies depending on node type: empirical
              priors for root nodes; Bayesian Dirichlet equivalent uniform
              (BDeu) counting for the three intermediate stressor nodes;
              deterministic CPTs for the four effect / impact nodes (using
              the published Dillon 2010 dose-response, Health Canada
              commercial-fish guideline, subsistence MeHg formula, US EPA
              child pTWI threshold). LOO cross-validation + mutual-
              information sensitivity analysis run inside this same
              milestone.
            </li>
            <li>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                M5 -- Export + pack assembly.
              </span>{' '}
              Serialize to the generic-bn-rrm-v1 pack schema this dashboard
              consumes; the pack travels from the Regulatory-Review repo to
              the SSTAC dashboard public assets folder.
            </li>
            <li>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                M6 -- Dashboard generalization.
              </span>{' '}
              Generalize the SSTAC dashboard renderer so a single
              generic-bn-rrm-v1 pack can drive multiple model views
              (not just this one).
            </li>
            <li>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                M7 -- PublishedComparison + HowItWorksView.
              </span>{' '}
              Implement the dashboard tabs that surface the comparison-
              protocol results and the model-explanation walkthrough
              (the two siblings of this AI-assisted-development view).
            </li>
          </ol>
          <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
            Every milestone has a fixed input contract, a fixed output
            artifact, and a written acceptance gate; nothing is mutated by
            later stages.
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="Validation Results (What the Numbers Mean)"
        defaultOpen
        badge={TIER_LABELS.practitioner}
        badgeColor={TIER_BADGE_COLORS.practitioner}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            Leave-one-out cross-validation (LOO) measures how well each
            intermediate CPT predicts a held-out observation given the
            others. Reported as Cohen&apos;s kappa (a chance-corrected
            agreement statistic between predicted and observed category).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded-lg">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">
                    Target node
                  </th>
                  <th className="text-left px-3 py-2 font-semibold">
                    GSL kappa (N)
                  </th>
                  <th className="text-left px-3 py-2 font-semibold">
                    GBS kappa (N)
                  </th>
                  <th className="text-left px-3 py-2 font-semibold">
                    Interpretation
                  </th>
                </tr>
              </thead>
              <tbody className="text-slate-600 dark:text-slate-400">
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2 font-mono">fish_tissue_hg</td>
                  <td className="px-3 py-2">0.466 (584)</td>
                  <td className="px-3 py-2">0.489 (258)</td>
                  <td className="px-3 py-2">
                    Moderate agreement -- the model usefully discriminates
                    fish-tissue Hg categories.
                  </td>
                </tr>
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2 font-mono">freshwater_thg</td>
                  <td className="px-3 py-2">0.0 (855)</td>
                  <td className="px-3 py-2">0.0 (1589)</td>
                  <td className="px-3 py-2">
                    Majority-class collapse -- most water samples are in
                    one category and the model just predicts that
                    category. Not a coding bug; a feature of the data
                    distribution. Surfaced explicitly so users do not
                    mistake the freshwater path for a strong predictor.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="Honest Reporting (Open Items)"
        badge={TIER_LABELS.practitioner}
        badgeColor={TIER_BADGE_COLORS.practitioner}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            Items the construction record names as carry-forwards or known
            limitations. Several DO affect model results in the current
            build (per-region inference is the &quot;single biggest
            gap&quot;; soft-edging introduces 5-10% off-target
            probability mass that has not yet been quantified). They are
            surfaced here so peer reviewers can assess them in context
            and so dashboard users do not mistake the current outputs
            for fully-validated production results.
          </p>
          <ul className="space-y-1.5 ml-1 text-xs">
            <li className="flex items-start gap-1.5">
              <span className="text-slate-400 mt-0.5">-</span>
              <span>
                Per-region inference currently uses overall priors rather
                than per-region priors -- a known narrow-scope fix
                documented in Part V.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-slate-400 mt-0.5">-</span>
              <span>
                LOO is implemented as a target-CPT-only design rather than
                a full-network design -- adequate for CPT-level diagnostics
                but does not propagate uncertainty across the whole DAG.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-slate-400 mt-0.5">-</span>
              <span>
                Per-CPT soft-edging (0.90 / 0.10 for multi-state CPTs;
                0.95 / 0.05 for binary CPTs) prevents impossible-event
                probabilities of 0.0 from blocking inference. The choice
                is documented; sensitivity to this choice is on the open
                follow-up list.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-slate-400 mt-0.5">-</span>
              <span>
                Subsistence-scenario assumptions for human exposure (100
                g/day fish intake, 60 kg body weight, 0.95 MeHg fraction
                of total Hg) are surfaced in three places in the record
                so a reviewer cannot miss them.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-slate-400 mt-0.5">-</span>
              <span>
                Of the five comparison dimensions against the published
                Jermilova model, ONE is fully run (structural match), ONE
                is partial (sensitivity rankings, narrative only), and
                THREE are not yet run (CPT divergence, per-region
                marginal, counterfactual fold-change).
              </span>
            </li>
          </ul>
        </div>
      </ExpandableSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tier 3: Technical
// ---------------------------------------------------------------------------

function TechnicalContent() {
  return (
    <div className="space-y-4">
      <TierHeader
        tier="technical"
        title="Python Toolchain + BDeu Details + Codex Loop"
      />

      <ExpandableSection
        title="Python Toolchain"
        defaultOpen
        badge={TIER_LABELS.technical}
        badgeColor={TIER_BADGE_COLORS.technical}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            The reconstruction is a small Python pipeline (no notebooks --
            all code lives in importable modules with deterministic CLIs).
            Key libraries:
          </p>
          <ul className="space-y-1.5 ml-1 text-xs">
            <li className="flex items-start gap-1.5">
              <span className="text-violet-500 mt-0.5">-</span>
              <span>
                <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">
                  numpy
                </code>{' '}
                is the workhorse for the math: BDeu counting, Dirichlet
                normalization, LOO validation, mutual-information
                sensitivity, and forward-inference enumeration. No scipy
                / sklearn dependency on the fitting / inference path.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-violet-500 mt-0.5">-</span>
              <span>
                <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">
                  openpyxl
                </code>{' '}
                handles FRDR Excel ingest (the FRDR dataset ships as
                .xlsx workbooks). Crosswalk + discretization run as
                per-record <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">discretize_*()</code> functions
                in <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">prepare_mackenzie_data.py</code>;{' '}
                numpy enters at the BDeu-counting / inference stage,
                not at preprocessing.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-violet-500 mt-0.5">-</span>
              <span>
                <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">
                  networkx
                </code>{' '}
                provides a lightweight DAG-validation fallback
                (acyclicity check) so the pipeline can be validated
                without paying the pgmpy / torch import cost.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-violet-500 mt-0.5">-</span>
              <span>
                <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">
                  pgmpy
                </code>{' '}
                is imported ONLY to build a cycle-validated
                BayesianNetwork object in the DAG-definition module --
                CPT fitting and inference do NOT use pgmpy. Learned CPTs
                are stored as Python dicts serialized to the learned-
                model JSON file, not in TabularCPD objects. The rationale
                (a self-contained, line-by-line auditable BDeu
                implementation in fit_mackenzie_model.py) is in Appendix
                B.4 of the methodology paper.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-violet-500 mt-0.5">-</span>
              <span>
                <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">
                  pandas
                </code>{' '}
                is OPTIONAL -- used only in DAG-validation fixtures,
                not in the production fitting / inference pipeline.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-violet-500 mt-0.5">-</span>
              <span>
                The Dillon LL.3 dose-response{' '}
                <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">
                  injury_pct = 133.99 / (1 + exp(-0.699 * (ln(Hg) - ln(2.435))))
                </code>{' '}
                is implemented analytically (no R{' '}
                <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">
                  drc::drm()
                </code>{' '}
                runtime dependency).
              </span>
            </li>
          </ul>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="BDeu Counting (How the Intermediate CPTs Are Fit)"
        defaultOpen
        badge={TIER_LABELS.technical}
        badgeColor={TIER_BADGE_COLORS.technical}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            For the three intermediate stressor nodes (total_hg_deposition,
            freshwater_thg, fish_tissue_hg) the CPTs are fit by{' '}
            <InfoTooltip
              title="BDeu"
              description="Bayesian Dirichlet equivalent uniform -- a standard Bayesian estimator that adds a uniform Dirichlet prior on top of observed counts. The Equivalent Sample Size (ESS) parameter controls how much weight that prior receives."
              iconSize={11}
            />{' '}
            counting at ESS = 1.0. Concretely:
          </p>
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-2 font-mono text-xs">
            <div className="text-slate-600 dark:text-slate-400">
              <span className="text-slate-500">Prior:</span>{' '}
              <span>
                alpha_ijk = ESS / (n_parent_configs * n_states_target)
              </span>
            </div>
            <div className="text-slate-600 dark:text-slate-400">
              <span className="text-slate-500">Posterior:</span>{' '}
              <span>
                P(target=k | parents=j) = (N_ijk + alpha_ijk) / sum_k (N_ijk + alpha_ijk)
              </span>
            </div>
          </div>
          <ul className="space-y-1.5 ml-1 text-xs">
            <li className="flex items-start gap-1.5">
              <span className="text-violet-500 mt-0.5">-</span>
              <span>
                ESS = 1.0 is a low-information BDeu prior choice. The
                methodology paper reports it as a DOCUMENTED CHOICE rather
                than a defended choice: the proper defense is empirical
                via an ESS sensitivity sweep (re-run LOO at ESS in
                &#123;0.5, 1.0, 5.0, 10.0&#125;), recorded as PLAN Q6 open
                follow-up. The defense should NOT appeal to the published
                lme() baseline&apos;s prior posture -- lme() is
                maximum-likelihood (frequentist), not Dirichlet-posterior
                -- so the two paths are NOT comparing matched priors.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-violet-500 mt-0.5">-</span>
              <span>
                Each observation is treated independently -- no random
                effects. This diverges from the published lme-based fit;
                the divergence is documented in Part VII (Comparison) and
                Appendix B.3.6 has the analytic-equivalence receipt against
                a pgmpy.BayesianEstimator BDeu fixture.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-violet-500 mt-0.5">-</span>
              <span>
                Hand-calculation fixture for one BDeu row in Appendix B.2
                of the methodology paper: a reader can re-derive the
                posterior probabilities row-by-row by hand and check
                against the fitted CPT.
              </span>
            </li>
          </ul>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="Comparison Protocol (Five Dimensions, Frozen at M2)"
        badge={TIER_LABELS.technical}
        badgeColor={TIER_BADGE_COLORS.technical}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            The comparison protocol against the published Jermilova model
            was frozen at milestone M2 so the reconstruction could not
            silently shape the comparison to favor itself. Status of each
            dimension:
          </p>
          <ul className="space-y-1.5 ml-1 text-xs">
            <li className="flex items-start gap-1.5">
              <span className="text-emerald-500 mt-0.5">[done]</span>
              <span>
                <span className="font-semibold">Dimension 1 -- Structural.</span>{' '}
                Node count, edge count, topological ordering. Perfect
                match against the published DAG (14 nodes, 15 edges per
                submodel; same source-stressor-effect-impact layering).
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-amber-500 mt-0.5">[partial]</span>
              <span>
                <span className="font-semibold">
                  Dimension 4 -- Sensitivity rankings.
                </span>{' '}
                Mutual-information ranking of DAG drivers agrees with the
                published Table 2 on top-3 for shared variables, but the
                full Spearman rho / top-3 / rank-displacement metric
                receipts have not been written. Narrative match only.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-rose-500 mt-0.5">[not run]</span>
              <span>
                <span className="font-semibold">
                  Dimension 2 -- CPT divergence.
                </span>{' '}
                Jensen-Shannon divergence per shared CPT, between
                reconstructed (BDeu, ESS=1.0) and published (lme +
                predictSE).
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-rose-500 mt-0.5">[not run]</span>
              <span>
                <span className="font-semibold">
                  Dimension 3 -- Per-region marginal belief.
                </span>{' '}
                Pearson r between reconstructed per-region marginals and
                published per-region marginals.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-rose-500 mt-0.5">[not run]</span>
              <span>
                <span className="font-semibold">
                  Dimension 5 -- Minamata counterfactual fold-change.
                </span>{' '}
                Apply the published 35-60% atmospheric-Hg reduction (the
                Minamata Treaty scenario from the paper) and compare
                predicted fold-changes in fish-tissue Hg across regions
                and species. Threshold: same direction (decrease in fish
                Hg) and magnitude within 0.5x of the published ~1.2-fold
                reduction.
              </span>
            </li>
          </ul>
          <p className="text-xs text-slate-500 dark:text-slate-500 italic mt-2">
            The construction record names this status as the headline open
            follow-up. The dashboard does not claim full equivalence with
            the published model; it claims a structural match plus a
            narrative-level sensitivity-ranking match.
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="The Mutual-Agreement Codex Loop"
        badge={TIER_LABELS.technical}
        badgeColor={TIER_BADGE_COLORS.technical}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            Every load-bearing artifact -- the PLAN, the body Parts, the
            appendices, the methodology-paper holistic review -- went
            through a Codex CLI adversarial review loop run by the HITL.
            The contract is mutual-agreement, not silent acceptance: when
            the AI orchestrator and Codex disagree on a finding, the
            orchestrator quotes the finding verbatim, states its
            counter-position with load-bearing evidence, and asks Codex to
            defend, revise, or withdraw. Codex CLI is stateless between
            invocations, so each argument round is a self-contained prompt.
          </p>
          <p className="text-xs">
            The methodology-paper construction ran codex review rounds
            across components (PLAN, appendices, body Parts, plus a
            holistic round on the assembled v1.0). Status at the time of
            this dashboard authoring: v1.0 assembled 2026-05-17 post
            body-R4 YELLOW non-blocking and holistic-R1 RED applied --
            the file is explicitly &quot;ready for holistic codex review
            and HITL sign-off,&quot; not yet at final HITL acceptance.
            Appendix F (the Decision-Provenance Ledger) records the
            round-by-round audit trail.
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="Reproducibility"
        badge={TIER_LABELS.technical}
        badgeColor={TIER_BADGE_COLORS.technical}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            Part IX of the methodology paper documents an end-to-end
            reproducibility recipe: environment (Python version, pinned
            library versions); step-by-step commands (M1 download to M7
            comparison); expected output hashes; drift check for the pack
            artifacts; explicit &quot;what we would do differently&quot;
            placeholder for items that ran but would benefit from a
            redesign.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-500 italic">
            Appendix D records every file under the methodology-paper
            tree with absolute path + size + SHA-256 for primary artifacts;
            Appendix F is the chronological decision-provenance ledger
            (every decision tagged with the AI tool + version + HITL
            sign-off).
          </p>
        </div>
      </ExpandableSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Source pointer footer
// ---------------------------------------------------------------------------

function SourcePointerFooter() {
  return (
    <div className="mt-6 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
      <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
        Source of truth
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        The view above is a curated summary. The full construction record
        -- nine Parts (I to IX), six Appendices (A to F), ~57k words,
        peer-reviewer grade -- lives in the Regulatory-Review repository at{' '}
        <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded break-all">
          2026_Database_Development/data_acquisition/bnrrm_extraction/bn_learning/external_case_studies/jermilova_2025_mackenzie_hg/methodology_paper/JERMILOVA_BNRRM_CONSTRUCTION_METHODOLOGY.md
        </code>
        . Every empirical claim there cites a source file with line number
        or a results-JSON path; the dashboard never overrides that source.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers (TierButton + TierHeader -- mirror HowItWorksView for visual parity)
// ---------------------------------------------------------------------------

function TierButton({
  tier,
  title,
  subtitle,
  active,
  onClick,
}: {
  tier: AudienceTier & string;
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
      data-testid={`ai-assisted-tier-${tier}`}
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
              tier === 'twg-review' &&
                'border-amber-500 dark:border-amber-400 bg-amber-50 dark:bg-amber-900/20'
            )
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm'
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className={cn(
            'w-2.5 h-2.5 rounded-full',
            TIER_ACCENT_COLORS[tier]
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

function TierHeader({
  tier,
  title,
}: {
  tier: string;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'w-1.5 h-6 rounded-full',
          TIER_ACCENT_COLORS[tier] ?? 'bg-slate-400'
        )}
      />
      <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
        {title}
      </h3>
    </div>
  );
}
