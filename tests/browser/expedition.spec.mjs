import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';

async function ready(page, query = '?scoutTheme=dark') {
  await page.goto(`/${query}`);
  await expect(page.locator('body')).toHaveAttribute('data-renderer', 'webgl');
  await expect.poll(() => page.locator('canvas').evaluate(canvas => {
    const sample = document.createElement('canvas');
    sample.width = 64;
    sample.height = 64;
    const context = sample.getContext('2d');
    context.drawImage(canvas, 0, 0, 64, 64);
    const pixels = context.getImageData(0, 0, 64, 64).data;
    const colours = new Set();
    for (let i = 0; i < pixels.length; i += 4) colours.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
    return colours.size;
  })).toBeGreaterThan(150);
}

const image = async page => createHash('sha256').update(await page.locator('canvas').evaluate(canvas => canvas.toDataURL())).digest('hex');
const route = (page, name) => page.locator('#route-list').getByRole('button', { name: `Jump to ${name}`, exact: true });

test('renders real procedural pixels without remote runtime dependencies or shader errors', async ({ page }) => {
  const errors = [];
  const remoteRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => {
    if (!request.url().startsWith('http://127.0.0.1:4173') && !request.url().startsWith('data:')) remoteRequests.push(request.url());
  });
  await ready(page);
  expect(errors).toEqual([]);
  expect(remoteRequests).toEqual([]);
  await expect(page.locator('#repository')).toHaveAttribute('href', 'https://github.com/chapi-dev/agent-hosting-lab');
});

test('replacement jumps and aborting preserve the last completed arrival', async ({ page }) => {
  await ready(page);
  await route(page, 'Pelagic').click();
  await expect(page.locator('body')).toHaveAttribute('data-mode', 'transit');
  await route(page, 'Parallax').click();
  await route(page, 'Ferrum').click();
  await expect(page.locator('#mission-title')).toHaveText('Ferrum');
  await expect(page.locator('body')).toHaveAttribute('data-mode', 'arrival');
  await route(page, 'Aphelion').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#mission-title')).toHaveText('Ferrum');
  await expect(page.locator('body')).toHaveAttribute('data-mode', 'arrival');
  await expect(page.locator('#repository')).toHaveAttribute('href', 'https://github.com/chapi-dev/telco-devsecops-demo');
  await expect(route(page, 'Ferrum')).toHaveAttribute('aria-current', 'true');
  await route(page, 'Aphelion').click();
  await page.keyboard.press('m');
  await page.keyboard.press('Escape');
  await expect(page.locator('#mission-title')).toHaveText('Ferrum');
});

test('the star chart, surface scanner, satellite moons, route keys and native controls dialog work', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await page.locator('#scan-toggle').click();
  await expect(page.locator('#scan-badge')).toHaveText('SURFACE SURVEYED');
  await expect(page.locator('#moon-list .moon-card')).toHaveCount(3);
  await page.getByRole('button', { name: 'Inspect moon Aethel Foundry', exact: true }).click();
  await expect(page.locator('#scan-badge')).toHaveText('MOON LOCK');
  await expect(page.locator('#repository')).toHaveAttribute('href', 'https://github.com/chapi-dev/agentic-factory-hack');
  await page.locator('#chart-toggle').click();
  await expect(page.locator('body')).toHaveAttribute('data-mode', 'chart');
  const markers = page.locator('#map-markers');
  await expect(markers.getByRole('button')).toHaveCount(8);
  await markers.getByRole('button', { name: 'Jump to Parallax', exact: true }).click();
  await expect(page.locator('#mission-title')).toHaveText('Parallax');
  await expect(page.locator('#map-markers')).toBeHidden();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#mission-title')).toHaveText('Ferrum');
  await page.keyboard.press('5');
  await expect(page.locator('#mission-title')).toHaveText('Sentinel');
  await page.keyboard.press('1');
  await expect(page.locator('#mission-title')).toHaveText('Vesper');
  await page.locator('#help-toggle').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('reduced motion is static, deep links arrive directly and motion can finish a jump', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page, '?destination=parallax&scoutTheme=dark');
  await expect(page.locator('#mission-title')).toHaveText('Parallax');
  await expect(page.locator('#motion-toggle')).toHaveAttribute('aria-pressed', 'false');
  const before = await image(page);
  await page.waitForTimeout(300);
  expect(await image(page)).toBe(before);
  await route(page, 'Halation').click();
  await expect(page.locator('body')).toHaveAttribute('data-mode', 'arrival');
  await expect(page.locator('#mission-title')).toHaveText('Halation');
  expect(await image(page)).not.toBe(before);
  await page.locator('#motion-toggle').click();
  await route(page, 'Pelagic').click();
  await page.locator('#motion-toggle').click();
  await expect(page.locator('body')).toHaveAttribute('data-mode', 'arrival');
  await expect(page.locator('#mission-title')).toHaveText('Pelagic');
});

test('all eight destinations remain usable without WebGL', async ({ page }) => {
  await page.addInitScript(() => {
    const context = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      return String(kind).includes('webgl') ? null : context.call(this, kind, ...args);
    };
  });
  await page.goto('/');
  await expect(page.locator('#fallback')).toBeVisible();
  await expect(page.locator('#chart-toggle')).toBeDisabled();
  await expect(page.locator('#reset-view')).toBeDisabled();
  await expect(page.locator('#route-list button')).toHaveCount(8);
  await route(page, 'Parallax').click();
  await expect(page.locator('#mission-title')).toHaveText('Parallax');
  await expect(page.locator('#repository')).toHaveAttribute('href', 'https://github.com/chapi-dev/Introduction-to-Quantum-Computing');
});

test('the eight ordinary repository links survive with JavaScript disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/');
  await expect(page.locator('noscript a')).toHaveCount(8);
  for (const link of await page.locator('noscript a').all()) {
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', /^https:\/\/github\.com\/chapi-dev\//);
  }
  await context.close();
});

test('theme changes update the scene as well as the interface', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  const dark = await image(page);
  await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect.poll(() => image(page)).not.toBe(dark);
});

test('dragging, zooming and ship movement inspect the actual 3D world and reset cleanly', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  const original = await image(page);
  const canvas = page.locator('canvas');
  const bounds = await canvas.boundingBox();
  await page.mouse.move(bounds.x + bounds.width * 0.5, bounds.y + bounds.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.65, bounds.y + bounds.height * 0.55, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => image(page)).not.toBe(original);
  const rotated = await image(page);
  await page.mouse.wheel(0, -250);
  await expect.poll(() => image(page)).not.toBe(rotated);
  const zoomed = await image(page);
  await canvas.focus();
  await page.keyboard.down('a');
  await page.waitForTimeout(300);
  await page.keyboard.up('a');
  await expect.poll(() => image(page)).not.toBe(zoomed);
  await page.keyboard.press('r');
  await expect.poll(async () => await image(page) === original).toBe(true);
});

test('all eight geological worlds are distinct and the transit has an actual rendered view', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  const fingerprints = new Set();
  let previous = '';
  for (const name of ['Vesper', 'Pelagic', 'Parallax', 'Ferrum', 'Sentinel', 'Meridian', 'Halation', 'Aphelion']) {
    await route(page, name).click();
    await expect.poll(() => image(page)).not.toBe(previous);
    previous = await image(page);
    fingerprints.add(previous);
    await page.locator('canvas').screenshot({ path: testInfo.outputPath(`${name.toLowerCase()}.png`) });
  }
  expect(fingerprints.size).toBe(8);
  await page.locator('#motion-toggle').click();
  await route(page, 'Vesper').click();
  await page.waitForTimeout(650);
  await page.locator('canvas').screenshot({ path: testInfo.outputPath('transit.png') });
});

test('desktop and narrow mobile layouts keep the flight view and routes in bounds', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const { width, height, theme } of [
    { width: 1440, height: 900, theme: 'dark' },
    { width: 1440, height: 900, theme: 'light' },
    { width: 390, height: 844, theme: 'dark' },
    { width: 320, height: 800, theme: 'light' },
  ]) {
    await page.setViewportSize({ width, height });
    await ready(page, `?scoutTheme=${theme}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.locator('canvas')).toBeVisible();
    await expect(page.locator('#route-list button')).toHaveCount(8);
    await page.screenshot({ path: testInfo.outputPath(`${width}-${theme}.png`), fullPage: true });
    if (width < 800) {
      for (const name of ['Vesper', 'Pelagic', 'Parallax', 'Ferrum', 'Sentinel', 'Meridian', 'Halation', 'Aphelion']) {
        await page.locator('#chart-toggle').click();
        if (name === 'Vesper') await page.screenshot({ path: testInfo.outputPath(`${width}-chart.png`) });
        await page.locator('#map-markers').getByRole('button', { name: `Jump to ${name}`, exact: true }).click();
        await expect(page.locator('#mission-title')).toHaveText(name);
      }
    }
  }
});
