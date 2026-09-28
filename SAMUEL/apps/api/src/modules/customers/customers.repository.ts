import { Injectable } from '@nestjs/common';
import { CustomerStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

const customerRegionInclude = {
  customerRegion: {
    select: {
      id: true,
      name: true,
      latitude: true,
      longitude: true,
      radiusMeters: true,
    },
  },
} as const;

@Injectable()
export class CustomersRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(params: {
    companyId: string;
    q?: string;
    status?: CustomerStatus;
    document?: string;
  }) {
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

  findByIdInCompany(id: string, companyId: string) {
    return this.prisma.customer.findFirst({
      where: { id, companyId },
      include: customerRegionInclude,
    });
  }

  create(data: Prisma.CustomerCreateInput) {
    return this.prisma.customer.create({ data, include: customerRegionInclude });
  }

  async update(
    id: string,
    companyId: string,
    data: Prisma.CustomerUpdateManyMutationInput,
  ) {
    const result = await this.prisma.customer.updateMany({
      where: { id, companyId },
      data,
    });
    if (result.count === 0) return null;
    return this.findByIdInCompany(id, companyId);
  }
}
