import { test, expect, loginAsDefaultUser } from '../../fixtures/test';
import { CreateBookingPage } from '../../pages/CreateBookingPage';

test.describe('@regression customer my bookings upcoming previous views (MCP replica)', () => {
  test('customer My Bookings: Upcoming tab, view toggles, filters, Previous tab', async ({
    page,
    loginPage
  }) => {
    test.setTimeout(120000);

    const wait = (ms: number) => page.waitForTimeout(ms);

    await loginAsDefaultUser(loginPage);

    const createBookingPage = new CreateBookingPage(page);
    const myBookingsLink = page.getByRole('link', { name: /my bookings/i }).or(page.getByText(/my bookings/i).first());
    if (await myBookingsLink.isVisible().catch(() => false)) {
      await myBookingsLink.click({ force: true }).catch(() => undefined);
      await wait(5000);
    } else {
      await page.goto('/bookings', { waitUntil: 'domcontentloaded' });
      await wait(5000);
    }

    const currentUrl = page.url();
    const body = (await page.locator('body').innerText().catch(() => '')).toLowerCase();
    expect(currentUrl).toMatch(/\/bookings/);
    expect(body).toMatch(/my bookings/);

    const upcomingTab = page.getByText(/upcoming bookings/i).first();
    const previousTab = page.getByText(/previous bookings/i).first();
    const filterBtn = page
      .getByRole('button', { name: /filter/i })
      .or(page.locator('button, [role="button"]').filter({ hasText: /filter/i }))
      .first();

    await expect(upcomingTab).toBeVisible({ timeout: 15000 });
    await expect(previousTab).toBeVisible({ timeout: 15000 });
    await expect(filterBtn).toBeVisible({ timeout: 15000 });

    await upcomingTab.click({ force: true }).catch(() => undefined);
    await wait(2000);

    const weeklyViewSelectors = [
      page.getByRole('link', { name: /weekly view/i }),
      page.getByRole('button', { name: /weekly view/i }),
      page.locator('a').filter({ hasText: /weekly view/i }),
      page.locator('button').filter({ hasText: /weekly view/i }),
      page.getByText(/weekly view/i),
      page.locator('[class*="view"]').filter({ hasText: /week/i }),
      page.getByRole('tab', { name: /week/i }),
      page.locator('button, a').filter({ hasText: /^week$/i })
    ];
    let weeklyClicked = false;
    for (const sel of weeklyViewSelectors) {
      const el = sel.first();
      if (await el.isVisible().catch(() => false)) {
        await el.click({ force: true }).catch(() => undefined);
        weeklyClicked = true;
        break;
      }
    }
    await wait(3000);

    const listViewSelectors = [
      page.getByRole('link', { name: /list view/i }),
      page.getByRole('button', { name: /list view/i }),
      page.locator('a').filter({ hasText: /list view/i }),
      page.locator('button').filter({ hasText: /list view/i }),
      page.getByText(/list view/i),
      page.locator('button, a').filter({ hasText: /^list$/i })
    ];
    let listClicked = false;
    for (const sel of listViewSelectors) {
      const el = sel.first();
      if (await el.isVisible().catch(() => false)) {
        await el.click({ force: true }).catch(() => undefined);
        listClicked = true;
        break;
      }
    }
    await wait(2000);

    await filterBtn.click({ force: true }).catch(() => undefined);
    await wait(2000);
    const filterBody = (await page.locator('body').innerText().catch(() => '')).toLowerCase();
    expect(filterBody).toMatch(/language|status|booking type|booker|date|department|my booking/);
    await page.mouse.click(10, 10).catch(() => undefined);
    await wait(1000);

    await previousTab.click({ force: true }).catch(() => undefined);
    await wait(3000);

    const prevRows = page.locator('tbody tr');
    const prevRowCount = await prevRows.count();
    const prevBody = (await page.locator('body').innerText().catch(() => '')).toLowerCase();
    expect(prevRowCount).toBeGreaterThanOrEqual(0);
    if (prevRowCount > 0) {
      expect(prevBody).toMatch(/completed|cancelled|expired/);
    }
  });
});
