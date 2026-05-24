import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="ssd-chart-container">{children}</div>
  ),
  ComposedChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="ssd-composed-chart">{children}</div>
  ),
  CartesianGrid: () => <div data-testid="ssd-chart-grid" />,
  XAxis: () => <div data-testid="ssd-chart-x-axis" />,
  YAxis: () => <div data-testid="ssd-chart-y-axis" />,
  Tooltip: () => <div data-testid="ssd-chart-tooltip" />,
  Legend: () => <div data-testid="ssd-chart-legend" />,
  Line: () => <div data-testid="ssd-chart-line" />,
  Scatter: () => <div data-testid="ssd-chart-scatter" />,
}));

import SsdWorkbench from '../SsdWorkbench';

describe('SsdWorkbench', () => {
  it('renders the fixture-backed SSD workbench and derived candidate receipt', () => {
    render(<SsdWorkbench />);

    expect(screen.getByTestId('ssd-workbench')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: /Species Sensitivity Distribution candidate generator/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Derived candidate only/i)).toBeInTheDocument();
    expect(screen.getByText(/582,125 rows/i)).toBeInTheDocument();
    expect(screen.getByText(/Upload CSV or JSON/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Water$/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /^Sediment$/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByTestId('ssd-composed-chart')).toBeInTheDocument();
    expect(screen.getByTestId('ssd-species-aggregate-table')).toBeInTheDocument();
    expect(screen.getByText(/Daphnia magna/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Species CSV/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Receipt JSON/i })).toBeInTheDocument();
    expect(screen.getByText(/Plot options/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Log scale$/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /^Linear$/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByLabelText(/Empirical curve/i)).toBeChecked();
    expect(screen.getByLabelText(/Fitted curve/i)).toBeChecked();
    expect(screen.getByLabelText(/Species points/i)).toBeChecked();
    expect(screen.getByTestId('ssd-model-diagnostics-table')).toBeInTheDocument();
    expect(screen.getAllByText(/Log-Normal fit/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('combobox', { name: /Distribution/i })).toHaveValue(
      'Log-Normal',
    );

    const receipt = screen
      .getByRole('heading', { name: /Derived candidate receipt/i })
      .closest('div');
    expect(receipt).not.toBeNull();
    expect(screen.getByText(/HC5 SSD-derived candidate/i)).toBeInTheDocument();
    expect(screen.getByText(/user entered or derived/i)).toBeInTheDocument();
    expect(screen.getByText(/needs review/i)).toBeInTheDocument();
  });

  it('shows an insufficient-data state instead of calculating an HCp value', () => {
    render(<SsdWorkbench />);

    fireEvent.click(screen.getByRole('button', { name: /^Marine$/ }));

    expect(screen.getByText(/^Needs data$/)).toBeInTheDocument();
    expect(
      screen.getByText(/Insufficient data for HCp preview/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/^2$/).length).toBeGreaterThan(0);
  });

  it('opens References & Values with a derived SSD filter request', () => {
    const handleOpenEvidenceLibrary = vi.fn();
    render(<SsdWorkbench onOpenEvidenceLibrary={handleOpenEvidenceLibrary} />);

    fireEvent.click(
      screen.getByRole('button', { name: /Compare in References & Values/i }),
    );

    expect(handleOpenEvidenceLibrary).toHaveBeenCalledWith({
      evidenceSupportStatuses: ['user_entered_or_derived'],
      search: 'SSD',
    });
  });

  it('updates endpoint filters and reports excluded rows', () => {
    render(<SsdWorkbench />);

    fireEvent.click(screen.getByRole('button', { name: /^Growth$/ }));

    expect(screen.getAllByText(/^4$/).length).toBeGreaterThan(0);
    const exclusions = screen.getByTestId('ssd-exclusions-table');
    expect(within(exclusions).getAllByText(/endpoint mismatch/i).length).toBeGreaterThan(0);
  });

  it('loads uploaded CSV data into the workbench source mode', async () => {
    render(<SsdWorkbench />);

    const csv = [
      'chemical,species,value,media,endpoint,group',
      'Zinc,Species 1,0.10,FW,Mortality,Fish',
      'Zinc,Species 2,0.11,FW,Mortality,Fish',
      'Zinc,Species 3,0.12,FW,Mortality,Fish',
      'Zinc,Species 4,0.13,FW,Mortality,Fish',
      'Zinc,Species 5,0.14,FW,Mortality,Fish',
    ].join('\n');
    const file = new File([csv], 'ssd-upload.csv', { type: 'text/csv' });
    Object.defineProperty(file, 'text', {
      value: () => Promise.resolve(csv),
    });

    fireEvent.change(screen.getByLabelText(/Upload CSV or JSON/i), {
      target: { files: [file] },
    });

    await waitFor(() =>
      expect(screen.getByText(/5 uploaded records loaded/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /^Upload$/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByDisplayValue('Zinc')).toBeInTheDocument();
    expect(screen.getAllByText(/^5$/).length).toBeGreaterThan(0);
  });
});
