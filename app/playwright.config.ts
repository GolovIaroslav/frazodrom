import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);
const desktopViewport = { width: 1366, height: 768 };

const baseUse = {
  baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173',
  locale: 'ru-RU',
  timezoneId: 'Europe/Bratislava',
  reducedMotion: 'reduce' as const,
  colorScheme: 'light' as const,
  actionTimeout: 5_000,
  navigationTimeout: 15_000,
  trace: 'retain-on-failure' as const,
  screenshot: 'only-on-failure' as const,
  video: 'retain-on-failure' as const,
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  outputDir: 'test-results',
  use: baseUse,
  webServer: {
    command: 'npm run build && npx vite preview --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...baseUse, browserName: 'chromium', viewport: desktopViewport },
    },
    {
      name: 'firefox',
      grepInvert: /@visual|@layout|@chromium-cdp/,
      use: { ...baseUse, browserName: 'firefox', viewport: desktopViewport },
    },
    {
      name: 'webkit',
      grepInvert: /@visual|@layout|@chromium-cdp/,
      use: { ...baseUse, browserName: 'webkit', viewport: desktopViewport },
    },
    {
      name: 'edge',
      grepInvert: /@visual|@layout|@chromium-cdp/,
      use: { ...baseUse, browserName: 'chromium', channel: 'msedge', viewport: desktopViewport },
    },
    {
      name: 'mobile-chromium',
      grepInvert: /@visual|@layout|@chromium-cdp/,
      use: { ...baseUse, browserName: 'chromium', ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-webkit',
      grepInvert: /@visual|@layout|@chromium-cdp/,
      use: { ...baseUse, browserName: 'webkit', ...devices['iPhone 13'] },
    },
  ],
});
