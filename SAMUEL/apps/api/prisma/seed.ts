import {
  PrismaClient,
  UserRole,
  UserStatus,
  CompanyStatus,
  EmployeeStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@demo.local').toLowerCase().trim();
  const password = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';
  const rounds = Number(process.env.BCRYPT_ROUNDS || 10);

  const company = await prisma.company.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    update: {
      name: 'Demo Samuel',
      status: CompanyStatus.ACTIVE,
    },
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Demo Samuel',
      status: CompanyStatus.ACTIVE,
    },
  });

  const passwordHash = await bcrypt.hash(password, rounds);

  await prisma.user.upsert({
    where: { email },
    update: {
      name: 'Admin Demo',
      passwordHash,
      role: UserRole.PLATFORM_ADMIN,
      status: UserStatus.ACTIVE,
      companyId: company.id,
    },
    create: {
      name: 'Admin Demo',
      email,
      passwordHash,
      role: UserRole.PLATFORM_ADMIN,
      status: UserStatus.ACTIVE,
      companyId: company.id,
    },
  });

  const employeeEmail = 'employee@demo.local';
  const employeeUser = await prisma.user.upsert({
    where: { email: employeeEmail },
    update: {
      name: 'Campo Demo',
      passwordHash,
      role: UserRole.EMPLOYEE,
      status: UserStatus.ACTIVE,
      companyId: company.id,
    },
    create: {
      name: 'Campo Demo',
      email: employeeEmail,
      passwordHash,
      role: UserRole.EMPLOYEE,
      status: UserStatus.ACTIVE,
      companyId: company.id,
    },
  });

  await prisma.employee.upsert({
    where: { userId: employeeUser.id },
    update: {
      name: 'Campo Demo',
      status: EmployeeStatus.ACTIVE,
      companyId: company.id,
    },
    create: {
      companyId: company.id,
      userId: employeeUser.id,
      name: 'Campo Demo',
      status: EmployeeStatus.ACTIVE,
      jobTitle: 'Técnico de campo',
    },
  });

  console.log(`Seed OK: company "${company.name}" + admin ${email}`);
  console.log(`Seed OK: employee ${employeeEmail} / ${password} (vinculado a Employee)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
