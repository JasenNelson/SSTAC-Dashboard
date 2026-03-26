'use client';

import { ExpandableSection } from '@/components/bn-rrm/shared/ExpandableSection';
import { InfoTooltip } from '@/components/bn-rrm/shared/InfoTooltip';
import { cn } from '@/utils/cn';

const METHODS = [
  {
    id: 'bnrrm',
    name: 'BN-RRM',
    fullName: 'Bayesian Network Relative Risk Model',
    reference: 'Landis (2021)',
    type: 'Causal probabilistic model',
    inputs: 'Chemistry, conditions, and effects through causal DAG',
    output: 'Posterior probability distribution (Low/Moderate/High)',
    strengths: [
      'Causal reasoning through mechanistic pathways',
      'Probabilistic output with explicit uncertainty',
      'Forward and backward inference capability',
      'Sensitivity analysis identifies key drivers',
    ],
    limitations: [
      'Trained on 8 BC sites (82 co-located stations)',
      'Organic pathway expert-dominant (limited PAH+PCB data)',
      'Moderate-risk detection limited (12.5% recall in LOO)',
      'Requires discretization of continuous measurements',
    ],
    color: 'blue',
  },
  {
    id: 'woe',
    name: 'WOE',
    fullName: 'Weight of Evidence',
    reference: 'Chapman & Anderson (2005)',
    type: 'Expert-driven scenario classification',
    inputs: 'Multiple lines of evidence ranked by expert judgment',
    output: 'Categorical risk scenario (1–8) or risk label',
    strengths: [
      'Widely used and accepted in BC regulatory practice',
      'Integrates qualitative and quantitative evidence',
      'Flexible framework adaptable to site-specific conditions',
      'Well-established peer review history',
    ],
    limitations: [
      'Subjective ranking of evidence lines',
      'Scenario assignment can vary between assessors',
      'No explicit uncertainty quantification',
      'Does not distinguish causal pathways',
    ],
    color: 'violet',
  },
  {
    id: 'sqt',
    name: 'SQT',
    fullName: 'Sediment Quality Triad',
    reference: 'Long & Chapman (1985)',
    type: 'Integrated three-line assessment',
    inputs: 'Chemistry, toxicity, and benthic community (three LoE)',
    output: 'Categorical classification based on LoE concordance',
    strengths: [
      'Simple conceptual framework',
      'Direct integration of field and lab data',
      'Well-established methodology with decades of use',
    ],
    limitations: [
      'Equal weighting of three LoE may not reflect site conditions',
      'Classification depends on threshold choices',
      'No causal attribution of effects to specific contaminants',
    ],
    color: 'amber',
  },
  {
    id: 'sqg',
    name: 'SQG',
    fullName: 'Sediment Quality Guidelines',
    reference: 'CCME (2001)',
    type: 'Guideline-based screening',
    inputs: 'Chemistry concentrations compared to ISQG and PEL thresholds',
    output: 'Exceedance counts or quotients (continuous)',
    strengths: [
      'Objective, reproducible, no expert judgment required',
      'Based on large empirical databases',
      'Useful for initial screening and prioritization',
    ],
    limitations: [
      'Chemistry-only — does not incorporate biological effects',
      'Does not account for bioavailability modifiers (TOC, AVS)',
      'Binary thresholds lose information about dose-response',
    ],
    color: 'green',
  },
  {
    id: 'pecq',
    name: 'PEC-Q / mPEC-Q',
    fullName: 'Probable Effect Concentration Quotient',
    reference: 'MacDonald et al. (2000)',
    type: 'Quotient-based continuous metric',
    inputs: 'Chemistry concentrations normalized to PEC values',
    output: 'Continuous quotient (0–∞); mean PEC quotient across contaminants',
    strengths: [
      'Continuous metric allows ranking and correlation',
      'Empirically calibrated against biological effects databases',
      'Mean quotient integrates across multiple contaminants',
    ],
    limitations: [
      'Chemistry-only like SQG',
      'Does not account for bioavailability or site conditions',
      'Quotient additivity assumption may not hold for all mixtures',
    ],
    color: 'red',
  },
  {
    id: 'logistic',
    name: 'Logistic Regression',
    fullName: 'Logistic Regression Models',
    reference: 'Field et al. (2002); Wenning et al. (2005)',
    type: 'Statistical model (quantitative LoE integration)',
    inputs: 'Quantified lines of evidence as predictor variables',
    output: 'Probability of adverse effect (continuous 0–1)',
    strengths: [
      'Probabilistic output comparable to BN-RRM P(high)',
      'Transparent coefficient interpretation',
      'Well-established statistical theory and diagnostics',
      'Can incorporate interaction terms',
    ],
    limitations: [
      'Assumes linear relationship on logit scale',
      'No causal structure — correlational only',
      'Requires sufficient sample size per predictor',
      'Does not propagate through mechanistic pathways',
    ],
    color: 'slate',
  },
];

const colorMap: Record<string, { border: string; bg: string; header: string }> = {
  blue: { border: 'border-blue-200 dark:border-blue-700', bg: 'bg-blue-50 dark:bg-blue-900/20', header: 'text-blue-800 dark:text-blue-200' },
  violet: { border: 'border-violet-200 dark:border-violet-700', bg: 'bg-violet-50 dark:bg-violet-900/20', header: 'text-violet-800 dark:text-violet-200' },
  amber: { border: 'border-amber-200 dark:border-amber-700', bg: 'bg-amber-50 dark:bg-amber-900/20', header: 'text-amber-800 dark:text-amber-200' },
  green: { border: 'border-green-200 dark:border-green-700', bg: 'bg-green-50 dark:bg-green-900/20', header: 'text-green-800 dark:text-green-200' },
  red: { border: 'border-red-200 dark:border-red-700', bg: 'bg-red-50 dark:bg-red-900/20', header: 'text-red-800 dark:text-red-200' },
  slate: { border: 'border-slate-300 dark:border-slate-600', bg: 'bg-slate-50 dark:bg-slate-800/50', header: 'text-slate-800 dark:text-slate-200' },
};

export function MethodComparison() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Method Comparison</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Overview of sediment ecological risk assessment methods used in BC contaminated sites practice
        </p>
      </div>

      {/* Educational note */}
      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          This section provides an educational overview of assessment methods. Each method was
          developed for different purposes and produces different types of outputs. Direct numerical
          comparison between methods is only appropriate where a defensible ordinal mapping exists
          between their output spaces. Where no such mapping exists, methods are compared
          descriptively.
        </p>
      </div>

      {/* Comparison table */}
      <ExpandableSection title="Summary Comparison Table" defaultOpen>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400 w-24">Method</th>
                <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Type</th>
                <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Inputs</th>
                <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Output</th>
                <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400 w-48">
                  <span className="inline-flex items-center gap-1">
                    Comparison to BN-RRM
                    <InfoTooltip
                      title="Comparison Approach"
                      description="How each method's output can be compared to BN-RRM posterior estimates. Ordinal methods use weighted kappa; continuous methods use correlation. Where mapping is not defensible, comparison is descriptive only."
                      iconSize={11}
                    />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {METHODS.filter(m => m.id !== 'bnrrm').map((method) => (
                <tr key={method.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-2 font-semibold text-slate-700 dark:text-slate-300">{method.name}</td>
                  <td className="py-2 text-slate-600 dark:text-slate-400">{method.type}</td>
                  <td className="py-2 text-slate-600 dark:text-slate-400">{method.inputs}</td>
                  <td className="py-2 text-slate-600 dark:text-slate-400">{method.output}</td>
                  <td className="py-2 text-slate-600 dark:text-slate-400">
                    {method.id === 'woe' && 'Weighted kappa (ordinal 3-class mapping available)'}
                    {method.id === 'sqt' && 'Weighted kappa (if ordinal mapping is defensible)'}
                    {method.id === 'sqg' && 'Descriptive only (exceedance counts are not ordinal risk)'}
                    {method.id === 'pecq' && 'Spearman correlation with BN-RRM P(high) (both continuous)'}
                    {method.id === 'logistic' && 'Spearman or Pearson correlation (both produce probabilities)'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ExpandableSection>

      {/* Manager-accessible summary */}
      <ExpandableSection title="Plain-Language Summary" defaultOpen badge="For all audiences">
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            Several methods exist for assessing ecological risk at contaminated sediment sites.
            They differ in what data they use, how they combine evidence, and what kind of
            answer they produce:
          </p>
          <ul className="space-y-2 ml-1">
            <li className="flex items-start gap-2">
              <span className="font-semibold text-blue-600 dark:text-blue-400 shrink-0 w-20">BN-RRM</span>
              <span>Uses a causal model to estimate the <em>probability</em> of ecological risk, showing how confident the estimate is. Produces a distribution (e.g., 70% Low, 20% Moderate, 10% High).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-violet-600 dark:text-violet-400 shrink-0 w-20">WOE</span>
              <span>An expert combines multiple lines of evidence to assign a risk scenario or category. Widely used in BC practice. Produces a single label (e.g., &ldquo;moderate risk&rdquo;).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-amber-600 dark:text-amber-400 shrink-0 w-20">SQT</span>
              <span>Compares chemistry, toxicity, and community data side by side. Classifies risk based on whether the three lines of evidence agree.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-green-600 dark:text-green-400 shrink-0 w-20">SQG</span>
              <span>Compares contaminant concentrations against published guidelines (ISQG/PEL). Chemistry-only — does not use biological effect data.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-red-600 dark:text-red-400 shrink-0 w-20">PEC-Q</span>
              <span>Calculates a ratio of measured concentrations to effect thresholds. Produces a number — higher means greater concern.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-slate-600 dark:text-slate-400 shrink-0 w-20">Logistic</span>
              <span>A statistical model that estimates the probability of adverse effects from measured data. Produces a probability like BN-RRM, but without causal structure.</span>
            </li>
          </ul>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            These methods were developed for different purposes. None is universally superior.
            When comparing their results, it is important to account for differences in what
            they measure and how they express uncertainty.
          </p>
        </div>
      </ExpandableSection>

      {/* Statistical comparison approaches (technical) */}
      <ExpandableSection title="Statistical Comparison Approaches" badge="Technical">
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            The appropriate statistical method for comparing BN-RRM outputs with another method
            depends on the output type of each method:
          </p>
          <table className="w-full text-xs mt-2">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-1.5 font-medium text-slate-500 dark:text-slate-400">Comparator output type</th>
                <th className="text-left py-1.5 font-medium text-slate-500 dark:text-slate-400">Statistical method</th>
                <th className="text-left py-1.5 font-medium text-slate-500 dark:text-slate-400">Prerequisite</th>
                <th className="text-left py-1.5 font-medium text-slate-500 dark:text-slate-400">Applicable methods</th>
              </tr>
            </thead>
            <tbody className="text-slate-600 dark:text-slate-400">
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-1.5">Ordinal categories (Low/Mod/High)</td>
                <td className="py-1.5">Weighted Cohen&apos;s kappa (quadratic)</td>
                <td className="py-1.5">Defensible mapping to BN 3-class space</td>
                <td className="py-1.5">WOE, SQT</td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-1.5">Continuous probability (0–1)</td>
                <td className="py-1.5">Spearman or Pearson correlation</td>
                <td className="py-1.5">BN-RRM posterior P(high) available</td>
                <td className="py-1.5">PEC-Q, mPEC-Q, Logistic regression</td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-1.5">Counts or non-ordinal categories</td>
                <td className="py-1.5">Descriptive comparison only</td>
                <td className="py-1.5">No defensible mapping to BN 3-class</td>
                <td className="py-1.5">SQG exceedance counts</td>
              </tr>
              <tr>
                <td className="py-1.5">Binary (adverse / not adverse)</td>
                <td className="py-1.5">McNemar&apos;s test</td>
                <td className="py-1.5">Justified binary reduction of both methods</td>
                <td className="py-1.5">Any (with explicit binary definition)</td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            All agreement metrics require bootstrap 95% confidence intervals given the small
            sample sizes typical of sediment risk assessments. See the Statistical Analysis
            Plan (STATISTICAL_ANALYSIS_PLAN.md) for full methodology.
          </p>
        </div>
      </ExpandableSection>

      {/* Individual method cards */}
      {METHODS.map((method) => {
        const c = colorMap[method.color] ?? colorMap.blue;
        return (
          <ExpandableSection
            key={method.id}
            title={`${method.name} — ${method.fullName}`}
            badge={method.reference}
            defaultOpen={method.id === 'bnrrm'}
          >
            <div className={cn('rounded-lg border p-4 space-y-3', c.border, c.bg)}>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Type</div>
                  <p className={cn('font-medium', c.header)}>{method.type}</p>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Output</div>
                  <p className="text-slate-600 dark:text-slate-400">{method.output}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Strengths</div>
                  <ul className="space-y-1">
                    {method.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                        <span className="text-green-500 mt-0.5">+</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Limitations</div>
                  <ul className="space-y-1">
                    {method.limitations.map((l, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                        <span className="text-amber-500 mt-0.5">-</span>
                        <span>{l}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </ExpandableSection>
        );
      })}

      {/* Key references */}
      <ExpandableSection title="Key References">
        <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
          <li>Chapman, P.M. &amp; Anderson, J. (2005). A decision-making framework for sediment contamination. <em>Integrated Environmental Assessment and Management</em>, 1(3), 163–173.</li>
          <li>Long, E.R. &amp; Chapman, P.M. (1985). A sediment quality triad: measures of sediment contamination, toxicity, and infaunal community composition. <em>Marine Pollution Bulletin</em>, 16(10), 405–415.</li>
          <li>MacDonald, D.D., Ingersoll, C.G. &amp; Berger, T.A. (2000). Development and evaluation of consensus-based sediment quality guidelines. <em>Archives of Environmental Contamination and Toxicology</em>, 39, 20–31.</li>
          <li>Landis, W.G. (2021). The origin, development, application, lessons learned, and future regarding the Bayesian Network Relative Risk Model. <em>Integrated Environmental Assessment and Management</em>, 17(1), 79–96.</li>
          <li>CCME (2001). <em>Canadian Sediment Quality Guidelines for the Protection of Aquatic Life</em>. Canadian Council of Ministers of the Environment.</li>
          <li>Bay, S.M. &amp; Weisberg, S.B. (2012). Framework for interpreting sediment quality triad data. <em>Integrated Environmental Assessment and Management</em>, 8(4), 589–596.</li>
          <li>Grapentine, L., Anderson, J., Boyd, D., Burton, G.A., DeBarros, C., Johnson, G., Marvin, C., Milani, D., Painter, S., Pascoe, T., Reynoldson, T., Richman, L., Solomon, K. &amp; Chapman, P.M. (2002). A decision making framework for sediment assessment developed for the Great Lakes. <em>Human and Ecological Risk Assessment</em>, 8(7), 1641–1655.</li>
          <li>Field, L.J., MacDonald, D.D., Norton, S.B., Ingersoll, C.G., Severn, C.G., Smorong, D. &amp; Lindskoog, R. (2002). Predicting amphipod toxicity from sediment chemistry using logistic regression models. <em>Environmental Toxicology and Chemistry</em>, 21(9), 1993–2005.</li>
          <li>Wenning, R.J., Batley, G.E., Ingersoll, C.G. &amp; Moore, D.W. (Eds.) (2005). <em>Use of Sediment Quality Guidelines and Related Tools for the Assessment of Contaminated Sediments</em>. SETAC Press.</li>
        </ul>
      </ExpandableSection>

      {/* Footer */}
      <div className="text-xs text-slate-400 dark:text-slate-500 border-t border-slate-200 dark:border-slate-700 pt-4">
        <p>
          This overview is educational. It does not rank methods by quality or recommend one
          over another. Each method serves different assessment needs. Choice of method depends
          on regulatory context, data availability, and assessment objectives.
        </p>
      </div>
    </div>
  );
}
