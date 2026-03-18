import { test, expect, loginAsTranslator } from '../../fixtures/test';
import { getBaseOrigin } from '../../utils/env';

test.describe('@regression translator view assigned booking details', () => {
  test('translator can open an assigned booking and see all key details', async ({ page, loginPage }) => {
    test.setTimeout(240000);

    await loginAsTranslator(loginPage);

    const wait = (ms: number) => page.waitForTimeout(ms);

    await page.goto(`${getBaseOrigin()}/bookings?booking_view=1`, { waitUntil: 'domcontentloaded' });
    await wait(5000);

    const upcomingTab = page.getByText(/upcoming bookings/i).first();
    if (await upcomingTab.isVisible().catch(() => false)) {
      await upcomingTab.click({ force: true }).catch(() => undefined);
      await wait(2500);
    }

    const allRows = page.locator('tr');
    const total = await allRows.count();
    let chosenRowIndex = -1;
    let chosenRowText = '';

    for (let i = 0; i < total; i += 1) {
      const row = allRows.nth(i);
      const text = (await row.innerText().catch(() => '')).trim();
      if (!text) continue;
      const lower = text.toLowerCase();
      if (/assigned/.test(lower) && !/convey/.test(lower)) {
        chosenRowIndex = i;
        chosenRowText = text;
        break;
      }
    }

    if (chosenRowIndex === -1) {
      const body = await page.locator('body').innerText().catch(() => '');
      throw new Error(`No Assigned (non-Convey) booking found in Upcoming. Body snippet: ${body.slice(0, 800)}`);
    }

    const row = allRows.nth(chosenRowIndex);

    const detailsBtn = row
      .getByRole('button', { name: /details/i })
      .or(row.getByRole('link', { name: /details|view details/i }))
      .or(row.getByText(/→\s*details|details/i))
      .first();

    await detailsBtn.click({ force: true });
    await wait(2500);

    const dialog = page.getByRole('dialog').first();
    await dialog.waitFor({ state: 'visible', timeout: 15000 });

    const dialogText = await dialog.innerText().catch(() => '');

    const hasBookingId = /booking id\s*#?\s*\d+/i.test(dialogText);
    const hasStatus = /status\s*\n/i.test(dialogText) || /status\s*:/i.test(dialogText);
    const hasType = /type\s*\n/i.test(dialogText) || /type\s*:/i.test(dialogText);
    const hasLanguage = /language\s*\n/i.test(dialogText) || /language\s*:/i.test(dialogText);
    const hasDate = /date\s*\n/i.test(dialogText) || /date\s*:/i.test(dialogText);
    const hasTime = /time\s*\n/i.test(dialogText) || /time\s*:/i.test(dialogText);
    const hasDuration = /duration\s*\n/i.test(dialogText) || /duration\s*:/i.test(dialogText);
    const hasCustomerSection = /about booker|customer type/i.test(dialogText);

    expect(hasBookingId).toBeTruthy();
    expect(hasStatus).toBeTruthy();
    expect(hasType).toBeTruthy();
    expect(hasLanguage).toBeTruthy();
    expect(hasDate).toBeTruthy();
    expect(hasTime).toBeTruthy();
    expect(hasDuration).toBeTruthy();
    expect(hasCustomerSection).toBeTruthy();

    const closeBtn = page.getByRole('button', { name: /close/i }).first();
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click({ force: true }).catch(() => undefined);
      await wait(1000);
    }
  });
});

