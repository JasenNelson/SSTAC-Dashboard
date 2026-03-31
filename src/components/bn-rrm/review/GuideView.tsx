'use client';

import { usePackArtifact } from '@/hooks/bn-rrm/usePackArtifact';
import { InfoTooltip } from '@/components/bn-rrm/shared/InfoTooltip';

// ---------------------------------------------------------------------------
// Types for the explainer artifact
// ---------------------------------------------------------------------------

interface ContaminationProfile {
  label: string;
  detail?: string;
}

interface SiteContextData {
  narrative: string;
  pathway: 'metals' | 'organic' | 'mixed';
  contamination_profile?: ContaminationProfile[] | string;
}

interface DataInventoryItem {
  data_type: string;
  status: 'available' | 'missing' | 'partial';
  notes?: string;
}

interface DataInventoryData {
  summary?: string;
  items: DataInventoryItem[];
}

interface TierEntry {
  tier: number | string;
  name: string;
  cpt_method: string;
  nodes?: string[];
}

interface OverrideCallout {
  label: string;
  description: string;
}

interface FittingApproachData {
  summary: string;
  tiers?: TierEntry[];
  overrides?: OverrideCallout[];
}

interface StationPrediction {
  station: string;
  observed: string;
  predicted: string;
  correct: boolean;
}

interface ResultsSummaryData {
  loo_accuracy?: number;
  loo_kappa?: number;
  loo_n?: number;
  predictions?: StationPrediction[];
}

interface MetricComparison {
  label: string;
  before: string | number;
  after: string | number;
}

interface BeforeAfterData {
  before_label?: string;
  after_label?: string;
  metrics: MetricComparison[];
}

interface ResidualOutlier {
  station: string;
  explanation: string;
  recommendation?: string;
}

interface GovernanceData {
  decisions?: string[];
  scope_notes?: string[];
}

interface HitlQuestion {
  question: string;
  context?: string;
}

interface ExplainerData {
  site_context?: SiteContextData;
  data_inventory?: DataInventoryData;
  fitting_approach?: FittingApproachData;
  results_summary?: ResultsSummaryData;
  before_after?: BeforeAfterData;
  residual_outliers?: ResidualOutlier[];
  governance?: GovernanceData;
  hitl_review_questions?: HitlQuestion[];
}

// ---------------------------------------------------------------------------
// Pathway badge
// ---------------------------------------------------------------------------

const PATHWAY_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  metals: {
    label: 'Metals pathway',
    bg: 'bg-slate-200 dark:bg-slate-600',
    text: 'text-slate-700 dark:text-slate-200',
  },
  organic: {
    label: 'Organic pathway',
    bg: 'bg-amber-200 dark:bg-amber-800',
    text: 'text-amber-800 dark:text-amber-200',
  },
  mixed: {
    label: 'Mixed pathway',
    bg: 'bg-purple-200 dark:bg-purple-800',
    text: 'text-purple-800 dark:text-purple-200',
  },
};

// ---------------------------------------------------------------------------
// Status indicator
// ---------------------------------------------------------------------------

function StatusDot({ status }: { status: string }) {
  if (status === 'available')
    return <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" title="Available" />;
  if (status === 'missing')
    return <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" title="Missing" />;
  return <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-400" title="Partial / Unknown" />;
}

// ---------------------------------------------------------------------------
// MAP color for prediction cells
// ---------------------------------------------------------------------------

function riskColor(risk: string): string {
  const r = risk.toLowerCase();
  if (r === 'low') return 'text-green-600 dark:text-green-400';
  if (r === 'moderate') return 'text-amber-600 dark:text-amber-400';
  if (r === 'high') return 'text-red-600 dark:text-red-400';
  return 'text-slate-600 dark:text-slate-400';
}

function riskBg(risk: string): string {
  const r = risk.toLowerCase();
  if (r === 'low') return 'bg-green-50 dark:bg-green-900/20';
  if (r === 'moderate') return 'bg-amber-50 dark:bg-amber-900/20';
  if (r === 'high') return 'bg-red-50 dark:bg-red-900/20';
  return '';
}

// ---------------------------------------------------------------------------
// Section card wrapper
// ---------------------------------------------------------------------------

function SectionCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 ${className ?? ''}`}
    >
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4">
        {title}
      </h3>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section renderers
// ---------------------------------------------------------------------------

function SiteContextSection({ data }: { data: SiteContextData }) {
  const badge = PATHWAY_BADGE[data.pathway] ?? PATHWAY_BADGE.mixed;
  return (
    <SectionCard title="Site Context">
      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
        {data.narrative}
      </p>
      <span
        className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}
      >
        {badge.label}
      </span>
      {data.contamination_profile && (
        typeof data.contamination_profile === 'string' ? (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{data.contamination_profile}</p>
        ) : Array.isArray(data.contamination_profile) && data.contamination_profile.length > 0 ? (
          <ul className="mt-3 space-y-1">
            {data.contamination_profile.map((item: any, i: number) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                <span className="text-slate-400 mt-0.5">&#8226;</span>
                <span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{item.label}</span>
                  {item.detail && <span className="ml-1">&#8212; {item.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        ) : null
      )}
    </SectionCard>
  );
}

function DataInventorySection({ data }: { data: DataInventoryData }) {
  return (
    <SectionCard title="Data Inventory">
      {data.summary && (
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{data.summary}</p>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700">
            <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Data Type</th>
            <th className="text-center py-2 font-medium text-slate-500 dark:text-slate-400">Status</th>
            <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Notes</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, i) => (
            <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
              <td className="py-2 text-slate-700 dark:text-slate-300">{item.data_type}</td>
              <td className="py-2 text-center">
                <StatusDot status={item.status} />
              </td>
              <td className="py-2 text-slate-500 dark:text-slate-400 text-xs">
                {item.notes ?? ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </SectionCard>
  );
}

function FittingApproachSection({ data }: { data: FittingApproachData }) {
  return (
    <SectionCard title="Fitting Approach">
      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
        {data.summary}
      </p>
      {data.tiers && data.tiers.length > 0 && (
        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Tier</th>
              <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Name</th>
              <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">CPT Method</th>
            </tr>
          </thead>
          <tbody>
            {data.tiers.map((tier, i) => (
              <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 text-slate-700 dark:text-slate-300 font-medium">T{tier.tier}</td>
                <td className="py-2 text-slate-600 dark:text-slate-400">{tier.name}</td>
                <td className="py-2 text-slate-600 dark:text-slate-400">{tier.cpt_method}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {data.overrides && data.overrides.length > 0 && (
        <div className="space-y-2">
          {data.overrides.map((ov, i) => (
            <div
              key={i}
              className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3"
            >
              <div className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">
                {ov.label}
              </div>
              <p className="text-sm text-amber-600 dark:text-amber-400">{ov.description}</p>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function ResultsSummarySection({ data }: { data: ResultsSummaryData }) {
  return (
    <SectionCard title="Results Summary">
      {/* LOO metrics row */}
      {(data.loo_accuracy !== undefined || data.loo_kappa !== undefined) && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          {data.loo_accuracy !== undefined && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                LOO Accuracy
              </div>
              <div className="text-2xl font-bold mt-1 text-slate-800 dark:text-slate-100">
                {(data.loo_accuracy * 100).toFixed(1)}%
              </div>
            </div>
          )}
          {data.loo_kappa !== undefined && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                LOO Kappa
              </div>
              <div className="text-2xl font-bold mt-1 text-slate-800 dark:text-slate-100">
                {data.loo_kappa.toFixed(3)}
              </div>
            </div>
          )}
          {data.loo_n !== undefined && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Sample Size
              </div>
              <div className="text-2xl font-bold mt-1 text-slate-800 dark:text-slate-100">
                n={data.loo_n}
              </div>
            </div>
          )}
        </div>
      )}
      {/* Per-station prediction table */}
      {data.predictions && data.predictions.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Station</th>
              <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Observed</th>
              <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Predicted (MAP)</th>
              <th className="text-center py-2 font-medium text-slate-500 dark:text-slate-400">Correct</th>
            </tr>
          </thead>
          <tbody>
            {data.predictions.map((p, i) => (
              <tr key={i} className={`border-b border-slate-100 dark:border-slate-800 ${riskBg(p.predicted)}`}>
                <td className="py-2 font-medium text-slate-700 dark:text-slate-300">{p.station}</td>
                <td className={`py-2 capitalize ${riskColor(p.observed)}`}>{p.observed}</td>
                <td className={`py-2 capitalize ${riskColor(p.predicted)}`}>{p.predicted}</td>
                <td className="py-2 text-center">
                  {p.correct ? (
                    <span className="text-green-600 dark:text-green-400">&#10003;</span>
                  ) : (
                    <span className="text-red-500 dark:text-red-400">&#10007;</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </SectionCard>
  );
}

function BeforeAfterSection({ data }: { data: BeforeAfterData }) {
  const beforeLabel = data.before_label ?? 'Before';
  const afterLabel = data.after_label ?? 'After';

  return (
    <SectionCard title="Before / After Comparison">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Before panel */}
        <div className="rounded-xl border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-4">
          <h4 className="text-sm font-semibold text-red-700 dark:text-red-300 mb-3">{beforeLabel}</h4>
          <div className="space-y-2">
            {data.metrics.map((m, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-red-600 dark:text-red-400">{m.label}</span>
                <span className="font-mono font-medium text-red-700 dark:text-red-300">{String(m.before)}</span>
              </div>
            ))}
          </div>
        </div>
        {/* After panel */}
        <div className="rounded-xl border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10 p-4">
          <h4 className="text-sm font-semibold text-green-700 dark:text-green-300 mb-3">{afterLabel}</h4>
          <div className="space-y-2">
            {data.metrics.map((m, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-green-600 dark:text-green-400">{m.label}</span>
                <span className="font-mono font-medium text-green-700 dark:text-green-300">{String(m.after)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function ResidualOutliersSection({ data }: { data: ResidualOutlier[] }) {
  return (
    <SectionCard title="Residual Outliers">
      <div className="space-y-3">
        {data.map((item, i) => (
          <div
            key={i}
            className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4"
          >
            <div className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">
              {item.station}
            </div>
            <p className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
              {item.explanation}
            </p>
            {item.recommendation && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 italic">
                Recommendation: {item.recommendation}
              </p>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function GovernanceSection({ data }: { data: GovernanceData }) {
  return (
    <SectionCard title="Governance">
      {data.decisions && data.decisions.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider mb-2">
            HITL Decisions
          </h4>
          <div className="space-y-2">
            {data.decisions.map((d, i) => (
              <div
                key={i}
                className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-200"
              >
                {d}
              </div>
            ))}
          </div>
        </div>
      )}
      {data.scope_notes && data.scope_notes.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider mb-2">
            Scope Notes
          </h4>
          <div className="space-y-2">
            {data.scope_notes.map((n, i) => (
              <div
                key={i}
                className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-200"
              >
                {n}
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function HitlReviewQuestionsSection({ data }: { data: HitlQuestion[] }) {
  return (
    <SectionCard title="HITL Review Questions">
      <ol className="space-y-4">
        {data.map((q, i) => (
          <li key={i} className="flex gap-3">
            <span className="shrink-0 w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-300">
              {i + 1}
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                {q.question}
              </p>
              {q.context && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{q.context}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function GuideView() {
  const { data, loading, error } = usePackArtifact<ExplainerData>('explainer');

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
          <span>Loading guide...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center max-w-md">
          <div className="text-slate-400 dark:text-slate-500 text-3xl mb-3">&#128214;</div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Guide not available
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {error ?? 'The explainer artifact is not available for this pack. It will be generated during the next model build.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-1">
          Step-by-Step Model Review
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
          This guide walks through the model construction, data inputs, fitting decisions, and results
          in a narrative format designed for expert review.
        </p>
      </div>

      {data.site_context && <SiteContextSection data={data.site_context} />}
      {data.data_inventory && <DataInventorySection data={data.data_inventory} />}
      {data.fitting_approach && <FittingApproachSection data={data.fitting_approach} />}
      {data.results_summary && <ResultsSummarySection data={data.results_summary} />}
      {data.before_after && <BeforeAfterSection data={data.before_after} />}
      {data.residual_outliers && data.residual_outliers.length > 0 && (
        <ResidualOutliersSection data={data.residual_outliers} />
      )}
      {data.governance && <GovernanceSection data={data.governance} />}
      {data.hitl_review_questions && data.hitl_review_questions.length > 0 && (
        <HitlReviewQuestionsSection data={data.hitl_review_questions} />
      )}
    </div>
  );
}
