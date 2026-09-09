import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', '2026-09-06-ops');
const BASE = 'http://localhost:3000';

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });
const page = await ctx.newPage();
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.locator('#email').fill('admin@demo.local');
await page.locator('#password').fill('ChangeMe123!');
await page.getByRole('button', { name: 'Entrar' }).click();
await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 25000 });
await page.waitForTimeout(800);

const shots = [
  ['05-services-new-desktop.png', '/services/new'],
  ['06-routes-desktop.png', '/routes'],
  ['07-customers-new-desktop.png', '/customers/new'],
  ['08-agenda-desktop.png', '/agenda'],
];
for (const [file, route] of shots) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('h1', { timeout: 15000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, file), fullPage: true, animations: 'disabled' });
  console.log(file, page.url());
}

const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-BR' });
const mp = await mobile.newPage();
await mp.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await mp.waitForTimeout(1200);
await mp.locator('#email').fill('admin@demo.local');
await mp.locator('#password').fill('ChangeMe123!');
await mp.getByRole('button', { name: 'Entrar' }).click();
await mp.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 25000 });
await mp.goto(`${BASE}/services/new`, { waitUntil: 'domcontentloaded' });
await mp.waitForSelector('h1', { timeout: 15000 });
await mp.waitForTimeout(900);
await mp.screenshot({
  path: path.join(OUT, '11-services-new-mobile.png'),
  fullPage: true,
  animations: 'disabled',
});
console.log('11-services-new-mobile.png', mp.url());
await browser.close();
