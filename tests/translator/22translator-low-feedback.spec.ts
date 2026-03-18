import { test, expect, loginAsTranslator } from '../../fixtures/test';
import { getBaseOrigin } from '../../utils/env';

test.describe('@regression translator low feedback', () => {
  test('translator can give negative feedback on a completed booking', async ({ page, loginPage }) => {
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
      if (!(await labelEl.isVisible().catch(() => false))) continue;
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
    expect(rowCount).toBeGreaterThan(0);

    const maxTries = Math.min(rowCount, 10);
    let chosenRowIndex = -1;

    for (let i = 0; i < maxTries; i += 1) {
      const row = rows.nth(i);
      const detailsBtn = row
        .getByRole('button', { name: /details/i })
        .or(row.getByRole('link', { name: /details|view details/i }))
        .or(row.getByText(/→\s*details|details/i))
        .first();

      await detailsBtn.click({ force: true });
      await wait(2500);

      const dialog = page.getByRole('dialog').first();
      await dialog.waitFor({ state: 'visible', timeout: 15000 });

      const feedbackButton = dialog
        .getByRole('button', { name: /give feedback|feedback/i })
        .or(dialog.locator('button, a').filter({ hasText: /give feedback|feedback/i }))
        .first();

      if (await feedbackButton.isVisible().catch(() => false)) {
        chosenRowIndex = i;
        await feedbackButton.click({ force: true });
        break;
      }

      const closeDetails = dialog.getByRole('button', { name: /close/i }).first();
      if (await closeDetails.isVisible().catch(() => false)) {
        await closeDetails.click({ force: true }).catch(() => undefined);
      } else {
        await page.keyboard.press('Escape').catch(() => undefined);
      }
      await wait(1500);
    }

    expect(chosenRowIndex).toBeGreaterThanOrEqual(0);
    await wait(1500);

    const feedbackPanel = page.locator('div[role="dialog"], section[role="dialog"]').first();
    await expect(feedbackPanel.getByText(/rate your experience/i).first()).toBeVisible({ timeout: 20000 });

    const stars = feedbackPanel
      .locator('span.material-symbols-outlined.material-icons.base-icon')
      .filter({ hasText: /star/i });
    const starCount = await stars.count();
    expect(starCount).toBeGreaterThan(0);
    const firstStar = stars.first();
    await firstStar.click({ force: true });
    await wait(500);

    const optionRows = feedbackPanel.locator('.feedback-option-row');
    const optionRowCount = await optionRows.count();
    for (let i = 0; i < optionRowCount; i += 1) {
      const row = optionRows.nth(i);
      const checkbox = row.locator('.n-checkbox').first();
      if (await checkbox.isVisible().catch(() => false)) {
        const ariaChecked = await checkbox.getAttribute('aria-checked').catch(() => null);
        if (ariaChecked !== 'true') {
          await checkbox.click({ force: true });
          await wait(200);
        }
      }
    }

    const thoughtsTextarea = feedbackPanel.locator('textarea').first();
    if (await thoughtsTextarea.isVisible().catch(() => false)) {
      await thoughtsTextarea.fill('Bad');
      await wait(500);
    }

    const sendFeedbackBtn = page
      .getByRole('button', { name: /send feedback/i })
      .or(page.locator('button').filter({ hasText: /send feedback/i }))
      .first();

    await expect(sendFeedbackBtn).toBeVisible({ timeout: 15000 });
    await sendFeedbackBtn.click({ force: true });
    await wait(4000);

    const closeBtn = page.getByRole('button', { name: /close/i }).first();
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click({ force: true }).catch(() => undefined);
      await wait(1500);
    }

    const chosenRow = rows.nth(chosenRowIndex);
    await chosenRow.scrollIntoViewIfNeeded().catch(() => undefined);
    const reopenDetailsBtn = chosenRow
      .getByRole('button', { name: /details/i })
      .or(chosenRow.getByRole('link', { name: /details|view details/i }))
      .or(chosenRow.getByText(/→\s*details|details/i))
      .first();

    await reopenDetailsBtn.click({ force: true });
    await wait(2500);

    const dialog2 = page.getByRole('dialog').first();
    await dialog2.waitFor({ state: 'visible', timeout: 15000 });
    const dialogText = (await dialog2.innerText().catch(() => '')).toLowerCase();

    expect(dialogText).toContain('bad');
  });
});

