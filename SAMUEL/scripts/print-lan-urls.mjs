/**
 * Imprime URLs Local + Network (como o Next) para acessar no celular na mesma Wi‑Fi.
 */
import os from 'os';

function lanIpv4s() {
  const out = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const info of ifaces[name] || []) {
      if (info.family === 'IPv4' && !info.internal) {
        out.push({ name, address: info.address });
      }
    }
  }
  return out;
}

const port = Number(process.env.WEB_PORT || 3000);
const all = lanIpv4s();
const ips = all.filter(
  (i) =>
    !i.name.toLowerCase().includes('vethernet') &&
    !i.name.toLowerCase().includes('docker') &&
    !i.name.toLowerCase().includes('wsl'),
);

console.log('');
console.log('  Samuel Web (acesse no PC ou no celular na mesma Wi‑Fi)');
console.log(`  - Local:   http://localhost:${port}`);
for (const ip of ips.length ? ips : all) {
  console.log(`  - Network: http://${ip.address}:${port}  (${ip.name})`);
}
console.log('  Login no celular: abra o Network acima (não use localhost no telefone).');
console.log('  API no celular: via proxy /api/v1 no mesmo host:porta da web.');
console.log('');
