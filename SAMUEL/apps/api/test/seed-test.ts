import {
  PrismaClient,
  UserRole,
  UserStatus,
  CompanyStatus,
  EmployeeStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  DEMO_COMPANY_ID,
  OUTRA_COMPANY_ID,
  TEST_PASSWORD,
  TEST_USERS,
} from './fixtures';

const prisma = new PrismaClient();

async function upsertCompany(id: string, name: string) {
  return prisma.company.upsert({
    where: { id },
    update: { name, status: CompanyStatus.ACTIVE },
    create: { id, name, status: CompanyStatus.ACTIVE },
  });
}

async function upsertUser(opts: {
  email: string;
  name: string;
  role: UserRole;
  companyId: string;
  passwordHash: string;
}) {
  return prisma.user.upsert({
    where: { email: opts.email },
    update: {
      name: opts.name,
      passwordHash: opts.passwordHash,
      role: opts.role,
      status: UserStatus.ACTIVE,
      companyId: opts.companyId,
    },
    create: {
      name: opts.name,
      email: opts.email,
      passwordHash: opts.passwordHash,
      role: opts.role,
      status: UserStatus.ACTIVE,
      companyId: opts.companyId,
    },
  });
}

async function upsertEmployee(opts: {
  userId: string;
  companyId: string;
  name: string;
}) {
  const existing = await prisma.employee.findFirst({
    where: { userId: opts.userId },
  });
  if (existing) {
    return prisma.employee.update({
      where: { id: existing.id },
      data: { name: opts.name, status: EmployeeStatus.ACTIVE, companyId: opts.companyId },
    });
  }
  return prisma.employee.create({
    data: {
      companyId: opts.companyId,
      userId: opts.userId,
      name: opts.name,
      status: EmployeeStatus.ACTIVE,
      jobTitle: 'Técnico de campo',
    },
  });
}

async function main() {
  const url = process.env.DATABASE_URL || '';
  if (!url.includes('samuel_test')) {
    throw new Error('seed-test só roda em samuel_test.');
  }

  const rounds = Number(process.env.BCRYPT_ROUNDS || 10);
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, rounds);

  await upsertCompany(DEMO_COMPANY_ID, 'Demo Test');
  await upsertCompany(OUTRA_COMPANY_ID, 'Outra Test');

  const admin = await upsertUser({
    email: TEST_USERS.ADMIN,
    name: 'Admin Demo Test',
    role: UserRole.ADMIN,
    companyId: DEMO_COMPANY_ID,
    passwordHash,
  });
  const employee = await upsertUser({
    email: TEST_USERS.EMPLOYEE,
    name: 'Campo Demo Test',
    role: UserRole.EMPLOYEE,
    companyId: DEMO_COMPANY_ID,
    passwordHash,
  });
  const employeeOther = await upsertUser({
    email: TEST_USERS.EMPLOYEE_OTHER,
    name: 'Campo Outro Test',
    role: UserRole.EMPLOYEE,
    companyId: DEMO_COMPANY_ID,
    passwordHash,
  });
  const outraAdmin = await upsertUser({
    email: TEST_USERS.OUTRA_ADMIN,
    name: 'Admin Outra',
    role: UserRole.ADMIN,
    companyId: OUTRA_COMPANY_ID,
    passwordHash,
  });
  const outraEmployee = await upsertUser({
    email: TEST_USERS.OUTRA_EMPLOYEE,
    name: 'Campo Outra',
    role: UserRole.EMPLOYEE,
    companyId: OUTRA_COMPANY_ID,
    passwordHash,
  });

  await upsertEmployee({
    userId: employee.id,
    companyId: DEMO_COMPANY_ID,
    name: employee.name,
  });
  await upsertEmployee({
    userId: employeeOther.id,
    companyId: DEMO_COMPANY_ID,
    name: employeeOther.name,
  });
  await upsertEmployee({
    userId: outraEmployee.id,
    companyId: OUTRA_COMPANY_ID,
    name: outraEmployee.name,
  });

  void admin;
  void outraAdmin;
  console.log('Seed test OK: Demo Test + Outra Test (ADMIN/EMPLOYEE).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
