import {
  expect,
  mockAiProviders,
  seedAiRouting,
  test,
  VALID_JUDGE_RESPONSE,
} from './fixtures';

async function triggerMockedJudge(page: Parameters<typeof mockAiProviders>[0]): Promise<void> {
  await page.goto('/drill/a1_be_affirm');
  await page.getByRole('textbox', { name: 'Переведи на английский' }).fill('a deliberately wrong answer');
  await page.getByRole('button', { name: 'Проверить' }).click();
}

test('AI routing uses a fully mocked successful first provider', async ({ page }) => {
  await seedAiRouting(page);
  await mockAiProviders(page, {
    primary: { kind: 'success', body: VALID_JUDGE_RESPONSE },
    secondary: { kind: 'success', body: VALID_JUDGE_RESPONSE },
  });
  await triggerMockedJudge(page);

  await expect(page.getByTestId('drill-screen').getByText('mock-primary', { exact: true })).toBeVisible();
  await expect(page.getByText('✗ Неверно')).toBeVisible();
});

test('AI routing falls back after a mocked timeout', async ({ page, diagnostics }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await seedAiRouting(page);
  await mockAiProviders(page, {
    primary: { kind: 'timeout' },
    secondary: { kind: 'success', body: VALID_JUDGE_RESPONSE },
  });
  await triggerMockedJudge(page);

  await expect(page.getByTestId('drill-screen').getByText('mock-secondary', { exact: true })).toBeVisible();
  expect(requests.some((url) => /googleapis|groq\.com|openrouter|gigachat|yandex/i.test(url))).toBe(false);
  expect((await page.locator('body').textContent()) ?? '').not.toMatch(/AIza|sk-[A-Za-z0-9]|real-api-key/);
  expect(diagnostics.consoleErrors.every((message) => message.includes('504'))).toBe(true);
  diagnostics.consoleErrors.length = 0;
});

test('invalid first response falls back and an exhausted chain reaches self-check', async ({ page }) => {
  await seedAiRouting(page);
  await mockAiProviders(page, {
    primary: { kind: 'invalid' },
    secondary: { kind: 'success', body: VALID_JUDGE_RESPONSE },
  });
  await triggerMockedJudge(page);
  await expect(page.getByTestId('drill-screen').getByText('mock-secondary', { exact: true })).toBeVisible();

  await page.goto('/');
  await expect(page.getByText(/повторений нет/)).toBeVisible();
  await page.goto('/drill/a1_be_affirm');
  await mockAiProviders(page, {
    primary: { kind: 'invalid' },
    secondary: { kind: 'invalid' },
  });
  await page.getByRole('textbox', { name: 'Переведи на английский' }).fill('another wrong answer');
  await page.getByRole('button', { name: 'Проверить' }).click();
  await expect(page.getByRole('paragraph').filter({ hasText: /Ключ ИИ не настроен или бюджет исчерпан/ })).toBeVisible();
});

test('empty Judge configuration is an explicit self-check state', async ({ page }) => {
  await page.goto('/drill/a1_be_affirm');
  await page.getByRole('textbox', { name: 'Переведи на английский' }).fill('wrong answer');
  await page.getByRole('button', { name: 'Проверить' }).click();
  await expect(page.getByRole('paragraph').filter({ hasText: /Ключ ИИ не настроен или бюджет исчерпан/ })).toBeVisible();
});

test('accepted cache avoids a second judge call for the same answer', async ({ page }) => {
  const calls: string[] = [];
  const acceptedResponse = JSON.stringify({
    verdict: 'correct',
    error_tags: [],
    explanation_ru: 'Принято моковым судьёй.',
    corrected: 'A love.',
    natural: 'A love.',
    add_to_accepted: true,
  });
  await seedAiRouting(page);
  await mockAiProviders(page, {
    primary: { kind: 'success', body: acceptedResponse },
    secondary: { kind: 'success', body: acceptedResponse },
  });
  page.on('request', (request) => {
    if (request.url().includes('mock-primary')) calls.push(request.url());
  });

  await page.goto('/drill/a1_be_affirm');
  await page.getByRole('textbox', { name: 'Переведи на английский' }).fill('A love.');
  await page.getByRole('button', { name: 'Проверить' }).click();
  await expect(page.getByText('✓ Верно')).toBeVisible();
  await expect(page.getByTestId('drill-screen').getByText('mock-primary', { exact: true })).toBeVisible();

  await page.goto('/drill/a1_be_affirm');
  await page.getByRole('textbox', { name: 'Переведи на английский' }).fill('A love.');
  await page.getByRole('button', { name: 'Проверить' }).click();
  await expect(page.getByText('✓ Верно')).toBeVisible();
  expect(calls).toHaveLength(1);
});
