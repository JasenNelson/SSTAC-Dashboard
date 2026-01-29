/**
 * Interim Technical Memo Generator
 *
 * Generates export content (Markdown/HTML) for regulatory review assessments.
 * Supports configurable options for format, content inclusion, and filtering.
 */

// Types for local Assessment model (from page.tsx)
export interface LocalAssessment {
  id: string;
  policyId: string;
  citationLabel?: string;
  policyTitle: string;
  section: string;
  tier: 'TIER_1_BINARY' | 'TIER_2_PROFESSIONAL' | 'TIER_3_STATUTORY';
  status: 'pass' | 'fail' | 'pending' | 'flagged';
  evidence: string[];
  notes: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

export interface LocalJudgment {
  humanResult?: 'ACCEPT' | 'OVERRIDE_PASS' | 'OVERRIDE_FAIL' | 'DEFER' | 'NOT_APPLICABLE';
  humanConfidence?: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  judgmentNotes?: string;
  overrideReason?: string;
  evidenceSufficiency?: 'SUFFICIENT' | 'INSUFFICIENT' | 'NEEDS_MORE_EVIDENCE' | 'UNREVIEWED';
  includeInFinal?: boolean;
  finalMemoSummary?: string;
  followUpNeeded?: boolean;
  reviewedAt?: string;
  reviewerName?: string;
  reviewStatus?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'DEFERRED';
}

export interface ExportOptions {
  format: 'markdown' | 'html' | 'csv' | 'word';
  memoType: 'interim' | 'final';
  includePending: boolean;
  twoColumnFormat: boolean;
  includeEvidence: boolean;
  onlyNeedsAttention: boolean;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface MemoData {
  submissionId: string;
  siteId?: string;
  assessments: LocalAssessment[];
  judgments: Map<string, LocalJudgment>;
}

export interface MemoStats {
  total: number;
  reviewed: number;
  pending: number;
  deferred: number;
  sufficient: number;
  insufficient: number;
  needsMoreEvidence: number;
  unreviewed: number;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format tier name for display
 */
function formatTierDisplay(tier: LocalAssessment['tier']): string {
  const tierMap: Record<LocalAssessment['tier'], string> = {
    TIER_1_BINARY: 'TIER_1_BINARY',
    TIER_2_PROFESSIONAL: 'TIER_2_PROFESSIONAL',
    TIER_3_STATUTORY: 'TIER_3_STATUTORY',
  };
  return tierMap[tier];
}

/**
 * Format status for display
 */
function formatStatusDisplay(status: LocalAssessment['status']): string {
  const statusMap: Record<LocalAssessment['status'], string> = {
    pass: 'PASS',
    fail: 'FAIL',
    pending: 'REQUIRES_JUDGMENT',
    flagged: 'PARTIAL',
  };
  return statusMap[status];
}

/**
 * Format human result for display
 */
function formatHumanResultDisplay(result?: LocalJudgment['humanResult']): string {
  if (!result) return 'Pending';
  const resultMap: Record<NonNullable<LocalJudgment['humanResult']>, string> = {
    ACCEPT: 'Accept',
    OVERRIDE_PASS: 'Override - Pass',
    OVERRIDE_FAIL: 'Override - Fail',
    DEFER: 'Deferred',
    NOT_APPLICABLE: 'Not Applicable',
  };
  return resultMap[result];
}

/**
 * Format evidence sufficiency for display
 */
function formatSufficiencyDisplay(status?: LocalJudgment['evidenceSufficiency']): string {
  const normalized = status || 'UNREVIEWED';
  const map: Record<NonNullable<LocalJudgment['evidenceSufficiency']>, string> = {
    SUFFICIENT: 'Sufficient',
    INSUFFICIENT: 'Insufficient',
    NEEDS_MORE_EVIDENCE: 'Needs More Evidence',
    UNREVIEWED: 'Unreviewed',
  };
  return map[normalized];
}

function getCitationDisplay(assessment: LocalAssessment): {
  label: string;
  internalId: string;
  showInternalId: boolean;
} {
  const label = assessment.citationLabel || assessment.policyId;
  return {
    label,
    internalId: assessment.policyId,
    showInternalId: Boolean(
      assessment.citationLabel && assessment.citationLabel !== assessment.policyId
    ),
  };
}

function getMemoTitle(memoType: ExportOptions['memoType']): string {
  return memoType === 'final' ? 'Final Technical Memo' : 'Interim Technical Memo';
}

/**
 * Get current date in ISO format
 */
function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Escape special characters for markdown
 */
function escapeMarkdown(text: string): string {
  return text
    .replace(/\|/g, '\\|')
    .replace(/\n/g, ' ')
    .trim();
}

/**
 * Escape special characters for HTML
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================================
// Statistics Calculation
// ============================================================================

/**
 * Calculate summary statistics from assessments and judgments
 */
export function calculateStats(
  assessments: LocalAssessment[],
  judgments: Map<string, LocalJudgment>
): MemoStats {
  let reviewed = 0;
  let pending = 0;
  let deferred = 0;
  let sufficient = 0;
  let insufficient = 0;
  let needsMoreEvidence = 0;
  let unreviewed = 0;

  for (const assessment of assessments) {
    const judgment = judgments.get(assessment.id);
    const sufficiency = judgment?.evidenceSufficiency || 'UNREVIEWED';

    // Count by review status
    if (judgment?.reviewStatus === 'DEFERRED' || judgment?.humanResult === 'DEFER') {
      deferred++;
    }

    if (sufficiency === 'UNREVIEWED') {
      pending++;
      unreviewed++;
    } else {
      reviewed++;
      switch (sufficiency) {
        case 'SUFFICIENT':
          sufficient++;
          break;
        case 'INSUFFICIENT':
          insufficient++;
          break;
        case 'NEEDS_MORE_EVIDENCE':
          needsMoreEvidence++;
          break;
      }
    }
  }

  return {
    total: assessments.length,
    reviewed,
    pending,
    deferred,
    sufficient,
    insufficient,
    needsMoreEvidence,
    unreviewed,
  };
}

// ============================================================================
// Filter Assessments
// ============================================================================

/**
 * Filter assessments based on export options
 */
export function filterAssessments(
  assessments: LocalAssessment[],
  judgments: Map<string, LocalJudgment>,
  options: ExportOptions
): LocalAssessment[] {
  return assessments.filter((assessment) => {
    const judgment = judgments.get(assessment.id);

    if (options.memoType === 'final' && !judgment?.includeInFinal) {
      return false;
    }

    // Filter: include pending items
    if (!options.includePending) {
      const isReviewed = judgment?.reviewStatus === 'COMPLETED';
      if (!isReviewed) return false;
    }

    // Filter: only items needing attention (FAIL or REQUIRES_JUDGMENT status)
    if (options.onlyNeedsAttention) {
      const needsAttention =
        assessment.status === 'fail' ||
        assessment.status === 'pending' ||
        assessment.status === 'flagged';
      if (!needsAttention) return false;
    }

    // Filter: date range
    if (options.dateFrom || options.dateTo) {
      const reviewDate = judgment?.reviewedAt
        ? new Date(judgment.reviewedAt)
        : assessment.reviewedAt
          ? new Date(assessment.reviewedAt)
          : null;

      if (reviewDate) {
        if (options.dateFrom && reviewDate < options.dateFrom) return false;
        if (options.dateTo && reviewDate > options.dateTo) return false;
      } else if (options.dateFrom || options.dateTo) {
        // If no review date but date filter is set, exclude
        return false;
      }
    }

    return true;
  });
}

// ============================================================================
// Markdown Generation
// ============================================================================

/**
 * Generate Markdown format memo
 */
export function generateMarkdown(
  data: MemoData,
  options: ExportOptions
): string {
  const filteredAssessments = filterAssessments(
    data.assessments,
    data.judgments,
    options
  );
  const stats = calculateStats(filteredAssessments, data.judgments);
  const memoTitle = getMemoTitle(options.memoType);

  const lines: string[] = [];

  // Header
  lines.push(`# ${memoTitle} - ${data.submissionId}`);
  lines.push('');
  if (data.siteId) {
    lines.push(`**Site:** ${data.siteId}`);
  }
  lines.push(`**Date:** ${getCurrentDate()}`);
  lines.push(`**Status:** Draft - Pending Human Review`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Total Items: ${stats.total}`);
  lines.push(`- Reviewed: ${stats.reviewed} (${stats.total > 0 ? Math.round((stats.reviewed / stats.total) * 100) : 0}%)`);
  lines.push(`- Pending: ${stats.pending}`);
  lines.push(`- Deferred: ${stats.deferred}`);
  lines.push('');
  lines.push('### Evidence Sufficiency Distribution');
  lines.push('');
  lines.push(`- Sufficient: ${stats.sufficient}`);
  lines.push(`- Needs More Evidence: ${stats.needsMoreEvidence}`);
  lines.push(`- Insufficient: ${stats.insufficient}`);
  lines.push(`- Unreviewed: ${stats.unreviewed}`);
  lines.push('');

  // Assessments section header
  if (options.onlyNeedsAttention) {
    lines.push('## Assessments Requiring Attention');
  } else {
    lines.push('## All Assessments');
  }
  lines.push('');

  // Individual assessments
  for (const assessment of filteredAssessments) {
    const judgment = data.judgments.get(assessment.id);
    const sufficiencyLabel = formatSufficiencyDisplay(judgment?.evidenceSufficiency);
    const citation = getCitationDisplay(assessment);

    lines.push(`### ${citation.label} - ${assessment.section}`);
    if (citation.showInternalId) {
      lines.push(`**Internal ID:** ${citation.internalId}`);
    }
    lines.push(`**AI Proposed Status:** ${formatStatusDisplay(assessment.status)} | **Tier:** ${formatTierDisplay(assessment.tier)}`);
    lines.push('');
    lines.push(`**Policy:** ${assessment.policyTitle}`);
    lines.push('');

    if (options.memoType === 'final') {
      lines.push('**Reviewer Summary (Final Memo):**');
      lines.push(judgment?.finalMemoSummary || judgment?.judgmentNotes || 'Summary not provided.');
      lines.push('');
      lines.push(`**Evidence Sufficiency (Reviewer):** ${sufficiencyLabel}`);
      if (judgment?.reviewerName) {
        lines.push(`**Reviewer:** ${judgment.reviewerName}`);
      }
      lines.push('');
    } else if (options.twoColumnFormat) {
      // Two-column format (AI | Reviewer)
      lines.push('| AI Assessment | Reviewer Assessment |');
      lines.push('|---------------|---------------------|');
      lines.push(`| Status: ${formatStatusDisplay(assessment.status)} | Evidence Sufficiency: ${sufficiencyLabel} |`);
      lines.push(`| Evidence: ${assessment.evidence.length} items found | Notes: ${escapeMarkdown(judgment?.judgmentNotes || 'N/A')} |`);
      if (judgment?.finalMemoSummary) {
        lines.push(`| - | Final Memo Summary: ${escapeMarkdown(judgment.finalMemoSummary)} |`);
      }
      if (judgment?.overrideReason) {
        lines.push(`| - | Override Reason: ${escapeMarkdown(judgment.overrideReason)} |`);
      }
      lines.push('');
    } else {
      // Single column format
      lines.push('**AI Assessment:**');
      lines.push(`- Status: ${formatStatusDisplay(assessment.status)}`);
      lines.push(`- Evidence Items: ${assessment.evidence.length}`);
      if (assessment.notes) {
        lines.push(`- Notes: ${assessment.notes}`);
      }
      lines.push('');

      lines.push('**Reviewer Assessment:**');
      lines.push(`- Evidence Sufficiency: ${formatSufficiencyDisplay(judgment?.evidenceSufficiency)}`);
      if (judgment?.judgmentNotes) {
        lines.push(`- Notes: ${judgment.judgmentNotes}`);
      }
      if (judgment?.finalMemoSummary) {
        lines.push(`- Final Memo Summary: ${judgment.finalMemoSummary}`);
      }
      if (judgment?.includeInFinal !== undefined) {
        lines.push(`- Include-in-Final: ${judgment.includeInFinal ? 'Yes' : 'No'}`);
      }
      if (judgment?.followUpNeeded !== undefined) {
        lines.push(`- Follow-up Needed: ${judgment.followUpNeeded ? 'Yes' : 'No'}`);
      }
      if (judgment?.reviewerName) {
        lines.push(`- Reviewer: ${judgment.reviewerName}`);
      }
      if (judgment?.reviewedAt) {
        lines.push(`- Reviewed: ${new Date(judgment.reviewedAt).toLocaleDateString()}`);
      }
      lines.push('');
    }

    // Evidence section
    if (options.includeEvidence && assessment.evidence.length > 0) {
      lines.push('**Evidence:**');
      for (const item of assessment.evidence) {
        lines.push(`- ${item}`);
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  // Footer
  lines.push('');
  lines.push('---');
  lines.push(`*Generated: ${new Date().toISOString()}*`);
  lines.push('*SSTAC Dashboard - Regulatory Review Module*');

  return lines.join('\n');
}

// ============================================================================
// HTML Generation
// ============================================================================

/**
 * Generate HTML format memo
 */
export function generateHTML(
  data: MemoData,
  options: ExportOptions
): string {
  const filteredAssessments = filterAssessments(
    data.assessments,
    data.judgments,
    options
  );
  const stats = calculateStats(filteredAssessments, data.judgments);
  const memoTitle = getMemoTitle(options.memoType);

  const html: string[] = [];

  // Document start
  html.push('<!DOCTYPE html>');
  html.push('<html lang="en">');
  html.push('<head>');
  html.push('  <meta charset="UTF-8">');
  html.push('  <meta name="viewport" content="width=device-width, initial-scale=1.0">');
  html.push(`  <title>${escapeHtml(memoTitle)} - ${escapeHtml(data.submissionId)}</title>`);
  html.push('  <style>');
  html.push('    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; max-width: 900px; margin: 0 auto; padding: 2rem; color: #333; }');
  html.push('    h1 { color: #1a365d; border-bottom: 2px solid #3182ce; padding-bottom: 0.5rem; }');
  html.push('    h2 { color: #2d3748; margin-top: 2rem; }');
  html.push('    h3 { color: #4a5568; margin-top: 1.5rem; }');
  html.push('    .meta { color: #718096; margin-bottom: 0.5rem; }');
  html.push('    .status-draft { background: #fef3c7; color: #92400e; padding: 0.25rem 0.75rem; border-radius: 4px; font-weight: 500; display: inline-block; }');
  html.push('    .summary-box { background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; margin: 1rem 0; }');
  html.push('    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin: 1rem 0; }');
  html.push('    .stat-item { text-align: center; padding: 0.75rem; background: white; border-radius: 4px; border: 1px solid #e2e8f0; }');
  html.push('    .stat-value { font-size: 1.5rem; font-weight: 700; color: #2d3748; }');
  html.push('    .stat-label { font-size: 0.875rem; color: #718096; }');
  html.push('    .assessment-card { border: 1px solid #e2e8f0; border-radius: 8px; margin: 1rem 0; overflow: hidden; }');
  html.push('    .assessment-header { background: #edf2f7; padding: 0.75rem 1rem; border-bottom: 1px solid #e2e8f0; }');
  html.push('    .assessment-body { padding: 1rem; }');
  html.push('    .badge { display: inline-block; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; margin-right: 0.5rem; }');
  html.push('    .badge-pass { background: #c6f6d5; color: #22543d; }');
  html.push('    .badge-fail { background: #fed7d7; color: #822727; }');
  html.push('    .badge-pending { background: #fef3c7; color: #92400e; }');
  html.push('    .badge-tier1 { background: #bee3f8; color: #2a4365; }');
  html.push('    .badge-tier2 { background: #e9d8fd; color: #553c9a; }');
  html.push('    .badge-tier3 { background: #fed7d7; color: #822727; }');
  html.push('    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }');
  html.push('    th, td { border: 1px solid #e2e8f0; padding: 0.75rem; text-align: left; }');
  html.push('    th { background: #f7fafc; font-weight: 600; }');
  html.push('    .evidence-list { list-style-type: disc; padding-left: 1.5rem; margin: 0.5rem 0; }');
  html.push('    .evidence-list li { margin: 0.25rem 0; color: #4a5568; }');
  html.push('    hr { border: none; border-top: 1px solid #e2e8f0; margin: 1.5rem 0; }');
  html.push('    .footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e2e8f0; color: #718096; font-size: 0.875rem; }');
  html.push('    @media print { body { max-width: none; } .assessment-card { break-inside: avoid; } }');
  html.push('  </style>');
  html.push('</head>');
  html.push('<body>');

  // Header
  html.push(`  <h1>${escapeHtml(memoTitle)} - ${escapeHtml(data.submissionId)}</h1>`);
  if (data.siteId) {
    html.push(`  <p class="meta"><strong>Site:</strong> ${escapeHtml(data.siteId)}</p>`);
  }
  html.push(`  <p class="meta"><strong>Date:</strong> ${getCurrentDate()}</p>`);
  html.push('  <p class="meta"><span class="status-draft">Draft - Pending Human Review</span></p>');

  // Summary
  html.push('  <h2>Summary</h2>');
  html.push('  <div class="summary-box">');
  html.push('    <div class="stats-grid">');
  html.push(`      <div class="stat-item"><div class="stat-value">${stats.total}</div><div class="stat-label">Total Items</div></div>`);
  html.push(`      <div class="stat-item"><div class="stat-value">${stats.reviewed}</div><div class="stat-label">Reviewed</div></div>`);
  html.push(`      <div class="stat-item"><div class="stat-value">${stats.pending}</div><div class="stat-label">Pending</div></div>`);
  html.push(`      <div class="stat-item"><div class="stat-value">${stats.deferred}</div><div class="stat-label">Deferred</div></div>`);
  html.push('    </div>');
  html.push('    <h3 style="margin-top: 1rem;">Evidence Sufficiency Distribution</h3>');
  html.push('    <div class="stats-grid">');
  html.push(`      <div class="stat-item"><div class="stat-value" style="color: #22543d;">${stats.sufficient}</div><div class="stat-label">Sufficient</div></div>`);
  html.push(`      <div class="stat-item"><div class="stat-value" style="color: #92400e;">${stats.needsMoreEvidence}</div><div class="stat-label">Needs More Evidence</div></div>`);
  html.push(`      <div class="stat-item"><div class="stat-value" style="color: #822727;">${stats.insufficient}</div><div class="stat-label">Insufficient</div></div>`);
  html.push(`      <div class="stat-item"><div class="stat-value" style="color: #4a5568;">${stats.unreviewed}</div><div class="stat-label">Unreviewed</div></div>`);
  html.push('    </div>');
  html.push('  </div>');

  // Assessments section
  if (options.onlyNeedsAttention) {
    html.push('  <h2>Assessments Requiring Attention</h2>');
  } else {
    html.push('  <h2>All Assessments</h2>');
  }

  // Individual assessments
  for (const assessment of filteredAssessments) {
    const judgment = data.judgments.get(assessment.id);
    const citation = getCitationDisplay(assessment);
    const sufficiencyLabel = formatSufficiencyDisplay(judgment?.evidenceSufficiency);

    const statusBadgeClass = {
      pass: 'badge-pass',
      fail: 'badge-fail',
      pending: 'badge-pending',
      flagged: 'badge-pending',
    }[assessment.status];

    const tierBadgeClass = {
      TIER_1_BINARY: 'badge-tier1',
      TIER_2_PROFESSIONAL: 'badge-tier2',
      TIER_3_STATUTORY: 'badge-tier3',
    }[assessment.tier];

    html.push('  <div class="assessment-card">');
    html.push('    <div class="assessment-header">');
    html.push(`      <strong>${escapeHtml(citation.label)}</strong> - ${escapeHtml(assessment.section)}`);
    html.push(`      <span class="badge ${statusBadgeClass}">${formatStatusDisplay(assessment.status)}</span>`);
    html.push(`      <span class="badge ${tierBadgeClass}">${formatTierDisplay(assessment.tier)}</span>`);
    html.push('    </div>');
    html.push('    <div class="assessment-body">');
    if (citation.showInternalId) {
      html.push(`      <p><strong>Internal ID:</strong> ${escapeHtml(citation.internalId)}</p>`);
    }
    html.push(`      <p><strong>Policy:</strong> ${escapeHtml(assessment.policyTitle)}</p>`);

    if (options.memoType === 'final') {
      html.push('      <h4>Reviewer Summary (Final Memo)</h4>');
      html.push(`      <p>${escapeHtml(judgment?.finalMemoSummary || judgment?.judgmentNotes || 'Summary not provided.')}</p>`);
      html.push('      <ul>');
      html.push(`        <li>Evidence Sufficiency: ${escapeHtml(sufficiencyLabel)}</li>`);
      if (judgment?.reviewerName) {
        html.push(`        <li>Reviewer: ${escapeHtml(judgment.reviewerName)}</li>`);
      }
      html.push('      </ul>');
    } else if (options.twoColumnFormat) {
      // Two-column table format
      html.push('      <table>');
      html.push('        <thead>');
      html.push('          <tr><th>AI Assessment</th><th>Reviewer Assessment</th></tr>');
      html.push('        </thead>');
      html.push('        <tbody>');
      html.push(`          <tr><td>Status: ${formatStatusDisplay(assessment.status)}</td><td>Evidence Sufficiency: ${escapeHtml(sufficiencyLabel)}</td></tr>`);
      html.push(`          <tr><td>Evidence: ${assessment.evidence.length} items found</td><td>Notes: ${escapeHtml(judgment?.judgmentNotes || 'N/A')}</td></tr>`);
      if (judgment?.finalMemoSummary) {
        html.push(`          <tr><td>-</td><td>Final Memo Summary: ${escapeHtml(judgment.finalMemoSummary)}</td></tr>`);
      }
      if (judgment?.overrideReason) {
        html.push(`          <tr><td>-</td><td>Override Reason: ${escapeHtml(judgment.overrideReason)}</td></tr>`);
      }
      html.push('        </tbody>');
      html.push('      </table>');
    } else {
      // Single column format
      html.push('      <h4>AI Assessment</h4>');
      html.push('      <ul>');
      html.push(`        <li>Status: ${formatStatusDisplay(assessment.status)}</li>`);
      html.push(`        <li>Evidence Items: ${assessment.evidence.length}</li>`);
      if (assessment.notes) {
        html.push(`        <li>Notes: ${escapeHtml(assessment.notes)}</li>`);
      }
      html.push('      </ul>');

      html.push('      <h4>Reviewer Assessment</h4>');
      html.push('      <ul>');
      html.push(`        <li>Evidence Sufficiency: ${escapeHtml(sufficiencyLabel)}</li>`);
      if (judgment?.judgmentNotes) {
        html.push(`        <li>Notes: ${escapeHtml(judgment.judgmentNotes)}</li>`);
      }
      if (judgment?.finalMemoSummary) {
        html.push(`        <li>Final Memo Summary: ${escapeHtml(judgment.finalMemoSummary)}</li>`);
      }
      if (judgment?.includeInFinal !== undefined) {
        html.push(`        <li>Include-in-Final: ${judgment.includeInFinal ? 'Yes' : 'No'}</li>`);
      }
      if (judgment?.followUpNeeded !== undefined) {
        html.push(`        <li>Follow-up Needed: ${judgment.followUpNeeded ? 'Yes' : 'No'}</li>`);
      }
      if (judgment?.reviewerName) {
        html.push(`        <li>Reviewer: ${escapeHtml(judgment.reviewerName)}</li>`);
      }
      if (judgment?.reviewedAt) {
        html.push(`        <li>Reviewed: ${new Date(judgment.reviewedAt).toLocaleDateString()}</li>`);
      }
      html.push('      </ul>');
    }

    // Evidence section
    if (options.includeEvidence && assessment.evidence.length > 0) {
      html.push('      <h4>Evidence</h4>');
      html.push('      <ul class="evidence-list">');
      for (const item of assessment.evidence) {
        html.push(`        <li>${escapeHtml(item)}</li>`);
      }
      html.push('      </ul>');
    }

    html.push('    </div>');
    html.push('  </div>');
  }

  // Footer
  html.push('  <div class="footer">');
  html.push(`    <p><em>Generated: ${new Date().toISOString()}</em></p>`);
  html.push('    <p>SSTAC Dashboard - Regulatory Review Module</p>');
  html.push('  </div>');

  html.push('</body>');
  html.push('</html>');

  return html.join('\n');
}

// ============================================================================
// CSV Generation
// ============================================================================

/**
 * Escape CSV field (handle commas, quotes, newlines)
 */
function escapeCSV(text: string): string {
  if (!text) return '';
  // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * Generate CSV format for Excel
 */
export function generateCSV(
  data: MemoData,
  options: ExportOptions
): string {
  const filteredAssessments = filterAssessments(
    data.assessments,
    data.judgments,
    options
  );

  const rows: string[] = [];

  // Header row
  const headers = [
    'CSAP ID',
    'Citation Label',
    'Section',
    'Tier',
    'AI Result',
    'Evidence Sufficiency',
    'Human Decision',
    'Human Confidence',
    'Policy Question',
    'Evidence Count',
    'Judgment Notes',
    'Final Memo Summary',
    'Include-in-Final',
    'Follow-up Needed',
    'Override Reason',
    'Reviewer',
    'Review Date',
  ];
  rows.push(headers.join(','));

  // Data rows
  for (const assessment of filteredAssessments) {
    const judgment = data.judgments.get(assessment.id);

    const row = [
      escapeCSV(assessment.policyId),
      escapeCSV(assessment.citationLabel || ''),
      escapeCSV(assessment.section),
      escapeCSV(formatTierDisplay(assessment.tier)),
      escapeCSV(formatStatusDisplay(assessment.status)),
      escapeCSV(formatSufficiencyDisplay(judgment?.evidenceSufficiency)),
      escapeCSV(formatHumanResultDisplay(judgment?.humanResult)),
      escapeCSV(judgment?.humanConfidence || ''),
      escapeCSV(assessment.policyTitle),
      String(assessment.evidence.length),
      escapeCSV(judgment?.judgmentNotes || ''),
      escapeCSV(judgment?.finalMemoSummary || ''),
      judgment?.includeInFinal === undefined ? '' : (judgment.includeInFinal ? 'Yes' : 'No'),
      judgment?.followUpNeeded === undefined ? '' : (judgment.followUpNeeded ? 'Yes' : 'No'),
      escapeCSV(judgment?.overrideReason || ''),
      escapeCSV(judgment?.reviewerName || ''),
      judgment?.reviewedAt ? new Date(judgment.reviewedAt).toLocaleDateString() : '',
    ];
    rows.push(row.join(','));
  }

  return rows.join('\n');
}

// ============================================================================
// Word-Compatible HTML Generation
// ============================================================================

/**
 * Generate Word-compatible HTML (.doc format)
 * Uses mso-specific styles that Word understands
 */
export function generateWordHTML(
  data: MemoData,
  options: ExportOptions
): string {
  const filteredAssessments = filterAssessments(
    data.assessments,
    data.judgments,
    options
  );
  const stats = calculateStats(filteredAssessments, data.judgments);
  const memoTitle = getMemoTitle(options.memoType);

  const html: string[] = [];

  // Word-compatible HTML header with mso styles
  html.push('<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">');
  html.push('<head>');
  html.push('<meta charset="UTF-8">');
  html.push(`<title>${escapeHtml(memoTitle)} - ${escapeHtml(data.submissionId)}</title>`);
  html.push('<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->');
  html.push('<style>');
  html.push('  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.5; margin: 1in; }');
  html.push('  h1 { font-size: 18pt; color: #1F4E79; border-bottom: 2pt solid #1F4E79; padding-bottom: 6pt; }');
  html.push('  h2 { font-size: 14pt; color: #2E75B6; margin-top: 18pt; }');
  html.push('  h3 { font-size: 12pt; color: #404040; margin-top: 12pt; }');
  html.push('  table { border-collapse: collapse; width: 100%; margin: 12pt 0; }');
  html.push('  th, td { border: 1pt solid #D9D9D9; padding: 6pt 8pt; text-align: left; vertical-align: top; }');
  html.push('  th { background-color: #F2F2F2; font-weight: bold; }');
  html.push('  .pass { background-color: #C6EFCE; color: #006100; padding: 2pt 6pt; }');
  html.push('  .fail { background-color: #FFC7CE; color: #9C0006; padding: 2pt 6pt; }');
  html.push('  .pending { background-color: #FFEB9C; color: #9C5700; padding: 2pt 6pt; }');
  html.push('  .meta { color: #666666; margin-bottom: 6pt; }');
  html.push('  .footer { margin-top: 24pt; padding-top: 12pt; border-top: 1pt solid #D9D9D9; color: #808080; font-size: 9pt; }');
  html.push('  ul { margin: 6pt 0; padding-left: 24pt; }');
  html.push('  li { margin: 3pt 0; }');
  html.push('</style>');
  html.push('</head>');
  html.push('<body>');

  // Header
  html.push(`<h1>${escapeHtml(memoTitle)}</h1>`);
  html.push(`<p class="meta"><strong>Submission:</strong> ${escapeHtml(data.submissionId)}</p>`);
  if (data.siteId) {
    html.push(`<p class="meta"><strong>Site:</strong> ${escapeHtml(data.siteId)}</p>`);
  }
  html.push(`<p class="meta"><strong>Date:</strong> ${getCurrentDate()}</p>`);
  html.push(`<p class="meta"><strong>Status:</strong> Draft - Pending Human Review</p>`);

  // Summary table
  html.push('<h2>Summary</h2>');
  html.push('<table>');
  html.push('<tr><th>Metric</th><th>Count</th><th>Percentage</th></tr>');
  html.push(`<tr><td>Total Items</td><td>${stats.total}</td><td>100%</td></tr>`);
  html.push(`<tr><td>Reviewed</td><td>${stats.reviewed}</td><td>${stats.total > 0 ? Math.round((stats.reviewed / stats.total) * 100) : 0}%</td></tr>`);
  html.push(`<tr><td>Pending</td><td>${stats.pending}</td><td>${stats.total > 0 ? Math.round((stats.pending / stats.total) * 100) : 0}%</td></tr>`);
  html.push(`<tr><td>Deferred</td><td>${stats.deferred}</td><td>${stats.total > 0 ? Math.round((stats.deferred / stats.total) * 100) : 0}%</td></tr>`);
  html.push('</table>');

  html.push('<h3>Evidence Sufficiency Distribution</h3>');
  html.push('<table>');
  html.push('<tr><th>Result</th><th>Count</th></tr>');
  html.push(`<tr><td><span class="pass">SUFFICIENT</span></td><td>${stats.sufficient}</td></tr>`);
  html.push(`<tr><td><span class="pending">NEEDS MORE EVIDENCE</span></td><td>${stats.needsMoreEvidence}</td></tr>`);
  html.push(`<tr><td><span class="fail">INSUFFICIENT</span></td><td>${stats.insufficient}</td></tr>`);
  html.push(`<tr><td>UNREVIEWED</td><td>${stats.unreviewed}</td></tr>`);
  html.push('</table>');

  // Assessments
  html.push(`<h2>${options.onlyNeedsAttention ? 'Assessments Requiring Attention' : 'All Assessments'}</h2>`);

  for (const assessment of filteredAssessments) {
    const judgment = data.judgments.get(assessment.id);
    const statusClass = assessment.status === 'pass' ? 'pass' : assessment.status === 'fail' ? 'fail' : 'pending';
    const sufficiencyLabel = formatSufficiencyDisplay(judgment?.evidenceSufficiency);
    const citation = getCitationDisplay(assessment);

    html.push(`<h3>${escapeHtml(citation.label)} - ${escapeHtml(assessment.section)}</h3>`);
    if (citation.showInternalId) {
      html.push(`<p><strong>Internal ID:</strong> ${escapeHtml(citation.internalId)}</p>`);
    }
    html.push(`<p><strong>AI Proposed Status:</strong> <span class="${statusClass}">${formatStatusDisplay(assessment.status)}</span> | <strong>Tier:</strong> ${formatTierDisplay(assessment.tier)}</p>`);
    html.push(`<p><strong>Policy:</strong> ${escapeHtml(assessment.policyTitle)}</p>`);

    // Comparison table
    html.push('<table>');
    html.push('<tr><th style="width:50%">AI Assessment</th><th style="width:50%">Reviewer Assessment</th></tr>');
    html.push(`<tr><td>Status: <span class="${statusClass}">${formatStatusDisplay(assessment.status)}</span></td><td>Evidence Sufficiency: ${escapeHtml(sufficiencyLabel)}</td></tr>`);
    html.push(`<tr><td>Evidence: ${assessment.evidence.length} items found</td><td>Notes: ${escapeHtml(judgment?.judgmentNotes || 'N/A')}</td></tr>`);
    if (judgment?.finalMemoSummary) {
      html.push(`<tr><td>&nbsp;</td><td>Final Memo Summary: ${escapeHtml(judgment.finalMemoSummary)}</td></tr>`);
    }
    if (judgment?.overrideReason) {
      html.push(`<tr><td>&nbsp;</td><td>Override Reason: ${escapeHtml(judgment.overrideReason)}</td></tr>`);
    }
    html.push('</table>');

    // Evidence
    if (options.includeEvidence && assessment.evidence.length > 0) {
      html.push('<p><strong>Evidence:</strong></p>');
      html.push('<ul>');
      for (const item of assessment.evidence) {
        html.push(`<li>${escapeHtml(item)}</li>`);
      }
      html.push('</ul>');
    }
  }

  // Footer
  html.push('<div class="footer">');
  html.push(`<p>Generated: ${new Date().toISOString()}</p>`);
  html.push('<p>SSTAC Dashboard - Regulatory Review Module</p>');
  html.push('</div>');

  html.push('</body>');
  html.push('</html>');

  return html.join('\n');
}

// ============================================================================
// Preview Generation
// ============================================================================

/**
 * Generate a preview (first N items) in the selected format
 */
export function generatePreview(
  data: MemoData,
  options: ExportOptions,
  maxItems: number = 3
): string {
  const previewData: MemoData = {
    ...data,
    assessments: filterAssessments(data.assessments, data.judgments, options).slice(0, maxItems),
  };

  switch (options.format) {
    case 'html':
      return generateHTML(previewData, options);
    case 'csv':
      return generateCSV(previewData, options);
    case 'word':
      return generateWordHTML(previewData, options);
    default:
      return generateMarkdown(previewData, options);
  }
}

// ============================================================================
// Export Helpers
// ============================================================================

/**
 * Trigger download of generated content
 */
export function downloadContent(
  content: string,
  filename: string,
  format: 'markdown' | 'html' | 'csv' | 'word'
): void {
  const formatConfig: Record<string, { mimeType: string; extension: string }> = {
    markdown: { mimeType: 'text/markdown', extension: 'md' },
    html: { mimeType: 'text/html', extension: 'html' },
    csv: { mimeType: 'text/csv', extension: 'csv' },
    word: { mimeType: 'application/msword', extension: 'doc' },
  };

  const config = formatConfig[format] || formatConfig.markdown;
  const blob = new Blob([content], { type: `${config.mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.${config.extension}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copy content to clipboard
 */
export async function copyToClipboard(content: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(content);
    return true;
  } catch {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = content;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textArea);
    }
  }
}
