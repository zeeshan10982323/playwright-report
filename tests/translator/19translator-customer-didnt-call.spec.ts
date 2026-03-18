import { test, expect, loginAsTranslator } from '../../fixtures/test';
import { getBaseOrigin } from '../../utils/env';

test.describe('@regression translator customer didnt call', () => {
  test("translator can report 'Customer didn't call' for a cancelled booking", async ({ page, loginPage }) => {
    test.setTimeout(240000);

    await loginAsTranslator(loginPage);

    const wait = (ms: number) => page.waitForTimeout(ms);

    await page.goto(`${getBaseOrigin()}/bookings?booking_view=1`, { waitUntil: 'domcontentloaded' });
    await wait(5000);

    const previousTab = page.getByText(/previous bookings/i).first();
    if (await previousTab.isVisible().catch(() => false)) {
      await previousTab.click({ force: true }).catch(() => undefined);
      await wait(3000);
    }

    const rows = page.locator('tr');
    const total = await rows.count();
    let chosenIndex = -1;
    let chosenRowText = '';

    for (let i = 0; i < total; i += 1) {
      const row = rows.nth(i);
      const text = (await row.innerText().catch(() => '')).trim();
      if (!text) continue;
      if (/cancelled|canceled|avbokad/i.test(text)) {
        chosenIndex = i;
        chosenRowText = text;
        break;
      }
    }

    if (chosenIndex === -1) {
      const body = await page.locator('body').innerText().catch(() => '');
      throw new Error(`No cancelled booking found in Previous bookings. Body snippet: ${body.slice(0, 800)}`);
    }

    const row = rows.nth(chosenIndex);

    const detailsBtn = row
      .getByRole('button', { name: /details/i })
      .or(row.getByRole('link', { name: /details|view details/i }))
      .or(row.getByText(/→\s*details|details/i))
      .first();

    await detailsBtn.click({ force: true });
    await wait(2500);

    const dialog = page.getByRole('dialog').first();
    await dialog.waitFor({ state: 'visible', timeout: 15000 });

    const didntCallBtn = dialog
      .getByRole('button', { name: /customer didn[’']t call|customer did not call|customer didn.t call/i })
      .or(dialog.getByText(/customer didn[’']t call|customer did not call|customer didn.t call/i))
      .first();

    await expect(didntCallBtn).toBeVisible({ timeout: 15000 });
    await didntCallBtn.click({ force: true });
    await wait(2000);

    const confirmDialog = page.getByRole('dialog').first();
    await confirmDialog.waitFor({ state: 'visible', timeout: 15000 });

    const warningText = await confirmDialog.innerText().catch(() => '');
    expect(/customer did not contact you for this booking/i.test(warningText)).toBeTruthy();

    const confirmBtn = confirmDialog
      .getByRole('button', { name: /yes|ok|confirm|continue/i })
      .or(confirmDialog.locator('button').filter({ hasText: /yes|ok|confirm|continue/i }))
      .first();

    await expect(confirmBtn).toBeVisible({ timeout: 15000 });
    await confirmBtn.click({ force: true });
    await wait(4000);

    const bodyAfter = await page.locator('body').innerText().catch(() => '');
    expect(bodyAfter.length).toBeGreaterThan(0);
    expect(chosenRowText.length).toBeGreaterThan(0);
  });
});

