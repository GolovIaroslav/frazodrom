import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

const routes = [
  '/',
  '/course-map',
  '/drill/a1_be_affirm',
  '/settings',
] as const;

for (const route of routes) {
  test(`critical accessibility checks for ${route}`, async ({ page }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const seriousViolations = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    );
    expect(seriousViolations, JSON.stringify(seriousViolations, null, 2)).toEqual([]);
  });
}

test('keyboard navigation exposes a visible focus target', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('link', { name: 'Карта курса' }).focus();
  const focusStyle = await page.getByRole('link', { name: 'Карта курса' }).evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
  });
  expect(focusStyle.outlineStyle).not.toBe('none');
  expect(focusStyle.outlineWidth).not.toBe('0px');
});

test('TutorChat has a labelled panel role and keeps keyboard focus predictable', async ({ page }) => {
  await page.goto('/drill/a1_be_affirm');
  const answer = page.getByRole('textbox', { name: 'Переведи на английский' });
  await answer.fill('It love.');
  await page.getByRole('button', { name: 'Проверить' }).click();
  await page.getByRole('button', { name: 'Ошибся' }).click();

  const trigger = page.getByRole('button', { name: 'Спросить репетитора' });
  await trigger.click();

  const panel = page.getByRole('region', { name: 'Спросить репетитора' });
  await expect(panel).toBeVisible();
  const chat = page.getByRole('textbox', { name: 'Спроси что-нибудь об этом предложении…' });
  await expect(chat).toBeFocused();

  await panel.getByRole('button', { name: 'Закрыть чат' }).click();
  await expect(trigger).toBeFocused();
});
