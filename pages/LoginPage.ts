import { expect, Locator, Page } from '@playwright/test';

type LoginEntryState = 'login_form' | 'authenticated';

export class LoginPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(): Promise<LoginEntryState> {
    await this.page.goto('/auth/login', { waitUntil: 'domcontentloaded' });

    await expect
      .poll(async () => (await this.isLoginFormVisible()) || (await this.isDashboardVisible()), {
        timeout: 45000
      })
      .toBeTruthy();

    if (await this.isLoginFormVisible()) {
      return 'login_form';
    }

    if (await this.isDashboardVisible()) {
      return 'authenticated';
    }

    throw new Error(`Unexpected state after /auth/login. Current URL: ${this.page.url()}`);
  }

  async login(usernameOrEmail: string, password: string): Promise<void> {
    const username = await this.resolveUsernameInput(45000);
    const passwordInput = await this.resolvePasswordInput(45000);
    const submit = await this.resolveSubmitButton(45000);

    await username.fill(usernameOrEmail);
    await passwordInput.fill(password);

    const tokenResponsePromise = this.page
      .waitForResponse(
        (response) =>
          response.request().method() === 'POST' && /oauth\/token|auth\/login|session|token/i.test(response.url()),
        { timeout: 45000 }
      )
      .catch(() => null);

    await submit.click();

    await tokenResponsePromise;
  }

  async assertLoginSucceeded(): Promise<void> {
    await expect(this.page).not.toHaveURL(/\/auth\/login|signin|passwordless|register|forgot-password/i, {
      timeout: 60000
    });

    const dashboardMarkers = [
      this.page.getByText(/Create Booking/i).first(),
      this.page.getByText(/Dashboard/i).first(),
      this.page.getByText(/My Bookings/i).first(),
      this.page.locator('a[href*="/dashboard"]').first()
    ];

    await this.waitForVisibleLocator(dashboardMarkers, 45000, 'Dashboard markers not visible after login.');
  }

  async assertLoginFormVisible(): Promise<void> {
    await this.resolveUsernameInput(45000);
    await this.resolvePasswordInput(45000);
    await this.resolveSubmitButton(45000);
  }

  async assertLoginFailed(): Promise<void> {
    await expect
      .poll(
        async () => {
          const onLoginRoute = /\/auth\/login|login|signin/i.test(this.page.url());
          const hasExplicitError = await this.page
            .getByText(/invalid|incorrect|unauthorized|required|failed|wrong/i)
            .first()
            .isVisible()
            .catch(() => false);
          const hasForm = await this.isLoginFormVisible();
          return onLoginRoute && (hasExplicitError || hasForm);
        },
        { timeout: 30000 }
      )
      .toBeTruthy();
  }

  private async resolveUsernameInput(timeoutMs: number): Promise<Locator> {
    const candidates = [
      this.page.getByLabel(/username|email/i).first(),
      this.page.locator('input[placeholder="Username"]').first(),
      this.page.locator('input[placeholder*="user" i]').first(),
      this.page.locator('[data-testid="username"]').first(),
      this.page.locator('input[name="username"]').first(),
      this.page.locator('input[name="email"]').first(),
      this.page.locator('input[type="email"]').first(),
      this.page.locator('input[autocomplete="username"]').first()
    ];

    return this.waitForVisibleLocator(candidates, timeoutMs, 'Username/email input not visible.');
  }

  private async resolvePasswordInput(timeoutMs: number): Promise<Locator> {
    const candidates = [
      this.page.getByLabel(/password/i).first(),
      this.page.locator('[data-testid="password"]').first(),
      this.page.locator('input[name="password"]').first(),
      this.page.locator('input[type="password"]').first()
    ];

    return this.waitForVisibleLocator(candidates, timeoutMs, 'Password input not visible.');
  }

  private async resolveSubmitButton(timeoutMs: number): Promise<Locator> {
    const candidates = [
      this.page.getByRole('button', { name: /log in|login|sign in|continue/i }).first(),
      this.page.locator('button[type="submit"]').first()
    ];

    return this.waitForVisibleLocator(candidates, timeoutMs, 'Login submit button not visible.');
  }

  private async waitForVisibleLocator(
    candidates: Locator[],
    timeoutMs: number,
    errorMessage: string
  ): Promise<Locator> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      for (const locator of candidates) {
        if (await locator.isVisible().catch(() => false)) {
          return locator;
        }
      }

      const remaining = Math.max(1, deadline - Date.now());
      await Promise.any(
        candidates.map((locator) =>
          locator.waitFor({ state: 'visible', timeout: Math.min(3000, remaining) })
        )
      ).catch(() => undefined);
    }

    throw new Error(errorMessage);
  }

  private async isLoginFormVisible(): Promise<boolean> {
    const username = await this.resolveUsernameInput(15000).then(() => true).catch(() => false);
    const password = await this.resolvePasswordInput(15000).then(() => true).catch(() => false);
    return username && password;
  }

  private async isDashboardVisible(): Promise<boolean> {
    const markers = [
      this.page.getByText(/Create Booking/i).first(),
      this.page.getByText(/Dashboard/i).first(),
      this.page.getByText(/My Bookings/i).first(),
      this.page.locator('a[href*="/dashboard"]').first()
    ];

    for (const marker of markers) {
      if (await marker.isVisible().catch(() => false)) {
        return true;
      }
    }

    return false;
  }
}
