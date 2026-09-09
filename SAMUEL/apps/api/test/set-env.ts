process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://samuel:samuel@localhost:5433/samuel_test?schema=public';
