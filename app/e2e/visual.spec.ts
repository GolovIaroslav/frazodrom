import { expect, seedProgress, test, waitForStablePage } from './fixtures';

test('course map visual baseline @visual', async ({ page }) => {
  await page.goto('/course-map');
  await waitForStablePage(page);
  await expect(page).toHaveScreenshot('course-map.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixels: 300,
  });
});

test('drill visual baseline @visual', async ({ page }) => {
  await page.goto('/drill/a1_be_affirm');
  await waitForStablePage(page);
  await expect(page).toHaveScreenshot('drill.png', {
    animations: 'disabled',
    caret: 'hide',
    mask: [page.getByText(/Осталось:/)],
    maxDiffPixels: 300,
  });
});

test('review visual baseline @visual', async ({ page }) => {
  await page.goto('/settings');
  await seedProgress(page, {
    status: 'in_progress',
    accuracy: 0.8,
    attemptCount: 5,
    correctCount: 4,
    due: Date.now() - 1_000,
    stability: 1,
    difficulty: 5,
    reps: 1,
    state: 2,
    lastReview: Date.now() - 86_400_000,
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Начать повторение' }).click();
  await expect(page.getByTestId('drill-screen')).toBeVisible();
  await waitForStablePage(page);
  await expect(page).toHaveScreenshot('review.png', {
    animations: 'disabled',
    caret: 'hide',
    mask: [page.getByText(/Осталось:/)],
    maxDiffPixels: 300,
  });
});

test('settings visual baseline @visual', async ({ page }) => {
  await page.goto('/settings');
  await waitForStablePage(page);
  await expect(page).toHaveScreenshot('settings.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixels: 400,
  });
});

test('mobile layout visual baseline @visual', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/course-map');
  await waitForStablePage(page);
  await expect(page).toHaveScreenshot('mobile-layout.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixels: 300,
  });
});
