export const TEST_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';

export const DEMO_COMPANY_ID = '10000000-0000-4000-8000-000000000001';
export const OUTRA_COMPANY_ID = '10000000-0000-4000-8000-000000000002';

export const TEST_USERS = {
  ADMIN: 'admin@test.local',
  EMPLOYEE: 'employee@test.local',
  EMPLOYEE_OTHER: 'employee2@test.local',
  OUTRA_ADMIN: 'admin@outra.local',
  OUTRA_EMPLOYEE: 'employee@outra.local',
} as const;

export type TestLoginRole = keyof typeof TEST_USERS;
