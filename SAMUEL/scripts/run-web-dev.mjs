/**
 * Sobe o Next e reinicia se ele sair sozinho (exit 0).
 * O concurrently só reinicia em exit ≠ 0; no Windows o Next às vezes
 * encerra limpo quando o stdin do processo-pai fecha.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webDir = path.join(root, 'apps', 'web');

function resolveNextBin() {
  const candidates = [
    path.join(webDir, 'node_modules', 'next', 'dist', 'bin', 'next'),
    path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('Não encontrei o binário do Next (node_modules/next).');
}

const nextBin = resolveNextBin();
let child = null;
let stopping = false;

function start() {
  child = spawn(process.execPath, [nextBin, 'dev', '-H', '0.0.0.0', '-p', '3000'], {
    cwd: webDir,
    stdio: ['ignore', 'inherit', 'inherit'],
    env: process.env,
    windowsHide: true,
  });

  child.on('exit', (code, signal) => {
    child = null;
    if (stopping) {
      process.exit(code ?? (signal ? 1 : 0));
      return;
    }
    const reason = signal ? `signal ${signal}` : `code ${code}`;
    console.error(`[web] next saiu (${reason}); reiniciando em 2s...`);
    setTimeout(start, 2000);
  });
}

function stop() {
  stopping = true;
  if (child && !child.killed) {
    child.kill('SIGTERM');
  } else {
    process.exit(0);
  }
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);

start();
