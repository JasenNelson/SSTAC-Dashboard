import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DraPublishControl, DraRow, DraAuditRow } from '../DraPublishControl';

const mockDras: DraRow[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Test DRA 1',
    agency: 'Agency 1',
    year: 2026,
    public: false,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    title: 'Test DRA 2',
    agency: 'Agency 2',
    year: 2026,
    public: true,
  }
];

const mockAuditHistory: DraAuditRow[] = [
  {
    id: 'a1111111-1111-4111-8111-111111111111',
    dra_id: '22222222-2222-4222-8222-222222222222',
    prior_value: false,
    new_value: true,
    changed_at: '2026-07-01T12:00:00.000Z',
    changed_by_email: 'admin@example.com',
    reason: 'TWG review complete',
  },
];

describe('DraPublishControl', () => {
  let fetchMock: any;

  beforeEach(() => {
    fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true })
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render publish/unpublish buttons when isAdmin is false', () => {
    render(<DraPublishControl initialDras={mockDras} isAdmin={false} />);
    
    // Select a row to reveal details
    fireEvent.click(screen.getByTestId('dra-row-11111111-1111-4111-8111-111111111111'));
    
    // Check that there is no publish or unpublish button
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unpublish' })).not.toBeInTheDocument();
  });

  it('keeps the confirm submit button disabled when reason textarea is empty', async () => {
    render(<DraPublishControl initialDras={mockDras} isAdmin={true} />);
    
    // Select the first (private) row
    fireEvent.click(screen.getByTestId('dra-row-11111111-1111-4111-8111-111111111111'));
    
    // Click 'Publish' to open confirm form
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    
    // Find the textarea and the confirm button
    const confirmButton = screen.getByRole('button', { name: 'Confirm publish' });
    const textarea = screen.getByLabelText('Reason for visibility change');
    
    expect(textarea).toHaveValue('');
    expect(confirmButton).toBeDisabled();
    
    // Fill with only whitespace
    await userEvent.type(textarea, '   ');
    expect(confirmButton).toBeDisabled();
  });

  it('enables the confirm button when reason is filled and calls fetch correctly on submit', async () => {
    render(<DraPublishControl initialDras={mockDras} isAdmin={true} />);
    
    // Select the first (private) row
    fireEvent.click(screen.getByTestId('dra-row-11111111-1111-4111-8111-111111111111'));
    
    // Click 'Publish' to open confirm form
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    
    const confirmButton = screen.getByRole('button', { name: 'Confirm publish' });
    const textarea = screen.getByLabelText('Reason for visibility change');
    
    // Fill reason
    await userEvent.type(textarea, 'Ready for public view');
    expect(confirmButton).not.toBeDisabled();
    
    // Submit
    fireEvent.click(confirmButton);
    
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    
    expect(fetchMock).toHaveBeenCalledWith('/api/matrix-map/admin/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dra_id: '11111111-1111-4111-8111-111111111111',
        public: true,
        reason: 'Ready for public view',
      }),
    });
  });

  it('does not contain any bulk or publish all controls', () => {
    render(<DraPublishControl initialDras={mockDras} isAdmin={true} />);

    // Check by common bulk action texts
    const bulkTexts = [/publish all/i, /unpublish all/i, /bulk publish/i, /select all/i];

    bulkTexts.forEach((text) => {
      expect(screen.queryByText(text)).not.toBeInTheDocument();
    });
  });

  it('shows current public/private state and offers Unpublish for a public DRA', () => {
    render(<DraPublishControl initialDras={mockDras} isAdmin={true} />);

    // Select the second (public) row
    fireEvent.click(screen.getByTestId('dra-row-22222222-2222-4222-8222-222222222222'));

    // Status line shows Public
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getAllByText('Public').length).toBeGreaterThan(0);

    // Action button offers Unpublish, not Publish, for an already-public DRA
    expect(screen.getByRole('button', { name: 'Unpublish' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
  });

  it('calls fetch with public:false when unpublishing', async () => {
    render(<DraPublishControl initialDras={mockDras} isAdmin={true} />);

    // Select the second (public) row
    fireEvent.click(screen.getByTestId('dra-row-22222222-2222-4222-8222-222222222222'));

    fireEvent.click(screen.getByRole('button', { name: 'Unpublish' }));

    const confirmButton = screen.getByRole('button', { name: 'Confirm unpublish' });
    const textarea = screen.getByLabelText('Reason for visibility change');

    await userEvent.type(textarea, 'Withdrawn pending correction');
    expect(confirmButton).not.toBeDisabled();

    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/matrix-map/admin/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dra_id: '22222222-2222-4222-8222-222222222222',
        public: false,
        reason: 'Withdrawn pending correction',
      }),
    });

    // After a successful unpublish, the row's local state flips to Private
    // and the action button now offers Publish again.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
    });
  });

  it('renders audit history rows scoped to the selected DRA and an empty state for DRAs with no history', () => {
    render(
      <DraPublishControl
        initialDras={mockDras}
        isAdmin={true}
        auditHistory={mockAuditHistory}
      />
    );

    // DRA 2 has one audit row -- selecting it shows the history list, not the empty state.
    fireEvent.click(screen.getByTestId('dra-row-22222222-2222-4222-8222-222222222222'));
    expect(screen.getByTestId('dra-audit-history-list')).toBeInTheDocument();
    expect(screen.getByText(/admin@example.com/)).toBeInTheDocument();
    expect(screen.getByText(/TWG review complete/)).toBeInTheDocument();

    // DRA 1 has no audit rows -- selecting it shows the empty state, not DRA 2's history.
    fireEvent.click(screen.getByTestId('dra-row-11111111-1111-4111-8111-111111111111'));
    expect(screen.getByTestId('dra-audit-history-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('dra-audit-history-list')).not.toBeInTheDocument();
  });

  it('renders the audit-history empty state when auditHistory is omitted (optional prop, backward compatible)', () => {
    render(<DraPublishControl initialDras={mockDras} isAdmin={true} />);

    fireEvent.click(screen.getByTestId('dra-row-11111111-1111-4111-8111-111111111111'));
    expect(screen.getByTestId('dra-audit-history-empty')).toBeInTheDocument();
  });
});
