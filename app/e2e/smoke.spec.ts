import { expect, test } from './fixtures';

test('app shell loads without browser errors', async ({ page }) => {
  await expect(page.getByTestId('app-main')).toBeVisible();
  await expect(page.getByTestId('home-screen')).toBeVisible();
  await expect(page.getByRole('navigation')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Карта курса' })).toBeEnabled();
  await expect(page.getByRole('link', { name: 'Настройки' })).toBeEnabled();
});

test('voice settings use browser speech without a model download or cloud TTS switch', async ({ page }) => {
  await page.goto('/settings');

  await expect(page.getByRole('button', { name: '🔊 Проверить голос' })).toBeVisible();
  await expect(page.getByText('Включить качественный голос')).toHaveCount(0);
  await expect(page.getByText('Использовать Gemini voice (нужен Gemini API key)')).toHaveCount(0);
});

test('primary routes open directly and browser history works', async ({ page }) => {
  const routes = [
    { path: '/', marker: 'home-screen' },
    { path: '/course-map', marker: 'course-map-screen' },
    { path: '/drill/a1_be_affirm', marker: 'drill-screen' },
    { path: '/settings', marker: 'settings-screen' },
  ] as const;

  for (const route of routes) {
    await page.goto(route.path);
    await expect(page.getByTestId(route.marker)).toBeVisible();
  }

  await page.goto('/course-map');
  await page.getByRole('link', { name: 'Настройки' }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/course-map$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/settings$/);
});

test('free talk and empty direct session show usable states', async ({ page }) => {
  await page.goto('/free-talk');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText(/нужен ключ ии|ai key/i)).toBeVisible();

  await page.goto('/session');
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByText(/нет активной сессии|no active session/i)).toBeVisible();
});

test('unknown routes show a localized recovery state', async ({ page }) => {
  await page.goto('/unknown-route');
  await expect(page.getByTestId('not-found-screen')).toBeVisible();
  await expect(page.getByRole('link', { name: /на главную|go home/i })).toBeEnabled();
});

test('unknown drill skills show a recoverable load error', async ({ page }) => {
  await page.goto('/drill/no-such-skill');
  await expect(page.getByText(/не удалось загрузить пак навыка|could not load skill pack/i)).toBeVisible();
});
