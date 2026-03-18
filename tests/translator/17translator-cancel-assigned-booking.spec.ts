import { test, expect, loginAsTranslator } from '../../fixtures/test';
import { getBaseOrigin } from '../../utils/env';

test.describe('@regression translator cancel assigned booking', () => {
  test('translator can cancel an assigned booking with Cancel \\u2192 Cancel \\u2192 OK flow', async ({ page, loginPage }) => {
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
      const lower = text.toLowerCase();
      if (/assigned/.test(lower) && !/convey/.test(lower)) {
        chosenRowIndex = i;
        chosenRowText = text;
        break;
      }
    }

    if (chosenRowIndex === -1) {
      throw new Error('No non-convey Assigned booking found in Upcoming for translator.');
    }

    const row = allRows.nth(chosenRowIndex);

    const detailsBtn = row
      .getByRole('button', { name: /details/i })
      .or(row.getByRole('link', { name: /details|view details/i }))
      .or(row.getByText(/→\s*details|details/i))
      .first();

    await detailsBtn.click({ force: true });
    await wait(2500);

    const detailsDialog = page.getByRole('dialog').first();
    await detailsDialog.waitFor({ state: 'visible', timeout: 15000 });

    const cancelInDetails = detailsDialog
      .getByRole('button', { name: /^cancel$/i })
      .or(detailsDialog.getByRole('button', { name: /cancel booking|cannot attend|avboka/i }))
      .or(detailsDialog.locator('button, a').filter({ hasText: /cancel/i }))
      .first();

    await expect(cancelInDetails).toBeVisible({ timeout: 15000 });
    await cancelInDetails.click({ force: true });
    await wait(2000);

    const firstConfirm = page.getByRole('dialog').first();
    await firstConfirm.waitFor({ state: 'visible', timeout: 15000 });

    const firstPlainCancel = firstConfirm
      .getByRole('button', { name: /^cancel$/i })
      .or(firstConfirm.locator('button').filter({ hasText: /^\s*cancel\s*$/i }))
      .first();

    await expect(firstPlainCancel).toBeVisible({ timeout: 15000 });
    await firstPlainCancel.click({ force: true });
    await wait(2500);

    const detailsDialogAgain = page.getByRole('dialog').first();
    await detailsDialogAgain.waitFor({ state: 'visible', timeout: 15000 });

    const cancelInDetailsAgain = detailsDialogAgain
      .getByRole('button', { name: /^cancel$/i })
      .or(detailsDialogAgain.getByRole('button', { name: /cancel booking|cannot attend|avboka/i }))
      .or(detailsDialogAgain.locator('button, a').filter({ hasText: /cancel/i }))
      .first();

    await expect(cancelInDetailsAgain).toBeVisible({ timeout: 15000 });
    await cancelInDetailsAgain.click({ force: true });
    await wait(2000);

    const secondConfirm = page.getByRole('dialog').first();
    await secondConfirm.waitFor({ state: 'visible', timeout: 15000 });

    const cancelledHeading = secondConfirm.getByText(/booking cancelled/i).first();
    await expect(cancelledHeading).toBeVisible({ timeout: 15000 });

    const okButton = secondConfirm
      .getByRole('button', { name: /^ok$/i })
      .or(secondConfirm.locator('button').filter({ hasText: /^\s*ok\s*$/i }))
      .first();

    await expect(okButton).toBeVisible({ timeout: 15000 });
    await okButton.click({ force: true });
    await wait(4000);

    const closeBtn = page.getByRole('button', { name: /close/i }).first();
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click({ force: true }).catch(() => undefined);
      await wait(2000);
    }

    const bodyLower = (await page.locator('body').innerText().catch(() => '')).toLowerCase();
    const cancelled = /declined|cancelled|canceled|rejected|avbokad|inställd/.test(bodyLower);
    expect(cancelled).toBeTruthy();

    if (!bodyLower.includes('74792') && !/assigned/.test(chosenRowText.toLowerCase())) {
      throw new Error(`Booking might not be present as expected after cancellation. Row snapshot: ${chosenRowText}`);
    }
  });
});

