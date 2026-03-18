import { test, expect, loginAsTranslator } from '../../fixtures/test';
import { getBaseOrigin } from '../../utils/env';

test.describe('@regression translator unblock municipalities', () => {
  test('translator can unblock a municipality from settings', async ({ page, loginPage }) => {
    await loginAsTranslator(loginPage);

    const wait = (ms: number) => page.waitForTimeout(ms);

    await page.goto(`${getBaseOrigin()}/dashboard`, { waitUntil: 'domcontentloaded' }).catch(() => undefined);
    await wait(5000);

    const settingsItem = page.getByText(/^Settings$/i).first();
    await settingsItem.waitFor({ state: 'visible', timeout: 20000 });
    await settingsItem.click({ force: true });
    await wait(5000);

    await page.getByText(/^Settings$/i).first().waitFor({ state: 'visible', timeout: 30000 });

    const bookingsTab = page.locator('div,button,a').filter({ hasText: /^Bookings$/i }).first();
    if (await bookingsTab.isVisible().catch(() => false)) {
      await bookingsTab.click({ force: true });
      await wait(2000);
    }

    const blockedMunicipalities = page.getByText(/Blocked municipalities/i).first();
    await blockedMunicipalities.waitFor({ state: 'visible', timeout: 30000 });
    await blockedMunicipalities.click({ force: true });
    await wait(3000);

    await page.getByText(/Blocked municipalities/i).first().waitFor({ state: 'visible', timeout: 30000 });

    const bodyBefore = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');

    if (/No blocked municipalities/i.test(bodyBefore)) {
      test.skip('No blocked municipalities to unblock for translator');
    }

    const unblockLink = page
      .locator('a, button, span, div')
      .filter({ hasText: /^Unblock$/i })
      .first();

    await expect(unblockLink).toBeVisible({ timeout: 20000 });

    const row = unblockLink.locator('..').locator('..');
    const nameText = (await row.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();

    await unblockLink.click({ force: true });
    await wait(4000);

    const bodyAfter = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
    const noLongerListed = !bodyAfter.toLowerCase().includes(nameText.toLowerCase());
    const noBlockedNow = /No blocked municipalities/i.test(bodyAfter);

    const toast = page.locator('.n-notification, .n-message, .toast, [role="alert"], [aria-live]').first();
    const toastVisible = await toast.isVisible().catch(() => false);
    const toastText = toastVisible
      ? (await toast.innerText().catch(() => '')).replace(/\s+/g, ' ').trim()
      : '';

    const successKeywords = /unblocked|success|saved|updated/i.test(toastText.toLowerCase());

    expect(noLongerListed || noBlockedNow || successKeywords).toBeTruthy();
  });
});

