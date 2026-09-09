/**
 * Avisa se 3000/3001 já estão em uso (comum no Windows quando um `npm run dev`
 * anterior ficou órfão). Não mata processos — só imprime dica.
 */
import net from 'node:net';

const ports = [
  { port: 3000, name: 'Web (Next)' },
  { port: 3001, name: 'API (Nest)' },
];

function canListen(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

const busy = [];
for (const p of ports) {
  const free = await canListen(p.port);
  if (!free) busy.push(p);
}

if (busy.length) {
  console.warn('');
  console.warn('[samuel] Porta(s) ocupada(s) — o servidor pode cair ou falhar ao subir:');
  for (const p of busy) {
    console.warn(`  - ${p.port} (${p.name})`);
  }
  console.warn('');
  console.warn('No PowerShell (na raiz do SAMUEL):');
  console.warn('  Get-NetTCPConnection -LocalPort 3000,3001 -ErrorAction SilentlyContinue |');
  console.warn('    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }');
  console.warn('');
}
