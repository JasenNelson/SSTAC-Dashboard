import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ExposureScenarioControl from '../ExposureScenarioControl';

describe('ExposureScenarioControl', () => {
  it('renders a real, operable select with Custom as the only option', () => {
    render(<ExposureScenarioControl />);
    const select = screen.getByTestId('exposure-scenario-select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select).not.toBeDisabled();
    expect(select.options).toHaveLength(1);
    expect(select.value).toBe('custom');
  });

  it('explains that Protocol 28 presets are not available yet, rather than appearing empty or broken', () => {
    render(<ExposureScenarioControl />);
    expect(screen.getByTestId('exposure-scenario-note')).toHaveTextContent(
      /not available yet/i,
    );
    expect(screen.getByTestId('exposure-scenario-note')).toHaveTextContent(/Protocol 28/);
  });

  it('associates the select with its explanatory note via aria-describedby', () => {
    render(<ExposureScenarioControl />);
    const select = screen.getByTestId('exposure-scenario-select');
    const note = screen.getByTestId('exposure-scenario-note');
    expect(select).toHaveAttribute('aria-describedby', note.id);
  });
});
