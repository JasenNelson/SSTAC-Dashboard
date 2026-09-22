export const MATRIX_OPTIONS_VIEW_IDS = [
  'Vision for Modernizing Schedule 3.4',
  'The Guide',
  'TWG Review',
  'Interactive Map',
  'Calculator',
  'SSD Workbench',
  'References & Values',
] as const;

export type MatrixOptionsViewId = (typeof MATRIX_OPTIONS_VIEW_IDS)[number];

export const MATRIX_OPTIONS_TABPANEL_ID = 'matrix-dashboard-tabpanel';
export const MATRIX_OPTIONS_PAPER_TABPANEL_ID = 'matrix-options-paper-tabpanel';
export const MATRIX_OPTIONS_PAPER_LANDING_PATH = '/matrix-options/paper';
export const MATRIX_OPTIONS_PAPER_REVIEW_ROUTE = '/matrix-options/paper/review/v/1.0.11-remediated-7-8-successor-20260918-D';
export const MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH = '/matrix-options?view=TWG%20Review';
export const MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION_FLAG =
  'MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION';
export const MATRIX_OPTIONS_PAPER_WORKSPACE_FLAG = 'MATRIX_OPTIONS_PAPER_WORKSPACE';

export type MatrixOptionsPaperReviewNavigationGate =
  | 'LEGACY_TWG_REVIEW'
  | 'PAPER_RESOLVER'
  | 'REVIEW_NAVIGATION';

const DISPLAY_LABELS: Partial<Record<MatrixOptionsViewId, string>> = {
  'The Guide': 'Guide',
  'Vision for Modernizing Schedule 3.4': 'Modernizing Schedule 3.4',
  'Interactive Map': 'Database',
  'References & Values': 'Catalogue',
};

export interface MatrixOptionsViewDefinition {
  id: MatrixOptionsViewId;
  dashboardLabel: string;
  paperLabel: string;
  dashboardHref: string;
  paperHref: string | null;
}

export const MATRIX_OPTIONS_VIEWS: readonly MatrixOptionsViewDefinition[] =
  MATRIX_OPTIONS_VIEW_IDS.map((id) => ({
    id,
    dashboardLabel: id === 'TWG Review' ? 'Options Paper' : (DISPLAY_LABELS[id] ?? id),
    paperLabel: id === 'TWG Review' ? 'Options Paper' : (DISPLAY_LABELS[id] ?? id),
    dashboardHref: `/matrix-options?view=${encodeURIComponent(id)}`,
    paperHref: id === 'TWG Review' ? MATRIX_OPTIONS_PAPER_LANDING_PATH : null,
  }));

export function isMatrixOptionsViewId(value: unknown): value is MatrixOptionsViewId {
  return typeof value === 'string' && (MATRIX_OPTIONS_VIEW_IDS as readonly string[]).includes(value);
}

export function parseMatrixOptionsViewParam(
  value: string | string[] | undefined,
): MatrixOptionsViewId {
  const candidate = Array.isArray(value) ? value[0] : value;
  return isMatrixOptionsViewId(candidate) ? candidate : 'The Guide';
}

export function isMatrixOptionsPaperWorkspaceEnabled(value: string | undefined): boolean {
  // Production deployments historically omitted this flag, which silently
  // selected the obsolete TWGReviewPortal. Treat absence as the reviewed
  // workspace default; only the exact true value enables this route and every
  // other set value (including '') remains fail-closed for rollback.
  return value === undefined || value === 'true';
}

export function isMatrixOptionsPaperReviewNavigationEnabled(
  value: string | undefined,
): boolean {
  return value === undefined || value === 'true';
}

export function resolveMatrixOptionsPaperReviewNavigationGate(
  outerValue: string | undefined,
  innerValue: string | undefined,
): MatrixOptionsPaperReviewNavigationGate {
  if (!isMatrixOptionsPaperWorkspaceEnabled(outerValue)) return 'LEGACY_TWG_REVIEW';
  if (!isMatrixOptionsPaperReviewNavigationEnabled(innerValue)) return 'PAPER_RESOLVER';
  return 'REVIEW_NAVIGATION';
}

export function matrixOptionsPrimaryTabId(viewId: MatrixOptionsViewId): string {
  const slug = viewId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
  return `matrix-tab-${slug}`;
}

export function matrixOptionsViewLabel(
  viewId: MatrixOptionsViewId,
  paperRoute = false,
): string {
  const view = MATRIX_OPTIONS_VIEWS.find((candidate) => candidate.id === viewId)!;
  return paperRoute ? view.paperLabel : view.dashboardLabel;
}
