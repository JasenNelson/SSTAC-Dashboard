import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/components/MathRenderer', () => ({
  default: ({ content }: { content: string }) => (
    <div data-testid="math-renderer-mock">{content}</div>
  ),
}));

import HHInhalationCalculator from '../HHInhalationCalculator';

describe('HHInhalationCalculator', () => {
  it('renders fail-closed (blocked) by default -- VF/PEF are never pre-seeded', () => {
    render(
      <HHInhalationCalculator
        substanceKey="benzene"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );

    expect(screen.getByTestId('hh-inhalation-calculator')).toBeInTheDocument();
    // VF/PEF inputs must start blank regardless of substance -- the owner ruling
    // forbids ANY pre-seed of a transport factor, even for a substance (benzene) that
    // has catalog RfC/IUR values wired.
    expect((screen.getByTestId('hh-inhalation-vf-input') as HTMLInputElement).value).toBe('');
    expect((screen.getByTestId('hh-inhalation-pef-input') as HTMLInputElement).value).toBe('');
    expect(screen.getByTestId('hh-inhalation-blocked')).toHaveTextContent(
      /Inhalation pathway blocked/i,
    );
    expect(screen.queryByTestId('hh-inhalation-preliminary-standard')).not.toBeInTheDocument();
  });

  it('seeds RfC/IUR from the substance library for a substance with wired catalog values (benzene)', () => {
    render(
      <HHInhalationCalculator
        substanceKey="benzene"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    expect((screen.getByTestId('hh-inhalation-rfc-input') as HTMLInputElement).value).toBe(
      '0.03',
    );
    expect((screen.getByTestId('hh-inhalation-iur-input') as HTMLInputElement).value).toBe(
      '0.016',
    );
  });

  it('leaves RfC/IUR blank for a substance with no wired inhalation toxicity values', () => {
    render(
      <HHInhalationCalculator
        substanceKey="zinc"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    expect((screen.getByTestId('hh-inhalation-rfc-input') as HTMLInputElement).value).toBe('');
    expect((screen.getByTestId('hh-inhalation-iur-input') as HTMLInputElement).value).toBe('');
    expect(screen.getByTestId('hh-inhalation-blocked')).toBeInTheDocument();
  });

  it('unblocks and shows a computed screening value once the user supplies VF and PEF', () => {
    render(
      <HHInhalationCalculator
        substanceKey="benzene"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    fireEvent.change(screen.getByTestId('hh-inhalation-vf-input'), {
      target: { value: '10000' },
    });
    fireEvent.change(screen.getByTestId('hh-inhalation-pef-input'), {
      target: { value: '1.36e9' },
    });
    expect(screen.queryByTestId('hh-inhalation-blocked')).not.toBeInTheDocument();
    const standard = screen.getByTestId('hh-inhalation-preliminary-standard');
    expect(standard).toHaveTextContent(/Preliminary Human Health Screening Value \(Inhalation\)/i);
    expect(standard).not.toHaveTextContent(/--\s*mg\/kg/);
  });

  it('stays blocked with only VF supplied and no RfC/IUR (no substance toxicity values)', () => {
    render(
      <HHInhalationCalculator
        substanceKey="zinc"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    fireEvent.change(screen.getByTestId('hh-inhalation-vf-input'), {
      target: { value: '10000' },
    });
    expect(screen.getByTestId('hh-inhalation-blocked')).toBeInTheDocument();
  });

  it('does not re-seed VF/PEF when the substance changes (stays whatever the user typed)', () => {
    const { rerender } = render(
      <HHInhalationCalculator
        substanceKey="benzene"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    fireEvent.change(screen.getByTestId('hh-inhalation-vf-input'), {
      target: { value: '5000' },
    });
    rerender(
      <HHInhalationCalculator
        substanceKey="trichloroethylene"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    expect((screen.getByTestId('hh-inhalation-vf-input') as HTMLInputElement).value).toBe(
      '5000',
    );
  });

  it('re-seeds RfC/IUR when the substance changes to another wired substance (trichloroethylene)', () => {
    const { rerender } = render(
      <HHInhalationCalculator
        substanceKey="benzene"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    rerender(
      <HHInhalationCalculator
        substanceKey="trichloroethylene"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    expect((screen.getByTestId('hh-inhalation-rfc-input') as HTMLInputElement).value).toBe(
      '0.002',
    );
    expect((screen.getByTestId('hh-inhalation-iur-input') as HTMLInputElement).value).toBe(
      '0.0048',
    );
  });

  it('surfaces a parse error when a required exposure field is invalid', () => {
    render(
      <HHInhalationCalculator
        substanceKey="benzene"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    fireEvent.change(screen.getByTestId('hh-inhalation-ef-input'), {
      target: { value: 'not-a-number' },
    });
    expect(screen.getByTestId('hh-inhalation-error')).toHaveTextContent(
      /Exposure frequency must be a positive decimal number/i,
    );
  });

  it('always shows the VF/PEF fail-closed notice, regardless of block state', () => {
    render(
      <HHInhalationCalculator
        substanceKey="benzene"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    expect(screen.getByTestId('hh-inhalation-vfpef-notice')).toHaveTextContent(
      /Fail-closed by design/i,
    );
    fireEvent.change(screen.getByTestId('hh-inhalation-vf-input'), {
      target: { value: '10000' },
    });
    expect(screen.getByTestId('hh-inhalation-vfpef-notice')).toBeInTheDocument();
  });

  it('renders the provenance panel attributing RfC/IUR to the human-health-direct pathway catalog rows', () => {
    render(
      <HHInhalationCalculator
        substanceKey="benzene"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    // CalculatorProvenancePanel renders a details/summary disclosure; assert it mounted
    // without asserting its internal implementation (covered by its own test suite).
    expect(screen.getByText(/Inhalation RfC \(non-cancer\)/i)).toBeInTheDocument();
  });

  // Regression tests for the two codex ship-gate P2 findings (2026-07-17): the
  // provenance panel was showing the WRONG equation (borrowed from human-health-direct
  // ingestion/dermal) and losing catalog attribution for the converted IUR value.

  it('does not display the human-health-direct ingestion/dermal equation in the inhalation provenance panel', () => {
    render(
      <HHInhalationCalculator
        substanceKey="benzene"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    // "Human Health Direct Contact sediment screen" is the display_name of
    // eq-human-health-direct-contact in matrix_research/reference_catalog/equations.json
    // -- it must NEVER appear here now that equationIds is pinned to [].
    expect(
      screen.queryByText(/Human Health Direct Contact sediment screen/i),
    ).not.toBeInTheDocument();
  });

  it('attributes the as-wired benzene IUR to its exact Health Canada catalog row (source citation visible)', () => {
    render(
      <HHInhalationCalculator
        substanceKey="benzene"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    // pv-hc-benzene-hh-direct-iur cites src-health-canada-trv-v4-2025, short_citation
    // "Health Canada TRVs v4.0, 2025". This text can only appear if the parameter_value_id
    // override resolved the row (the tuple resolver alone cannot match a converted IUR).
    expect(screen.getByText(/Health Canada TRVs v4\.0, 2025/i)).toBeInTheDocument();
  });

  it('attributes the as-wired benzene RfC to its exact IRIS catalog row (source citation visible)', () => {
    render(
      <HHInhalationCalculator
        substanceKey="benzene"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    // pv-iris-benzene-hh-direct-rfc cites src-us-epa-iris-chemical-details-live.
    expect(screen.getByText(/US EPA IRIS chemical details, live/i)).toBeInTheDocument();
  });

  it('drops the exact-id IUR attribution once the user edits the value away from the seed', () => {
    render(
      <HHInhalationCalculator
        substanceKey="benzene"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    expect(screen.getByText(/Health Canada TRVs v4\.0, 2025/i)).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('hh-inhalation-iur-input'), {
      target: { value: '0.5' },
    });
    // The edited value no longer matches the wired seed, so the exact catalog
    // attribution (and its source citation) must be dropped, not silently kept.
    expect(
      screen.queryByText(/Health Canada TRVs v4\.0, 2025/i),
    ).not.toBeInTheDocument();
  });

  it('the IUR "View alternatives" button filters by the catalog\'s real input_key, not the calculator\'s own field name', () => {
    // Regression for codex ship-gate P3 (2026-07-17): CalculatorProvenancePanel's
    // per-row "View alternatives" button filters the evidence-library request by
    // row.input_key. The IUR row's own field name (iur_inhalation_per_mg_per_m3)
    // never matches the catalog's real key (unit_risk_inhalation_per_ug_m3), so the
    // button must use the catalog key while the exact-id attribution is active.
    const onOpenEvidenceLibrary = vi.fn();
    const { container } = render(
      <HHInhalationCalculator
        substanceKey="benzene"
        jurisdiction="bc-protocol1-v5-dra"
        onOpenEvidenceLibrary={onOpenEvidenceLibrary}
      />,
    );
    const button = container.querySelector(
      '[aria-label="View alternatives for Inhalation unit risk (cancer)"]',
    );
    expect(button).not.toBeNull();
    fireEvent.click(button as Element);
    expect(onOpenEvidenceLibrary).toHaveBeenCalledWith(
      expect.objectContaining({
        inputKeys: ['unit_risk_inhalation_per_ug_m3'],
      }),
    );
  });

  it('does not attribute RfC/IUR to any catalog row for a substance with no wired lookup entry (zinc)', () => {
    render(
      <HHInhalationCalculator
        substanceKey="zinc"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    expect(
      screen.queryByText(/Health Canada TRVs v4\.0, 2025/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/US EPA IRIS chemical details, live/i),
    ).not.toBeInTheDocument();
  });
  it('attributes both baseline thresholds (HQ + ILCR) to their BC CSR catalog rows', () => {
    render(
      <HHInhalationCalculator
        substanceKey="benzene"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    // Both threshold inputs now resolve to BC CSR: HQ -> pv-bc-csr-hi-target-ca and the
    // re-sourced ILCR -> pv-hc-pqra-v4-2024-ilcr-target-ca (now cites src-bc-csr-375-96),
    // both short_citation "B.C. Reg. 375/96 (CSR)", so it appears twice.
    expect(screen.getAllByText(/B\.C\. Reg\. 375\/96 \(CSR\)/i)).toHaveLength(2);
  });

  it('no longer attributes the baseline Target Risk to Health Canada PQRA (re-sourced to BC CSR s.18)', () => {
    render(
      <HHInhalationCalculator
        substanceKey="benzene"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    // pv-hc-pqra-v4-2024-ilcr-target-ca is re-sourced to src-bc-csr-375-96 (BC CSR s.18),
    // so the Health Canada PQRA citation is no longer attributed to the target-risk input.
    expect(screen.queryByText(/Health Canada PQRA v4\.0, 2024/i)).not.toBeInTheDocument();
  });

  it('drops the exact-id HQ/TR attribution once the user edits the values away from the seed', () => {
    render(
      <HHInhalationCalculator
        substanceKey="benzene"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    // Both HQ and TR resolve to BC CSR at baseline, so the citation appears twice.
    expect(screen.getAllByText(/B\.C\. Reg\. 375\/96 \(CSR\)/i)).toHaveLength(2);

    fireEvent.change(screen.getByTestId('hh-inhalation-hazard-quotient-input'), {
      target: { value: '0.2' },
    });
    // Editing HQ away from the seed drops ITS attribution; TR's BC CSR citation still remains.
    expect(screen.getAllByText(/B\.C\. Reg\. 375\/96 \(CSR\)/i)).toHaveLength(1);

    fireEvent.change(screen.getByTestId('hh-inhalation-target-risk-input'), {
      target: { value: '0.00002' },
    });
    // Editing TR away too drops the last BC CSR attribution.
    expect(screen.queryByText(/B\.C\. Reg\. 375\/96 \(CSR\)/i)).not.toBeInTheDocument();
  });
});
