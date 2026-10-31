import { test, expect } from '@playwright/test';

test.describe('EP-2350 FX Tool Smoke Tests', () => {
  test('loads application and displays initial official pack', async ({ page }) => {
    await page.goto('/');

    // Check title and top banner branding
    await expect(page).toHaveTitle(/EP–2350 fx tool/i);
    await expect(page.getByText('EP', { exact: true })).toBeVisible();
    await expect(page.getByText('TOOL', { exact: true })).toBeVisible();

    // Default pack name should be BROKEN RADIO PACK
    const packInput = page.getByPlaceholder('PACK NAME');
    await expect(packInput).toHaveValue('BROKEN RADIO PACK');
  });

  test('can switch between official Teenage Engineering packs', async ({ page }) => {
    await page.goto('/');

    const packInput = page.getByPlaceholder('PACK NAME');
    const dropdownToggle = page.getByLabel('Select default pack');

    // Open dropdown
    await dropdownToggle.click();
    await expect(page.getByText('OFFICIAL TE PRESET PACKS')).toBeVisible();

    // Select DUB PACK
    await page.getByRole('button', { name: /DUB PACK/i }).click();
    await expect(packInput).toHaveValue('DUB PACK');

    // Preset 1 in DUB PACK should be SPACE ECHO
    await expect(page.getByPlaceholder('PRESET NAME')).toHaveValue('SPACE ECHO');

    // Switch to MYSTERIOUS PACK
    await dropdownToggle.click();
    await page.getByRole('button', { name: /MYSTERIOUS PACK/i }).click();
    await expect(packInput).toHaveValue('MYSTERIOUS PACK');

    // Preset 1 in MYSTERIOUS PACK should be MANUAL PITCHER
    await expect(page.getByPlaceholder('PRESET NAME')).toHaveValue('MANUAL PITCHER');
  });

  test('can switch between FX and TING themes', async ({ page }) => {
    await page.goto('/');

    const tingButton = page.getByRole('button', { name: 'TING', exact: true });
    const fxButton = page.getByRole('button', { name: 'FX', exact: true });

    await tingButton.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'ting');

    await fxButton.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'fx');
  });

  test('exports valid config.json that matches official structure', async ({ page }) => {
    await page.goto('/');

    // Set up download listener
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /EXPORT CONFIG\.JSON/i }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('config.json');

    // Read exported json and verify structure
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const content = Buffer.concat(chunks).toString('utf8');
    const parsed = JSON.parse(content);

    expect(parsed).toHaveProperty('name', 'BROKEN RADIO PACK');
    expect(parsed).toHaveProperty('presets');
    expect(parsed.presets).toHaveLength(4);
    expect(parsed.presets[0]).toHaveProperty('pos', 0);
    expect(parsed.presets[0]).toHaveProperty('name', 'WALKIE TALKIE');
  });
});
