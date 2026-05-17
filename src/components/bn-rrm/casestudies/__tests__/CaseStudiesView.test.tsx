/**
 * Tests for CaseStudiesView integration gating, focused on the
 * AI-assisted-development tab introduced for the Jermilova benchmark pack.
 *
 * Codex holistic 2026-05-17 surfaced two integration bugs:
 *   P2 -- activeSection state was unconditional render branch; switching
 *         packs left the wrong content rendered.
 *   P3 -- isBenchmark gate exposed Jermilova-specific content for any
 *         future scope_type=benchmark pack.
 *
 * Tests below lock in the fixes: pack-id gate (P3), pack-switch reset (P2),
 * and conditional render guards.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  type Mock,
} from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CaseStudiesView } from '../CaseStudiesView';

// usePackStore mock -- selector pattern.
const mockPackManifest = vi.fn();
vi.mock('@/stores/bn-rrm/packStore', () => ({
  usePackStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ packManifest: mockPackManifest() }),
}));

// The downstream views are heavy (HowItWorksView is ~985 lines, AiAssisted
// is ~923 lines). Stub them so the test stays focused on the integration
// gating logic.
vi.mock('../HowItWorksView', () => ({
  HowItWorksView: () => <div data-testid="view-how-it-works" />,
}));
vi.mock('../PublishedComparison', () => ({
  PublishedComparison: () => <div data-testid="view-benchmark" />,
}));
vi.mock('../AiAssistedDevelopmentView', () => ({
  AiAssistedDevelopmentView: () => <div data-testid="view-ai-assisted" />,
}));
vi.mock('../DetailedComparison', () => ({
  DetailedComparison: () => <div data-testid="view-detailed-comparison" />,
}));
vi.mock('../TrainingSites', () => ({
  TrainingSites: () => <div data-testid="view-training" />,
}));
vi.mock('../ExternalSites', () => ({
  ExternalSites: () => <div data-testid="view-external" />,
}));
vi.mock('../MethodComparison', () => ({
  MethodComparison: () => <div data-testid="view-methods" />,
}));

const JERMILOVA_PACK_ID = 'bnrrm-casestudy-jermilova2025-mackenzie-hg';

const jermilovaManifest = {
  pack_id: JERMILOVA_PACK_ID,
  scope_type: 'benchmark',
};
const siteManifest = {
  pack_id: 'bnrrm-site-v0.1-alcan-map',
  scope_type: 'site_specific',
};

// Hypothetical future benchmark pack that is NOT Jermilova -- used to
// verify the AI-assisted tab does not leak to it (P3 gate).
const otherBenchmarkManifest = {
  pack_id: 'bnrrm-casestudy-future-other-paper',
  scope_type: 'benchmark',
};

beforeEach(() => {
  (mockPackManifest as Mock).mockReset();
});

describe('CaseStudiesView -- AI-assisted-development tab gating', () => {
  it('renders the AI-assisted-development tab when the Jermilova pack is selected', () => {
    (mockPackManifest as Mock).mockReturnValue(jermilovaManifest);
    render(<CaseStudiesView />);
    expect(
      screen.getByRole('button', { name: /AI-assisted BN-RRM development/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /How It Works/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Published Benchmark/i }),
    ).toBeInTheDocument();
  });

  it('renders the Detailed Comparison tab for the Jermilova pack', () => {
    (mockPackManifest as Mock).mockReturnValue(jermilovaManifest);
    render(<CaseStudiesView />);
    expect(
      screen.getByRole('button', { name: /Detailed Comparison/i }),
    ).toBeInTheDocument();
  });

  it('does NOT render the Detailed Comparison tab for a non-Jermilova benchmark pack', () => {
    (mockPackManifest as Mock).mockReturnValue(otherBenchmarkManifest);
    render(<CaseStudiesView />);
    expect(
      screen.queryByRole('button', { name: /Detailed Comparison/i }),
    ).toBeNull();
  });

  it('shows the Detailed Comparison content when activated AND isJermilova', () => {
    (mockPackManifest as Mock).mockReturnValue(jermilovaManifest);
    render(<CaseStudiesView />);
    fireEvent.click(
      screen.getByRole('button', { name: /Detailed Comparison/i }),
    );
    expect(screen.getByTestId('view-detailed-comparison')).toBeInTheDocument();
    // Hides the previously-active how-it-works view.
    expect(screen.queryByTestId('view-how-it-works')).toBeNull();
  });

  it('does NOT render the AI-assisted tab for a non-Jermilova benchmark pack (P3)', () => {
    // Hypothetical future scope_type=benchmark pack that is NOT Jermilova:
    // the tab + its content are Jermilova-specific and must not leak.
    (mockPackManifest as Mock).mockReturnValue(otherBenchmarkManifest);
    render(<CaseStudiesView />);
    expect(
      screen.queryByRole('button', { name: /AI-assisted BN-RRM development/i }),
    ).toBeNull();
    // How It Works + Published Benchmark are generic and remain visible
    // for any benchmark pack.
    expect(
      screen.getByRole('button', { name: /How It Works/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Published Benchmark/i }),
    ).toBeInTheDocument();
  });

  it('does NOT render the AI-assisted tab for a site-specific pack', () => {
    (mockPackManifest as Mock).mockReturnValue(siteManifest);
    render(<CaseStudiesView />);
    expect(
      screen.queryByRole('button', { name: /AI-assisted BN-RRM development/i }),
    ).toBeNull();
    // site_specific pack shows the base sections instead.
    expect(
      screen.getByRole('button', { name: /Training Sites/i }),
    ).toBeInTheDocument();
  });

  it('AI-assisted content renders ONLY when both activeSection AND isJermilova are true', () => {
    (mockPackManifest as Mock).mockReturnValue(jermilovaManifest);
    render(<CaseStudiesView />);
    // Default for benchmark = how-it-works
    expect(screen.getByTestId('view-how-it-works')).toBeInTheDocument();
    // Switch to AI-assisted
    fireEvent.click(
      screen.getByRole('button', { name: /AI-assisted BN-RRM development/i }),
    );
    expect(screen.getByTestId('view-ai-assisted')).toBeInTheDocument();
    expect(screen.queryByTestId('view-how-it-works')).toBeNull();
  });

  it('resets activeSection when the pack switches from Jermilova to site_specific (P2)', () => {
    // Start with Jermilova + activate ai-assisted.
    (mockPackManifest as Mock).mockReturnValue(jermilovaManifest);
    const { rerender } = render(<CaseStudiesView />);
    fireEvent.click(
      screen.getByRole('button', { name: /AI-assisted BN-RRM development/i }),
    );
    expect(screen.getByTestId('view-ai-assisted')).toBeInTheDocument();
    // Now switch the underlying pack to a site-specific one and re-render.
    // The store mock returns a new manifest; activeSection should reset
    // to the first available section of the new sections array (training)
    // via the useEffect guard.
    (mockPackManifest as Mock).mockReturnValue(siteManifest);
    act(() => {
      rerender(<CaseStudiesView />);
    });
    expect(screen.queryByTestId('view-ai-assisted')).toBeNull();
    expect(screen.getByTestId('view-training')).toBeInTheDocument();
  });

  it('resets activeSection when the pack switches from site_specific to Jermilova', () => {
    // Start with site pack + active section = training (default for non-benchmark)
    (mockPackManifest as Mock).mockReturnValue(siteManifest);
    const { rerender } = render(<CaseStudiesView />);
    expect(screen.getByTestId('view-training')).toBeInTheDocument();
    // Switch to Jermilova: 'training' is not a valid section for benchmark
    // packs, so the guard should snap activeSection back to the first
    // available section (how-it-works).
    (mockPackManifest as Mock).mockReturnValue(jermilovaManifest);
    act(() => {
      rerender(<CaseStudiesView />);
    });
    expect(screen.queryByTestId('view-training')).toBeNull();
    expect(screen.getByTestId('view-how-it-works')).toBeInTheDocument();
  });
});
