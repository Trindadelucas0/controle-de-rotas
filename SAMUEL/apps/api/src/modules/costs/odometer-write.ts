import { OdometerReadingSource, Prisma } from '@prisma/client';

export type OdometerDb = {
  odometerReading: {
    create: (args: { data: Prisma.OdometerReadingCreateInput }) => Promise<unknown>;
  };
};

export async function writeOdometerReading(
  db: OdometerDb,
  input: {
    companyId: string;
    vehicleId: string;
    source: OdometerReadingSource;
    km: number;
    occurredAt: Date;
    routeId?: string | null;
    fuelFillId?: string | null;
    actorUserId?: string | null;
    note?: string | null;
  },
) {
  await db.odometerReading.create({
    data: {
      company: { connect: { id: input.companyId } },
      vehicle: { connect: { id: input.vehicleId } },
      source: input.source,
      km: new Prisma.Decimal(input.km),
      occurredAt: input.occurredAt,
      ...(input.routeId ? { route: { connect: { id: input.routeId } } } : {}),
      ...(input.fuelFillId ? { fuelFill: { connect: { id: input.fuelFillId } } } : {}),
      ...(input.actorUserId ? { actor: { connect: { id: input.actorUserId } } } : {}),
      note: input.note ?? null,
    },
  });
}
