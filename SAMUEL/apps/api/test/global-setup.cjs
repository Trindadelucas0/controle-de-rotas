const { execFileSync, execSync } = require('child_process');
const path = require('path');

const TEST_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://samuel:samuel@localhost:5433/samuel_test?schema=public';

if (!TEST_URL.includes('samuel_test')) {
  throw new Error('TEST_DATABASE_URL deve apontar para o banco samuel_test.');
}

function dockerPsql(database, sql) {
  return execFileSync(
    'docker',
    ['exec', 'samuel-postgres', 'psql', '-U', 'samuel', '-d', database, '-tAc', sql],
    { encoding: 'utf8' },
  ).trim();
}

module.exports = async function globalSetup() {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = TEST_URL;

  try {
    const exists = dockerPsql('postgres', "SELECT 1 FROM pg_database WHERE datname='samuel_test'");
    if (exists !== '1') {
      dockerPsql('postgres', 'CREATE DATABASE samuel_test OWNER samuel');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Não foi possível criar/checar samuel_test. Postgres Docker (samuel-postgres) precisa estar no ar. ${msg}`,
    );
  }

  const apiRoot = path.join(__dirname, '..');
  execSync('npx prisma migrate deploy', {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL: TEST_URL },
    stdio: 'inherit',
  });

  execSync('npx tsx test/seed-test.ts', {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL: TEST_URL },
    stdio: 'inherit',
  });
};
