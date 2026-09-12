import { Injectable } from '@nestjs/common';
import { Customer, CustomerStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CustomersRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(params: {
    companyId: string;
    q?: string;
    status?: CustomerStatus;
    document?: string;
  }): Promise<Customer[]> {
    const where: Prisma.CustomerWhereInput = {
      companyId: params.companyId,
      recordSessionShell: false,
      ...(params.status ? { status: params.status } : {}),
      ...(params.document
        ? { document: { contains: params.document, mode: 'insensitive' } }
        : {}),
      ...(params.q
        ? {
            OR: [
              { name: { contains: params.q, mode: 'insensitive' } },
              { tradeName: { contains: params.q, mode: 'insensitive' } },
              { document: { contains: params.q, mode: 'insensitive' } },
              { email: { contains: params.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return this.prisma.customer.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  findByIdInCompany(id: string, companyId: string): Promise<Customer | null> {
    return this.prisma.customer.findFirst({ where: { id, companyId } });
  }

  create(data: Prisma.CustomerCreateInput): Promise<Customer> {
    return this.prisma.customer.create({ data });
  }

  async update(
    id: string,
    companyId: string,
    data: Prisma.CustomerUpdateManyMutationInput,
  ): Promise<Customer | null> {
    const result = await this.prisma.customer.updateMany({
      where: { id, companyId },
      data,
    });
    if (result.count === 0) return null;
    return this.findByIdInCompany(id, companyId);
  }
}
