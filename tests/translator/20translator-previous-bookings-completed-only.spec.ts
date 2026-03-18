import { test, expect, loginAsTranslator } from '../../fixtures/test';
import { getBaseOrigin } from '../../utils/env';

test.describe('@regression translator previous bookings completed only', () => {
  test('translator can filter previous bookings to show only completed status', async ({ page, loginPage }) => {
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

    const filterBtn = page
      .getByRole('button', { name: /filter/i })
      .or(page.locator('button, [role="button"]').filter({ hasText: /filter/i }))
      .first();

    await expect(filterBtn).toBeVisible({ timeout: 15000 });
    await filterBtn.click({ force: true });
    await wait(1500);

    const bookingStatusChip = page
      .locator('div.filter-field-popover-btn-text--inner', { hasText: 'Booking status' })
      .first();

    await expect(bookingStatusChip).toBeVisible({ timeout: 15000 });
    await bookingStatusChip.click({ force: true });
    await wait(1000);

    const items = page.locator('.booking-list-dropdown-checkbox');
    const itemCount = await items.count();

    for (let i = 0; i < itemCount; i += 1) {
      const item = items.nth(i);
      const labelEl = item.locator('.booking-list-dropdown-checkbox-label').first();
      if (!(await labelEl.isVisible().catch(() => false))) {
        continue;
      }
      const label = (await labelEl.innerText().catch(() => '')).trim().toLowerCase();
      const classAttr = (await item.getAttribute('class').catch(() => '')) || '';
      const isChecked = classAttr.includes('booking-list-dropdown-checkbox--checked');

      if (label === 'completed') {
        if (!isChecked) {
          await item.click({ force: true });
          await wait(500);
        }
      } else if (isChecked) {
        await item.click({ force: true });
        await wait(500);
      }
    }

    await page.mouse.click(10, 10).catch(() => undefined);
    await wait(1500);

    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();

    for (let i = 0; i < rowCount; i += 1) {
      const row = rows.nth(i);
      const text = (await row.innerText().catch(() => '')).toLowerCase();
      if (!text) continue;
      expect(text).toMatch(/completed/);
      expect(text).not.toMatch(/cancelled|canceled|compensation|not carried out by customer|cancelled late/);
    }
  });
});

