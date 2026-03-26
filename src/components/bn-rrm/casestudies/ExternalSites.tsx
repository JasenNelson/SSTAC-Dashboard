'use client';

import { ExpandableSection } from '@/components/bn-rrm/shared/ExpandableSection';

export function ExternalSites() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">External Sites</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Non-training sites assessed via BN-RRM with descriptive comparison to report-stated risk
        </p>
      </div>

      {/* Status */}
      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6 text-center">
        <div className="text-slate-400 dark:text-slate-500 mb-3">
          <svg className="w-12 h-12 mx-auto opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">
          No external case studies yet
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto">
          External case studies will be added as non-training sites are identified from the
          PDF archive and assessed using the BN-RRM. Each case study requires complete
          provenance for both BN-RRM inputs and report-stated comparator labels.
        </p>
      </div>

      {/* Requirements */}
      <ExpandableSection title="Requirements for external case studies">
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            Before a non-training site can be added as a case study, the following must be satisfied:
          </p>
          <ul className="list-disc ml-5 space-y-1.5">
            <li>
              <strong>BN-RRM input data:</strong> Chemistry (metals, PAHs, PCBs), environmental
              conditions (TOC, grain size, sulfide binding), and effect data (toxicity, community)
              must be available with provenance.
            </li>
            <li>
              <strong>Report-stated risk:</strong> The consultant ERA report must contain an explicit
              risk conclusion (WOE, SQT, or other framework) with identifiable stations.
            </li>
            <li>
              <strong>Defensible mapping:</strong> Where the report uses a different risk
              classification system than the BN 3-class (Low/Moderate/High), either a defensible
              ordinal mapping must exist per the Comparison Governance specification, or the
              comparison must remain descriptive only with parallel labels.
            </li>
            <li>
              <strong>Provenance completeness:</strong> Every comparator label must include source
              document, page reference, extraction method, and extractor identity.
            </li>
          </ul>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
            Candidate sites are identified from the 464-site scout inventory and PDF archive.
            Data extraction follows the BN-RRM Extraction SOP. No data is imported without
            HITL validation.
          </p>
        </div>
      </ExpandableSection>

      {/* Candidate pipeline note */}
      <ExpandableSection title="Candidate identification pipeline">
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
          <p>
            A read-only inventory of 464 candidate sites has been scored by sediment document
            count, WOE/SQT presence, and data availability. The top candidates will be
            evaluated for case study suitability based on the requirements above.
          </p>
          <p>
            The first external case study candidate is Iron Mountain (Site 28553), which is
            currently under active HHERA review.
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Note: Adding a site as a case study does not add it to the BN-RRM training dataset.
            External site comparisons are descriptive only.
          </p>
        </div>
      </ExpandableSection>
    </div>
  );
}
