/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/test/set-env.ts'],
  globalSetup: '<rootDir>/test/global-setup.cjs',
  testTimeout: 60000,
  maxWorkers: 1,
};
