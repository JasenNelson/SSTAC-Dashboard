import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import FrameImpactCard from '../FrameImpactCard';

describe('FrameImpactCard', () => {
  const defaultProps = {
    frameId: 'bc-protocol1-v5-dra' as const,
    pathway: 'eco-direct-eqp' as const,
    usedBaselineFallback: false,
  };

  it('renders the card container with the frame-applicability content', () => {
    render(<FrameImpactCard {...defaultProps} />);
    const card = screen.getByTestId('frame-impact-card');
    expect(card).toBeInTheDocument();
    expect(screen.getByText('Regulatory frame impact')).toBeInTheDocument();
    expect(screen.getByTestId('regulatory-frame-notice-eco-direct-eqp')).toBeInTheDocument();
    
    // Fallback notice should be absent
    expect(screen.queryByTestId('frame-variant-fallback-notice')).not.toBeInTheDocument();
  });

  it('renders the fallback notice when usedBaselineFallback is true', () => {
    render(
      <FrameImpactCard
        {...defaultProps}
        frameId="ccme-sediment-quality"
        usedBaselineFallback={true}
        fallbackReason="No specialized equation."
      />
    );
    expect(screen.getByTestId('frame-variant-fallback-notice')).toBeInTheDocument();
    expect(screen.getByText(/No specialized equation/)).toBeInTheDocument();
  });
});
