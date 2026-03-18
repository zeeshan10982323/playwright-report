import { expect, Locator, Page } from '@playwright/test';

export class TopNav {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  userMenu(): Locator {
    return this.page.getByRole('button', { name: /profile|account|user|menu|sign out/i }).first();
  }

  async assertVisible(): Promise<void> {
    await expect(this.page.locator('body')).toBeVisible();
  }
}
