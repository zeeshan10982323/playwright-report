import { expect, test } from '../../fixtures/test';
import { loginAsDefaultUser } from '../../fixtures/test';
import { requiredEnv } from '../../utils/env';

test.describe('Auth', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(180000);

  test('@smoke valid login redirects to app', async ({ dashboardPage, loginPage, page }) => {
    await test.step('Login with valid credentials', async () => {
      await loginAsDefaultUser(loginPage);
    });

    await test.step('Verify dashboard loaded', async () => {
      await loginPage.assertLoginSucceeded();
      await dashboardPage.assertLoaded();
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test('@regression invalid password shows error', async ({ loginPage }) => {
    await test.step('Open login and submit invalid password', async () => {
      await loginPage.page.context().clearCookies();
      await loginPage.page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
      await loginPage.assertLoginFormVisible();

      const fakeUsername = `invalid_user_${Date.now()}@example.com`;
      await loginPage.login(fakeUsername, `${requiredEnv('LOGIN_PASSWORD')}_invalid`);
    });

    await test.step('Verify login failure', async () => {
      await loginPage.assertLoginFailed();
    });
  });
});
