import { expect, test } from './fixtures';

const viewports = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
] as const;

const screens = [
  { path: '/', marker: 'home-screen' },
  { path: '/course-map', marker: 'course-map-screen' },
  { path: '/drill/a1_be_affirm', marker: 'drill-screen' },
  { path: '/settings', marker: 'settings-screen' },
] as const;

for (const viewport of viewports) {
  test(`key screens fit ${viewport.width}x${viewport.height} @layout`, async ({ page }) => {
    await page.setViewportSize(viewport);

    for (const screen of screens) {
      await page.goto(screen.path);
      const root = page.getByTestId(screen.marker);
      await expect(root).toBeVisible();

      const metrics = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      }));
      expect(metrics.scrollWidth, `${screen.path} has horizontal overflow`).toBeLessThanOrEqual(metrics.clientWidth);

      const heading = page.getByRole('heading', { level: 1 });
      const box = await heading.boundingBox();
      expect(box, `${screen.path} heading is missing`).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(metrics.viewportWidth);
      expect(box!.y + box!.height).toBeLessThanOrEqual(metrics.viewportHeight);
    }
  });
}
