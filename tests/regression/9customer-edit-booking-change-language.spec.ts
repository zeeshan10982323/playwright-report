import { test, expect, loginAsDefaultUser } from '../../fixtures/test';
import { CreateBookingPage } from '../../pages/CreateBookingPage';

test.describe('@regression customer edit booking change language', () => {
  test('edit first pending booking: set language to Klingon and validate', async ({ page, loginPage }) => {
    test.setTimeout(180000);

    await loginAsDefaultUser(loginPage);

    const createBookingPage = new CreateBookingPage(page);
    await createBookingPage.openMyBookingsFromSidebar();

    const wait = (ms: number) => page.waitForTimeout(ms);
    await wait(3000);

    const upcomingTab = page.getByText(/upcoming bookings/i).first();
    if (await upcomingTab.isVisible().catch(() => false)) {
      await upcomingTab.click({ force: true }).catch(() => undefined);
      await wait(2000);
    }

    const rows = page.locator('tbody tr');
    const count = await rows.count();
    let pendingIndex = -1;
    for (let i = 0; i < count; i += 1) {
      const text = (await rows.nth(i).innerText().catch(() => '')).toLowerCase();
      if (/pending/.test(text)) {
        pendingIndex = i;
        break;
      }
    }
    if (pendingIndex === -1) {
      throw new Error('No pending booking found in Upcoming.');
    }

    const row = rows.nth(pendingIndex);
    const detailsBtn = row
      .getByRole('button', { name: /details/i })
      .or(row.getByRole('link', { name: /details|view details/i }))
      .or(row.getByText(/→\s*details|details/i))
      .first();
    await detailsBtn.click({ force: true });
    await wait(2500);

    const dialog = page.getByRole('dialog').first();
    await dialog.waitFor({ state: 'visible', timeout: 15000 });
    const editBtn = dialog.getByRole('button', { name: /^edit$/i }).first();
    await editBtn.click({ force: true });
    await wait(4000);

    const editModal = page.getByRole('dialog').filter({ hasText: /edit\s*#|edit #/i }).first();
    await editModal.waitFor({ state: 'visible', timeout: 15000 });
    const langForm = editModal.locator('.n-form-item:has-text("Language")').first();
    await langForm.waitFor({ state: 'visible', timeout: 10000 });
    const trigger = langForm.locator('.n-base-selection').first();
    await trigger.click({ force: true });
    await wait(800);
    const input = langForm.locator('input.n-base-selection-input').first();
    await input.fill('');
    await input.type('Klingon', { delay: 40 });
    await wait(1200);
    const option = page.locator('.n-base-select-option').filter({ hasText: /klingon/i }).first();
    await option.click({ force: true });
    await wait(1500);
    const saveEditBtn = editModal.getByRole('button', { name: /^edit$/i }).last();
    await saveEditBtn.click({ force: true });
    await wait(10000);

    const closeBtn = page.getByRole('button', { name: /close/i }).first();
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click({ force: true });
      await wait(1000);
    }

    await detailsBtn.click({ force: true });
    await wait(2500);
    const dialog2 = page.getByRole('dialog').first();
    await dialog2.waitFor({ state: 'visible', timeout: 15000 });
    const dialogText = await dialog2.innerText();
    expect(dialogText).toMatch(/klingon/i);
  });
});
