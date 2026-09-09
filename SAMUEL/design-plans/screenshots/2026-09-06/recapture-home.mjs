import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', '2026-09-06-ops');
const BASE = 'http://localhost:3000';

const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function login(ctx) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('#email').fill('admin@demo.local');
  await page.locator('#password').fill('ChangeMe123!');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 25000 });
  await page.waitForTimeout(600);
  return page;
}

const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });
const d = await login(desktop);
await d.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await d.waitForSelector('h1');
await d.waitForTimeout(1400);
await d.screenshot({ path: path.join(OUT, '03-home-desktop.png'), animations: 'disabled' });
await d.screenshot({ path: path.join(OUT, '01-login-skip.png') }).catch(() => {});
console.log('03-home-desktop');

const loginCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });
const lp = await loginCtx.newPage();
await lp.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await lp.waitForTimeout(800);
await lp.screenshot({ path: path.join(OUT, '01-login-desktop.png'), animations: 'disabled' });
console.log('01-login-desktop');

const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-BR' });
const m = await login(mobile);
await m.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await m.waitForSelector('h1');
await m.waitForTimeout(1400);
await m.screenshot({ path: path.join(OUT, '09-home-mobile.png'), animations: 'disabled' });
console.log('09-home-mobile');

await browser.close();
