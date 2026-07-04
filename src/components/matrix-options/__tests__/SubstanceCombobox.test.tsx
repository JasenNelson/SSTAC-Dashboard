import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SubstanceCombobox } from '../SubstanceCombobox';

const FIXTURE_OPTIONS = [
  { key: 'a', label: 'Benzene' },
  { key: 'b', label: 'Barium' },
  { key: 'c', label: 'Toluene' },
];

describe('SubstanceCombobox', () => {
  it('renders the input with role combobox + selected label', () => {
    render(
      <SubstanceCombobox
        options={FIXTURE_OPTIONS}
        value="a"
        onChange={() => {}}
      />
    );
    const input = screen.getByTestId('substance-combobox-input') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('role', 'combobox');
    expect(input.value).toBe('Benzene');
  });

  it('typing filters the listbox', async () => {
    const user = userEvent.setup();
    render(
      <SubstanceCombobox
        options={FIXTURE_OPTIONS}
        value=""
        onChange={() => {}}
      />
    );
    const input = screen.getByTestId('substance-combobox-input');
    
    await user.type(input, 'b');
    
    expect(screen.getByTestId('substance-option-a')).toBeInTheDocument();
    expect(screen.getByTestId('substance-option-b')).toBeInTheDocument();
    expect(screen.queryByTestId('substance-option-c')).not.toBeInTheDocument();
  });

  it('ArrowDown opens + sets aria-activedescendant, Enter selects', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <SubstanceCombobox
        options={FIXTURE_OPTIONS}
        value=""
        onChange={handleChange}
      />
    );
    const input = screen.getByTestId('substance-combobox-input');
    input.focus(); // roving focus stays on the input; keyboard events must target it

    expect(input).toHaveAttribute('aria-expanded', 'false');

    await user.keyboard('[ArrowDown]');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', 'substance-combobox-opt-a');
    
    await user.keyboard('[ArrowDown]');
    expect(input).toHaveAttribute('aria-activedescendant', 'substance-combobox-opt-b');
    
    await user.keyboard('[Enter]');
    expect(handleChange).toHaveBeenCalledWith('b');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('clicking an option calls onChange with its key and closes', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <SubstanceCombobox
        options={FIXTURE_OPTIONS}
        value="a"
        onChange={handleChange}
      />
    );
    const input = screen.getByTestId('substance-combobox-input');
    await user.click(input);
    
    const optionC = screen.getByTestId('substance-option-c');
    await user.click(optionC);
    
    expect(handleChange).toHaveBeenCalledWith('c');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('Escape closes and restores the selected label (onChange NOT called)', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <SubstanceCombobox
        options={FIXTURE_OPTIONS}
        value="a"
        onChange={handleChange}
      />
    );
    const input = screen.getByTestId('substance-combobox-input') as HTMLInputElement;
    
    await user.clear(input);
    await user.type(input, 'Barium');
    expect(input.value).toBe('Barium');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    
    await user.keyboard('[Escape]');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input.value).toBe('Benzene');
    expect(handleChange).not.toHaveBeenCalled();
  });

  it('empty filter shows "No matches" and Enter does not call onChange', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <SubstanceCombobox
        options={FIXTURE_OPTIONS}
        value=""
        onChange={handleChange}
      />
    );
    const input = screen.getByTestId('substance-combobox-input');
    
    await user.type(input, 'xyz');
    expect(screen.getByText('No matches')).toBeInTheDocument();
    
    await user.keyboard('[Enter]');
    expect(handleChange).not.toHaveBeenCalled();
  });

  it('aria-expanded reflects open/closed', async () => {
    const user = userEvent.setup();
    render(
      <SubstanceCombobox
        options={FIXTURE_OPTIONS}
        value=""
        onChange={() => {}}
      />
    );
    const input = screen.getByTestId('substance-combobox-input');
    
    expect(input).toHaveAttribute('aria-expanded', 'false');
    
    await user.click(input);
    expect(input).toHaveAttribute('aria-expanded', 'true');
    
    fireEvent.blur(input);
    
    await waitFor(() => {
      expect(input).toHaveAttribute('aria-expanded', 'false');
    });
  });
});
