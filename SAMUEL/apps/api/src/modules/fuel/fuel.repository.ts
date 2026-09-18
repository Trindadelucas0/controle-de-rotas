import { Injectable } from '@nestjs/common';
import { FuelFillStatus, FuelPaymentMethod, Prisma, VehicleCostType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

const fillInclude = {
  vehicle: { select: { id: true, plate: true, brand: true, model: true, fuelType: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  evidence: true,
} satisfies Prisma.FuelFillInclude;

export type FuelFillWithRelations = Prisma.FuelFillGetPayload<{ include: typeof fillInclude }>;

@Injectable()
export class FuelRepository {
  constructor(private readonly prisma: PrismaService) {}

  get client() {
    return this.prisma;
  }

  findVehicle(companyId: string, vehicleId: string) {
    return this.prisma.vehicle.findFirst({ where: { id: vehicleId, companyId } });
  }

  findEmployeeByUser(companyId: string, userId: string) {
    return this.prisma.employee.findFirst({
      where: { companyId, userId },
      select: { id: true },
    });
  }

  findCompanySettings(companyId: string) {
    return this.prisma.company.findUnique({
      where: { id: companyId },
      select: { fuelReceiptRequired: true, referenceFuelPricePerLiter: true },
    });
  }

  async list(params: {
    companyId: string;
    createdByUserId?: string;
    from?: Date;
    to?: Date;
    vehicleId?: string;
    fuelType?: string;
    station?: string;
    q?: string;
    skip: number;
    take: number;
  }): Promise<{ rows: FuelFillWithRelations[]; total: number; periodTotal: Prisma.Decimal }> {
    const where: Prisma.FuelFillWhereInput = {
      companyId: params.companyId,
      ...(params.createdByUserId ? { createdByUserId: params.createdByUserId } : {}),
      ...(params.vehicleId ? { vehicleId: params.vehicleId } : {}),
      ...(params.fuelType ? { fuelType: { equals: params.fuelType, mode: 'insensitive' } } : {}),
      ...(params.station ? { station: { contains: params.station, mode: 'insensitive' } } : {}),
      ...(params.from || params.to
        ? {
            occurredAt: {
              ...(params.from ? { gte: params.from } : {}),
              ...(params.to ? { lte: params.to } : {}),
            },
          }
        : {}),
      ...(params.q
        ? {
            OR: [
              { station: { contains: params.q, mode: 'insensitive' } },
              { notes: { contains: params.q, mode: 'insensitive' } },
              { receiptRef: { contains: params.q, mode: 'insensitive' } },
              { vehicle: { plate: { contains: params.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [rows, total, agg] = await Promise.all([
      this.prisma.fuelFill.findMany({
        where,
        include: fillInclude,
        orderBy: { occurredAt: 'desc' },
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.fuelFill.count({ where }),
      this.prisma.fuelFill.aggregate({
        where: { ...where, status: FuelFillStatus.ACTIVE },
        _sum: { totalCost: true },
      }),
    ]);

    return {
      rows,
      total,
      periodTotal: agg._sum.totalCost ?? new Prisma.Decimal(0),
    };
  }

  findById(companyId: string, id: string) {
    return this.prisma.fuelFill.findFirst({
      where: { id, companyId },
      include: fillInclude,
    });
  }

  findEvidence(companyId: string, fillId: string, evidenceId: string) {
    return this.prisma.fuelFillEvidence.findFirst({
      where: { id: evidenceId, fuelFillId: fillId, companyId },
    });
  }

  createFill(data: {
    companyId: string;
    vehicleId: string;
    employeeId: string | null;
    occurredAt: Date;
    odometerKm: Prisma.Decimal;
    liters: Prisma.Decimal;
    pricePerLiter: Prisma.Decimal;
    totalCost: Prisma.Decimal;
    fuelType: string | null;
    station: string | null;
    paymentMethod: FuelPaymentMethod;
    receiptRef: string | null;
    notes: string | null;
    createdByUserId: string;
    evidence?: {
      storageKey: string;
      mimeType: string;
      sizeBytes: number;
      originalName: string | null;
    };
  }): Promise<FuelFillWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const fill = await tx.fuelFill.create({
        data: {
          companyId: data.companyId,
          vehicleId: data.vehicleId,
          employeeId: data.employeeId,
          occurredAt: data.occurredAt,
          odometerKm: data.odometerKm,
          liters: data.liters,
          pricePerLiter: data.pricePerLiter,
          totalCost: data.totalCost,
          fuelType: data.fuelType,
          station: data.station,
          paymentMethod: data.paymentMethod,
          receiptRef: data.receiptRef,
          notes: data.notes,
          createdByUserId: data.createdByUserId,
        },
      });
      await tx.vehicleCost.create({
        data: {
          companyId: data.companyId,
          vehicleId: data.vehicleId,
          type: VehicleCostType.FUEL,
          amount: data.totalCost,
          occurredAt: data.occurredAt,
          fuelFillId: fill.id,
          createdByUserId: data.createdByUserId,
        },
      });
      if (data.evidence) {
        await tx.fuelFillEvidence.create({
          data: {
            companyId: data.companyId,
            fuelFillId: fill.id,
            storageKey: data.evidence.storageKey,
            mimeType: data.evidence.mimeType,
            sizeBytes: data.evidence.sizeBytes,
            originalName: data.evidence.originalName,
            actorUserId: data.createdByUserId,
          },
        });
      }
      return tx.fuelFill.findFirstOrThrow({
        where: { id: fill.id },
        include: fillInclude,
      });
    });
  }
}
