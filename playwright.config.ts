import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ quiet: true });

const baseURL = process.env.BASE_URL;
if (!baseURL || /your-digitaltolkapp-url\.com/i.test(baseURL)) {
  throw new Error(
    'Invalid BASE_URL in .env. Set BASE_URL to your real digitaltolkapp URL before running tests.'
  );
}

export default defineConfig({
  testDir: './tests',
  timeout: 120000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.PW_RETRIES ? Number(process.env.PW_RETRIES) : (process.env.CI ? 2 : 0),
  workers: process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : (process.env.CI ? 1 : undefined),
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ...(process.env.MM_NOTIFY
      ? [[path.resolve(__dirname, 'reporters/mattermost-dm-reporter.ts'), {
        dmUsers: process.env.MM_DM_USERS || process.env.MM_DM_USER || '',
        channelTeam: process.env.MM_CHANNEL_TEAM || process.env.MM_TEAM || '',
        channelName: process.env.MM_CHANNEL_NAME || process.env.MM_CHANNEL || '',
        channelId: process.env.MM_CHANNEL_ID || '',
        target: process.env.MM_NOTIFY_TARGET || 'dm'
      }]]
      : [])
  ],
  use: {
  baseURL,
  trace: 'on-first-retry',
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
  headless: true,
  launchOptions: {
    slowMo: 400
  }
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    }
  ]
});
