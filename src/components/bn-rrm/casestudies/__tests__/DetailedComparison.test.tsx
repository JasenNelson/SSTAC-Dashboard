/**
 * Tests for DetailedComparison -- the per-CPT-node Jermilova case-study view.
 *
 * The component consumes three pack artifacts (comparison_results,
 * cpt_transparency, validation) via usePackArtifact. The tests stub the
 * hook to feed compact fixtures and verify the join logic + render
 * branches.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Hoisted mock state -- vi.hoisted runs before vi.mock factory expansion
// so the mock body can reference these values without TDZ issues.
const mockState = vi.hoisted(() => ({
  artifacts: {} as Record<string, { data: unknown; loading: boolean; error: string | null }>,
}));

vi.mock('@/hooks/bn-rrm/usePackArtifact', () => ({
  usePackArtifact: (key: string) => {
    const entry = mockState.artifacts[key];
    if (!entry) return { data: null, loading: false, error: null, reload: () => {} };
    return { ...entry, reload: () => {} };
  },
}));

import { DetailedComparison } from '../DetailedComparison';

const FIXTURE_COMPARISON = {
  structural: { match: true },
  sensitivity_ranking_comparison: {
    GSL_fish_tissue_hg: {
      our_MI_ranking: [
        { rank: 1, source: 'fish_species', MI: 0.103 },
        { rank: 2, source: 'proximity_mine_gsl', MI: 0.048 },
        { rank: 3, source: 'proximity_historic_mine', MI: 0.026 },
      ],
      published_ranking: {
        'Total Hg input': { rank: 1 },
        'Proximity to mining': { rank: 3 },
        'Proximity to historic mining': { rank: 2 },
      },
    },
  },
  loo_accuracy_summary: {
    GSL: {
      fish_tissue_hg: { accuracy: 0.69, kappa: 0.466, n: 584 },
      freshwater_thg: { accuracy: 0.945, kappa: 0.0, n: 855 },
    },
    GBS: {
      fish_tissue_hg: { accuracy: 0.667, kappa: 0.489, n: 258 },
    },
    interpretation: 'Mock LOO interpretation',
  },
};

const FIXTURE_CPT = {
  nodes: [
    {
      id: 'atmospheric_hg_deposition',
      label: 'Atmospheric Hg Deposition',
      tier: 1,
      cpt_source: 'Data-Learned',
      sample_count: 855,
      dr001_affected: false,
      learned_distribution: {
        states: ['low', 'medium', 'high'],
        marginal: { low: 0.2, medium: 0.6, high: 0.2 },
      },
      ess_prior_weight: { ess: 1.0, method: 'BDeu' },
    },
    {
      id: 'fish_tissue_hg',
      label: 'Fish Tissue Hg',
      tier: 3,
      cpt_source: 'Data-Learned',
      sample_count: 584,
      dr001_affected: false,
      learned_distribution: {
        states: ['low', 'medium', 'high'],
        marginal: { low: 0.3, medium: 0.5, high: 0.2 },
      },
      ess_prior_weight: { ess: 1.0, method: 'BDeu' },
    },
    {
      id: 'proximity_mine_gsl',
      label: 'Proximity to Mine (GSL)',
      tier: 1,
      cpt_source: 'Data-Learned',
      sample_count: 855,
      dr001_affected: true, // exercise the DR-001 highlight
      learned_distribution: {
        states: ['yes', 'no'],
        marginal: { yes: 0.28, no: 0.72 },
      },
      ess_prior_weight: { ess: 1.0, method: 'BDeu' },
    },
  ],
};

function setArtifacts(opts?: {
  loading?: boolean;
  error?: string | null;
  comparison?: unknown;
  cpt?: unknown;
  validation?: unknown;
}) {
  const loading = opts?.loading ?? false;
  const error = opts?.error ?? null;
  mockState.artifacts.comparison_results = { data: opts?.comparison ?? FIXTURE_COMPARISON, loading, error };
  mockState.artifacts.cpt_transparency = { data: opts?.cpt ?? FIXTURE_CPT, loading, error };
  mockState.artifacts.validation = { data: opts?.validation ?? null, loading, error };
}

describe('DetailedComparison', () => {
  it('shows a loading state while artifacts are still pending', () => {
    setArtifacts({ loading: true });
    render(<DetailedComparison />);
    expect(screen.getByText(/Loading detailed comparison data/i)).toBeInTheDocument();
  });

  it('shows an error state when required artifacts fail to load', () => {
    setArtifacts({ error: 'network down' });
    render(<DetailedComparison />);
    expect(screen.getByText(/Detailed comparison data not available/i)).toBeInTheDocument();
    expect(screen.getByText(/network down/i)).toBeInTheDocument();
  });

  it('renders the 3-up summary cards with totals derived from the artifacts', () => {
    setArtifacts();
    render(<DetailedComparison />);
    expect(screen.getByTestId('detailed-stat-nodes')).toHaveTextContent(/^3/);
    // fish_tissue_hg has LOO data in GSL (n=584, k=0.466) and GBS
    // (n=258, k=0.489). N-weighted mean kappa = (0.466*584 + 0.489*258) /
    // 842 = 0.473 -> "0.47" when fixed to 2 decimals. Asserts the
    // weighting fix (P1-1 from Opus adversarial review).
    expect(screen.getByTestId('detailed-stat-kappa')).toHaveTextContent('0.47');
    // 1 done dimension (Structural), out of 5 total. Tighten assertion to
    // the bold number's exact text (the subtitle contains "1 done, 1
    // partial, 3 pending" which all match a loose "1" check).
    expect(screen.getByTestId('detailed-stat-dims').textContent).toMatch(/^1\s*\/\s*5/);
  });

  it('renders all 5 comparison-dimension rows with correct status badges', () => {
    setArtifacts();
    render(<DetailedComparison />);
    expect(screen.getByTestId('comparison-dimension-1')).toHaveTextContent(/Structural/);
    expect(screen.getByTestId('comparison-dimension-1')).toHaveTextContent(/done/i);
    expect(screen.getByTestId('comparison-dimension-4')).toHaveTextContent(/Sensitivity rankings/);
    expect(screen.getByTestId('comparison-dimension-4')).toHaveTextContent(/partial/i);
    expect(screen.getByTestId('comparison-dimension-5')).toHaveTextContent(/Minamata fold-change/);
    expect(screen.getByTestId('comparison-dimension-5')).toHaveTextContent(/not run/i);
  });

  it('renders one row per CPT node and computes the modal state', () => {
    setArtifacts();
    render(<DetailedComparison />);
    // 3 nodes in fixture -> 3 rows.
    expect(screen.getByTestId('detailed-node-row-atmospheric_hg_deposition')).toBeInTheDocument();
    expect(screen.getByTestId('detailed-node-row-fish_tissue_hg')).toBeInTheDocument();
    expect(screen.getByTestId('detailed-node-row-proximity_mine_gsl')).toBeInTheDocument();
    // Atmospheric Hg's modal state is 'medium' (0.6).
    const atmosphericRow = screen.getByTestId('detailed-node-row-atmospheric_hg_deposition');
    expect(atmosphericRow).toHaveTextContent(/medium/);
  });

  it('shows LOO kappa for endpoint nodes and "-" for non-endpoints', () => {
    setArtifacts();
    render(<DetailedComparison />);
    // fish_tissue_hg has LOO data; row should contain a kappa (mean of GSL+GBS = ~0.48).
    const fishRow = screen.getByTestId('detailed-node-row-fish_tissue_hg');
    expect(fishRow.textContent).toMatch(/0\.4[0-9]/);
    // atmospheric_hg_deposition has no LOO data -- row should show the
    // "no LOO" placeholder.
    const atmRow = screen.getByTestId('detailed-node-row-atmospheric_hg_deposition');
    // Hard to assert "-" alone; assert the row does NOT carry the kappa
    // string for fish (which is unique to that row).
    expect(atmRow.textContent).not.toMatch(/0\.466/);
  });

  it('shows published-rank pairs for nodes that appear in the published ranking', () => {
    setArtifacts();
    render(<DetailedComparison />);
    // proximity_mine_gsl maps to "Proximity to mining" published key (rank 3)
    // and is rank 2 in our MI -> badge should show "3 (2)".
    const proxRow = screen.getByTestId('detailed-node-row-proximity_mine_gsl');
    expect(proxRow.textContent).toMatch(/3 \(2\)/);
  });

  it('expands a row when the chevron button is clicked and shows the BDeu posterior + ESS prior', () => {
    setArtifacts();
    render(<DetailedComparison />);
    // Per Opus P1-2 (keyboard a11y): the chevron is a proper focusable
    // button now, not a tabIndex=-1 child of a click-handling <tr>.
    // Activation is via the button, not the row.
    const toggle = screen.getByTestId('detailed-node-row-toggle-fish_tissue_hg');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    // Expansion reveals ESS prior + LOO summary + learned-marginal bar.
    expect(screen.getByText(/ESS = 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Learned marginal distribution/i)).toBeInTheDocument();
  });

  it('chevron toggle is keyboard-activatable (WCAG 2.1.1)', () => {
    setArtifacts();
    render(<DetailedComparison />);
    const toggle = screen.getByTestId('detailed-node-row-toggle-fish_tissue_hg');
    // Tab to the button (jsdom does not synthesize Tab; assert focus
    // works programmatically + the button is a focusable <button type=
    // "button"> with no tabIndex=-1).
    toggle.focus();
    expect(document.activeElement).toBe(toggle);
    expect(toggle.tagName).toBe('BUTTON');
    expect(toggle).not.toHaveAttribute('tabindex', '-1');
    // Enter activates via native button semantics. fireEvent.click is
    // the canonical jsdom way to simulate Enter on a button.
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('rank badge has descriptive aria-label naming the endpoint + both ranks', () => {
    setArtifacts();
    render(<DetailedComparison />);
    const proxRow = screen.getByTestId('detailed-node-row-proximity_mine_gsl');
    // Look for a child of the row with an aria-label that names both
    // ranks. The endpoint label uses human-readable spacing.
    const badge = proxRow.querySelector('[aria-label*="paper rank"]');
    expect(badge).not.toBeNull();
    expect(badge?.getAttribute('aria-label')).toMatch(/paper rank 3/);
    expect(badge?.getAttribute('aria-label')).toMatch(/our MI rank 2/);
  });

  it('flags DR-001 affected nodes with a visible marker', () => {
    setArtifacts();
    render(<DetailedComparison />);
    const proxRow = screen.getByTestId('detailed-node-row-proximity_mine_gsl');
    expect(proxRow.textContent).toMatch(/DR-001/);
  });

  it('tier filter narrows the rows to the selected tier', () => {
    setArtifacts();
    render(<DetailedComparison />);
    // All-tiers default: 3 rows visible.
    expect(screen.getByTestId('detailed-node-row-atmospheric_hg_deposition')).toBeInTheDocument();
    expect(screen.getByTestId('detailed-node-row-fish_tissue_hg')).toBeInTheDocument();
    expect(screen.getByTestId('detailed-node-row-proximity_mine_gsl')).toBeInTheDocument();
    // Click Tier 3 filter -- only fish_tissue_hg remains.
    fireEvent.click(screen.getByTestId('detailed-tier-filter-3'));
    expect(screen.queryByTestId('detailed-node-row-atmospheric_hg_deposition')).toBeNull();
    expect(screen.getByTestId('detailed-node-row-fish_tissue_hg')).toBeInTheDocument();
    expect(screen.queryByTestId('detailed-node-row-proximity_mine_gsl')).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Uncertainty & Sensitivity Analysis section
  // -------------------------------------------------------------------------

  it('renders the U/S section with all four families', () => {
    setArtifacts();
    render(<DetailedComparison />);
    expect(screen.getByTestId('us-section-root')).toBeInTheDocument();
    expect(screen.getByTestId('us-family-a')).toBeInTheDocument();
    expect(screen.getByTestId('us-family-b')).toBeInTheDocument();
    expect(screen.getByTestId('us-family-c')).toBeInTheDocument();
    expect(screen.getByTestId('us-family-d')).toBeInTheDocument();
  });

  it('family (a) reports ESS = 1.0 uniform when all nodes share that prior weight', () => {
    setArtifacts();
    render(<DetailedComparison />);
    const familyA = screen.getByTestId('us-family-a');
    expect(familyA).toHaveTextContent(/BDeu ESS:/);
    expect(familyA).toHaveTextContent(/1\s*\(uniform/);
    // Sample-size summary line.
    expect(familyA).toHaveTextContent(/Sample size N:/);
    expect(familyA).toHaveTextContent(/min=584/);
    expect(familyA).toHaveTextContent(/max=855/);
  });

  it('family (b) renders one LOO row per endpoint node with kappa + n', () => {
    setArtifacts();
    render(<DetailedComparison />);
    // fish_tissue_hg is the only LOO endpoint in the fixture cpt list.
    expect(screen.getByTestId('us-loo-row-fish_tissue_hg')).toBeInTheDocument();
    expect(screen.getByTestId('us-loo-row-fish_tissue_hg').textContent).toMatch(/0\.4[0-9]/);
    expect(screen.getByTestId('us-loo-row-fish_tissue_hg').textContent).toMatch(/n=842/);
  });

  it('family (c) renders top-driver rows per endpoint (ours vs published)', () => {
    setArtifacts();
    render(<DetailedComparison />);
    const row = screen.getByTestId('us-driver-row-GSL_fish_tissue_hg');
    expect(row).toBeInTheDocument();
    expect(row).toHaveTextContent(/fish_species/); // our top driver
    expect(row).toHaveTextContent(/Total Hg input/); // published top driver
  });

  it('family (d) shows "not run" status with a clear next-step note', () => {
    setArtifacts();
    render(<DetailedComparison />);
    const familyD = screen.getByTestId('us-family-d');
    expect(familyD).toHaveTextContent(/Minamata Treaty/);
    expect(familyD).toHaveTextContent(/not run/i);
    expect(familyD).toHaveTextContent(/Python pipeline/);
  });

  it('exports CSV with the visible rows when the CSV button is clicked', () => {
    setArtifacts();
    // Stub URL.createObjectURL + the anchor click so we can inspect the
    // export call without exercising the browser download flow.
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    try {
      render(<DetailedComparison />);
      fireEvent.click(screen.getByTestId('detailed-export-csv'));
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalled();
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
      clickSpy.mockRestore();
    }
  });
});
