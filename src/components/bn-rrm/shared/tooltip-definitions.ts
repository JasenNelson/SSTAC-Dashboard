/**
 * Centralized tooltip definitions for BN-RRM pages.
 *
 * All user-facing statistical and methodological explanations live here.
 * This prevents wording drift across components and ensures terminology
 * stays locked to the v4.0 architecture.
 *
 * Model lock: bnrrm-landis-causal v4.0, 20 nodes, 24 edges,
 * training target = ecological_risk, sulfide_binding (not avs).
 */

export const TOOLTIP = {
  // ── ResultsPanel ──────────────────────────────────────────────────────
  inferenceBasis: {
    noEvidence: {
      title: 'Inference Basis',
      description:
        "Results show the model's prior risk distribution before any site-specific evidence is provided. Set evidence on substance, condition, or effect nodes to see updated posteriors.",
    },
    withEvidence: {
      title: 'Inference Basis',
      description:
        'Results show posterior probabilities computed by forward propagation through the 20-node causal DAG (bnrrm-landis-causal v4.0), given the evidence you have set.',
    },
  },

  riskClassification: {
    title: 'Risk Classification',
    description:
      'This summary is determined by a severity-weighted threshold rule applied to the posterior distribution. It checks whether the probability mass in the most severe states exceeds specific thresholds — so a moderate probability of high risk can elevate the classification beyond what the single most probable class would suggest. The full distribution below shows the complete posterior.',
  },

  ecologicalRiskDistribution: {
    title: 'Ecological Risk Distribution',
    description:
      'Posterior probabilities from forward propagation through the causal DAG (bnrrm-landis-causal v4.0). Each bar shows the probability of that risk level given all set evidence. Probabilities sum to 100%.',
  },

  cumulativeProbability: {
    title: 'Cumulative Probability',
    description:
      'P(Risk >= Moderate) combines moderate and high probabilities into a single screening metric. Values above 30-40% warrant closer review. This is useful for conservative screening — higher values indicate greater concern.',
  },

  sensitivityAnalysis: {
    title: 'Sensitivity Analysis',
    description:
      'Shows how much each substance or condition node affects the ecological_risk posterior. Each bar represents the change in P(high risk) when that node varies from its best (low) to worst (high) state, with all other evidence held fixed. Longer bars = more influential nodes.',
  },

  // ── NodeInspector ─────────────────────────────────────────────────────
  posteriorProbability: {
    title: 'Posterior Probability',
    description:
      "These bars show the posterior probability distribution for this node in the v4.0 causal DAG. When no evidence is set on this node, they reflect the influence of evidence on other connected nodes propagated through the causal structure. When evidence is set, one state shows 100%.",
  },

  // ── ModelOverview ─────────────────────────────────────────────────────
  looCrossValidation: {
    title: 'Leave-One-Out Cross-Validation',
    description:
      'Each of the 82 co-located stations is predicted using a model trained on all other stations. This provides an unbiased estimate of how the v4.0 causal DAG generalises to new stations.',
  },

  cohensKappa: {
    title: "Cohen's Kappa",
    description:
      'Measures agreement between the v4.0 posterior MAP state and observed ecological_risk, correcting for chance. Scale: <0.20 slight, 0.21-0.40 fair, 0.41-0.60 moderate, 0.61-0.80 substantial, 0.81-1.00 almost perfect. Current value reflects unweighted kappa; weighted kappa (penalising distant misclassifications more) is used for formal comparison.',
  },

  cohensKappaShort: {
    title: "Cohen's Kappa",
    description:
      'Agreement between predicted and observed ecological_risk, corrected for chance. Values: <0.20 slight, 0.21-0.40 fair, 0.41-0.60 moderate. Higher is better.',
  },

  precision: {
    title: 'Precision',
    description:
      'Of all stations the model predicted as this class, what fraction actually were this class. High precision means few false positives for this risk level.',
  },

  recall: {
    title: 'Recall',
    description:
      'Of all stations that actually were this class, what fraction did the model correctly identify. For high-risk screening, high recall means fewer missed high-risk stations.',
  },

  f1Score: {
    title: 'F1 Score',
    description:
      'Harmonic mean of precision and recall. Balances the trade-off between false positives (precision) and missed detections (recall). Range: 0 (worst) to 1 (perfect).',
  },

  support: {
    title: 'Support',
    description:
      'Number of stations in the LOO dataset that actually belong to this risk class. Low support (e.g. 8 moderate stations) limits the reliability of per-class metrics.',
  },

  triadReconciliation: {
    title: 'Triad Count Reconciliation',
    description:
      "'Co-located' = station has both chemistry and toxicity from the same sampling event (82 stations). 'Full triads' = station has chemistry + toxicity + community. Raw DB count is 36; 8 additional Woodfibre stations have 2006 chemistry merged with 2014 toxicity/community via Level C cross-year merge, giving 44 effective full triads.",
  },

  dagArchitectureTiers: {
    title: 'CPT Learning Tiers',
    description:
      "Each node's conditional probability table (CPT) is learned through a tiered strategy: Tier 1 uses Noisy-OR (data-fitted aggregation), Tier 2-3 blend BDeu counting with expert priors, Tier 4 relies primarily on expert elicitation. Higher tiers have less training data and more expert influence.",
  },

  // ── ValidationDashboard ───────────────────────────────────────────────
  confusionMatrix: {
    title: 'Confusion Matrix',
    description:
      'Rows = observed ecological_risk class. Columns = v4.0 posterior MAP state prediction. Green diagonal cells = correct classifications. Off-diagonal red cells = misclassifications. Larger numbers on the diagonal indicate better agreement.',
  },

  predicted: {
    title: 'Predicted',
    description:
      "The MAP (maximum a posteriori) state from the v4.0 causal DAG posterior for ecological_risk, computed via LOO cross-validation. This is the model's best estimate when this station's data is withheld from training.",
  },

  observed: {
    title: 'Observed',
    description:
      "The ecological_risk class derived from the station's actual chemistry, toxicity, and community data using a severity-based heuristic applied to the observed effect endpoints. This is a derived reference label, not a directly measured field value.",
  },

  accuracy: {
    title: 'Accuracy',
    description:
      'Fraction of stations where predicted class matches observed class. Inflated by class imbalance (69.5% of stations are low-risk). Always interpret alongside per-class metrics and kappa.',
  },

  highRiskRecall: {
    title: 'High-Risk Recall',
    description:
      'Fraction of truly high-risk stations that the model correctly identifies. Critical for conservative screening — a missed high-risk station is worse than a false alarm.',
  },

  // ── CptTransparency ───────────────────────────────────────────────────
  cptTransparency: {
    title: 'Conditional Probability Tables',
    description:
      "Each node in the v4.0 causal DAG has a CPT defining P(node state | parent states). CPTs are learned through a tiered strategy: Noisy-OR for substance aggregation, BDeu+Expert hybrid for bioavailability and effects, and expert-dominant for ecological_risk. This view shows the source, data coverage, and prior vs learned distributions for each node.",
  },

  configCoverage: (observed: number, possible: number, pct: number) => ({
    title: 'Configuration Coverage',
    description: `This node's CPT has ${possible} possible parent configurations. Only ${observed} have been observed in training data (${pct}%). Unobserved configurations rely entirely on the expert prior.`,
  }),

  cptLearningMethod: {
    title: 'CPT Learning Method',
    description:
      'Noisy-OR: data-fitted aggregation of parent contributions. Expert: elicited from domain knowledge. BDeu+Expert: Bayesian estimation blending data counts with expert prior, weighted by ESS. Hybrid: data-dominant where data exists, expert elsewhere.',
  },

  ess: {
    title: 'Effective Sample Size (ESS)',
    description:
      'Controls the weight of the expert prior relative to observed data. Higher ESS means stronger expert influence. At ESS=5, roughly 5 pseudo-observations from the expert prior are mixed with actual data counts.',
  },

  // ── RiskComparison ─────────────────────────────────────────────────────

  comparisonWeightedKappa: {
    title: 'Weighted Kappa',
    description:
      "Weighted Cohen's kappa (quadratic) measures ordinal agreement between BN-RRM and WOE, correcting for chance. Penalises distant misclassifications more heavily.",
  },

  comparisonUnweightedKappa: {
    title: 'Unweighted Kappa',
    description:
      "Unweighted Cohen's kappa — treats all disagreements equally regardless of ordinal distance.",
  },

  comparisonAgreement: {
    title: 'Agreement',
    description:
      'Simple proportion of matched stations where BN-RRM MAP class equals mapped WOE class. Inflated by class imbalance — interpret alongside kappa.',
  },

  comparisonConfusionMatrix: {
    title: 'Comparison Confusion Matrix',
    description:
      'Rows = mapped WOE classification. Columns = BN-RRM LOO MAP prediction. Diagonal = both methods agree. Off-diagonal = disagreement. This shows where the two methods diverge, not which is correct.',
  },

  comparisonPerClass: {
    title: 'Per-Class Metrics',
    description:
      "Precision/recall/F1 with BN-RRM prediction as 'test' and WOE as 'reference'. These measure per-class agreement between the two methods.",
  },

  // ── SiteReports ───────────────────────────────────────────────────────
  isqg: {
    title: 'ISQG',
    description:
      'CCME Interim Sediment Quality Guideline. Concentrations below ISQG are rarely associated with adverse biological effects. Used as the low/moderate discretization threshold in the v4.0 causal DAG.',
  },

  pel: {
    title: 'PEL',
    description:
      'CCME Probable Effect Level. Concentrations above PEL are frequently associated with adverse biological effects. Used as the moderate/high discretization threshold in the v4.0 causal DAG.',
  },

  spatialReferenceClasses: {
    title: 'Spatial Reference Classes',
    description:
      'EXACT: published coordinates from report tables. APPROXIMATE: digitised from figures via affine transform or satellite matching. RELATIVE: described by distance/direction only. ZONE: quadrant or general area only (coordinates not displayed). Class governs whether coordinates can be shown on the map.',
  },
} as const;
