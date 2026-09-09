/**
 * One-off visual sweep: light-theme leftovers → dark operational tokens.
 * Run from repo root: node scripts/ops-theme-sweep.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'apps/web/src');
const SKIP_BG_WHITE = new Set([
  'FieldNavigatePage.tsx',
  'FieldVisitPage.tsx',
]);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(ent.name)) out.push(p);
  }
  return out;
}

function transform(file, src) {
  const base = path.basename(file);
  let s = src;

  s = s.replaceAll('font-display ', '');
  s = s.replaceAll('font-display', '');

  if (!SKIP_BG_WHITE.has(base)) {
    s = s.replaceAll('bg-white/90', 'bg-surface');
    s = s.replaceAll('bg-white/80', 'bg-surface');
    s = s.replaceAll('bg-white/70', 'bg-surface');
    s = s.replaceAll('bg-white/60', 'bg-surface');
    s = s.replaceAll('bg-white/95', 'bg-surface');
    s = s.replaceAll('bg-white/40', 'bg-black/50');
    s = s.replaceAll('bg-white p-', 'bg-surface p-');
    s = s.replaceAll('bg-white px-', 'bg-surface px-');
    s = s.replaceAll("bg-white '", "bg-surface '");
    s = s.replaceAll('bg-white"', 'bg-surface"');
    s = s.replaceAll('bg-white ', 'bg-surface ');
  }

  s = s.replaceAll('shadow-sm ', '');
  s = s.replaceAll(' shadow-sm', '');
  s = s.replaceAll('backdrop-blur ', '');

  s = s.replaceAll(
    'rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-[var(--ok)]',
    'rounded-[6px] border border-[var(--ok)]/30 bg-[var(--ok-bg)] px-3 py-2 text-sm text-[var(--ok)]',
  );
  s = s.replaceAll(
    'border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700',
    'border border-[var(--danger)]/40 bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]',
  );
  s = s.replaceAll(
    'border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700',
    'border border-[var(--danger)]/40 bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]',
  );
  s = s.replaceAll(
    'rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950',
    'rounded-[10px] border border-[var(--warn)]/40 bg-[var(--warn-bg)] p-6 text-sm text-[var(--warn)]',
  );
  s = s.replaceAll('text-red-600', 'text-[var(--danger)]');
  s = s.replaceAll('text-red-700', 'text-[var(--danger)]');

  s = s.replaceAll("bg-white px-3 py-2 outline-none ring-brand-500 focus:ring-2", 'ops-input');
  s = s.replaceAll(
    'w-full rounded-xl border border-brand-100 bg-white px-3 py-2 outline-none ring-brand-500 focus:ring-2',
    'ops-input',
  );
  s = s.replaceAll(
    'w-full rounded-xl border border-brand-100 px-3 py-2 outline-none ring-brand-500 focus:ring-2',
    'ops-input',
  );
  s = s.replaceAll('rounded-xl border border-brand-100 bg-white px-3 py-2', 'ops-input');
  s = s.replaceAll('rounded-xl border border-brand-100 px-3 py-2', 'ops-input');

  return s;
}

let n = 0;
for (const file of walk(ROOT)) {
  const src = fs.readFileSync(file, 'utf8');
  const next = transform(file, src);
  if (next !== src) {
    fs.writeFileSync(file, next);
    n += 1;
    console.log('updated', path.relative(ROOT, file));
  }
}
console.log(`done: ${n} files`);
