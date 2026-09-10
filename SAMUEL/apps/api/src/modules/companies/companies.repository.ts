import { Injectable } from '@nestjs/common';
import { Company, CompanyStatus, Prisma, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CompaniesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(companyId: string): Promise<Company | null> {
    return this.prisma.company.findUnique({ where: { id: companyId } });
  }

  list(params: { q?: string; status?: CompanyStatus }): Promise<Company[]> {
    const where: Prisma.CompanyWhereInput = {
      ...(params.status ? { status: params.status } : {}),
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
    return this.prisma.company.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  update(companyId: string, data: Prisma.CompanyUpdateInput): Promise<Company> {
    return this.prisma.company.update({
      where: { id: companyId },
      data,
    });
  }

  createWithAdmin(
    companyData: Prisma.CompanyCreateInput,
    admin: {
      name: string;
      email: string;
      passwordHash: string;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({ data: companyData });
      const user = await tx.user.create({
        data: {
          companyId: company.id,
          name: admin.name,
          email: admin.email,
          passwordHash: admin.passwordHash,
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
        },
        select: {
          id: true,
          companyId: true,
          name: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
        },
      });
      return { company, admin: user };
    });
  }
}
