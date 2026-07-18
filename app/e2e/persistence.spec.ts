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

test('wrong and rewrite attempts survive a reload', async ({ page }) => {
  await page.goto('/drill/a1_be_affirm');
  const answer = page.getByRole('textbox', { name: 'Переведи на английский' });
  await answer.fill('It love.');
  await page.getByRole('button', { name: 'Проверить' }).click();
  await page.getByRole('button', { name: 'Ошибся' }).click();
  await answer.fill("It's love.");
  await page.getByRole('button', { name: 'Проверить' }).click();
  await expect(page.getByText('✓ Верно')).toBeVisible();

  await page.reload();
  const attempts = await readStore<{ userInput: string; verdict: string }>(page, 'attempts');
  expect(attempts).toEqual([
    expect.objectContaining({ userInput: 'It love.', verdict: 'wrong' }),
    expect.objectContaining({ userInput: "It's love.", verdict: 'correct' }),
  ]);
});

test('review completion shows final session stats', async ({ page }) => {
  await page.goto('/drill/a1_be_affirm');
  await expect(page.getByRole('heading', { name: 'Это любовь.' })).toBeVisible();

  await page.evaluate(async () => {
    const request = indexedDB.open('frazodrom');
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const pack = await new Promise<{ data: { items: unknown[] } }>((resolve, reject) => {
      const get = database.transaction('packs', 'readonly').objectStore('packs').get('a1_be_affirm');
      get.onsuccess = () => resolve(get.result);
      get.onerror = () => reject(get.error);
    });
    pack.data.items = pack.data.items.slice(0, 2);
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(['packs', 'sessions', 'attempts', 'skillState'], 'readwrite');
      transaction.objectStore('packs').put(pack);
      transaction.objectStore('sessions').clear();
      transaction.objectStore('attempts').clear();
      transaction.objectStore('skillState').put({
        skillId: 'a1_be_affirm',
        status: 'in_progress',
        accuracy: 0.7,
        attemptCount: 5,
        correctCount: 3,
        due: Date.now() - 60_000,
        stability: 1,
        difficulty: 6,
        reps: 5,
        lapses: 1,
        state: 2,
        lastReview: Date.now() - 86_400_000,
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Начать повторение' }).click();
  const answer = page.getByRole('textbox', { name: 'Переведи на английский' });
  await answer.fill("It's love.");
  await answer.press('Enter');
  await page.getByRole('button', { name: 'Дальше' }).click();
  await answer.fill('It love.');
  await answer.press('Enter');
  await page.getByRole('button', { name: 'Ошибся' }).click();
  await answer.fill('Mine are worse.');
  await answer.press('Enter');
  await page.getByRole('button', { name: 'Дальше' }).click();
  await answer.fill('Mine are worse.');
  await answer.press('Enter');
  await page.getByRole('button', { name: 'Дальше' }).click();

  await expect(page.getByRole('heading', { name: 'Сессия завершена!' })).toBeVisible();
  await expect
    .poll(async () => {
      const sessions = await readStore<{ finishedAt?: number; stats: { total: number; correct: number } }>(page, 'sessions');
      return sessions.find((session) => session.finishedAt)?.stats;
    })
    .toEqual({ total: 3, correct: 2 });
  const skillState = await readStore<{
    skillId: string;
    reps: number;
    due: number;
    stability: number;
    difficulty: number;
    state: number;
    lastReview: number;
  }>(page, 'skillState');
  const reviewedSkill = skillState.find((record) => record.skillId === 'a1_be_affirm');
  expect(reviewedSkill).toEqual(expect.objectContaining({
    reps: expect.any(Number),
    due: expect.any(Number),
    stability: expect.any(Number),
    difficulty: expect.any(Number),
    state: expect.any(Number),
    lastReview: expect.any(Number),
  }));
  expect(reviewedSkill?.reps).toBeGreaterThan(5);
  expect(reviewedSkill?.lastReview).toBeGreaterThan(Date.now() - 60_000);
  await expect(page.getByText('Верно 2 из 3.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'К разделу «Сегодня»' })).toBeVisible();
});

test('TutorChat Enter does not submit the drill answer', async ({ page }) => {
  await page.goto('/drill/a1_be_affirm');
  const answer = page.getByRole('textbox', { name: 'Переведи на английский' });
  await answer.fill('It love.');
  await answer.press('Enter');
  await expect(page.getByRole('button', { name: 'Ошибся' })).toBeVisible();
  await page.getByRole('button', { name: 'Ошибся' }).click();
  await page.getByRole('button', { name: 'Спросить репетитора' }).click();

  const chat = page.getByRole('textbox', { name: 'Спроси что-нибудь об этом предложении…' });
  await chat.fill('Почему это неверно?');
  await chat.press('Enter');

  await expect(page.getByText('Репетитор сейчас недоступен — нет ключа, бюджет исчерпан или сервер недоступен.')).toBeVisible();
  await expect(page.getByText('Ответ должен быть по-английски.')).not.toBeVisible();
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
  expect(await readStore(page, 'kv')).toEqual([
    { key: 'tts.browserOnlyMigration.v1', value: true },
  ]);
});
