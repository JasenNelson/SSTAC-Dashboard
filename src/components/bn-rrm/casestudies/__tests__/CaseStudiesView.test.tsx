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
// AiAssistedDevelopmentView is rendered as a controlled component by
// CaseStudiesView (activeTier + onTierChange props for the tier-aware
// width breakout fix, 2026-05-17). The mock surfaces the props so tests
// can verify the prop wire-up. A small inline tier-switcher button lets
// tests drive setActiveTier from the parent via the onTierChange
// callback. Uses the exported AudienceTier type from the real component
// so the union stays single-sourced.
import type { AudienceTier } from '../AiAssistedDevelopmentView';
vi.mock('../AiAssistedDevelopmentView', () => ({
  AiAssistedDevelopmentView: (props: {
    activeTier?: AudienceTier;
    onTierChange?: (tier: AudienceTier) => void;
  }) => (
    <div data-testid="view-ai-assisted">
      <span data-testid="active-tier-prop">{String(props.activeTier ?? 'undefined')}</span>
      <button
        type="button"
        data-testid="mock-pick-twg-tier"
        onClick={() => props.onTierChange?.('twg-review')}
      >
        pick twg
      </button>
      <button
        type="button"
        data-testid="mock-pick-technical-tier"
        onClick={() => props.onTierChange?.('technical')}
      >
        pick technical
      </button>
    </div>
  ),
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

  // -------------------------------------------------------------------------
  // Tier-aware width breakout (2026-05-17 fix)
  //
  // CaseStudiesView now lifts activeTier state so the content-area wrapper
  // can be tier-aware: tiers 1-3 keep the max-w-4xl reading cap; tier 4
  // (TWG Review) escapes the cap so the 3-column portal can fill the
  // available width. AiAssistedDevelopmentView is rendered as a controlled
  // component (activeTier + onTierChange props).
  // -------------------------------------------------------------------------

  it('passes activeTier as a controlled prop to AiAssistedDevelopmentView (defaults to everyone)', () => {
    (mockPackManifest as Mock).mockReturnValue(jermilovaManifest);
    render(<CaseStudiesView />);
    fireEvent.click(
      screen.getByRole('button', { name: /AI-assisted BN-RRM development/i }),
    );
    expect(screen.getByTestId('active-tier-prop')).toHaveTextContent('everyone');
  });

  it('updates activeTier when AiAssistedDevelopmentView fires onTierChange', () => {
    (mockPackManifest as Mock).mockReturnValue(jermilovaManifest);
    render(<CaseStudiesView />);
    fireEvent.click(
      screen.getByRole('button', { name: /AI-assisted BN-RRM development/i }),
    );
    fireEvent.click(screen.getByTestId('mock-pick-technical-tier'));
    expect(screen.getByTestId('active-tier-prop')).toHaveTextContent('technical');
  });

  it('LOAD-BEARING width-breakout: the wrapper around AiAssistedDevelopmentView has no max-w-4xl ancestor (squish root cause)', () => {
    (mockPackManifest as Mock).mockReturnValue(jermilovaManifest);
    render(<CaseStudiesView />);
    // Navigate to ai-assisted so the special render branch mounts.
    fireEvent.click(
      screen.getByRole('button', { name: /AI-assisted BN-RRM development/i }),
    );
    // Walk the ancestor chain of the AiAssistedDevelopmentView mount and
    // assert NO ancestor inside CaseStudiesView's content area carries the
    // max-w-4xl class. This is the LOAD-BEARING regression guard: the
    // original squish bug was the ANCESTOR wrapper at CaseStudiesView line
    // 144 (pre-fix) capping the portal to 56rem. A future refactor that
    // re-introduces max-w-4xl on the ai-assisted branch wrapper would
    // bring the squish back, and this assertion catches it.
    const mounted = screen.getByTestId('view-ai-assisted');
    let node: HTMLElement | null = mounted.parentElement;
    while (node) {
      expect(
        node.className,
        `Ancestor of AiAssistedDevelopmentView mount carries max-w-4xl: ${node.className}`,
      ).not.toMatch(/max-w-4xl/);
      // Stop walking at the test-root container.
      if (node.parentElement === document.body) break;
      node = node.parentElement;
    }
  });

  it('non-ai-assisted sections keep the original narrow content wrapper (max-w-4xl preserved for curated cards)', () => {
    (mockPackManifest as Mock).mockReturnValue(jermilovaManifest);
    render(<CaseStudiesView />);
    // Default benchmark section is how-it-works -- which should sit inside
    // the original max-w-4xl wrapper. Verify by walking ancestors.
    const howItWorksMount = screen.getByTestId('view-how-it-works');
    let foundMaxWFourXl = false;
    let node: HTMLElement | null = howItWorksMount.parentElement;
    while (node) {
      if (node.className.includes('max-w-4xl')) {
        foundMaxWFourXl = true;
        break;
      }
      if (node.parentElement === document.body) break;
      node = node.parentElement;
    }
    expect(
      foundMaxWFourXl,
      'how-it-works content should remain inside the narrow max-w-4xl wrapper',
    ).toBe(true);
  });

  it('resets activeTier to everyone when activeSection leaves ai-assisted', () => {
    (mockPackManifest as Mock).mockReturnValue(jermilovaManifest);
    render(<CaseStudiesView />);
    // Go to ai-assisted + pick the technical tier.
    fireEvent.click(
      screen.getByRole('button', { name: /AI-assisted BN-RRM development/i }),
    );
    fireEvent.click(screen.getByTestId('mock-pick-technical-tier'));
    expect(screen.getByTestId('active-tier-prop')).toHaveTextContent('technical');
    // Now switch back to How It Works. The post-section useEffect resets
    // activeTier to 'everyone' so re-entering ai-assisted later does not
    // start on a stale tier.
    fireEvent.click(screen.getByRole('button', { name: /How It Works/i }));
    expect(screen.getByTestId('view-how-it-works')).toBeInTheDocument();
    // Re-enter ai-assisted; the controlled prop should reset to 'everyone'.
    fireEvent.click(
      screen.getByRole('button', { name: /AI-assisted BN-RRM development/i }),
    );
    expect(screen.getByTestId('active-tier-prop')).toHaveTextContent('everyone');
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
