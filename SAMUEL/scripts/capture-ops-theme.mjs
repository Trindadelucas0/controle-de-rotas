import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', '..', 'design-plans', 'screenshots', '2026-09-06-ops');
const BASE = 'http://localhost:3000';

async function settle(page, ms = 1200) {
  await page.waitForTimeout(ms);
}

async function main() {
  const fs = await import('node:fs');
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-BR' });

  async function shot(ctx, name, route, extra = 900) {
    const page = await ctx.newPage();
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await settle(page, extra);
    await page.screenshot({ path: path.join(OUT, name), fullPage: false, animations: 'disabled' });
    await page.close();
    console.log(name);
  }

  await shot(desktop, '01-login-desktop.png', '/login');
  await shot(mobile, '02-login-mobile.png', '/login');

  async function logged(ctx, email, shots) {
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.locator('#email').fill(email);
    await page.locator('#password').fill('ChangeMe123!');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 25000 });
    await settle(page, 800);
    for (const s of shots) {
      await page.goto(`${BASE}${s.route}`, { waitUntil: 'domcontentloaded' });
      await settle(page, s.map ? 4200 : 1100);
      await page.screenshot({
        path: path.join(OUT, s.file),
        fullPage: !s.map,
        animations: 'disabled',
      });
      console.log(s.file);
    }
    await page.close();
  }

  await logged(desktop, 'admin@demo.local', [
    { file: '03-home-desktop.png', route: '/', map: true },
    { file: '04-map-desktop.png', route: '/map', map: true },
    { file: '05-services-new-desktop.png', route: '/services/new' },
    { file: '06-routes-desktop.png', route: '/routes' },
    { file: '07-customers-desktop.png', route: '/customers' },
  ]);
  await logged(mobile, 'admin@demo.local', [
    { file: '08-home-mobile.png', route: '/', map: true },
    { file: '09-map-mobile.png', route: '/map', map: true },
  ]);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
