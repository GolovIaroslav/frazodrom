import { expect, readStore, test } from './fixtures';

test('language setting persists after reload and a fresh context is empty', async ({ page, browser }) => {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Course Map' })).toBeVisible();

  const freshContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:4173',
    locale: 'ru-RU',
    timezoneId: 'Europe/Bratislava',
  });
  const freshPage = await freshContext.newPage();
  await freshPage.goto('/settings');
  await expect(freshPage.getByRole('heading', { name: 'Настройки', exact: true })).toBeVisible();
  await freshContext.close();
});

test('IndexedDB progress survives a reload', async ({ page }) => {
  await page.goto('/drill/a1_be_affirm');
  const answer = page.getByRole('textbox', { name: 'Переведи на английский' });
  await answer.fill("It's love.");
  await page.getByRole('button', { name: 'Проверить' }).click();
  await expect(page.getByText('✓ Верно')).toBeVisible();
  await page.getByRole('button', { name: 'Дальше' }).click();

  await page.reload();
  const attempts = await readStore<{ userInput: string; verdict: string }>(page, 'attempts');
  expect(attempts).toEqual([
    expect.objectContaining({ userInput: "It's love.", verdict: 'correct' }),
  ]);
});
