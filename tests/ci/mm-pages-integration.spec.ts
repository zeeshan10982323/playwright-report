import { expect, test } from '@playwright/test';

test.describe('CI integration', () => {
  test('publishes a basic html report', async ({ page }) => {
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/example domain/i);
    await expect(page.getByRole('heading', { name: /example domain/i })).toBeVisible();
  });
});

