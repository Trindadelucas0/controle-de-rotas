import { Injectable } from '@nestjs/common';
import { EmployeeStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

const employeeLoginUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
} satisfies Prisma.UserSelect;

const employeeInclude = {
  user: { select: employeeLoginUserSelect },
} satisfies Prisma.EmployeeInclude;

export type EmployeeRecord = Prisma.EmployeeGetPayload<{ include: typeof employeeInclude }>;

@Injectable()
export class EmployeesRepository {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: Prisma.TransactionClient) {
    return tx ?? this.prisma;
  }

  list(params: {
    companyId: string;
    q?: string;
    status?: EmployeeStatus;
  }): Promise<EmployeeRecord[]> {
    const where: Prisma.EmployeeWhereInput = {
      companyId: params.companyId,
      ...(params.status ? { status: params.status } : {}),
      ...(params.q
        ? {
            OR: [
              { name: { contains: params.q, mode: 'insensitive' } },
              { email: { contains: params.q, mode: 'insensitive' } },
              { registration: { contains: params.q, mode: 'insensitive' } },
              { jobTitle: { contains: params.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return this.prisma.employee.findMany({
      where,
      include: employeeInclude,
      orderBy: { name: 'asc' },
    });
  }

  findByIdInCompany(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<EmployeeRecord | null> {
    return this.db(tx).employee.findFirst({
      where: { id, companyId },
      include: employeeInclude,
    });
  }

  create(data: Prisma.EmployeeCreateInput, tx?: Prisma.TransactionClient): Promise<EmployeeRecord> {
    return this.db(tx).employee.create({ data, include: employeeInclude });
  }

  async update(
    id: string,
    companyId: string,
    data: Prisma.EmployeeUncheckedUpdateManyInput,
    tx?: Prisma.TransactionClient,
  ): Promise<EmployeeRecord | null> {
    const db = this.db(tx);
    const result = await db.employee.updateMany({
      where: { id, companyId },
      data,
    });
    if (result.count === 0) return null;
    return this.findByIdInCompany(id, companyId, tx);
  }
}
