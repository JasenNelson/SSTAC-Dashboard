'use client';

import { useState } from 'react';
import { ExpandableSection } from '@/components/bn-rrm/shared/ExpandableSection';
import { InfoTooltip } from '@/components/bn-rrm/shared/InfoTooltip';
import { cn } from '@/utils/cn';

// ---------------------------------------------------------------------------
// Audience tier type and badge colors
// ---------------------------------------------------------------------------

type AudienceTier = 'everyone' | 'practitioner' | 'technical' | null;

const TIER_BADGE_COLORS: Record<string, string> = {
  everyone:
    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  practitioner:
    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  technical:
    'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
};

const TIER_LABELS: Record<string, string> = {
  everyone: 'For Everyone',
  practitioner: 'For Practitioners',
  technical: 'Technical',
};

const TIER_ACCENT_COLORS: Record<string, string> = {
  everyone: 'bg-green-500',
  practitioner: 'bg-blue-500',
  technical: 'bg-violet-500',
};

// ---------------------------------------------------------------------------
// Discretization table data (Table S4)
// ---------------------------------------------------------------------------

const DISCRETIZATION_TABLE: {
  node: string;
  states: string;
  units: string;
  source: string;
}[] = [
  {
    node: 'Proximity to mine (GSL)',
    states: 'Near (<15 km) / Far (>=15 km)',
    units: 'km',
    source: 'Binary, FRDR spatial data',
  },
  {
    node: 'Proximity to historic mine',
    states: 'Near (<15 km) / Far (>=15 km)',
    units: 'km',
    source: 'Binary, FRDR spatial data',
  },
  {
    node: 'Proximity to oil (GBS)',
    states: 'Near (<15 km) / Far (>=15 km)',
    units: 'km',
    source: 'Binary, FRDR spatial data',
  },
  {
    node: 'Proximity to RPTS (GBS)',
    states: 'Near (<15 km) / Far (>=15 km)',
    units: 'km',
    source: 'Binary, FRDR spatial data',
  },
  {
    node: 'Atmospheric Hg deposition',
    states: 'Low (<5) / Medium (5-10) / High (>10)',
    units: 'ug/m2/yr',
    source: 'Table S4, FRDR monitoring',
  },
  {
    node: 'Permafrost Hg release',
    states: 'Low (<0.1) / Medium (0.1-0.5) / High (>0.5)',
    units: 'ug/L estimated',
    source: 'Table S4, literature estimates',
  },
  {
    node: 'Soil erosion Hg release',
    states: 'Low / Medium / High',
    units: 'RUSLE composite',
    source: 'Table S4, pre-computed K*LS*C*R',
  },
  {
    node: 'Total Hg deposition',
    states: 'Low / Medium / High',
    units: 'aggregate index',
    source: 'Derived from source nodes',
  },
  {
    node: 'Freshwater THg',
    states: 'Low (<2) / Medium (2-26) / High (>26)',
    units: 'ng/L',
    source: 'Table S4, CCME guideline = 26 ng/L',
  },
  {
    node: 'Fish tissue Hg',
    states: 'Low (<0.2) / Medium (0.2-0.5) / High (>0.5)',
    units: 'ug/g ww',
    source: 'Table S4, HC commercial limit = 0.5',
  },
  {
    node: 'Degree of injury',
    states: 'None-Low / Moderate / High',
    units: 'EC20/EC50 thresholds',
    source: 'Dose-response (drc LL.3 fit)',
  },
  {
    node: 'Meets commercial guideline',
    states: 'Yes (<0.5) / No (>=0.5)',
    units: 'ug Hg/g tissue',
    source: 'Health Canada limit',
  },
  {
    node: 'Fish species',
    states: 'Whitefish / Trout / Pike / Walleye / Burbot',
    units: 'categorical',
    source: 'Species code from FRDR',
  },
  {
    node: 'Fish length',
    states: 'Small / Medium / Large',
    units: 'mm fork length',
    source: 'Species-specific terciles',
  },
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function HowItWorksView() {
  const [activeTier, setActiveTier] = useState<AudienceTier>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
          How It Works
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Mackenzie Mercury BN-RRM -- understanding the model at your level
        </p>
      </div>

      {/* Tier selector */}
      <div className="grid grid-cols-3 gap-3">
        <TierButton
          tier="everyone"
          title="For Everyone"
          subtitle="No background needed"
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
      </div>

      {/* Tier 1: For Everyone */}
      {activeTier === 'everyone' && <EveryoneContent />}

      {/* Tier 2: For Practitioners */}
      {activeTier === 'practitioner' && <PractitionerContent />}

      {/* Tier 3: Technical */}
      {activeTier === 'technical' && <TechnicalContent />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tier selector button
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
      onClick={onClick}
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
                'border-violet-500 dark:border-violet-400 bg-violet-50 dark:bg-violet-900/20'
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

// ---------------------------------------------------------------------------
// Tier 1: For Everyone
// ---------------------------------------------------------------------------

function EveryoneContent() {
  return (
    <div className="space-y-4">
      <TierHeader tier="everyone" title="What Does This Model Do?" />

      <ExpandableSection
        title="The Big Picture"
        defaultOpen
        badge={TIER_LABELS.everyone}
        badgeColor={TIER_BADGE_COLORS.everyone}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            Mercury is a toxic metal that gets into rivers and lakes from old
            mines, the atmosphere, melting permafrost, and soil erosion. Fish
            absorb mercury from the water, and people who eat fish can be
            exposed.
          </p>
          <p>
            This model is like a map of cause-and-effect: it traces mercury from
            its sources all the way to whether fish are safe to eat.
          </p>
          <p>
            Scientists in the Mackenzie River basin (northern Canada, from Great
            Slave Lake to the Arctic Ocean) built this model to understand
            mercury risk to fish and communities that depend on them.
          </p>
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mt-2">
            <p className="text-xs text-green-700 dark:text-green-300">
              Think of the Bayesian network like a flowchart where each box
              represents a question (Is there a mine nearby? How much mercury
              falls from the sky?) and arrows show how the answers affect each
              other. Change one answer and all the downstream boxes update
              automatically.
            </p>
          </div>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="How It Works (Simple)"
        defaultOpen
        badge={TIER_LABELS.everyone}
        badgeColor={TIER_BADGE_COLORS.everyone}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <StepItem
            step={1}
            title="Where does mercury come from? (Sources)"
            description="Old mines, oil operations, the atmosphere, melting permafrost, and soil washing into rivers all release mercury into the environment."
            color="green"
          />
          <StepItem
            step={2}
            title="How much mercury ends up in the water? (Stressors)"
            description="The model adds up all the sources and predicts how much mercury ends up in the water. Some areas get more than others depending on which sources are nearby."
            color="green"
          />
          <StepItem
            step={3}
            title="How much mercury gets into fish? (Effects)"
            description="Different fish species (whitefish, trout, pike, walleye, burbot) absorb different amounts based on their size and diet. Larger, older fish tend to have more mercury."
            color="green"
          />
          <StepItem
            step={4}
            title="Is it safe to eat the fish? (Impact)"
            description="The model compares fish mercury levels to health guidelines. If mercury is too high, there are health risks, especially for children and pregnant women."
            color="green"
          />
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="Why Two Models?"
        badge={TIER_LABELS.everyone}
        badgeColor={TIER_BADGE_COLORS.everyone}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            The Mackenzie watershed is huge, so the model is split into two
            sub-models:
          </p>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Great Slave Lake (GSL)
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Has nearby active and historic mines as major mercury sources.
                Four study regions.
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Great Bear Subbasin (GBS)
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Has oil operations and thaw slumps (retrogressive permafrost
                thaw) as primary sources. Four study regions.
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Each area has different mercury sources, so separating them lets the
            model be more accurate about what drives risk in each region.
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
      <TierHeader tier="practitioner" title="Reading the Model Outputs" />

      <ExpandableSection
        title="The Bayesian Network Structure"
        defaultOpen
        badge={TIER_LABELS.practitioner}
        badgeColor={TIER_BADGE_COLORS.practitioner}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            The model is a{' '}
            <span className="inline-flex items-center gap-1">
              directed acyclic graph (
              <InfoTooltip
                title="DAG"
                description="Directed Acyclic Graph -- a network of nodes connected by one-way arrows with no loops. Each arrow represents a causal or conditional relationship."
                iconSize={11}
              />
              ) with 14 nodes:
            </span>
          </p>
          <ul className="space-y-2 ml-1">
            <li className="flex items-start gap-2">
              <span className="font-semibold text-blue-600 dark:text-blue-400 shrink-0 w-28">
                Sources (7)
              </span>
              <span>
                Mercury inputs -- proximity to mines/oil/thaw slumps,
                atmospheric deposition, permafrost Hg release, soil erosion Hg
                release
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-amber-600 dark:text-amber-400 shrink-0 w-28">
                Stressors (2)
              </span>
              <span>
                Total Hg Deposition and Freshwater{' '}
                <InfoTooltip
                  title="THg"
                  description="Total mercury concentration in water, measured in nanograms per litre (ng/L)."
                  iconSize={11}
                />
                {' '}-- how much mercury reaches the aquatic environment
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-violet-600 dark:text-violet-400 shrink-0 w-28">
                Effects (3)
              </span>
              <span>
                Fish Tissue Hg, Degree of Injury, and whether fish meet the
                commercial sale guideline
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-red-600 dark:text-red-400 shrink-0 w-28">
                Impact (2)
              </span>
              <span>
                Human health risk via weekly mercury intake compared against{' '}
                <InfoTooltip
                  title="pTWI"
                  description="Provisional Tolerable Weekly Intake -- the maximum amount of mercury (per kg body weight per week) considered safe for long-term consumption. Different values apply for children, women of childbearing age, and adult males."
                  iconSize={11}
                />{' '}
                thresholds
              </span>
            </li>
          </ul>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="How to Interpret Results"
        defaultOpen
        badge={TIER_LABELS.practitioner}
        badgeColor={TIER_BADGE_COLORS.practitioner}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <div className="space-y-2">
            <InterpretItem
              term="Beliefs"
              description="Each node shows a probability distribution across its states. For example, Freshwater THg might show 60% Low, 30% Medium, 10% High."
            />
            <InterpretItem
              term="Evidence"
              description='Setting a node to a known value (e.g., "mine nearby = yes") updates all downstream beliefs through the causal chain.'
            />
            <InterpretItem
              term="Sensitivity"
              description="Which sources have the most influence on fish mercury? The sensitivity analysis ranks source nodes by their impact on downstream endpoints."
            />
            <InterpretItem
              term="Regional models"
              description="The model runs separately for each of 8 study regions (4 GSL + 4 GBS), because mercury sources differ by location."
            />
          </div>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="Key Thresholds"
        badge={TIER_LABELS.practitioner}
        badgeColor={TIER_BADGE_COLORS.practitioner}
      >
        <div className="space-y-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">
                  Threshold
                </th>
                <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">
                  Value
                </th>
                <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">
                  Source
                </th>
              </tr>
            </thead>
            <tbody className="text-slate-700 dark:text-slate-300 text-sm">
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2">Freshwater aquatic life guideline</td>
                <td className="py-2 font-mono">26 ng/L total Hg</td>
                <td className="py-2 text-xs text-slate-500">CCME</td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2">Commercial fish sale limit</td>
                <td className="py-2 font-mono">0.5 ug Hg/g tissue</td>
                <td className="py-2 text-xs text-slate-500">Health Canada</td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2">
                  <span className="inline-flex items-center gap-1">
                    EC20 (20% fish injury)
                    <InfoTooltip
                      title="EC20"
                      description="Effect Concentration at 20% -- the tissue mercury concentration at which 20% of fish show injury."
                      iconSize={11}
                    />
                  </span>
                </td>
                <td className="py-2 font-mono">0.77 ug/g</td>
                <td className="py-2 text-xs text-slate-500">
                  Dose-response (drc)
                </td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2">EC50 (50% fish injury)</td>
                <td className="py-2 font-mono">2.435 ug/g</td>
                <td className="py-2 text-xs text-slate-500">
                  Dose-response (drc)
                </td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2">
                  <span className="inline-flex items-center gap-1">
                    pTWI -- children
                    <InfoTooltip
                      title="pTWI"
                      description="Provisional Tolerable Weekly Intake -- the maximum safe weekly mercury intake per kg of body weight."
                      iconSize={11}
                    />
                  </span>
                </td>
                <td className="py-2 font-mono">0.7 ug Hg/kgbw/week</td>
                <td className="py-2 text-xs text-slate-500">
                  Health Canada / JECFA
                </td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2">pTWI -- childbearing women</td>
                <td className="py-2 font-mono">1.4 ug Hg/kgbw/week</td>
                <td className="py-2 text-xs text-slate-500">
                  Health Canada / JECFA
                </td>
              </tr>
              <tr>
                <td className="py-2">pTWI -- adult males</td>
                <td className="py-2 font-mono">3.3 ug Hg/kgbw/week</td>
                <td className="py-2 text-xs text-slate-500">
                  Health Canada / JECFA
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="What This Comparison Shows"
        badge={TIER_LABELS.practitioner}
        badgeColor={TIER_BADGE_COLORS.practitioner}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            We independently rebuilt this{' '}
            <InfoTooltip
              title="BN-RRM"
              description="Bayesian Network Relative Risk Model -- a causal probabilistic model that estimates ecological risk by propagating evidence through a directed acyclic graph."
              iconSize={11}
            />{' '}
            using only the publicly available data, without copying the published
            model&apos;s internal parameters or assumptions.
          </p>
          <p>
            Our model uses{' '}
            <InfoTooltip
              title="BDeu"
              description="Bayesian Dirichlet equivalent uniform -- a method for learning conditional probability tables from data using frequency counting with a uniform prior. ESS (equivalent sample size) controls the prior weight."
              iconSize={11}
            />{' '}
            frequency counting; the published model uses regression (
            <InfoTooltip
              title="lme"
              description="Linear mixed-effects model -- a statistical model that accounts for both fixed effects (e.g., mine proximity) and random effects (e.g., variation between sampling sites)."
              iconSize={11}
            />
            ). These are fundamentally different learning methods.
          </p>
          <p>
            Comparing the two demonstrates that this platform can reconstruct
            any published BN-RRM, not just the BC sediment contamination model
            it was originally built for.
          </p>
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
      <TierHeader tier="technical" title="Model Construction Details" />

      <ExpandableSection
        title="Published Model Methodology (Jermilova et al. 2025)"
        defaultOpen
        badge={TIER_LABELS.technical}
        badgeColor={TIER_BADGE_COLORS.technical}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            <InfoTooltip
              title="CPT"
              description="Conditional Probability Table -- the table that defines the probability of each state of a node given every combination of its parent states."
              iconSize={11}
            />{' '}
            CPTs parameterized via linear mixed-effects models (
            <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">
              nlme
            </code>{' '}
            R package):
          </p>
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-2">
            <div className="text-xs font-mono text-slate-600 dark:text-slate-400">
              <span className="text-slate-500">Fish tissue Hg:</span>{' '}
              <span>
                lme(Tissue_Hg ~ Fish_Code + Fork_length + NearMine_15km +
                NearHistoricMine + Total_NonPoint, random=~1|OID_)
              </span>
            </div>
            <div className="text-xs font-mono text-slate-600 dark:text-slate-400">
              <span className="text-slate-500">Freshwater THg:</span>{' '}
              <span>
                lme(THg ~ NearMine_15km + Near_HistoricMine_15km +
                TotalHg_deposition, random=~1|OID_)
              </span>
            </div>
          </div>
          <ul className="space-y-1 text-xs text-slate-500 dark:text-slate-400 ml-1">
            <li className="flex items-start gap-1.5">
              <span className="text-slate-400 mt-0.5">-</span>
              <span>
                Predicted distributions via{' '}
                <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">
                  predictSE.lme()
                </code>{' '}
                for all parent state combinations
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-slate-400 mt-0.5">-</span>
              <span>
                Dose-response via{' '}
                <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">
                  drc::drm()
                </code>{' '}
                with 3-parameter log-logistic (LL.3): injury% = 133.99 / (1 +
                exp(-0.699 * (ln(Hg) - ln(2.435))))
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-slate-400 mt-0.5">-</span>
              <span>
                Software: Netica for BN inference, RStudio for CPT generation
              </span>
            </li>
          </ul>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="Our Reconstruction Methodology"
        defaultOpen
        badge={TIER_LABELS.technical}
        badgeColor={TIER_BADGE_COLORS.technical}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <ul className="space-y-1.5 text-xs ml-1">
            <li className="flex items-start gap-1.5">
              <span className="text-violet-500 mt-0.5">-</span>
              <span>
                <InfoTooltip
                  title="BDeu"
                  description="Bayesian Dirichlet equivalent uniform -- a standard Bayesian scoring method for learning CPTs from data. The ESS parameter controls how much weight the uniform prior receives relative to the observed data."
                  iconSize={11}
                />{' '}
                BDeu scoring with ESS=1.0 (equivalent sample size)
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-violet-500 mt-0.5">-</span>
              <span>
                Direct frequency counting from 797 fish + 2,124 water
                observations
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-violet-500 mt-0.5">-</span>
              <span>
                No random effects -- each observation treated independently
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-violet-500 mt-0.5">-</span>
              <span>
                Deterministic CPTs for dose-response and threshold nodes
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-violet-500 mt-0.5">-</span>
              <span>
                Forward inference via topological sort + belief propagation (no
                pgmpy/torch dependency)
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-violet-500 mt-0.5">-</span>
              <span>
                <InfoTooltip
                  title="LOO"
                  description="Leave-One-Out cross-validation -- each observation is predicted using a model trained on all other observations. Provides an unbiased estimate of predictive performance."
                  iconSize={11}
                />{' '}
                LOO cross-validation: fish tissue Hg kappa 0.47-0.49, freshwater
                THg accuracy 85-95%
              </span>
            </li>
          </ul>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="Key Structural Decisions"
        badge={TIER_LABELS.technical}
        badgeColor={TIER_BADGE_COLORS.technical}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">
                  Decision
                </th>
                <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">
                  Rationale
                </th>
              </tr>
            </thead>
            <tbody className="text-slate-600 dark:text-slate-400">
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 font-medium">
                  RUSLE chain collapsed
                </td>
                <td className="py-2">
                  K/LS/C/R factors pre-computed in FRDR data; individual factors
                  not available for CPT fitting
                </td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 font-medium">
                  Species nodes collapsed
                </td>
                <td className="py-2">
                  Single fish_species parent node instead of per-species sub-DAGs;
                  reduces parameter count
                </td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 font-medium">
                  Discharge/flux excluded
                </td>
                <td className="py-2">
                  Different output goal (concentration, not flux); data gap for
                  discharge measurements
                </td>
              </tr>
              <tr>
                <td className="py-2 font-medium">
                  Diet/body weight post-inference
                </td>
                <td className="py-2">
                  Calculated after inference using Health Canada reference values,
                  not modeled as DAG nodes
                </td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-slate-400 dark:text-slate-500 italic">
            Full rationale documented in MODEL_SPECIFICATION_MACKENZIE.md
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="Discretization (Table S4)"
        badge={TIER_LABELS.technical}
        badgeColor={TIER_BADGE_COLORS.technical}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">
                  Node
                </th>
                <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">
                  States
                </th>
                <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">
                  Units
                </th>
                <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">
                  Source
                </th>
              </tr>
            </thead>
            <tbody className="text-slate-600 dark:text-slate-400">
              {DISCRETIZATION_TABLE.map((row) => (
                <tr
                  key={row.node}
                  className="border-b border-slate-100 dark:border-slate-800"
                >
                  <td className="py-1.5 font-medium">{row.node}</td>
                  <td className="py-1.5 font-mono">{row.states}</td>
                  <td className="py-1.5">{row.units}</td>
                  <td className="py-1.5">{row.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ExpandableSection>

      <ExpandableSection
        title="Data Sources"
        badge={TIER_LABELS.technical}
        badgeColor={TIER_BADGE_COLORS.technical}
      >
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Primary Data Repository
            </div>
            <p className="text-xs font-mono text-slate-600 dark:text-slate-400">
              FRDR DOI:{' '}
              <a
                href="https://doi.org/10.20383/103.0957"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                10.20383/103.0957
              </a>{' '}
              (CC BY-NC-SA 4.0)
            </p>
          </div>
          <ul className="space-y-1.5 text-xs ml-1">
            <li className="flex items-start gap-1.5">
              <span className="text-violet-500 mt-0.5">-</span>
              <span>
                797 fish tissue Hg records (5 species, 44 locations, 2001-2015)
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-violet-500 mt-0.5">-</span>
              <span>
                2,124 freshwater THg records (38.2% below detection limit)
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-violet-500 mt-0.5">-</span>
              <span>
                21 publicly available monitoring datasets compiled by Jermilova
                et al.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-violet-500 mt-0.5">-</span>
              <span>
                Tlicho data excluded per{' '}
                <InfoTooltip
                  title="OCAP Principles"
                  description="Ownership, Control, Access, and Possession -- principles asserting First Nations jurisdiction over their own data. Tlicho Nation data was excluded from the public dataset in accordance with these principles."
                  iconSize={11}
                />{' '}
                OCAP principles
              </span>
            </li>
          </ul>
        </div>
      </ExpandableSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

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

function StepItem({
  step,
  title,
  description,
  color,
}: {
  step: number;
  title: string;
  description: string;
  color: string;
}) {
  const bgColors: Record<string, string> = {
    green: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    violet:
      'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  };
  return (
    <div className="flex items-start gap-3">
      <div
        className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5',
          bgColors[color] ?? bgColors.green
        )}
      >
        {step}
      </div>
      <div>
        <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {title}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {description}
        </p>
      </div>
    </div>
  );
}

function InterpretItem({
  term,
  description,
}: {
  term: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="font-semibold text-blue-600 dark:text-blue-400 shrink-0 w-24">
        {term}
      </span>
      <span className="text-xs text-slate-500 dark:text-slate-400">
        {description}
      </span>
    </div>
  );
}
