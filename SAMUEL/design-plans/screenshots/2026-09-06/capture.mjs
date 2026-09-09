import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;
const BASE = process.env.SAMUEL_URL || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@demo.local';
const EMPLOYEE_EMAIL = 'employee@demo.local';
const PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

const catalog = [];
let seq = 0;

function nextId() {
  seq += 1;
  return String(seq).padStart(2, '0');
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function settle(page, { extraMs = 900, map = false } = {}) {
  await page.waitForTimeout(250);
  try {
    await page.locator('[aria-busy="true"]').first().waitFor({ state: 'hidden', timeout: 18000 });
  } catch {
    /* no busy marker */
  }
  try {
    await page.locator('.animate-pulse').first().waitFor({ state: 'detached', timeout: 12000 });
  } catch {
    /* skeleton already gone or never shown */
  }
  await page.waitForTimeout(map ? 4200 : extraMs);
}

async function apiJson(page, urlPath) {
  return page.evaluate(async (p) => {
    const r = await fetch(p, { credentials: 'include' });
    const text = await r.text();
    try {
      return { ok: r.ok, status: r.status, data: JSON.parse(text) };
    } catch {
      return { ok: r.ok, status: r.status, data: null };
    }
  }, urlPath);
}

function firstId(payload, key) {
  const arr = payload?.data?.[key];
  if (Array.isArray(arr) && arr[0]?.id) return arr[0].id;
  return null;
}

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await settle(page, { extraMs: 400 });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 25000 });
  await settle(page, { extraMs: 700 });
}

async function logout(page) {
  const btn = page.getByRole('button', { name: /Sair|Saindo/ });
  if (await btn.count()) {
    await btn.first().click();
    await page.waitForURL(/\/login/, { timeout: 15000 }).catch(() => {});
  }
  await page.context().clearCookies();
}

async function shot(page, viewportName, meta) {
  const id = nextId();
  const file = `${id}-${meta.role}-${slugify(meta.slug)}-${viewportName}.png`;
  const filePath = path.join(OUT, file);
  const map = Boolean(meta.map);
  await settle(page, { map, extraMs: meta.extraMs ?? 900 });
  await page.screenshot({
    path: filePath,
    fullPage: meta.fullPage !== false,
    animations: 'disabled',
  });
  catalog.push({
    id,
    file,
    role: meta.role,
    viewport: viewportName,
    route: meta.route,
    title: meta.title,
    note: meta.note || '',
  });
  console.log(`saved ${file}`);
}

async function gotoShot(page, viewportName, route, meta) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await shot(page, viewportName, { ...meta, route });
}

async function captureAuth(browser) {
  for (const [name, size] of Object.entries(VIEWPORTS)) {
    const context = await browser.newContext({
      viewport: size,
      locale: 'pt-BR',
      colorScheme: 'light',
    });
    const page = await context.newPage();
    await gotoShot(page, name, '/login', {
      role: 'auth',
      slug: 'login',
      title: 'Login',
    });
    await gotoShot(page, name, '/forgot-password', {
      role: 'auth',
      slug: 'forgot-password',
      title: 'Esqueci a senha',
    });
    await gotoShot(page, name, '/reset-password', {
      role: 'auth',
      slug: 'reset-password',
      title: 'Redefinir senha (sem token válido)',
      note: 'Estado sem token / token inválido',
    });
    await context.close();
  }
}

async function captureAdmin(browser) {
  const ids = { customer: null, employee: null, vehicle: null, service: null, user: null };
  const desktop = await browser.newContext({
    viewport: VIEWPORTS.desktop,
    locale: 'pt-BR',
    colorScheme: 'light',
  });
  const page = await desktop.newPage();
  await login(page, ADMIN_EMAIL, PASSWORD);

  const lists = await Promise.all([
    apiJson(page, '/api/v1/customers'),
    apiJson(page, '/api/v1/employees'),
    apiJson(page, '/api/v1/vehicles'),
    apiJson(page, '/api/v1/service-orders'),
    apiJson(page, '/api/v1/users'),
  ]);
  ids.customer = firstId(lists[0], 'customers');
  ids.employee = firstId(lists[1], 'employees');
  ids.vehicle = firstId(lists[2], 'vehicles');
  ids.service = firstId(lists[3], 'serviceOrders');
  ids.user = firstId(lists[4], 'users');
  console.log('admin ids', ids);

  const adminPages = [
    { route: '/', slug: 'home', title: 'Centro de Operações', map: true, fullPage: false },
    { route: '/map', slug: 'map', title: 'Mapa operacional', map: true, fullPage: false },
    { route: '/agenda', slug: 'agenda', title: 'Agenda' },
    { route: '/services', slug: 'services', title: 'Serviços' },
    { route: '/services/new', slug: 'services-new', title: 'Novo serviço' },
    ids.service
      ? {
          route: `/services/${ids.service}`,
          slug: 'services-detail',
          title: 'Detalhe do serviço',
        }
      : null,
    { route: '/routes', slug: 'routes', title: 'Rotas', map: true, extraMs: 1500 },
    { route: '/customers', slug: 'customers', title: 'Clientes' },
    { route: '/customers/new', slug: 'customers-new', title: 'Novo cliente' },
    ids.customer
      ? {
          route: `/customers/${ids.customer}`,
          slug: 'customers-detail',
          title: 'Detalhe do cliente',
        }
      : null,
    { route: '/employees', slug: 'employees', title: 'Funcionários' },
    { route: '/employees/new', slug: 'employees-new', title: 'Novo funcionário' },
    ids.employee
      ? {
          route: `/employees/${ids.employee}`,
          slug: 'employees-detail',
          title: 'Detalhe do funcionário',
        }
      : null,
    { route: '/vehicles', slug: 'vehicles', title: 'Veículos' },
    { route: '/vehicles/new', slug: 'vehicles-new', title: 'Novo veículo' },
    ids.vehicle
      ? {
          route: `/vehicles/${ids.vehicle}`,
          slug: 'vehicles-detail',
          title: 'Detalhe do veículo',
        }
      : null,
    { route: '/settings/company', slug: 'settings-company', title: 'Empresa' },
    { route: '/settings/users', slug: 'settings-users', title: 'Usuários' },
    { route: '/settings/users/new', slug: 'settings-users-new', title: 'Novo usuário' },
    ids.user
      ? {
          route: `/settings/users/${ids.user}`,
          slug: 'settings-users-detail',
          title: 'Detalhe do usuário',
        }
      : null,
    { route: '/account/change-password', slug: 'change-password', title: 'Alterar senha' },
  ].filter(Boolean);

  for (const [name, size] of Object.entries(VIEWPORTS)) {
    const ctx =
      name === 'desktop'
        ? desktop
        : await browser.newContext({
            viewport: size,
            locale: 'pt-BR',
            colorScheme: 'light',
          });
    const p = name === 'desktop' ? page : await ctx.newPage();
    if (name !== 'desktop') await login(p, ADMIN_EMAIL, PASSWORD);

    for (const item of adminPages) {
      await gotoShot(p, name, item.route, {
        role: 'admin',
        slug: item.slug,
        title: item.title,
        map: item.map,
        fullPage: item.fullPage,
        extraMs: item.extraMs,
      });
    }

    if (name === 'desktop') {
      await p.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
      await settle(p, { extraMs: 700 });
      await shot(p, name, {
        role: 'overlay',
        slug: 'user-chrome',
        title: 'Chrome do usuário (Alterar senha / Sair)',
        route: '/',
        note: 'Não há dropdown: o menu é o bloco do header',
        fullPage: false,
      });
    }

    if (name === 'mobile') {
      await p.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
      await settle(p, { extraMs: 700 });
      const menuBtn = p.getByRole('button', { name: 'Abrir menu' });
      if (await menuBtn.count()) {
        await menuBtn.click();
        await p.waitForTimeout(400);
        await shot(p, name, {
          role: 'overlay',
          slug: 'mobile-nav',
          title: 'Menu mobile aberto',
          route: '/',
          note: 'Drawer da sidebar',
          fullPage: false,
        });
        await p.getByRole('button', { name: 'Fechar' }).first().click().catch(() => {});
      }

      await p.goto(`${BASE}/map`, { waitUntil: 'domcontentloaded' });
      await settle(p, { map: true });
      const teamBtn = p.getByRole('button', { name: 'Abrir equipe' });
      if (await teamBtn.count()) {
        await teamBtn.click();
        await p.waitForTimeout(500);
        await shot(p, name, {
          role: 'overlay',
          slug: 'map-team-drawer',
          title: 'Drawer Equipe no mapa',
          route: '/map',
          map: true,
          fullPage: false,
        });
      }
    }

    if (name !== 'desktop') await ctx.close();
  }

  await desktop.close();
  return ids;
}

async function captureEmployee(browser) {
  let routeId = null;
  let visitId = null;

  for (const [name, size] of Object.entries(VIEWPORTS)) {
    const context = await browser.newContext({
      viewport: size,
      locale: 'pt-BR',
      colorScheme: 'light',
      geolocation: { latitude: -23.5505, longitude: -46.6333 },
      permissions: ['geolocation'],
    });
    const page = await context.newPage();
    await login(page, EMPLOYEE_EMAIL, PASSWORD);

    if (!routeId) {
      const mine = await apiJson(page, '/api/v1/field/my-route');
      const routes = mine?.data?.routes || [];
      const pick =
        routes.find((r) => r.status === 'IN_PROGRESS') ||
        routes.find((r) => r.status === 'PUBLISHED') ||
        routes[0];
      routeId = pick?.id || null;
      visitId = pick?.stops?.[0]?.visit?.id || null;
      console.log('employee route/visit', { routeId, visitId, status: pick?.status });
    }

    const empPages = [
      { route: '/', slug: 'home', title: 'Início (campo — sem KPI empresa)', map: true, fullPage: false },
      { route: '/agenda', slug: 'agenda', title: 'Agenda (próprias)' },
      { route: '/customers', slug: 'customers', title: 'Clientes' },
      { route: '/field/my-route', slug: 'field-my-route', title: 'Minha rota' },
      routeId
        ? {
            route: `/field/start/${routeId}`,
            slug: 'field-start',
            title: 'Iniciar rota',
          }
        : null,
      { route: '/field/navigate', slug: 'field-navigate', title: 'Navegação GPS', map: true, fullPage: false },
      { route: '/field/tracking-status', slug: 'field-tracking-status', title: 'Status GPS' },
      visitId
        ? {
            route: `/field/visits/${visitId}`,
            slug: 'field-visit',
            title: 'Visita (check-in)',
            map: true,
            fullPage: false,
          }
        : null,
    ].filter(Boolean);

    for (const item of empPages) {
      await gotoShot(page, name, item.route, {
        role: 'employee',
        slug: item.slug,
        title: item.title,
        map: item.map,
        fullPage: item.fullPage,
        extraMs: item.extraMs,
      });
    }

    if (name === 'mobile') {
      await page.goto(`${BASE}/field/my-route`, { waitUntil: 'domcontentloaded' });
      await settle(page);
      const menuBtn = page.getByRole('button', { name: 'Abrir menu' });
      if (await menuBtn.count()) {
        await menuBtn.click();
        await page.waitForTimeout(400);
        await shot(page, name, {
          role: 'overlay',
          slug: 'employee-mobile-nav',
          title: 'Menu mobile do campo',
          route: '/field/my-route',
          fullPage: false,
        });
      }

      const bodyText = await page.locator('body').innerText();
      if (/NÃO ESTÁ EM HTTPS|não está em HTTPS|HTTPS/i.test(bodyText)) {
        await shot(page, name, {
          role: 'overlay',
          slug: 'gps-https-banner',
          title: 'Aviso GPS / HTTPS',
          route: '/field/my-route',
          note: 'Banner visível na tela de campo',
          fullPage: false,
        });
      }
    }

    await context.close();
  }
}

function writeIndex() {
  const missingNotes = [];
  const lines = [
    '# Catálogo visual SAMUEL — 2026-09-06',
    '',
    'Prints em desktop (1440×900) e celular (390×844). Papéis: auth, ADMIN, EMPLOYEE.',
    `App: ${BASE}. Seed: admin@demo.local e employee@demo.local.`,
    '',
    '| # | Arquivo | Papel | Viewport | Rota | Tela | Nota |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const row of catalog) {
    lines.push(
      `| ${row.id} | \`${row.file}\` | ${row.role} | ${row.viewport} | \`${row.route}\` | ${row.title} | ${row.note} |`,
    );
  }
  lines.push('');
  lines.push('## Telas sem dado seed');
  const slugs = new Set(catalog.map((c) => c.file));
  if (![...slugs].some((f) => f.includes('services-detail'))) {
    missingNotes.push('- Detalhe de serviço: lista vazia no seed.');
  }
  if (![...slugs].some((f) => f.includes('customers-detail'))) {
    missingNotes.push('- Detalhe de cliente: lista vazia no seed.');
  }
  if (![...slugs].some((f) => f.includes('vehicles-detail'))) {
    missingNotes.push('- Detalhe de veículo: lista vazia no seed.');
  }
  if (![...slugs].some((f) => f.includes('field-start'))) {
    missingNotes.push('- Iniciar rota: nenhuma rota PUBLISHED/IN_PROGRESS para o EMPLOYEE.');
  }
  if (![...slugs].some((f) => f.includes('field-visit'))) {
    missingNotes.push('- Visita de campo: nenhuma parada/visita na rota do EMPLOYEE.');
  }
  if (missingNotes.length === 0) {
    lines.push('Nenhuma ficha de detalhe ficou de fora por falta de ID.');
  } else {
    lines.push(...missingNotes);
  }
  lines.push('');
  lines.push('## Fora deste lote');
  lines.push('- `/dashboard`, `/settings/audit`, `/field/visits/[id]/evidence` (não existem).');
  lines.push('- Estados de loading, erro e hover.');
  fs.writeFileSync(path.join(OUT, 'INDEX.md'), lines.join('\n'), 'utf8');
  fs.writeFileSync(path.join(OUT, 'catalog.json'), JSON.stringify(catalog, null, 2), 'utf8');
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
  });
  try {
    await captureAuth(browser);
    await captureAdmin(browser);
    await captureEmployee(browser);
  } finally {
    await browser.close();
  }
  writeIndex();
  console.log(`done: ${catalog.length} screenshots`);
}

main().catch((err) => {
  console.error(err);
  writeIndex();
  process.exit(1);
});
