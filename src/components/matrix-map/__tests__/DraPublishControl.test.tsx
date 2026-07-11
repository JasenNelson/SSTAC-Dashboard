import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DraPublishControl, DraRow } from '../DraPublishControl';

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
});
