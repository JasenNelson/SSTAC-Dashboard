import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

function mockFetchJson(payload: unknown, status = 200) {
  const fetchMock = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('SsdWorkbench', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders the validation-backed SSD workbench and derived candidate receipt', () => {
    render(<SsdWorkbench />);

    expect(screen.getByTestId('ssd-workbench')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: /Species Sensitivity Distribution candidate generator/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Derived candidate only/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Run SSD/i })).toBeInTheDocument();
    expect(screen.getByText(/Results match the current staged settings/i)).toBeInTheDocument();
    expect(screen.getByText(/582,125 rows/i)).toBeInTheDocument();
    expect(screen.getByText(/Upload CSV or JSON/i)).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: /Validation dataset/i }),
    ).toHaveValue('copper_preview');
    expect(screen.getAllByText(/Preview dataset/i).length).toBeGreaterThan(0);
    expect(screen.getByTestId('ssd-validation-panel')).toBeInTheDocument();
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
    expect(screen.getAllByText(/Log-Normal \(lnorm\)/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Log-Gumbel \(lgumbel\)/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Log-Normal Mixture \(lnorm_lnorm\)/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/BCANZ ssdtools candidate distribution/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('combobox', { name: /Distribution/i })).toHaveValue(
      'Log-Normal',
    );
    expect(screen.getByText(/^Weight$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Delta$/i)).toBeInTheDocument();

    const receipt = screen
      .getByRole('heading', { name: /Derived candidate receipt/i })
      .closest('div');
    expect(receipt).not.toBeNull();
    expect(screen.getByText(/HC5 SSD-derived candidate/i)).toBeInTheDocument();
    expect(screen.getByText(/user entered or derived/i)).toBeInTheDocument();
    expect(screen.getByText(/needs review/i)).toBeInTheDocument();
  });

  it('shows a safe not-configured ECOTOX mirror receipt', async () => {
    const fetchMock = mockFetchJson(
      {
        error: 'ecotox_supabase_not_configured',
        configured: false,
        missing: ['ECOTOX_SUPABASE_URL', 'ECOTOX_SUPABASE_ANON_KEY'],
        invalid: [],
        table: 'toxicology_data',
        rowCount: null,
        rowCountAvailable: false,
        readable: false,
      },
      503,
    );

    render(<SsdWorkbench />);
    expect(screen.getByRole('button', { name: /Search mirror/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Load records/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /ECOTOX mirror/i }));

    await waitFor(() =>
      expect(screen.getByText(/Mirror not configured/i)).toBeInTheDocument(),
    );
    const healthPanel = screen.getByTestId('ssd-ecotox-health-panel');
    expect(
      within(healthPanel).getByText(/ECOTOX_SUPABASE_URL/i),
    ).toBeInTheDocument();
    expect(
      within(healthPanel).getByText(/No service-role key is used or required/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Search mirror/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Load records/i })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledWith('/api/matrix-options/ssd/records');
  });

  it('shows configured ECOTOX mirror health without exposing credentials', async () => {
    const fetchMock = mockFetchJson({
      configured: true,
      status: 'ok',
      table: 'toxicology_data',
      requiredColumns: ['chemical_name'],
      rowCount: 582125,
      rowCountAvailable: true,
      readable: true,
      limits: {
        search: 50,
        pageSize: 1000,
        maxFetchRows: 5000,
      },
    });

    render(<SsdWorkbench />);
    fireEvent.click(screen.getByRole('button', { name: /ECOTOX mirror/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/Read-only mirror connected/i),
      ).toBeInTheDocument(),
    );
    const healthPanel = screen.getByTestId('ssd-ecotox-health-panel');
    expect(within(healthPanel).getAllByText(/582,125/i).length).toBeGreaterThan(0);
    expect(within(healthPanel).getByText(/Search limit/i)).toBeInTheDocument();
    expect(within(healthPanel).getByText(/^50$/)).toBeInTheDocument();
    expect(within(healthPanel).getByText(/Record load cap/i)).toBeInTheDocument();
    expect(within(healthPanel).getByText(/^5,000$/)).toBeInTheDocument();
    expect(
      within(healthPanel).queryByText(/private-anon-key/i),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Search mirror/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /Load records/i })).not.toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('switches validation mode to the CCME validation datasets', () => {
    render(<SsdWorkbench />);

    fireEvent.change(
      screen.getByRole('combobox', { name: /Validation dataset/i }),
      {
        target: { value: 'ccme_boron_validation' },
      },
    );

    expect(screen.getByDisplayValue('Boron')).toBeInTheDocument();
    expect(screen.getAllByText(/Validation dataset/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/CCME boron validation dataset/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/28 source rows/i)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: /Analysis mode/i }), {
      target: { value: 'model_averaging' },
    });
    expect(screen.getByText(/Settings are staged/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Run SSD/i }));
    expect(screen.getByText(/Reference checks/i)).toBeInTheDocument();
    expect(screen.getByText(/BCANZ model-average HC5/i)).toBeInTheDocument();
    expect(screen.getByText(/Within tolerance/i)).toBeInTheDocument();

    fireEvent.change(
      screen.getByRole('combobox', { name: /Validation dataset/i }),
      {
        target: { value: 'ccme_endosulfan_validation' },
      },
    );

    expect(screen.getByDisplayValue('Endosulfan')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Run SSD/i }));
    expect(
      screen.getAllByText(/CCME endosulfan validation dataset/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/Published model-average HC5/i)).toBeInTheDocument();
    expect(screen.getByText(/Within tolerance/i)).toBeInTheDocument();
    expect(screen.getByText(/0.00767326 ng\/L/i)).toBeInTheDocument();
    expect(screen.queryByText(/ssddata::/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ssd_fits/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/12 source rows/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/ng\/L/i).length).toBeGreaterThan(0);
  });

  it('shows an insufficient-data state instead of calculating an HCp value', () => {
    render(<SsdWorkbench />);

    fireEvent.click(screen.getByRole('button', { name: /^Marine$/ }));
    fireEvent.click(screen.getByRole('button', { name: /Run SSD/i }));

    expect(screen.getByText(/^Needs data$/)).toBeInTheDocument();
    expect(
      screen.getByText(/Insufficient data for HCp preview/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/^2$/).length).toBeGreaterThan(0);
  });

  it('can show optional bootstrap confidence interval output', () => {
    render(<SsdWorkbench />);

    fireEvent.change(screen.getByRole('combobox', { name: /Bootstrap CI/i }), {
      target: { value: '25' },
    });

    expect(screen.getByText(/Settings are staged/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/deterministic TypeScript percentile/i),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Run SSD/i }));

    expect(screen.getAllByText(/Bootstrap CI/i).length).toBeGreaterThan(1);
    expect(screen.getByText(/deterministic TypeScript percentile/i)).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: /Run SSD/i }));

    expect(screen.getAllByText(/^4$/).length).toBeGreaterThan(0);
    const exclusions = screen.getByTestId('ssd-exclusions-table');
    expect(within(exclusions).getAllByText(/endpoint mismatch/i).length).toBeGreaterThan(0);
  });

  it('clicking a chemical suggestion toggles it into the selected chip bar', async () => {
    mockFetchJson({
      configured: true,
      status: 'ok',
      table: 'toxicology_data',
      rowCount: 582125,
      rowCountAvailable: true,
      readable: true,
      limits: { search: 50, pageSize: 1000, maxFetchRows: 5000 },
    });

    render(<SsdWorkbench />);
    fireEvent.click(screen.getByRole('button', { name: /ECOTOX mirror/i }));
    await waitFor(() =>
      expect(screen.getByText(/Read-only mirror connected/i)).toBeInTheDocument(),
    );

    const searchFetch = vi.fn(async (url: string) => {
      if (typeof url === 'string' && url.includes('/chemicals')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ chemicals: ['Copper', 'Cadmium', 'Lead'] }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', searchFetch);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Co' } });
    fireEvent.click(screen.getByRole('button', { name: /Search mirror/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Copper$/ })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: /^Copper$/ }));
    const chipBar = screen.getByTestId('ssd-selected-chemicals-bar');
    expect(chipBar).toBeInTheDocument();
    expect(within(chipBar).getByText(/Copper/)).toBeInTheDocument();
    expect(screen.getByText(/1\/12 selected/i)).toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: /^Copper$/ }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking X on a chip removes the chemical from selections', async () => {
    mockFetchJson({
      configured: true,
      status: 'ok',
      table: 'toxicology_data',
      rowCount: 582125,
      rowCountAvailable: true,
      readable: true,
      limits: { search: 50, pageSize: 1000, maxFetchRows: 5000 },
    });

    render(<SsdWorkbench />);
    fireEvent.click(screen.getByRole('button', { name: /ECOTOX mirror/i }));
    await waitFor(() =>
      expect(screen.getByText(/Read-only mirror connected/i)).toBeInTheDocument(),
    );

    const searchFetch = vi.fn(async (url: string) => {
      if (typeof url === 'string' && url.includes('/chemicals')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ chemicals: ['Copper'] }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', searchFetch);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Co' } });
    fireEvent.click(screen.getByRole('button', { name: /Search mirror/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Copper$/ })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: /^Copper$/ }));
    expect(screen.getByTestId('ssd-selected-chemicals-bar')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Remove Copper/i }));
    expect(screen.queryByTestId('ssd-selected-chemicals-bar')).not.toBeInTheDocument();
  });

  it('load records shows warning message when no chemicals are selected', async () => {
    mockFetchJson({
      configured: true,
      status: 'ok',
      table: 'toxicology_data',
      rowCount: 582125,
      rowCountAvailable: true,
      readable: true,
      limits: { search: 50, pageSize: 1000, maxFetchRows: 5000 },
    });

    render(<SsdWorkbench />);
    fireEvent.click(screen.getByRole('button', { name: /ECOTOX mirror/i }));
    await waitFor(() =>
      expect(screen.getByText(/Read-only mirror connected/i)).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: /Load records/i }));
    await waitFor(() =>
      expect(
        screen.getByText(/Select at least one chemical before loading records/i),
      ).toBeInTheDocument(),
    );
  });

  it('caps chemical selection at 12 and does not add a 13th', async () => {
    mockFetchJson({
      configured: true,
      status: 'ok',
      table: 'toxicology_data',
      rowCount: 582125,
      rowCountAvailable: true,
      readable: true,
      limits: { search: 50, pageSize: 1000, maxFetchRows: 5000 },
    });

    const chemicals = Array.from({ length: 13 }, (_, i) => `Chemical-${i + 1}`);

    render(<SsdWorkbench />);
    fireEvent.click(screen.getByRole('button', { name: /ECOTOX mirror/i }));
    await waitFor(() =>
      expect(screen.getByText(/Read-only mirror connected/i)).toBeInTheDocument(),
    );

    const searchFetch = vi.fn(async (url: string) => {
      if (typeof url === 'string' && url.includes('/chemicals')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ chemicals }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', searchFetch);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Chem' } });
    fireEvent.click(screen.getByRole('button', { name: /Search mirror/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Chemical-1$/ })).toBeInTheDocument(),
    );

    for (let i = 1; i <= 8; i++) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Chemical-${i}$`) }));
    }

    expect(screen.getByText(/8\/12 selected/i)).toBeInTheDocument();
  });

  it('switching to Validation data source clears selected chemicals', async () => {
    mockFetchJson({
      configured: true,
      status: 'ok',
      table: 'toxicology_data',
      rowCount: 582125,
      rowCountAvailable: true,
      readable: true,
      limits: { search: 50, pageSize: 1000, maxFetchRows: 5000 },
    });

    render(<SsdWorkbench />);
    fireEvent.click(screen.getByRole('button', { name: /ECOTOX mirror/i }));
    await waitFor(() =>
      expect(screen.getByText(/Read-only mirror connected/i)).toBeInTheDocument(),
    );

    const searchFetch = vi.fn(async (url: string) => {
      if (typeof url === 'string' && url.includes('/chemicals')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ chemicals: ['Copper'] }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', searchFetch);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Co' } });
    fireEvent.click(screen.getByRole('button', { name: /Search mirror/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Copper$/ })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: /^Copper$/ }));
    expect(screen.getByTestId('ssd-selected-chemicals-bar')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Validation$/ }));
    expect(screen.queryByTestId('ssd-selected-chemicals-bar')).not.toBeInTheDocument();
  });

  it('shows onboarding callout when ECOTOX mirror is not configured', async () => {
    mockFetchJson(
      {
        error: 'ecotox_supabase_not_configured',
        configured: false,
        missing: ['ECOTOX_SUPABASE_URL', 'ECOTOX_SUPABASE_ANON_KEY'],
        invalid: [],
        table: 'toxicology_data',
        rowCount: null,
        rowCountAvailable: false,
        readable: false,
      },
      503,
    );

    render(<SsdWorkbench />);
    fireEvent.click(screen.getByRole('button', { name: /ECOTOX mirror/i }));

    await waitFor(() =>
      expect(screen.getByTestId('ssd-ecotox-onboarding-callout')).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/Validation and Upload modes are fully functional without a mirror connection/i),
    ).toBeInTheDocument();
  });

  it('hides onboarding callout when ECOTOX mirror is configured', async () => {
    mockFetchJson({
      configured: true,
      status: 'ok',
      table: 'toxicology_data',
      requiredColumns: ['chemical_name'],
      rowCount: 582125,
      rowCountAvailable: true,
      readable: true,
      limits: {
        search: 50,
        pageSize: 1000,
        maxFetchRows: 5000,
      },
    });

    render(<SsdWorkbench />);
    fireEvent.click(screen.getByRole('button', { name: /ECOTOX mirror/i }));

    await waitFor(() =>
      expect(screen.getByText(/Read-only mirror connected/i)).toBeInTheDocument(),
    );
    expect(
      screen.queryByTestId('ssd-ecotox-onboarding-callout'),
    ).not.toBeInTheDocument();
  });

  it('shows health status dot on ECOTOX mirror button when not configured', async () => {
    mockFetchJson(
      {
        error: 'ecotox_supabase_not_configured',
        configured: false,
        missing: ['ECOTOX_SUPABASE_URL', 'ECOTOX_SUPABASE_ANON_KEY'],
        invalid: [],
        table: 'toxicology_data',
        rowCount: null,
        rowCountAvailable: false,
        readable: false,
      },
      503,
    );

    render(<SsdWorkbench />);
    fireEvent.click(screen.getByRole('button', { name: /ECOTOX mirror/i }));

    await waitFor(() =>
      expect(screen.getByTestId('ssd-ecotox-onboarding-callout')).toBeInTheDocument(),
    );

    const dot = screen.getByTestId('ssd-ecotox-status-dot');
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveClass('bg-amber-500');
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
    fireEvent.click(screen.getByRole('button', { name: /Run SSD/i }));
    expect(screen.getAllByText(/^5$/).length).toBeGreaterThan(0);
  });
});
