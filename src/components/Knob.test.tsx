// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Knob } from './Knob';

describe('Knob Component', () => {
  it('renders label, initial value and formatted unit', () => {
    render(
      <Knob
        label="TIME"
        value={0.35}
        min={0}
        max={1.2}
        step={0.01}
        unit="s"
        displayScale={(v) => `${Math.round(v * 1000)}ms`}
        onChange={() => {}}
      />
    );

    expect(screen.getByText('TIME')).toBeInTheDocument();
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('350ms');
  });

  it('shows modulation indicator badge when isModulated is true', () => {
    const { rerender } = render(
      <Knob
        label="CUTOFF"
        value={50}
        min={0}
        max={100}
        unit="%"
        onChange={() => {}}
        isModulated={false}
      />
    );
    expect(screen.queryByTitle(/Modulated by/)).not.toBeInTheDocument();

    rerender(
      <Knob
        label="CUTOFF"
        value={50}
        min={0}
        max={100}
        unit="%"
        onChange={() => {}}
        isModulated={true}
        modulationSource="LFO"
      />
    );
    const badge = screen.getByTitle('Modulated by LFO');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('LFO');
  });

  it('allows typing a new number and calls onChange on Enter / commit', async () => {
    const handleChange = vi.fn();
    render(
      <Knob
        label="MIX"
        value={50}
        min={0}
        max={100}
        step={1}
        unit="%"
        onChange={handleChange}
      />
    );

    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, '75{enter}');

    expect(handleChange).toHaveBeenCalledWith(75);
  });

  it('clamps entered values within [min, max]', async () => {
    const handleChange = vi.fn();
    render(
      <Knob
        label="AMOUNT"
        value={10}
        min={0}
        max={40}
        step={0.5}
        onChange={handleChange}
      />
    );

    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, '999{enter}');

    expect(handleChange).toHaveBeenCalledWith(40);
  });

  it('triggers onReset when double clicking the dial cap', () => {
    const handleReset = vi.fn();
    const { container } = render(
      <Knob
        label="ECHO"
        value={40}
        min={0}
        max={100}
        onChange={() => {}}
        onReset={handleReset}
      />
    );

    const dialCap = container.querySelector('.cursor-ns-resize')!;
    fireEvent.doubleClick(dialCap);
    expect(handleReset).toHaveBeenCalledTimes(1);
  });
});
