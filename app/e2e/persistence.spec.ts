import { expect, readStore, seedKv, seedProgress, test } from './fixtures';

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

test('Settings can export a backup and reset local data', async ({ page }) => {
  await seedProgress(page, { accuracy: 0.8, attemptCount: 5, correctCount: 4 });
  await seedKv(page, [{ key: 'llm.gemini.apiKey', value: 'fake-key-for-test' }]);
  await page.goto('/settings');

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('backup-export').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^frazodrom-backup-.*\.json$/);

  page.once('dialog', (dialog) => void dialog.accept());
  const resetButton = page.getByTestId('backup-reset');
  await resetButton.scrollIntoViewIfNeeded();
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    resetButton.click(),
  ]);
  await expect(page.getByTestId('settings-screen')).toBeVisible();
  expect(await readStore(page, 'skillState')).toEqual([]);
  expect(await readStore(page, 'attempts')).toEqual([]);
  expect(await readStore(page, 'kv')).toEqual([]);
});
