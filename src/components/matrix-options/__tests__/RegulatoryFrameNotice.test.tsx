import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import RegulatoryFrameNotice from '../RegulatoryFrameNotice';
import {
  getRegulatoryFrame,
  getPathwayApplicability,
  pathwayApplicabilityLabel,
} from '@/lib/matrix-options/regulatoryFrames';

describe('RegulatoryFrameNotice', () => {
  describe('bc-protocol1-v5-dra frame + eco-direct-eqp pathway', () => {
    it('renders the frame short label', () => {
      render(
        <RegulatoryFrameNotice
          frameId="bc-protocol1-v5-dra"
          pathway="eco-direct-eqp"
        />,
      );

      const frame = getRegulatoryFrame('bc-protocol1-v5-dra');
      expect(screen.getByText(frame.shortLabel)).toBeInTheDocument();
    });

    it('shows pathway applicability badge', () => {
      render(
        <RegulatoryFrameNotice
          frameId="bc-protocol1-v5-dra"
          pathway="eco-direct-eqp"
        />,
      );

      const applicability = getPathwayApplicability('bc-protocol1-v5-dra', 'eco-direct-eqp');
      const label = pathwayApplicabilityLabel(applicability.status);
      expect(screen.getByText(label)).toBeInTheDocument();
    });

    it('shows applicability note text', () => {
      render(
        <RegulatoryFrameNotice
          frameId="bc-protocol1-v5-dra"
          pathway="eco-direct-eqp"
        />,
      );

      const applicability = getPathwayApplicability('bc-protocol1-v5-dra', 'eco-direct-eqp');
      expect(screen.getByText(applicability.note)).toBeInTheDocument();
    });

    it('shows source hierarchy primary source label', () => {
      render(
        <RegulatoryFrameNotice
          frameId="bc-protocol1-v5-dra"
          pathway="eco-direct-eqp"
        />,
      );

      const frame = getRegulatoryFrame('bc-protocol1-v5-dra');
      const primaryLabel = frame.sourceHierarchy[0]?.label ?? 'Project-approved sources';
      expect(screen.getByText(new RegExp(primaryLabel))).toBeInTheDocument();
    });

    it('shows "Current effect" disclaimer', () => {
      render(
        <RegulatoryFrameNotice
          frameId="bc-protocol1-v5-dra"
          pathway="eco-direct-eqp"
        />,
      );

      expect(
        screen.getByText(
          /Current effect: frame selection changes value lookup filters/,
        ),
      ).toBeInTheDocument();
    });

    it('has correct data-testid for the section', () => {
      render(
        <RegulatoryFrameNotice
          frameId="bc-protocol1-v5-dra"
          pathway="eco-direct-eqp"
        />,
      );

      expect(
        screen.getByTestId('regulatory-frame-notice-eco-direct-eqp'),
      ).toBeInTheDocument();
    });

    it('has correct data-testid for the effect paragraph', () => {
      render(
        <RegulatoryFrameNotice
          frameId="bc-protocol1-v5-dra"
          pathway="eco-direct-eqp"
        />,
      );

      expect(
        screen.getByTestId('regulatory-frame-effect-eco-direct-eqp'),
      ).toBeInTheDocument();
    });

    it('shows safe use note from the frame', () => {
      render(
        <RegulatoryFrameNotice
          frameId="bc-protocol1-v5-dra"
          pathway="eco-direct-eqp"
        />,
      );

      const frame = getRegulatoryFrame('bc-protocol1-v5-dra');
      expect(screen.getByText(new RegExp(frame.safeUseNote))).toBeInTheDocument();
    });
  });

  describe('different frames and pathways', () => {
    it('renders bc-csr-sediment-numerical + background-adjustment pathway', () => {
      render(
        <RegulatoryFrameNotice
          frameId="bc-csr-sediment-numerical"
          pathway="background-adjustment"
        />,
      );

      const frame = getRegulatoryFrame('bc-csr-sediment-numerical');
      expect(screen.getByText(frame.shortLabel)).toBeInTheDocument();
      expect(
        screen.getByTestId('regulatory-frame-notice-background-adjustment'),
      ).toBeInTheDocument();
    });

    it('renders canada-fcsap-aquatic + human-health-direct pathway', () => {
      render(
        <RegulatoryFrameNotice
          frameId="canada-fcsap-aquatic"
          pathway="human-health-direct"
        />,
      );

      const frame = getRegulatoryFrame('canada-fcsap-aquatic');
      expect(screen.getByText(frame.shortLabel)).toBeInTheDocument();
      expect(
        screen.getByTestId('regulatory-frame-notice-human-health-direct'),
      ).toBeInTheDocument();
    });

    it('renders "Unsupported" badge for an unsupported pathway', () => {
      render(
        <RegulatoryFrameNotice
          frameId="bc-csr-sediment-numerical"
          pathway="eco-food-bsaf"
        />,
      );

      expect(screen.getByText('Unsupported')).toBeInTheDocument();
    });

    it('renders "Calculation-ready" badge for a calculation_ready pathway', () => {
      render(
        <RegulatoryFrameNotice
          frameId="bc-protocol1-v5-dra"
          pathway="background-adjustment"
        />,
      );

      expect(screen.getByText('Calculation-ready')).toBeInTheDocument();
    });
  });

  describe('testid suffix matches pathway prop', () => {
    it('uses eco-food-bsaf as testid suffix for eco-food-bsaf pathway', () => {
      render(
        <RegulatoryFrameNotice
          frameId="bc-protocol1-v5-dra"
          pathway="eco-food-bsaf"
        />,
      );

      expect(
        screen.getByTestId('regulatory-frame-notice-eco-food-bsaf'),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('regulatory-frame-effect-eco-food-bsaf'),
      ).toBeInTheDocument();
    });

    it('uses human-health-food as testid suffix for human-health-food pathway', () => {
      render(
        <RegulatoryFrameNotice
          frameId="bc-protocol1-v5-dra"
          pathway="human-health-food"
        />,
      );

      expect(
        screen.getByTestId('regulatory-frame-notice-human-health-food'),
      ).toBeInTheDocument();
    });
  });

  describe('"Regulatory frame" label', () => {
    it('renders the "Regulatory frame" uppercase label', () => {
      render(
        <RegulatoryFrameNotice
          frameId="bc-protocol1-v5-dra"
          pathway="eco-direct-eqp"
        />,
      );

      expect(screen.getByText(/Regulatory frame/i)).toBeInTheDocument();
    });
  });
});
