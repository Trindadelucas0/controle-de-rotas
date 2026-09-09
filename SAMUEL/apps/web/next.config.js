const os = require('os');

function lanHosts() {
  const hosts = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const info of ifaces[name] || []) {
      if (info.family === 'IPv4' && !info.internal) {
        hosts.push(info.address);
      }
    }
  }
  return hosts;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Localhost + 127.0.0.1 + LAN: sem isso o Next 15 bloqueia /_next/* e o browser
  // cai em "Application error: a client-side exception has occurred".
  allowedDevOrigins: ['localhost', '127.0.0.1', '[::1]', ...lanHosts()],
  experimental: {
    serverActions: {
      allowedOrigins: ['rotas.avadesk.com.br'],
    },
  },
  // Proxy da API na mesma origem → celular na LAN não chama localhost do telefone.
  // beforeFiles: o POST (preview/login) não pode cair no Next e devolver HTML "Cannot POST".
  // API_PROXY_TARGET é lido no `next build` (produção) e no `next dev`.
  async rewrites() {
    const target = process.env.API_PROXY_TARGET || 'http://127.0.0.1:3001';
    return {
      beforeFiles: [
        {
          source: '/api/v1/:path*',
          destination: `${target}/api/v1/:path*`,
        },
      ],
    };
  },
};

module.exports = nextConfig;
