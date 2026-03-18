import { expect, Page } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async assertLoaded(): Promise<void> {
    await expect.poll(() => this.page.url(), { timeout: 30000 }).not.toMatch(/login|signin|auth/i);
    await expect(this.page.locator('body')).toBeVisible();
  }

  async openTileByName(tileName: RegExp | string): Promise<void> {
    await this.page.getByRole('button', { name: tileName }).first().click();
  }
}
