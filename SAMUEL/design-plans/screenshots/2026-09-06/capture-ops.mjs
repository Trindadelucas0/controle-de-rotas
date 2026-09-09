import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', '2026-09-06-ops');
const BASE = 'http://localhost:3000';

async function settle(page, ms = 1100) {
  await page.waitForTimeout(ms);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-BR' });

  async function shot(ctx, name, route, extra = 900) {
    const page = await ctx.newPage();
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
    await settle(page, extra);
    await page.screenshot({ path: path.join(OUT, name), fullPage: false, animations: 'disabled' });
    await page.close();
    console.log(name);
  }

  await shot(desktop, '01-login-desktop.png', '/login');
  await shot(mobile, '02-login-mobile.png', '/login');

  async function logged(ctx, shots) {
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await settle(page, 1500);
    await page.locator('#email').fill('admin@demo.local');
    await page.locator('#password').fill('ChangeMe123!');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 25000 });
    await settle(page, 800);
    for (const s of shots) {
      await page.goto(`${BASE}${s.route}`, { waitUntil: 'domcontentloaded' });
      await settle(page, s.map ? 4200 : 1200);
      await page.screenshot({
        path: path.join(OUT, s.file),
        fullPage: Boolean(s.full),
        animations: 'disabled',
      });
      console.log(s.file);
    }
    await page.close();
  }

  await logged(desktop, [
    { file: '03-home-desktop.png', route: '/', map: true },
    { file: '04-map-desktop.png', route: '/map', map: true },
    { file: '05-services-new-desktop.png', route: '/services/new', full: true },
    { file: '06-routes-desktop.png', route: '/routes' },
    { file: '07-customers-new-desktop.png', route: '/customers/new', full: true },
    { file: '08-agenda-desktop.png', route: '/agenda' },
  ]);
  await logged(mobile, [
    { file: '09-home-mobile.png', route: '/', map: true },
    { file: '10-map-mobile.png', route: '/map', map: true },
    { file: '11-services-new-mobile.png', route: '/services/new', full: true },
  ]);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
