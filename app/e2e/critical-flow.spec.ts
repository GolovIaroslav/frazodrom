import { expect, readStore, test } from './fixtures';
import type { Page } from '@playwright/test';

async function openDrill(page: Page): Promise<void> {
  await page.goto('/drill/a1_be_affirm');
  await expect(page.getByTestId('drill-screen')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Переведи на английский' })).toBeFocused();
}

test('critical flow: correct answer, feedback, next sentence and persisted attempt', async ({ page }) => {
  await openDrill(page);
  const answer = page.getByRole('textbox', { name: 'Переведи на английский' });
  await answer.fill("It's love.");
  await page.getByRole('button', { name: 'Проверить' }).click();

  await expect(page.getByText('✓ Верно')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Дальше' })).toBeEnabled();
  await page.getByRole('button', { name: 'Дальше' }).click();
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Это любовь.');

  const attempts = await readStore<{ userInput: string; verdict: string }>(page, 'attempts');
  expect(attempts).toHaveLength(1);
  expect(attempts[0]).toMatchObject({ userInput: "It's love.", verdict: 'correct' });
});

test('critical flow: wrong answer, self feedback, rewrite and next sentence', async ({ page }) => {
  await openDrill(page);
  const answer = page.getByRole('textbox', { name: 'Переведи на английский' });
  await answer.fill('wrong answer');
  await page.getByRole('button', { name: 'Проверить' }).click();

  await expect(page.getByRole('paragraph').filter({ hasText: /Ключ ИИ не настроен или бюджет исчерпан/ })).toBeVisible();
  await page.getByRole('button', { name: 'Ошибся' }).click();
  await expect(page.getByText('✗ Неверно')).toBeVisible();

  await answer.fill("It's love.");
  await page.getByRole('button', { name: 'Проверить' }).click();
  await expect(page.getByText('✓ Верно')).toBeVisible();
  await page.getByRole('button', { name: 'Дальше' }).click();
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Это любовь.');

  const attempts = await readStore<{ userInput: string; verdict: string }>(page, 'attempts');
  expect(attempts).toHaveLength(2);
  expect(attempts.map((attempt) => attempt.verdict)).toEqual(['wrong', 'correct']);
});
