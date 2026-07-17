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
