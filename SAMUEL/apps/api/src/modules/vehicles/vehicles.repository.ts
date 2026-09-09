import { Injectable } from '@nestjs/common';
import { Prisma, Vehicle, VehicleStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class VehiclesRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(params: {
    companyId: string;
    q?: string;
    status?: VehicleStatus;
  }): Promise<Vehicle[]> {
    const where: Prisma.VehicleWhereInput = {
      companyId: params.companyId,
      ...(params.status ? { status: params.status } : {}),
      ...(params.q
        ? {
            OR: [
              { plate: { contains: params.q, mode: 'insensitive' } },
              { brand: { contains: params.q, mode: 'insensitive' } },
              { model: { contains: params.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return this.prisma.vehicle.findMany({
      where,
      orderBy: { plate: 'asc' },
    });
  }

  findByIdInCompany(id: string, companyId: string): Promise<Vehicle | null> {
    return this.prisma.vehicle.findFirst({ where: { id, companyId } });
  }

  create(data: Prisma.VehicleCreateInput): Promise<Vehicle> {
    return this.prisma.vehicle.create({ data });
  }

  async update(
    id: string,
    companyId: string,
    data: Prisma.VehicleUpdateManyMutationInput,
  ): Promise<Vehicle | null> {
    const result = await this.prisma.vehicle.updateMany({
      where: { id, companyId },
      data,
    });
    if (result.count === 0) return null;
    return this.findByIdInCompany(id, companyId);
  }
}
