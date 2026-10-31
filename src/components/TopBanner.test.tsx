// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TopBanner } from './TopBanner';
import { OFFICIAL_TE_PACKS } from '../constants/defaultPresets';

describe('TopBanner Component', () => {
  const defaultProps = {
    packName: 'BROKEN RADIO PACK',
    onUpdatePackName: vi.fn(),
    onSelectDefaultPack: vi.fn(),
    onImportJson: vi.fn(),
    onExportJson: vi.fn(),
    theme: 'fx' as const,
    onChangeTheme: vi.fn()
  };

  it('renders brand identity, pack name input, and version string', () => {
    render(<TopBanner {...defaultProps} />);

    expect(screen.getByText('FX TOOL')).toBeInTheDocument();
    expect(screen.getByText('EP–2350 COMPANION')).toBeInTheDocument();
    expect(screen.getByDisplayValue('BROKEN RADIO PACK')).toBeInTheDocument();
    expect(screen.getByText(/v 0\.0\.0-test/)).toBeInTheDocument();
  });

  it('allows switching between FX and TING themes', async () => {
    const handleThemeChange = vi.fn();
    render(<TopBanner {...defaultProps} onChangeTheme={handleThemeChange} />);

    const tingButton = screen.getByRole('button', { name: /TING/i });
    await userEvent.click(tingButton);

    expect(handleThemeChange).toHaveBeenCalledWith('ting');
  });

  it('opens preset pack dropdown and selects an official Teenage Engineering pack', async () => {
    const handleSelectPack = vi.fn();
    render(<TopBanner {...defaultProps} onSelectDefaultPack={handleSelectPack} />);

    // Dropdown initially closed
    expect(screen.queryByText('DUB PACK')).not.toBeInTheDocument();

    const dropdownToggle = screen.getByLabelText('Select default pack');
    await userEvent.click(dropdownToggle);

    // Dropdown now visible with all 3 TE packs
    expect(screen.getByText('OFFICIAL TE PRESET PACKS')).toBeInTheDocument();
    const dubOption = screen.getByText('DUB PACK');
    expect(dubOption).toBeInTheDocument();

    await userEvent.click(dubOption);
    expect(handleSelectPack).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'dub', name: 'DUB PACK' })
    );
  });

  it('triggers onExportJson when clicking EXPORT CONFIG.JSON', async () => {
    const handleExport = vi.fn();
    render(<TopBanner {...defaultProps} onExportJson={handleExport} />);

    const exportBtn = screen.getByRole('button', { name: /EXPORT CONFIG\.JSON/i });
    await userEvent.click(exportBtn);

    expect(handleExport).toHaveBeenCalledTimes(1);
  });
});
