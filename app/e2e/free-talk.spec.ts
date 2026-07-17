import { expect, seedKv, test } from './fixtures';

test('Free Talk supports a mocked conversation and summary', async ({ page }) => {
  await page.route('https://mock-primary.invalid/**', async (route) => {
    const request = route.request().postDataJSON() as { messages?: Array<{ content?: string }> };
    const system = request.messages?.[0]?.content ?? '';
    const content = system.includes('summary_ru')
      ? JSON.stringify({ summary_ru: 'Mock summary.', recurring_tags: [] })
      : 'Mock assistant reply.';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ choices: [{ message: { content } }] }),
    });
  });

  await seedKv(page, [
    {
      key: 'llm.localOpenai.profiles',
      value: [
        {
          id: 'mock-primary',
          label: 'Mock primary',
          baseUrl: 'https://mock-primary.invalid/v1',
          model: 'mock-model',
          timeoutMs: 1000,
        },
      ],
    },
    { key: 'llm.routing', value: { judge: [], tutor: ['mock-primary'], generator: [] } },
    { key: 'llm.budget.ceilings', value: { judge: 800, tutor: 150, generator: 50 } },
  ]);

  await page.goto('/free-talk');
  await expect(page.getByRole('heading', { name: 'Свободный диалог' })).toBeVisible();
  await page.getByRole('button', { name: 'Путешествия' }).click();
  await page.getByRole('textbox', { name: 'Напиши что-нибудь по-английски…' }).fill('I like local markets.');
  await page.getByRole('button', { name: 'Отправить' }).click();
  await expect(page.getByText('Mock assistant reply.')).toBeVisible();

  await page.getByRole('button', { name: 'Закончить' }).click();
  await expect(page.getByText('Mock summary.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'К дриллам' })).toBeEnabled();
});
