/**
 * Tests for AiAssistedDevelopmentView -- the AI-assisted BN-RRM development
 * case-studies section shown when the Jermilova benchmark pack is selected.
 *
 * The component is presentational (no data fetch, no router) so coverage
 * focuses on the tier-toggle interaction + canonical-source pointer + a few
 * load-bearing claims that should not silently disappear.
 *
 * Tier buttons are selected via data-testid="ai-assisted-tier-<id>" because
 * accessible-name selectors collide with internal badge labels ("For Everyone"
 * also appears as an ExpandableSection badge inside the tier content).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// JermilovaReviewPortal imports MathRenderer which pulls CSS via the
// renderer chain; stub it here so this test focuses on tier-toggle
// integration rather than re-testing the portal (covered in
// src/components/document-reviews/__tests__/JermilovaReviewPortal.test.tsx).
vi.mock('@/components/document-reviews/JermilovaReviewPortal', () => ({
  default: () => <div data-testid="jermilova-review-portal-mock" />,
}));

import { AiAssistedDevelopmentView } from '../AiAssistedDevelopmentView';

describe('AiAssistedDevelopmentView', () => {
  it('renders the section header + curated-summary disclaimer + tier selector', () => {
    render(<AiAssistedDevelopmentView />);
    expect(
      screen.getByRole('heading', { name: /AI-assisted BN-RRM Development/i }),
    ).toBeInTheDocument();
    // The disclaimer that the dashboard view is curated, not the source of truth.
    expect(
      screen.getByText(/dashboard view below is a curated summary/i),
    ).toBeInTheDocument();
    // Three tier buttons present.
    expect(screen.getByTestId('ai-assisted-tier-everyone')).toBeInTheDocument();
    expect(
      screen.getByTestId('ai-assisted-tier-practitioner'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('ai-assisted-tier-technical')).toBeInTheDocument();
  });

  it('defaults to the For Everyone tier and shows the three-party workflow narrative', () => {
    render(<AiAssistedDevelopmentView />);
    // The everyone tier button is aria-pressed=true on mount.
    expect(screen.getByTestId('ai-assisted-tier-everyone')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // Three-party workflow narrative is the load-bearing claim of the
    // Everyone tier -- it must not silently disappear. Use the role labels
    // that appear ONCE each in the section (not the body prose where
    // "scientist" recurs).
    expect(screen.getByText(/Three parties were involved/i)).toBeInTheDocument();
    expect(screen.getByText('The scientist')).toBeInTheDocument();
    expect(screen.getByText('The AI helper')).toBeInTheDocument();
    expect(screen.getByText('A second AI reviewer')).toBeInTheDocument();
  });

  it('switches to the Practitioner tier when clicked + reveals the LOO kappa table', () => {
    render(<AiAssistedDevelopmentView />);
    const practitioner = screen.getByTestId('ai-assisted-tier-practitioner');
    fireEvent.click(practitioner);
    expect(practitioner).toHaveAttribute('aria-pressed', 'true');
    // Load-bearing kappa numbers from the methodology paper must surface.
    expect(screen.getByText(/0\.466 \(584\)/)).toBeInTheDocument();
    expect(screen.getByText(/0\.489 \(258\)/)).toBeInTheDocument();
    // freshwater_thg kappa=0.0 in both submodels.
    expect(screen.getByText(/0\.0 \(855\)/)).toBeInTheDocument();
    expect(screen.getByText(/0\.0 \(1589\)/)).toBeInTheDocument();
    expect(screen.getByText(/majority-class collapse/i)).toBeInTheDocument();
  });

  it('switches to the Technical tier when clicked + shows the BDeu formula + opens the Comparison Protocol section', () => {
    const { container } = render(<AiAssistedDevelopmentView />);
    fireEvent.click(screen.getByTestId('ai-assisted-tier-technical'));
    // BDeu posterior formula (defaultOpen ExpandableSection content)
    expect(
      screen.getByText(
        /alpha_ijk = ESS \/ \(n_parent_configs \* n_states_target\)/,
      ),
    ).toBeInTheDocument();
    // Comparison Protocol section is collapsed by default; click open.
    const comparisonHeader = screen.getByRole('button', {
      name: /Comparison Protocol \(Five Dimensions, Frozen at M2\)/i,
    });
    fireEvent.click(comparisonHeader);
    // Now the dimension labels + prose render. They're split across nested
    // spans + multi-line JSX literals; flatten textContent to substring-
    // match.
    const flat = (container.textContent ?? '').replace(/\s+/g, ' ');
    expect(flat).toContain('Dimension 1 -- Structural');
    expect(flat).toContain('Dimension 4 -- Sensitivity rankings');
    expect(flat).toContain('Dimension 2 -- CPT divergence');
    expect(flat).toContain('Dimension 3 -- Per-region marginal belief');
    expect(flat).toContain('Dimension 5 -- Minamata counterfactual fold-change');
    // [done] / [partial] / [not run] tallies must match the methodology
    // paper (1 done + 1 partial + 3 not run = 5 dimensions).
    expect((flat.match(/\[done\]/g) ?? []).length).toBe(1);
    expect((flat.match(/\[partial\]/g) ?? []).length).toBe(1);
    expect((flat.match(/\[not run\]/g) ?? []).length).toBe(3);
  });

  it('collapsing a tier (clicking the active button) hides its content', () => {
    render(<AiAssistedDevelopmentView />);
    const everyone = screen.getByTestId('ai-assisted-tier-everyone');
    // Default-open Everyone tier renders the three-party narrative.
    expect(screen.getByText(/Three parties were involved/i)).toBeInTheDocument();
    fireEvent.click(everyone);
    // Clicking the active tier closes it -- aria-pressed=false; content gone.
    expect(everyone).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText(/Three parties were involved/i)).toBeNull();
  });

  it('renders the TWG Review tier button + opens the collaborative-review portal when clicked', async () => {
    // Stub the global fetch (the TWG Review tier fetches the MD from
    // /bn-rrm/jermilova-methodology.md on mount). vitest+jsdom has
    // global.fetch via undici, so we override.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('# Methodology\n\n## Section A\nbody'),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = fetchMock;

    render(<AiAssistedDevelopmentView />);
    // 4th tier button is present.
    const twg = screen.getByTestId('ai-assisted-tier-twg-review');
    expect(twg).toBeInTheDocument();
    fireEvent.click(twg);
    // After click, the portal mock renders; the source-pointer footer
    // hides for the TWG tier (the portal supplies its own canonical
    // pointer in-line via the snapshot it loads).
    expect(
      await screen.findByTestId('jermilova-review-portal-mock'),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/bn-rrm/jermilova-methodology.md',
      expect.any(Object),
    );
  });

  // -------------------------------------------------------------------------
  // Controlled mode + tier-aware layout shell (2026-05-17 fix)
  //
  // AiAssistedDevelopmentView accepts optional `activeTier` + `onTierChange`
  // props. When both are provided, the component runs in controlled mode --
  // the parent owns the tier state, and the internal layout shell uses two
  // data-testids ('ai-assisted-tier-content-twg-review' for the full-width
  // tier 4 branch; 'ai-assisted-tier-content-narrow' for the capped tiers
  // 1-3 branch) so CaseStudiesView's width-breakout integration is
  // testable from above.
  // -------------------------------------------------------------------------

  it('controlled mode: respects external activeTier prop without internal state', () => {
    const onTierChange = vi.fn();
    render(
      <AiAssistedDevelopmentView
        activeTier="technical"
        onTierChange={onTierChange}
      />,
    );
    expect(screen.getByTestId('ai-assisted-tier-technical')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // Technical tier content is visible.
    expect(
      screen.getByText(
        /alpha_ijk = ESS \/ \(n_parent_configs \* n_states_target\)/,
      ),
    ).toBeInTheDocument();
  });

  it('controlled mode: clicking a tier button fires onTierChange instead of mutating internal state', () => {
    const onTierChange = vi.fn();
    render(
      <AiAssistedDevelopmentView
        activeTier="everyone"
        onTierChange={onTierChange}
      />,
    );
    fireEvent.click(screen.getByTestId('ai-assisted-tier-practitioner'));
    expect(onTierChange).toHaveBeenCalledWith('practitioner');
    // Without a re-render with the new prop, internal state remains
    // (controlled mode does not update local state on click).
    expect(screen.getByTestId('ai-assisted-tier-everyone')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('tier-aware layout: tiers 1-3 render inside the narrow content shell', () => {
    render(<AiAssistedDevelopmentView />);
    // Default (everyone) -> narrow shell.
    expect(
      screen.getByTestId('ai-assisted-tier-content-narrow'),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('ai-assisted-tier-content-twg-review'),
    ).toBeNull();
    // Practitioner -> still narrow.
    fireEvent.click(screen.getByTestId('ai-assisted-tier-practitioner'));
    expect(
      screen.getByTestId('ai-assisted-tier-content-narrow'),
    ).toBeInTheDocument();
    // Technical -> still narrow.
    fireEvent.click(screen.getByTestId('ai-assisted-tier-technical'));
    expect(
      screen.getByTestId('ai-assisted-tier-content-narrow'),
    ).toBeInTheDocument();
  });

  it('tier-aware layout: TWG Review tier renders inside the full-width content shell (no max-w-4xl)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('# Methodology\n\n## Section A\nbody'),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = fetchMock;

    render(<AiAssistedDevelopmentView />);
    fireEvent.click(screen.getByTestId('ai-assisted-tier-twg-review'));
    // Full-width shell appears; narrow shell goes away.
    expect(
      await screen.findByTestId('ai-assisted-tier-content-twg-review'),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('ai-assisted-tier-content-narrow'),
    ).toBeNull();
    // The full-width shell wrapper must NOT carry the max-w-4xl class --
    // that is the squish root cause that this fix removes.
    const twgShell = screen.getByTestId('ai-assisted-tier-content-twg-review');
    expect(twgShell.className).not.toMatch(/max-w-4xl/);
  });

  it('shows the source-of-truth pointer footer on the curated tiers (1-3) + the no-tier-active state', () => {
    render(<AiAssistedDevelopmentView />);
    // Footer with the canonical path is visible on default (Everyone) tier.
    expect(
      screen.getByText(/JERMILOVA_BNRRM_CONSTRUCTION_METHODOLOGY\.md/),
    ).toBeInTheDocument();
    // Visible on Technical tier too.
    fireEvent.click(screen.getByTestId('ai-assisted-tier-technical'));
    expect(
      screen.getByText(/JERMILOVA_BNRRM_CONSTRUCTION_METHODOLOGY\.md/),
    ).toBeInTheDocument();
    // Visible with no tier active (all closed).
    fireEvent.click(screen.getByTestId('ai-assisted-tier-technical'));
    expect(
      screen.getByText(/JERMILOVA_BNRRM_CONSTRUCTION_METHODOLOGY\.md/),
    ).toBeInTheDocument();
  });

  it('HIDES the source-of-truth pointer footer on the TWG Review tier (portal opens the canonical content in-line)', async () => {
    // The TWG Review tier mounts the JermilovaReviewPortal which loads the
    // canonical methodology MD inline -- a separate canonical-path pointer
    // would be redundant. The layout-shell branch in
    // AiAssistedDevelopmentView intentionally omits SourcePointerFooter
    // when activeTier === 'twg-review'.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('# Methodology\n\n## Section A\nbody'),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = fetchMock;

    render(<AiAssistedDevelopmentView />);
    // Footer is visible on the default Everyone tier.
    expect(
      screen.getByText(/JERMILOVA_BNRRM_CONSTRUCTION_METHODOLOGY\.md/),
    ).toBeInTheDocument();
    // Switch to TWG Review tier; footer disappears.
    fireEvent.click(screen.getByTestId('ai-assisted-tier-twg-review'));
    await screen.findByTestId('ai-assisted-tier-content-twg-review');
    expect(
      screen.queryByText(/JERMILOVA_BNRRM_CONSTRUCTION_METHODOLOGY\.md/),
    ).toBeNull();
  });
});
