'use client';

import { useState } from 'react';
import {
  Users,
  Briefcase,
  Beaker,
  Thermometer,
  Activity,
  AlertTriangle,
  BarChart3,
  HelpCircle,
  Shield,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { ExpandableSection } from '@/components/bn-rrm/shared/ExpandableSection';
import { usePackStore } from '@/stores/bn-rrm/packStore';
import { getScopeBadge, getReleaseBadge } from '@/lib/bn-rrm/pack-types';

type Audience = 'decision-maker' | 'technical' | null;

export function GettingStartedView() {
  const [audience, setAudience] = useState<Audience>(null);
  const packManifest = usePackStore((s) => s.packManifest);

  return (
    <div className="flex-1 p-8 overflow-auto">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Getting Started with BN-RRM
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            Bayesian Network Relative Risk Model for sediment ecological risk assessment
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {packManifest
              ? `Model: ${packManifest?.pack_id ?? ''} (${packManifest?.version_history?.architecture_version ?? ''}) · ${packManifest?.display_name ?? ''} · ${packManifest?.dag_node_count ?? 20}-node causal DAG · 3 risk states`
              : 'Model: loading... · 20-node causal DAG · 3 risk states'
            }
          </p>
        </div>

        {/* Audience selector */}
        <div>
          <p className="text-sm text-slate-600 dark:text-slate-400 text-center mb-4">
            Select your role to see the most relevant information:
          </p>
          <div className="grid grid-cols-2 gap-4">
            <AudienceCard
              icon={Briefcase}
              title="Decision Maker"
              subtitle="Managers, directors, and stakeholders"
              description="Understand what the model produces, what its outputs mean, and what decisions it can and cannot support."
              active={audience === 'decision-maker'}
              onClick={() => setAudience(audience === 'decision-maker' ? null : 'decision-maker')}
            />
            <AudienceCard
              icon={Users}
              title="Technical Reviewer"
              subtitle="QPs, scientists, and technical staff"
              description="Understand the causal DAG structure, inference mechanics, CPT learning tiers, and how to evaluate model outputs."
              active={audience === 'technical'}
              onClick={() => setAudience(audience === 'technical' ? null : 'technical')}
            />
          </div>
        </div>

        {/* Decision Maker Track */}
        {audience === 'decision-maker' && (
          <div className="space-y-4">
            <TrackHeader title="For Decision Makers" color="blue" />

            <ExpandableSection title="What does this model do?" defaultOpen>
              <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
                <p>
                  The BN-RRM estimates the probability of ecological risk at contaminated sediment sites.
                  It takes sediment chemistry data (metals, PAHs, PCBs), environmental conditions
                  (organic carbon, grain size, sulfide binding), and biological effect data as inputs.
                </p>
                <p>
                  The model propagates this evidence through a causal pathway — from contamination,
                  through bioavailability, to biological effects — and produces a probability
                  distribution across three risk levels: <strong>Low</strong>, <strong>Moderate</strong>,
                  and <strong>High</strong>.
                </p>
                <p>
                  The output is a <strong>posterior probability estimate</strong> — the model&apos;s
                  assessment of risk given the available evidence. It is not a measured outcome or a
                  compliance determination.
                </p>
              </div>
            </ExpandableSection>

            <ExpandableSection title="How to read the outputs">
              <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
                <p>
                  The model produces two main outputs:
                </p>
                <div className="space-y-2 ml-4">
                  <div className="flex items-start gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                    <span>
                      <strong>Risk distribution:</strong> Three bars showing the probability of Low,
                      Moderate, and High ecological risk. These always sum to 100%.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <span>
                      <strong>Risk summary:</strong> A severity-weighted classification (Low, Medium,
                      High, or Very High) based on the probability distribution. This accounts for the
                      consequences of high-risk outcomes, not just their likelihood.
                    </span>
                  </div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-3">
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    <strong>Key point:</strong> A station showing 60% Low and 40% High risk may be
                    classified as &ldquo;High&rdquo; in the summary, because the severity-weighted rule
                    accounts for the potential consequences of that 40% probability. The full
                    distribution gives you the complete picture.
                  </p>
                </div>
              </div>
            </ExpandableSection>

            <ExpandableSection title="What are the model's limitations?">
              <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
                <div className="space-y-2">
                  <LimitationItem text={packManifest
                    ? `The model was trained on ${packManifest?.training_corpus?.n_sites ?? 'N/A'} BC contaminated sites (${packManifest?.training_corpus?.n_co_located ?? 'N/A'} co-located stations). Performance at sites with very different contamination profiles has not been validated.`
                    : "Performance at sites with very different contamination profiles has not been validated."
                  } />
                  <LimitationItem text="The organic pathway (PAH + PCB) relies primarily on expert judgment rather than training data. DR-001 reframed: PAH and PCB do not need co-location for candidacy — each needs its own conditions/effects evidence. Current code limitation: CPT fitting requires both parents observed, and jointly analyzed PAH+PCB data is scarce in BC sediment assessments (4 station-events from 1 site)." />
                  <LimitationItem text="Moderate-risk detection is limited (12.5% recall). The model is better at identifying high-risk and low-risk stations than moderate-risk stations." />
                  <LimitationItem text="Model outputs are posterior probability estimates, not measured environmental outcomes. They should inform professional judgment, not replace it." />
                </div>
              </div>
            </ExpandableSection>

            <ExpandableSection title="How does this compare to other assessment methods?">
              <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
                <p>
                  Contaminated site risk assessments in BC commonly use Weight of Evidence (WOE)
                  frameworks, Sediment Quality Triads (SQT), and guideline-based screening (SQG).
                  The BN-RRM is a complementary tool that uses causal reasoning rather than scenario
                  classification.
                </p>
                <p>
                  Risk conclusions from consultant reports (WOE, SQT, etc.) are treated as
                  <strong> external reference labels</strong> in this system. They use different
                  methodologies and are not directly comparable to BN-RRM posterior estimates without
                  explicit mapping rules. The <strong>Review</strong> tab provides transparency on
                  model validation and performance.
                </p>
              </div>
            </ExpandableSection>
          </div>
        )}

        {/* Technical Reviewer Track */}
        {audience === 'technical' && (
          <div className="space-y-4">
            <TrackHeader title="For Technical Reviewers" color="violet" />

            <ExpandableSection title="v1.0 Model Status" defaultOpen>
              <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
                <p className="text-amber-600 dark:text-amber-400 font-medium">
                  BN-RRM v1.0 is the canonical development line, under active review and refinement. v0.4.1 is the legacy baseline.
                </p>
                <p>
                  <strong>What changed:</strong> The v1.0 publication candidate uses the same v4.0 architecture (20-node DAG)
                  with a corrected evaluation pipeline: decoupled CPT fitting, adjudicated ground-truth labels,
                  ecological risk data injection, and entropy-aware classification for uncertain cases.
                </p>
                <p>
                  <strong>Evaluation:</strong> Strict Tier 1 &mdash; 33 full-triad stations across 5 sites
                  (Toquaht, ALCAN, CP Nelson, Island Copper, Brunette River).
                </p>
                <p>
                  <strong>Key metrics (entropy rule):</strong> Accuracy 0.515, Kappa 0.179,
                  Moderate recall 0.750 (n=12), High recall 0.500 (n=2), Low recall 0.368 (n=19).
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Kappa 0.179 = &ldquo;slight&rdquo; agreement (Landis &amp; Koch 1977). High support = 2 (not statistically meaningful).
                  See the Review tab for detailed validation results.
                </p>
              </div>
            </ExpandableSection>

            <ExpandableSection title="Model architecture (v4.0)" defaultOpen>
              <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
                <p>
                  The BN-RRM is a <strong>Landis (2021) causal Bayesian Network</strong> with 20
                  nodes, 24 directed edges, and 3 states per node (low / moderate / high). The
                  training target is <code>ecological_risk</code>, derived from causal propagation
                  through the DAG — not from any external classification such as WOE scenario numbers.
                </p>
                <div className="grid grid-cols-4 gap-2 mt-3">
                  <NodeGroupCard icon={Beaker} label="Substances" count={9} color="blue"
                    items="Cu, Zn, Pb, Cd, Hg, As, Cr, PAHs, PCBs" />
                  <NodeGroupCard icon={Thermometer} label="Conditions" count={3} color="violet"
                    items="TOC, grain size, sulfide_binding" />
                  <NodeGroupCard icon={Activity} label="Effects" count={7} color="amber"
                    items="Contamination, bioavailability, toxicity, community" />
                  <NodeGroupCard icon={AlertTriangle} label="Risk" count={1} color="red"
                    items="ecological_risk (causal target)" />
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                  v4.0 uses <code>sulfide_binding</code> (calibrated from AVS/SEM ratio) as the metal
                  bioavailability modifier. The <strong>Detailed BN</strong> tab shows the full DAG
                  with interactive inference.
                </p>
              </div>
            </ExpandableSection>

            <ExpandableSection title="Evidence propagation and inference">
              <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
                <p>
                  <strong>Forward inference:</strong> Set evidence on substance, condition, or effect
                  nodes. The model computes posterior probabilities for all nodes via variable
                  elimination on the causal DAG. The <code>ecological_risk</code> node shows the
                  resulting risk distribution.
                </p>
                <p>
                  <strong>Backward inference:</strong> Set a target protection level (e.g.,
                  P(High) &lt; 10%) and the model derives substance concentrations that would achieve
                  that target, tracing back through the causal chain.
                </p>
                <p>
                  <strong>Sensitivity analysis:</strong> A tornado chart shows how much each input
                  node affects the <code>ecological_risk</code> posterior when varied from its best
                  to worst state.
                </p>
                <p>
                  All inference runs in the browser. No backend API calls are made. The model is
                  deterministic given the same evidence inputs.
                </p>
              </div>
            </ExpandableSection>

            <ExpandableSection title="CPT learning tiers">
              <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
                <p>
                  Conditional Probability Tables (CPTs) are learned through a 4-tier strategy that
                  reflects data availability across the causal chain:
                </p>
                <table className="w-full text-xs mt-2">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left py-1.5 font-medium text-slate-500 dark:text-slate-400">Tier</th>
                      <th className="text-left py-1.5 font-medium text-slate-500 dark:text-slate-400">Method</th>
                      <th className="text-left py-1.5 font-medium text-slate-500 dark:text-slate-400">Nodes</th>
                      <th className="text-left py-1.5 font-medium text-slate-500 dark:text-slate-400">Data influence</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-600 dark:text-slate-400">
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-1.5">1</td>
                      <td className="py-1.5">Noisy-OR</td>
                      <td className="py-1.5">Contamination aggregation</td>
                      <td className="py-1.5">Data-fitted</td>
                    </tr>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-1.5">2</td>
                      <td className="py-1.5">BDeu + Expert</td>
                      <td className="py-1.5">Bioavailability</td>
                      <td className="py-1.5">Hybrid (data + prior)</td>
                    </tr>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-1.5">3</td>
                      <td className="py-1.5">BDeu + Expert</td>
                      <td className="py-1.5">Toxicity, community</td>
                      <td className="py-1.5">Hybrid (limited configs)</td>
                    </tr>
                    <tr>
                      <td className="py-1.5">4</td>
                      <td className="py-1.5">Expert-dominant</td>
                      <td className="py-1.5">ecological_risk</td>
                      <td className="py-1.5">Expert (latent node)</td>
                    </tr>
                  </tbody>
                </table>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                  The <strong>CPT</strong> tab and <strong>Review &gt; CPT Transparency</strong>
                  sub-view show per-node source badges, sample counts, configuration coverage, and
                  expert vs learned distributions.
                </p>
              </div>
            </ExpandableSection>

            <ExpandableSection title="Evaluation context and LOO validation">
              <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
                <p>
                  Model performance is assessed via Leave-One-Out (LOO) cross-validation on{' '}
                  {packManifest
                    ? `${packManifest?.training_corpus?.n_co_located ?? 'N/A'} co-located stations across ${packManifest?.training_corpus?.n_sites ?? 'N/A'} sites`
                    : 'the training corpus'
                  }. Each station is predicted using a model trained
                  on all other stations. The predicted class is the MAP (maximum a posteriori) state
                  of the <code>ecological_risk</code> posterior.
                </p>
                <p>
                  The observed class is derived from a severity-based heuristic applied to each
                  station&apos;s actual effect data. It is a derived reference label, not a directly
                  measured field value.
                </p>
                <p>
                  The <strong>Review &gt; QA/QC &amp; Validation</strong> sub-view shows the full
                  confusion matrix, per-station predictions, and model comparison across variants.
                </p>
              </div>
            </ExpandableSection>

            <ExpandableSection title="Comparison-label boundary">
              <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
                <p>
                  Risk conclusions from consultant ERA reports (WOE scenarios, SQT classifications,
                  SQG exceedance counts, PEC quotients) are <strong>external reference labels</strong>.
                  They are:
                </p>
                <ul className="list-disc ml-5 space-y-1">
                  <li>Never used as BN training targets</li>
                  <li>Never used to modify model parameters or CPTs</li>
                  <li>Not directly comparable to BN-RRM posterior estimates without explicit mapping</li>
                </ul>
                <p>
                  Where defensible ordinal mappings exist (e.g., WOE &ldquo;negligible&rdquo; to BN
                  &ldquo;Low&rdquo;), they are documented with provenance. Where no defensible mapping
                  exists (e.g., SQG exceedance counts), labels are stored in parallel and compared
                  descriptively only. See the Comparison Governance specification for full rules.
                </p>
              </div>
            </ExpandableSection>
          </div>
        )}

        {/* Shared: What This Tool Is Not */}
        {audience !== null && (
          <div className="space-y-4">
            <div className="h-px bg-slate-200 dark:bg-slate-700" />

            <ExpandableSection title="What this tool is not" defaultOpen badge="Important">
              <div className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
                <NotItem text="Not a compliance determination. The model estimates ecological risk probability — it does not determine whether a site meets regulatory standards." />
                <NotItem text="Not a substitute for professional judgment. Outputs should be reviewed by qualified professionals (QPs) in the context of site-specific information." />
                <NotItem text="Not a measured outcome. The risk distribution is a posterior probability estimate from a causal model, not a field measurement or laboratory result." />
                <NotItem text="Not a replacement for Weight of Evidence or other established frameworks. It is a complementary screening tool that uses causal reasoning to integrate multiple lines of evidence." />
              </div>
            </ExpandableSection>

            <ExpandableSection title="How to read uncertainty">
              <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
                <p>
                  Every output from the BN-RRM is a probability distribution, not a single number.
                  The width of this distribution reflects the model&apos;s uncertainty:
                </p>
                <div className="space-y-3 mt-2">
                  <UncertaintyExample
                    label="High confidence"
                    bars={[90, 7, 3]}
                    description="One state dominates. The model is relatively certain. Evidence strongly supports this classification."
                  />
                  <UncertaintyExample
                    label="Moderate confidence"
                    bars={[55, 30, 15]}
                    description="One state leads but others are non-trivial. More evidence would help narrow the estimate."
                  />
                  <UncertaintyExample
                    label="High uncertainty"
                    bars={[35, 35, 30]}
                    description="Probability is spread across states. The available evidence does not strongly favour any single risk level. Additional data collection may be warranted."
                  />
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
                  The number of evidence nodes set also affects certainty. With no evidence, the model
                  shows prior probabilities. As more evidence is provided, the posterior distribution
                  becomes more informative.
                </p>
              </div>
            </ExpandableSection>
          </div>
        )}

        {/* Quick links */}
        {audience !== null && (
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
              Explore the model
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <QuickLink label="Detailed BN" description="Interactive causal network" />
              <QuickLink label="Map" description="Spatial data explorer" />
              <QuickLink label="Review" description="Validation and transparency" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function AudienceCard({ icon: Icon, title, subtitle, description, active, onClick }: {
  icon: typeof Users; title: string; subtitle: string; description: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'text-left rounded-xl border-2 p-5 transition-all',
        active
          ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20 shadow-md'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm'
      )}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center',
          active ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
        )}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className="font-semibold text-slate-800 dark:text-slate-100">{title}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</div>
        </div>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
    </button>
  );
}

function TrackHeader({ title, color }: { title: string; color: 'blue' | 'violet' }) {
  const colors = {
    blue: 'bg-blue-500',
    violet: 'bg-violet-500',
  };
  return (
    <div className="flex items-center gap-3">
      <div className={cn('w-1.5 h-6 rounded-full', colors[color])} />
      <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
    </div>
  );
}

function LimitationItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2">
      <Shield className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

function NotItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2">
      <HelpCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

function NodeGroupCard({ icon: Icon, label, count, color, items }: {
  icon: typeof Beaker; label: string; count: number; color: 'blue' | 'violet' | 'amber' | 'red'; items: string;
}) {
  const colors = {
    blue: 'border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20',
    violet: 'border-violet-200 dark:border-violet-700 bg-violet-50 dark:bg-violet-900/20',
    amber: 'border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20',
    red: 'border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20',
  };
  return (
    <div className={cn('rounded-lg border p-3', colors[color])}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{label} ({count})</span>
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">{items}</p>
    </div>
  );
}

function UncertaintyExample({ label, bars, description }: {
  label: string; bars: [number, number, number]; description: string;
}) {
  const colors = ['bg-green-400', 'bg-amber-400', 'bg-red-400'];
  const labels = ['Low', 'Mod', 'High'];
  return (
    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
      <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">{label}</div>
      <div className="flex h-5 rounded-full overflow-hidden mb-1.5">
        {bars.map((pct, i) => (
          <div
            key={labels[i]}
            className={cn('flex items-center justify-center', colors[i])}
            style={{ width: `${pct}%` }}
          >
            {pct >= 15 && (
              <span className="text-[10px] font-bold text-white">{pct}%</span>
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-slate-400 mb-1.5">
        {labels.map((l, i) => <span key={l}>{l}: {bars[i]}%</span>)}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  );
}

function QuickLink({ label, description }: { label: string; description: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3 hover:border-blue-300 dark:hover:border-blue-600 transition-colors cursor-pointer">
      <div className="flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-blue-500" />
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{description}</p>
    </div>
  );
}
