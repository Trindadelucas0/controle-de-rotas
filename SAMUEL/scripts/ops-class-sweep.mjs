import fs from 'node:fs';
import path from 'node:path';

const root = path.join(process.cwd(), 'apps/web/src');
const replacements = [
  ['text-[10px] font-bold uppercase tracking-wide text-brand-500', 'ops-label mb-0'],
  ['mb-2 text-xs font-bold uppercase tracking-wide text-brand-500', 'ops-section-title mb-2'],
  ['text-xs font-bold uppercase tracking-wide text-brand-500', 'ops-section-title mb-0'],
  ['text-green-700', 'text-[var(--ok)]'],
  ['text-amber-800', 'text-[var(--warn)]'],
  [
    'rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700',
    'ops-btn ops-btn-primary',
  ],
  ['rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white', 'ops-btn ops-btn-primary'],
  ['rounded-xl bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white', 'ops-btn ops-btn-primary'],
  ['rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white', 'ops-btn ops-btn-primary'],
  [
    'rounded-xl border border-brand-200 px-4 text-sm font-medium',
    'ops-btn ops-btn-secondary',
  ],
  ['rounded-xl border border-brand-200 px-4 text-sm', 'ops-btn ops-btn-secondary'],
  [
    'rounded-xl border border-brand-200 px-4 py-2 text-sm font-medium',
    'ops-btn ops-btn-secondary',
  ],
  [
    'rounded-xl border border-brand-200 px-4 py-2 text-sm font-semibold text-brand-800',
    'ops-btn ops-btn-secondary',
  ],
  ['font-semibold text-brand-600 hover:underline', 'ops-link'],
  ['text-xs font-semibold text-brand-600 hover:underline', 'ops-link text-xs'],
  ['text-sm font-semibold text-brand-600 hover:underline', 'ops-link text-sm'],
];

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(tsx|ts|css)$/.test(name)) files.push(p);
  }
}

const files = [];
walk(root);
let changed = 0;
for (const file of files) {
  let src = fs.readFileSync(file, 'utf8');
  const orig = src;
  for (const [from, to] of replacements) src = src.split(from).join(to);
  if (src !== orig) {
    fs.writeFileSync(file, src);
    changed++;
    console.log(path.relative(process.cwd(), file));
  }
}
console.log(`updated ${changed} files`);
