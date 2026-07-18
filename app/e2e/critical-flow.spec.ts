import { expect, readStore, seedKv, test } from './fixtures';
import type { Page } from '@playwright/test';

async function openDrill(page: Page): Promise<void> {
  await page.goto('/drill/a1_be_affirm');
  await expect(page.getByTestId('drill-screen')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Переведи на английский' })).toBeFocused();
}

test('critical flow: tier 0 rejects empty and Russian answers locally', async ({ page }) => {
  await openDrill(page);
  const answer = page.getByRole('textbox', { name: 'Переведи на английский' });
  const check = page.getByRole('button', { name: 'Проверить' });

  await check.click();
  await expect(page.getByRole('alert')).toHaveText('Ответ должен быть по-английски.');
  await expect(page.getByText('Ключ ИИ не настроен или бюджет исчерпан')).toHaveCount(0);

  await answer.fill('Это любовь');
  await check.click();
  await expect(page.getByRole('alert')).toHaveText('Ответ должен быть по-английски.');
  await expect(page.getByText('Ключ ИИ не настроен или бюджет исчерпан')).toHaveCount(0);
});

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

test('critical flow: correct answer auto-plays through browser speech', async ({ page }) => {
  await openDrill(page);
  await page.evaluate(() => {
    class QaSpeechSynthesisUtterance {
      text: string;
      rate = 1;
      voice: unknown;
      onend: ((event: Event) => void) | null = null;
      onerror: ((event: Event & { error?: string }) => void) | null = null;

      constructor(text: string) {
        this.text = text;
      }
    }

    const calls: string[] = [];
    Object.defineProperty(window, '__qaSpeechCalls', { configurable: true, value: calls });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: QaSpeechSynthesisUtterance,
    });
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        addEventListener: () => undefined,
        cancel: () => undefined,
        getVoices: () => [],
        removeEventListener: () => undefined,
        speak: (utterance: QaSpeechSynthesisUtterance) => {
          calls.push(utterance.text);
          queueMicrotask(() => utterance.onend?.(new Event('end')));
        },
      },
    });
  });
  await seedKv(page, [
    { key: 'tts.autoPlay', value: true },
  ]);

  await page.getByRole('textbox', { name: 'Переведи на английский' }).fill("It's love.");
  await page.getByRole('button', { name: 'Проверить' }).click();

  await expect(page.getByText('✓ Верно')).toBeVisible();
  await expect.poll(() =>
    page.evaluate(() => (window as Window & { __qaSpeechCalls: string[] }).__qaSpeechCalls),
  ).toEqual(["It's love."]);
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
