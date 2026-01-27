import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import QRCodeModal from '../QRCodeModal';

// Mock QRCodeDisplay component
vi.mock('@/components/dashboard/QRCodeDisplay', () => ({
  default: ({ pollGroup }: { pollGroup: string }) => (
    <div data-testid="qr-code-display">{`QR Code: ${pollGroup}`}</div>
  )
}));

describe('QRCodeModal', () => {
  it('should not render when isOpen is false', () => {
    const onClose = vi.fn();

    const { container } = render(
      <QRCodeModal
        isOpen={false}
        onClose={onClose}
        expandedPollGroup="holistic-protection"
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render when isOpen is true', () => {
    const onClose = vi.fn();

    render(
      <QRCodeModal
        isOpen={true}
        onClose={onClose}
        expandedPollGroup="holistic-protection"
      />
    );

    expect(screen.getByText('Conference Poll Access')).toBeInTheDocument();
  });

  it('should display the correct web address for holistic-protection', () => {
    const onClose = vi.fn();

    render(
      <QRCodeModal
        isOpen={true}
        onClose={onClose}
        expandedPollGroup="holistic-protection"
      />
    );

    expect(screen.getByText('bit.ly/SABCS-Holistic')).toBeInTheDocument();
  });

  it('should display the correct web address for tiered-framework', () => {
    const onClose = vi.fn();

    render(
      <QRCodeModal
        isOpen={true}
        onClose={onClose}
        expandedPollGroup="tiered-framework"
      />
    );

    expect(screen.getByText('bit.ly/SABCS-Tiered')).toBeInTheDocument();
  });

  it('should display the correct web address for prioritization', () => {
    const onClose = vi.fn();

    render(
      <QRCodeModal
        isOpen={true}
        onClose={onClose}
        expandedPollGroup="prioritization"
      />
    );

    expect(screen.getByText('bit.ly/SABCS-Prio')).toBeInTheDocument();
  });

  it('should display default web address when expandedPollGroup is null', () => {
    const onClose = vi.fn();

    render(
      <QRCodeModal
        isOpen={true}
        onClose={onClose}
        expandedPollGroup={null}
      />
    );

    expect(screen.getByText('bit.ly/SABCS-Holistic')).toBeInTheDocument();
  });

  it('should always display CEW2025 password', () => {
    const onClose = vi.fn();

    render(
      <QRCodeModal
        isOpen={true}
        onClose={onClose}
        expandedPollGroup="tiered-framework"
      />
    );

    expect(screen.getByText('CEW2025')).toBeInTheDocument();
  });

  it('should render QRCodeDisplay component', () => {
    const onClose = vi.fn();

    render(
      <QRCodeModal
        isOpen={true}
        onClose={onClose}
        expandedPollGroup="holistic-protection"
      />
    );

    expect(screen.getByTestId('qr-code-display')).toBeInTheDocument();
  });

  it('should pass correct pollGroup to QRCodeDisplay', () => {
    const onClose = vi.fn();

    render(
      <QRCodeModal
        isOpen={true}
        onClose={onClose}
        expandedPollGroup="prioritization"
      />
    );

    expect(screen.getByText('QR Code: prioritization')).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn();

    render(
      <QRCodeModal
        isOpen={true}
        onClose={onClose}
        expandedPollGroup="holistic-protection"
      />
    );

    const closeButton = screen.getByRole('button');
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when modal overlay is clicked', () => {
    const onClose = vi.fn();

    const { container } = render(
      <QRCodeModal
        isOpen={true}
        onClose={onClose}
        expandedPollGroup="holistic-protection"
      />
    );

    // Find the overlay div (first child of fixed inset-0 container)
    const overlay = container.querySelector('.fixed.inset-0');
    if (overlay) {
      fireEvent.click(overlay);
      expect(onClose).toHaveBeenCalled();
    }
  });

  it('should not call onClose when modal content is clicked', () => {
    const onClose = vi.fn();

    render(
      <QRCodeModal
        isOpen={true}
        onClose={onClose}
        expandedPollGroup="holistic-protection"
      />
    );

    const modalContent = screen.getByText('Conference Poll Access').closest('div');
    if (modalContent) {
      fireEvent.click(modalContent);
    }

    expect(onClose).not.toHaveBeenCalled();
  });

  it('should display both Join at and Password sections', () => {
    const onClose = vi.fn();

    render(
      <QRCodeModal
        isOpen={true}
        onClose={onClose}
        expandedPollGroup="holistic-protection"
      />
    );

    expect(screen.getByText('Join at:')).toBeInTheDocument();
    expect(screen.getByText('Password:')).toBeInTheDocument();
  });

  it('should render modal with correct structure', () => {
    const onClose = vi.fn();

    const { container } = render(
      <QRCodeModal
        isOpen={true}
        onClose={onClose}
        expandedPollGroup="holistic-protection"
      />
    );

    // Check modal structure exists (overlay container)
    const overlay = container.querySelector('[class*="fixed"][class*="inset-0"]');
    expect(overlay).toBeInTheDocument();

    // Check modal content exists with styling
    const modalContent = container.querySelector('[class*="bg-white"]');
    expect(modalContent).toBeInTheDocument();
  });
});
