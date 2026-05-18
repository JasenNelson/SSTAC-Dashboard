/**
 * Focused tests for the Template download button + helper in DataUploader.
 *
 * Scope: the "Template" button under the Upload Data view (BN-RRM General
 * model > Data tab) previously had no onClick handler, so clicks did
 * nothing. Bug fix 2026-05-18 wired the button to downloadTemplateCsv()
 * which emits a CSV with the same headers parseCSV() consumes + 3
 * example rows (one reference, two exposure samples).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Stub the site-data store to avoid pulling in zustand + persist
// machinery for this focused render-and-click test. The DataUploader
// reads `loadFromJson` from the store; the rest of its behavior is
// not exercised here.
vi.mock('@/stores/bn-rrm/siteDataStore', () => ({
  useSiteDataStore: () => vi.fn(),
}));

import { DataUploader, downloadTemplateCsv, TEMPLATE_CSV_CONTENT } from '../DataUploader';

describe('DataUploader template download', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the Template button with proper a11y attributes', () => {
    render(<DataUploader />);
    const btn = screen.getByTestId('data-uploader-template-download');
    expect(btn).toBeInTheDocument();
    expect(btn.tagName).toBe('BUTTON');
    expect(btn).toHaveAttribute('type', 'button');
    expect(btn.getAttribute('aria-label')).toMatch(/csv data template/i);
  });

  it('clicking the Template button triggers a CSV download', () => {
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    try {
      render(<DataUploader />);
      fireEvent.click(screen.getByTestId('data-uploader-template-download'));
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
      const blobArg = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0] as Blob;
      expect(blobArg.type).toMatch(/text\/csv/);
      expect(blobArg.size).toBeGreaterThan(0);
      expect(clickSpy).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
      clickSpy.mockRestore();
    }
  });

  it('TEMPLATE_CSV_CONTENT has the expected header schema + example rows', () => {
    const text = TEMPLATE_CSV_CONTENT;
    const headerLine = text.split('\n')[0];
    // The header row MUST contain every column parseCSV() recognizes so
    // a user filling in the template can be confident the upload round-
    // trips correctly.
    const expectedColumns = [
      'site_id', 'site_name', 'latitude', 'longitude', 'site_type',
      'region', 'waterbody', 'date', 'sample_id',
      'copper', 'zinc', 'lead', 'cadmium', 'mercury', 'arsenic',
      'chromium', 'total_pahs', 'toc', 'avs', 'percent_fines',
    ];
    for (const col of expectedColumns) {
      expect(headerLine).toContain(col);
    }
    // At least 2 example data rows to seed the user.
    const dataLines = text.split('\n').slice(1).filter((line) => line.trim().length > 0);
    expect(dataLines.length).toBeGreaterThanOrEqual(2);
    // First example is a reference site; second is an exposure site.
    expect(text).toMatch(/reference/);
    expect(text).toMatch(/exposure/);
  });

  it('downloadTemplateCsv generates a filename ending in .csv', () => {
    let downloadFilename: string | null = null;
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
    // Intercept the anchor's download attr at click time.
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloadFilename = this.download;
    });
    try {
      downloadTemplateCsv();
      expect(downloadFilename).not.toBeNull();
      expect(downloadFilename).toMatch(/\.csv$/);
      expect(downloadFilename).toMatch(/bn-rrm/i);
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
      clickSpy.mockRestore();
    }
  });
});
