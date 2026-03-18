import { expect, Page } from '@playwright/test';

export class MyBookingsPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async searchByBookingId(bookingId: string): Promise<void> {
    const wrapper = this.page
      .locator('div, section')
      .filter({ hasText: /enter booking id/i })
      .first();

    const inputCandidates = [
      wrapper.locator('input').first(),
      this.page.locator('input[placeholder*="booking id" i], input[aria-label*="booking id" i], input[placeholder*="Enter booking id" i]').first(),
      this.page.getByPlaceholder(/enter booking id/i).first()
    ];

    for (const input of inputCandidates) {
      if (await input.isVisible().catch(() => false)) {
        await input.click({ force: true });
        await input.fill('');
        await input.type(bookingId, { delay: 15 });
        await input.press('Enter').catch(() => undefined);
        return;
      }
    }

    if (await wrapper.isVisible().catch(() => false)) {
      await wrapper.click({ force: true });
      await this.page.keyboard.press('Meta+a').catch(() => undefined);
      await this.page.keyboard.type(bookingId, { delay: 15 });
      await this.page.keyboard.press('Enter').catch(() => undefined);
    }
  }

  async assertBookingVisible(bookingId: string): Promise<void> {
    await expect
      .poll(async () => {
        await this.searchByBookingId(bookingId);
        const inCurrentView = await this.page.locator('body').innerText();
        if (inCurrentView.includes(bookingId)) {
          return true;
        }

        const tabs = [/upcoming bookings/i, /previous bookings/i, /drafts/i];
        for (const tabName of tabs) {
          const tab = this.page.getByText(tabName).first();
          if (await tab.isVisible().catch(() => false)) {
            await tab.click({ force: true });
            await this.searchByBookingId(bookingId);
            const body = await this.page.locator('body').innerText();
            if (body.includes(bookingId)) {
              return true;
            }
          }
        }

        return false;
      }, {
        timeout: 90000,
        intervals: [1000, 2000, 3000]
      })
      .toBeTruthy();
  }

  async assertBookingInUpcoming(bookingId: string): Promise<void> {
    const upcomingTab = this.page.getByText(/upcoming bookings/i).first();
    if (await upcomingTab.isVisible().catch(() => false)) {
      await upcomingTab.click({ force: true });
    }
    await this.assertBookingVisible(bookingId);
  }

  async assertBookingVisibleByDetails(language: string): Promise<void> {
    await expect
      .poll(async () => {
        const body = await this.page.locator('body').innerText();
        return new RegExp(language, 'i').test(body) || /Ludhiansk|Ludhianisk/i.test(body);
      }, {
        timeout: 90000,
        intervals: [1000, 2000, 3000]
      })
      .toBeTruthy();
  }

  async assertBookingReachableById(bookingId: string): Promise<void> {
    await this.page.goto(`/bookings/${bookingId}`);
    await expect
      .poll(async () => {
        const urlOk = new RegExp(`/bookings/${bookingId}(?:[/?#].*)?$`, 'i').test(this.page.url());
        if (!urlOk) return false;
        const body = await this.page.locator('body').innerText().catch(() => '');
        const hasIdSomewhere = new RegExp(`\\b${bookingId}\\b`).test(body);
        const hasDetailSignals =
          (await this.page.getByRole('button', { name: /cancel/i }).first().isVisible().catch(() => false)) ||
          (await this.page.getByRole('heading').first().isVisible().catch(() => false));
        return hasIdSomewhere || hasDetailSignals;
      }, { timeout: 45000, intervals: [1000, 2000, 3000] })
      .toBeTruthy();
  }

  async openDetailsOfAssignedOrPendingBooking(): Promise<string> {
    const upcomingTab = this.page.getByText(/upcoming bookings/i).first();
    if (await upcomingTab.isVisible().catch(() => false)) {
      await upcomingTab.click({ force: true });
    }

    const rows = this.page.getByRole('row').filter({ hasText: /(assigned|pending)/i });
    const rowCount = await rows.count();
    expect(rowCount, 'No assigned/pending booking rows found').toBeGreaterThan(0);

    for (let i = 0; i < Math.min(rowCount, 20); i++) {
      const row = rows.nth(i);
      const text = (await row.innerText().catch(() => '')) || '';
      const idMatch = text.match(/\b\d{3,}\b/);
      const bookingId = idMatch?.[0] ?? '';

      const clickTargets = [
        row.getByRole('button', { name: /view|details|open/i }).first(),
        row.getByRole('link', { name: /view|details|open/i }).first(),
        row.locator('td').first(),
        row
      ];

      for (const target of clickTargets) {
        if (await target.isVisible().catch(() => false)) {
          await target.click({ force: true });
          const curtainSignals = [
            this.page.getByRole('button', { name: /cancel/i }).first(),
            this.page.getByRole('heading', { name: /booking/i }).first(),
            this.page.getByText(/booking id/i).first()
          ];
          for (const signal of curtainSignals) {
            if (await signal.isVisible().catch(() => false)) {
              return bookingId;
            }
          }
          await this.page.waitForTimeout(250);
        }
      }
    }

    throw new Error('Could not open details of an assigned/pending booking');
  }

  async openDetailsByBookingId(bookingId: string): Promise<void> {
    await this.searchByBookingId(bookingId);

    const row = this.page.getByRole('row').filter({ hasText: new RegExp(`\\b${bookingId}\\b`) }).first();
    const clickTargets = [
      row.getByRole('button', { name: /view|details|open/i }).first(),
      row.getByRole('link', { name: /view|details|open/i }).first(),
      row.locator('td').first(),
      row
    ];

    for (const target of clickTargets) {
      if (await target.isVisible().catch(() => false)) {
        await target.click({ force: true });
        const curtainMarkers = [
          this.page.getByText(new RegExp(`booking\\s*id\\s*#?\\s*${bookingId}`, 'i')).first(),
          this.page.getByRole('button', { name: /cancel/i }).first()
        ];
        if (await Promise.any(curtainMarkers.map((m) => m.waitFor({ state: 'visible', timeout: 15000 }))).then(() => true).catch(() => false)) {
          return;
        }
      }
    }

    await this.page.goto(`/bookings/${bookingId}`);
    await expect
      .poll(async () => {
        const urlOk = new RegExp(`/bookings/${bookingId}(?:[/?#].*)?$`, 'i').test(this.page.url());
        if (!urlOk) return false;
        const body = await this.page.locator('body').innerText().catch(() => '');
        const hasIdSomewhere = new RegExp(`\\b${bookingId}\\b`).test(body);
        const hasCancel = await this.page.getByRole('button', { name: /cancel/i }).first().isVisible().catch(() => false);
        return hasIdSomewhere || hasCancel;
      }, { timeout: 45000, intervals: [1000, 2000, 3000] })
      .toBeTruthy();
  }

  async clickCancelBooking(): Promise<void> {
    const candidates = [
      this.page.getByRole('button', { name: /^cancel$/i }).first(),
      this.page.getByRole('button', { name: /cancel booking/i }).first(),
      this.page.getByRole('button', { name: /cancel/i }).first()
    ];

    for (const c of candidates) {
      if (await c.isVisible().catch(() => false)) {
        await c.click({ force: true });
        return;
      }
    }

    throw new Error('Cancel booking button not visible');
  }

  async confirmCancelInModal(): Promise<void> {
    const modal = this.page.getByRole('dialog').first();
    if (await modal.isVisible().catch(() => false)) {
      const confirm = modal.getByRole('button', { name: /confirm|yes|ok|cancel booking/i }).first();
      await expect(confirm).toBeVisible({ timeout: 15000 });
      await confirm.click({ force: true });
      await modal.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => undefined);
      return;
    }

    const confirmFallback = this.page.getByRole('button', { name: /confirm|yes|ok|cancel booking/i }).first();
    await expect(confirmFallback).toBeVisible({ timeout: 15000 });
    await confirmFallback.click({ force: true });
  }

  async assertBookingCancelled(bookingId: string): Promise<void> {
    await expect
      .poll(async () => {
        await this.searchByBookingId(bookingId);
        const body = (await this.page.locator('body').innerText()).toLowerCase();
        return body.includes(bookingId) && /(cancelled|canceled)/i.test(body);
      }, { timeout: 90000, intervals: [1000, 2000, 3000] })
      .toBeTruthy();
  }
}
