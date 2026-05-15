import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DerivationSimulator from '../DerivationSimulator'

describe('DerivationSimulator', () => {
  it('toggles pathways and reveals progressive disclosure UI', () => {
    render(<DerivationSimulator />)

    // The component defaults to Human Health, so Fish Consumption Rate should be visible initially.
    // However, the test specifically asks to click 'Human Health' and 'EqP' tabs to verify toggle behaviour.

    const humanHealthTab = screen.getByRole('button', { name: 'Human Health' })
    const eqpTab = screen.getByRole('button', { name: 'Ecological (EqP)' })

    // Click EqP
    fireEvent.click(eqpTab)
    expect(screen.getByText('Total Organic Carbon (TOC)')).toBeInTheDocument()
    expect(screen.queryByText('Fish Consumption Rate')).not.toBeInTheDocument()

    // Click Human Health
    fireEvent.click(humanHealthTab)
    expect(screen.getByText('Fish Consumption Rate')).toBeInTheDocument()
    expect(screen.queryByText('Total Organic Carbon (TOC)')).not.toBeInTheDocument()
  })

  it('dynamically recalculates the standard when parameters change', () => {
    render(<DerivationSimulator />)

    // Ensure we are on Human Health
    const humanHealthTab = screen.getByRole('button', { name: 'Human Health' })
    fireEvent.click(humanHealthTab)

    // Default value for Benzo[a]pyrene at 1e-5 risk and 32 g/day is ~1.5625
    expect(screen.getByText('1.5625')).toBeInTheDocument()

    // Find the fish consumption rate slider
    // The range input for consumption rate has min 10, max 200. We can find it by label or simply using getByRole if there are multiple.
    // It's the slider next to 'Fish Consumption Rate'. It doesn't have an explicit associated label via 'id' but we can find it by its value.
    const sliders = screen.getAllByRole('slider')
    // In Human Health there are two sliders: Target Risk Level and Fish Consumption Rate. The consumption rate is the second one.
    const consumptionSlider = sliders[1]

    // Move slider to 142
    fireEvent.change(consumptionSlider, { target: { value: '142' } })

    // 50 / 142 = ~0.3521
    expect(screen.getByText('0.3521')).toBeInTheDocument()
  })
})
