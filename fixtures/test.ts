import { test as base, expect } from '@playwright/test';
import { DashboardPage } from '../pages/DashboardPage';
import { LoginPage } from '../pages/LoginPage';
import { requiredEnv } from '../utils/env';

type AppFixtures = {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
};

export const test = base.extend<AppFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  }
});

export { expect };

export async function loginAsDefaultUser(loginPage: LoginPage): Promise<void> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      if (attempt > 1) {
        await loginPage.page.context().clearCookies();
        await loginPage.page.goto('about:blank');
      }

      const state = await loginPage.goto();
      if (state === 'login_form') {
        await loginPage.login(requiredEnv('LOGIN_EMAIL'), requiredEnv('LOGIN_PASSWORD'));
      }

      await loginPage.assertLoginSucceeded();
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

export async function loginAsTranslator(loginPage: LoginPage): Promise<void> {
  const translatorEmail = process.env.TRANSLATOR_EMAIL;
  const translatorPassword = process.env.TRANSLATOR_PASSWORD;
  if (!translatorEmail || !translatorPassword) {
    throw new Error('Missing TRANSLATOR_EMAIL or TRANSLATOR_PASSWORD in env.');
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      if (attempt > 1) {
        await loginPage.page.context().clearCookies();
        await loginPage.page.goto('about:blank');
      }

      const state = await loginPage.goto();
      if (state === 'login_form') {
        await loginPage.login(translatorEmail, translatorPassword);
      }

      await loginPage.assertLoginSucceeded();
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}
