const path = require('path');
const fs = require('fs');

const root = __dirname;
const apiDistMain = fs.existsSync(path.join(root, 'apps', 'api', 'dist', 'main.js'))
  ? 'dist/main.js'
  : 'dist/src/main.js';

module.exports = {
  apps: [
    {
      name: 'analise-api',
      cwd: path.join(root, 'apps', 'api'),
      script: apiDistMain,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: '3469',
        LISTEN_HOST: '127.0.0.1',
      },
    },
    {
      name: 'analise-web',
      cwd: path.join(root, 'apps', 'web'),
      script: path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next'),
      args: 'start -H 127.0.0.1 -p 3468',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: '3468',
        API_PROXY_TARGET: 'http://127.0.0.1:3469',
      },
    },
  ],
};
