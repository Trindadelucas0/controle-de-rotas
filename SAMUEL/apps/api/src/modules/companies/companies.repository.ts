import { Injectable } from '@nestjs/common';
import { Company, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CompaniesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(companyId: string): Promise<Company | null> {
    return this.prisma.company.findUnique({ where: { id: companyId } });
  }

  update(companyId: string, data: Prisma.CompanyUpdateInput): Promise<Company> {
    return this.prisma.company.update({
      where: { id: companyId },
      data,
    });
  }
}
