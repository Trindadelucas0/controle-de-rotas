/**
 * Espera Postgres (5433) e Redis (6379) aceitarem TCP antes de subir a API.
 * Evita race: docker compose up ainda healthy=false → Prisma/Redis ECONNREFUSED.
 */
import net from 'node:net';

const targets = [
  { host: '127.0.0.1', port: 5433, name: 'postgres' },
  { host: '127.0.0.1', port: 6379, name: 'redis' },
];

const timeoutMs = Number(process.env.WAIT_DEPS_TIMEOUT_MS || 90_000);
const intervalMs = 1000;
const started = Date.now();

function canConnect({ host, port }) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(2000);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

async function waitOne(target) {
  while (Date.now() - started < timeoutMs) {
    if (await canConnect(target)) {
      console.log(`[wait-deps] ${target.name} ok (${target.host}:${target.port})`);
      return;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `[wait-deps] timeout: ${target.name} em ${target.host}:${target.port}. Rode Docker Desktop e npm run docker:up.`,
  );
}

for (const t of targets) {
  await waitOne(t);
}
console.log('[wait-deps] dependências prontas');
