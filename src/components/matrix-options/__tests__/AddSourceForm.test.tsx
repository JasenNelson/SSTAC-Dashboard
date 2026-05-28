import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AddSourceForm } from '../AddSourceForm';

// ---------------------------------------------------------------------------
// Module mock for source-sync server action
// ---------------------------------------------------------------------------

vi.mock('@/lib/matrix-options/provenance/source-sync', () => ({
  submitSource: vi.fn().mockResolvedValue({ success: false, source_id: null, error: 'unknown' }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fillRequired() {
  fireEvent.change(screen.getByTestId('source-short-citation'), {
    target: { value: 'Health Canada (2024)' },
  });
  fireEvent.change(screen.getByTestId('source-title'), {
    target: { value: 'Guidelines for Canadian Drinking Water Quality' },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AddSourceForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all required and optional fields', () => {
    render(<AddSourceForm />);

    expect(screen.getByTestId('add-source-form')).toBeInTheDocument();
    expect(screen.getByTestId('source-short-citation')).toBeInTheDocument();
    expect(screen.getByTestId('source-title')).toBeInTheDocument();
    expect(screen.getByTestId('source-year')).toBeInTheDocument();
    expect(screen.getByTestId('source-publisher')).toBeInTheDocument();
    expect(screen.getByTestId('source-doi')).toBeInTheDocument();
    expect(screen.getByTestId('source-url')).toBeInTheDocument();
    expect(screen.getByTestId('source-zotero-key')).toBeInTheDocument();
    expect(screen.getByTestId('source-id-input')).toBeInTheDocument();
    expect(screen.getByTestId('source-authority-scope')).toBeInTheDocument();
    expect(screen.getByTestId('source-authority-tier')).toBeInTheDocument();
    expect(screen.getByTestId('source-canonical-status')).toBeInTheDocument();
    expect(screen.getByTestId('source-role')).toBeInTheDocument();
    expect(screen.getByTestId('source-submit')).toBeInTheDocument();
  });

  it('submit button is disabled when both short_citation and title are empty', () => {
    render(<AddSourceForm />);
    expect(screen.getByTestId('source-submit')).toBeDisabled();
  });

  it('submit button is disabled when only short_citation is filled', () => {
    render(<AddSourceForm />);
    fireEvent.change(screen.getByTestId('source-short-citation'), {
      target: { value: 'Health Canada (2024)' },
    });
    expect(screen.getByTestId('source-submit')).toBeDisabled();
  });

  it('submit button is disabled when only title is filled', () => {
    render(<AddSourceForm />);
    fireEvent.change(screen.getByTestId('source-title'), {
      target: { value: 'Guidelines for Canadian Drinking Water Quality' },
    });
    expect(screen.getByTestId('source-submit')).toBeDisabled();
  });

  it('submit button is enabled when both short_citation and title are filled', async () => {
    render(<AddSourceForm />);
    await fillRequired();
    expect(screen.getByTestId('source-submit')).not.toBeDisabled();
  });

  it('calls submitSource with trimmed values on submit', async () => {
    const { submitSource } = await import('@/lib/matrix-options/provenance/source-sync');
    vi.mocked(submitSource).mockResolvedValue({ success: true, source_id: 'src-hitl-test-123', error: null });

    const onAdded = vi.fn();
    render(<AddSourceForm onAdded={onAdded} />);

    await fillRequired();

    // Fill optional fields
    fireEvent.change(screen.getByTestId('source-year'), { target: { value: '2024' } });
    fireEvent.change(screen.getByTestId('source-publisher'), { target: { value: '  Health Canada  ' } });
    fireEvent.change(screen.getByTestId('source-doi'), { target: { value: '10.1234/abc' } });
    fireEvent.change(screen.getByTestId('source-url'), { target: { value: 'https://example.com' } });
    fireEvent.change(screen.getByTestId('source-zotero-key'), { target: { value: 'ABCD1234' } });

    fireEvent.click(screen.getByTestId('source-submit'));

    await waitFor(() => {
      expect(submitSource).toHaveBeenCalledTimes(1);
    });

    const call = vi.mocked(submitSource).mock.calls[0][0];
    expect(call.short_citation).toBe('Health Canada (2024)');
    expect(call.title).toBe('Guidelines for Canadian Drinking Water Quality');
    expect(call.year).toBe(2024);
    expect(call.publisher).toBe('Health Canada');
    expect(call.doi).toBe('10.1234/abc');
    expect(call.url).toBe('https://example.com');
    expect(call.zotero_key).toBe('ABCD1234');
  });

  it('passes null for empty optional fields', async () => {
    const { submitSource } = await import('@/lib/matrix-options/provenance/source-sync');
    vi.mocked(submitSource).mockResolvedValue({ success: true, source_id: 'src-test', error: null });

    render(<AddSourceForm />);
    await fillRequired();
    fireEvent.click(screen.getByTestId('source-submit'));

    await waitFor(() => {
      expect(submitSource).toHaveBeenCalledTimes(1);
    });

    const call = vi.mocked(submitSource).mock.calls[0][0];
    expect(call.doi).toBeNull();
    expect(call.url).toBeNull();
    expect(call.zotero_key).toBeNull();
    expect(call.year).toBeNull();
  });

  it('shows duplicate_source_id error message', async () => {
    const { submitSource } = await import('@/lib/matrix-options/provenance/source-sync');
    vi.mocked(submitSource).mockResolvedValue({ success: false, source_id: null, error: 'duplicate_source_id' });

    render(<AddSourceForm />);
    await fillRequired();
    fireEvent.click(screen.getByTestId('source-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('add-source-error')).toBeInTheDocument();
    });

    expect(screen.getByTestId('add-source-error')).toHaveTextContent(
      'A source with that ID already exists.',
    );
  });

  it('shows admin_required error message', async () => {
    const { submitSource } = await import('@/lib/matrix-options/provenance/source-sync');
    vi.mocked(submitSource).mockResolvedValue({ success: false, source_id: null, error: 'admin_required' });

    render(<AddSourceForm />);
    await fillRequired();
    fireEvent.click(screen.getByTestId('source-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('add-source-error')).toBeInTheDocument();
    });

    expect(screen.getByTestId('add-source-error')).toHaveTextContent('Admin access required.');
  });

  it('shows generic error message for unknown errors', async () => {
    const { submitSource } = await import('@/lib/matrix-options/provenance/source-sync');
    vi.mocked(submitSource).mockResolvedValue({ success: false, source_id: null, error: 'unknown' });

    render(<AddSourceForm />);
    await fillRequired();
    fireEvent.click(screen.getByTestId('source-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('add-source-error')).toBeInTheDocument();
    });

    expect(screen.getByTestId('add-source-error')).toHaveTextContent('Failed to add source. Try again.');
  });

  it('calls onAdded callback with source_id on success', async () => {
    const { submitSource } = await import('@/lib/matrix-options/provenance/source-sync');
    vi.mocked(submitSource).mockResolvedValue({ success: true, source_id: 'src-hitl-health-canada-2024', error: null });

    const onAdded = vi.fn();
    render(<AddSourceForm onAdded={onAdded} />);
    await fillRequired();
    fireEvent.click(screen.getByTestId('source-submit'));

    await waitFor(() => {
      expect(onAdded).toHaveBeenCalledTimes(1);
    });

    expect(onAdded).toHaveBeenCalledWith('src-hitl-health-canada-2024');
  });

  it('does not call onAdded on error', async () => {
    const { submitSource } = await import('@/lib/matrix-options/provenance/source-sync');
    vi.mocked(submitSource).mockResolvedValue({ success: false, source_id: null, error: 'duplicate_source_id' });

    const onAdded = vi.fn();
    render(<AddSourceForm onAdded={onAdded} />);
    await fillRequired();
    fireEvent.click(screen.getByTestId('source-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('add-source-error')).toBeInTheDocument();
    });

    expect(onAdded).not.toHaveBeenCalled();
  });

  it('calls onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(<AddSourceForm onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/ }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not render cancel button when onCancel is not provided', () => {
    render(<AddSourceForm />);
    expect(screen.queryByRole('button', { name: /^Cancel$/ })).not.toBeInTheDocument();
  });

  it('passes user-supplied source_id with special characters to submitSource for server-side normalization', async () => {
    // The form passes the raw source_id value to submitSource unchanged.
    // Normalization (slugification) happens inside submitSource on the server.
    // This test confirms the form does not drop or pre-transform special characters.
    const { submitSource } = await import('@/lib/matrix-options/provenance/source-sync');
    vi.mocked(submitSource).mockResolvedValue({ success: true, source_id: 'my-source-2024', error: null });

    render(<AddSourceForm />);
    await fillRequired();

    fireEvent.change(screen.getByTestId('source-id-input'), {
      target: { value: 'MY-Source/2024' },
    });

    fireEvent.click(screen.getByTestId('source-submit'));

    await waitFor(() => {
      expect(submitSource).toHaveBeenCalledTimes(1);
    });

    const call = vi.mocked(submitSource).mock.calls[0][0];
    // Form passes the raw value; submitSource normalizes to 'my-source-2024'.
    expect(call.source_id).toBe('MY-Source/2024');
  });

  it('does not show error panel when form is freshly rendered', () => {
    render(<AddSourceForm />);
    expect(screen.queryByTestId('add-source-error')).not.toBeInTheDocument();
  });

  it('passes the manual source_id when provided', async () => {
    const { submitSource } = await import('@/lib/matrix-options/provenance/source-sync');
    vi.mocked(submitSource).mockResolvedValue({ success: true, source_id: 'src-custom-id', error: null });

    render(<AddSourceForm />);
    await fillRequired();

    fireEvent.change(screen.getByTestId('source-id-input'), {
      target: { value: 'src-custom-id' },
    });

    fireEvent.click(screen.getByTestId('source-submit'));

    await waitFor(() => {
      expect(submitSource).toHaveBeenCalledTimes(1);
    });

    const call = vi.mocked(submitSource).mock.calls[0][0];
    expect(call.source_id).toBe('src-custom-id');
  });

  it('passes empty string for source_id when not provided (triggers auto-generation server-side)', async () => {
    const { submitSource } = await import('@/lib/matrix-options/provenance/source-sync');
    vi.mocked(submitSource).mockResolvedValue({ success: true, source_id: 'src-hitl-auto', error: null });

    render(<AddSourceForm />);
    await fillRequired();
    fireEvent.click(screen.getByTestId('source-submit'));

    await waitFor(() => {
      expect(submitSource).toHaveBeenCalledTimes(1);
    });

    const call = vi.mocked(submitSource).mock.calls[0][0];
    expect(call.source_id).toBe('');
  });

  it('renders default select values for authority_scope, authority_tier, canonical_status, role', () => {
    render(<AddSourceForm />);

    expect(
      (screen.getByTestId('source-authority-scope') as HTMLSelectElement).value,
    ).toBe('BC');
    expect(
      (screen.getByTestId('source-authority-tier') as HTMLSelectElement).value,
    ).toBe('tier_1_government_or_regulatory');
    expect(
      (screen.getByTestId('source-canonical-status') as HTMLSelectElement).value,
    ).toBe('needs_direct_source_check');
    expect(
      (screen.getByTestId('source-role') as HTMLSelectElement).value,
    ).toBe('canonical_candidate');
  });

  it('passes selected authority_scope, authority_tier, canonical_status, role to submitSource', async () => {
    const { submitSource } = await import('@/lib/matrix-options/provenance/source-sync');
    vi.mocked(submitSource).mockResolvedValue({ success: true, source_id: 'src-test', error: null });

    render(<AddSourceForm />);
    await fillRequired();

    fireEvent.change(screen.getByTestId('source-authority-scope'), { target: { value: 'general' } });
    fireEvent.change(screen.getByTestId('source-authority-tier'), { target: { value: 'tier_3_supporting_science' } });
    fireEvent.change(screen.getByTestId('source-canonical-status'), { target: { value: 'direct_source_verified' } });
    fireEvent.change(screen.getByTestId('source-role'), { target: { value: 'reference_mining' } });

    fireEvent.click(screen.getByTestId('source-submit'));

    await waitFor(() => {
      expect(submitSource).toHaveBeenCalledTimes(1);
    });

    const call = vi.mocked(submitSource).mock.calls[0][0];
    expect(call.authority_scope).toBe('general');
    expect(call.authority_tier).toBe('tier_3_supporting_science');
    expect(call.canonical_source_status).toBe('direct_source_verified');
    expect(call.role).toBe('reference_mining');
  });
});
