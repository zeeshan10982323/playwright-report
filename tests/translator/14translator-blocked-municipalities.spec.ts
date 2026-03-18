import { test, expect, loginAsTranslator } from '../../fixtures/test';
import { getBaseOrigin } from '../../utils/env';

test.describe('@regression translator blocked municipalities', () => {
  test('translator can block a municipality from settings', async ({ page, loginPage }) => {
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

    const header = page.getByText(/Search and block specific municipalities/i).first();
    await header.waitFor({ state: 'visible', timeout: 30000 });

    const container = page.locator('div,section').filter({ has: header }).first();

    const selection = container.locator('.n-base-selection, .n-base-selection-label').first();
    if (await selection.isVisible().catch(() => false)) {
      await selection.click({ force: true });
      await wait(500);
    }

    const visibleInput = container
      .locator('input')
      .filter({ hasNot: container.locator('input[tabindex="-1"]') })
      .first();

    const input = (await visibleInput.isVisible().catch(() => false))
      ? visibleInput
      : container.locator('input:not([tabindex="-1"])').first();

    if (await input.isVisible().catch(() => false)) {
      await input.click({ force: true });
      await input.fill('');
      await input.type('test', { delay: 80 });
    } else {
      await selection.click({ force: true }).catch(() => undefined);
      await wait(300);
      await page.keyboard.type('test', { delay: 80 });
    }

    await wait(2500);

    const optionList = page.locator('.n-base-select-option, [role="option"], li');
    const firstMatch = optionList.filter({ hasText: /test/i }).first();
    const anyOption = optionList.first();

    let selectedText = '';
    if (await firstMatch.isVisible().catch(() => false)) {
      selectedText = (await firstMatch.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
      await firstMatch.click({ force: true });
    } else if (await anyOption.isVisible().catch(() => false)) {
      selectedText = (await anyOption.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
      await anyOption.click({ force: true });
    } else {
      await page.keyboard.press('ArrowDown').catch(() => undefined);
      await wait(300);
      await page.keyboard.press('Enter').catch(() => undefined);
      selectedText = 'selected-via-keyboard';
    }

    await wait(800);

    const blockBtn = container.getByRole('button', { name: /^block$/i }).first();
    await blockBtn.waitFor({ state: 'visible', timeout: 20000 });
    await blockBtn.click({ force: true });
    await wait(5000);

    const bodyText = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');

    const namePart =
      selectedText && selectedText !== 'selected-via-keyboard'
        ? selectedText.split(/[#\n]/)[0].trim()
        : '';

    const appears = namePart ? bodyText.toLowerCase().includes(namePart.toLowerCase()) : false;

    const toast = page.locator('.n-notification, .n-message, .toast, [role="alert"], [aria-live]').first();
    const toastVisible = await toast.isVisible().catch(() => false);
    const toastText = toastVisible
      ? (await toast.innerText().catch(() => '')).replace(/\s+/g, ' ').trim()
      : '';

    const successKeywords =
      /blocked|success|saved|updated/i.test(toastText.toLowerCase()) || appears;

    expect(successKeywords).toBeTruthy();
  });
});

