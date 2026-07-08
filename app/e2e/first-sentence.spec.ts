import { test, expect } from '@playwright/test';

// PLAN.md §12 / Ф2 AC: "<60s from cold start to the first sentence being
// answerable". No dedicated onboarding screen exists yet (later phase), so
// the realistic cold-start path today is: course map -> pick a skill's
// drill -> input focused and ready to type.
test('cold start (Fast 3G, empty cache) to first answerable sentence is under 60s', async ({
  page,
  context,
}) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  // Fast 3G profile (matches Chrome DevTools' "Fast 3G" throttling preset).
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
    latency: 150,
  });

  const start = Date.now();

  await page.goto('/course-map');
  const firstDrillLink = page.getByRole('link', { name: /Дрилл|Drill/ }).first();
  await firstDrillLink.click();

  const input = page.locator('#drill-input');
  await expect(input).toBeVisible();
  await expect(input).toBeFocused();

  const elapsedMs = Date.now() - start;
  console.log(`cold start -> first answerable sentence: ${elapsedMs}ms`);
  expect(elapsedMs).toBeLessThan(60_000);
});
