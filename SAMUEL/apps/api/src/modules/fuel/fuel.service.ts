import { Injectable, HttpStatus } from '@nestjs/common';
import {
  FuelFillStatus,
  FuelPaymentMethod,
  OdometerReadingSource,
  Prisma,
  UserRole,
} from '@prisma/client';
import { AuthUser } from '../auth/decorators/auth.decorators';
import { httpError } from '../../common/errors/http-error';
import { LocalStorageService } from '../../common/storage/local-storage.service';
import { validateRouteEvidenceUpload } from '../routes/route-evidence.util';
import { writeOdometerReading } from '../costs/odometer-write';
import { ocrProvider } from '../costs/ocr/ocr-provider';
import { computeFillTotal } from '../costs/cost-calc';
import { randomUUID } from 'crypto';
import { FuelRepository, FuelFillWithRelations } from './fuel.repository';
import { CreateFuelFillDto, ListFuelFillsQueryDto, UpdateFuelFillDto } from './dto/fuel.dto';

function dec(n: number) {
  return new Prisma.Decimal(n);
}

function num(v: Prisma.Decimal | number | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v.toString());
  return Number.isFinite(n) ? n : null;
}

export function serializeFill(row: FuelFillWithRelations) {
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    vehicle: row.vehicle,
    employeeId: row.employeeId,
    occurredAt: row.occurredAt.toISOString(),
    odometerKm: num(row.odometerKm),
    liters: num(row.liters),
    pricePerLiter: num(row.pricePerLiter),
    totalCost: num(row.totalCost),
    fuelType: row.fuelType,
    station: row.station,
    paymentMethod: row.paymentMethod,
    receiptRef: row.receiptRef,
    notes: row.notes,
    status: row.status,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    evidence: row.evidence.map((e) => ({
      id: e.id,
      mimeType: e.mimeType,
      sizeBytes: e.sizeBytes,
      originalName: e.originalName,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}

@Injectable()
export class FuelService {
  constructor(
    private readonly repo: FuelRepository,
    private readonly storage: LocalStorageService,
  ) {}

  private assertOfficeWrite(user: AuthUser) {
    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.MANAGER &&
      user.role !== UserRole.PLATFORM_ADMIN
    ) {
      throw httpError(HttpStatus.FORBIDDEN, 'AUTH_FORBIDDEN', 'Você não tem permissão para esta ação.');
    }
  }

  async list(user: AuthUser, query: ListFuelFillsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 50);
    const createdByUserId = user.role === UserRole.EMPLOYEE ? user.id : undefined;
    const { rows, total, periodTotal } = await this.repo.list({
      companyId: user.companyId,
      createdByUserId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(`${query.to}T23:59:59.999Z`) : undefined,
      vehicleId: query.vehicleId,
      fuelType: query.fuelType,
      station: query.station,
      q: query.q,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return {
      fills: rows.map(serializeFill),
      page,
      pageSize,
      total,
      periodTotal: num(periodTotal) ?? 0,
    };
  }

  async getOne(user: AuthUser, id: string) {
    const row = await this.repo.findById(user.companyId, id);
    if (!row) {
      throw httpError(HttpStatus.NOT_FOUND, 'FUEL_FILL_NOT_FOUND', 'Abastecimento não encontrado.');
    }
    if (user.role === UserRole.EMPLOYEE && row.createdByUserId !== user.id) {
      throw httpError(HttpStatus.NOT_FOUND, 'FUEL_FILL_NOT_FOUND', 'Abastecimento não encontrado.');
    }
    return { fill: serializeFill(row) };
  }

  async create(user: AuthUser, dto: CreateFuelFillDto, file?: Express.Multer.File) {
    if (user.role === UserRole.SUPERVISOR) {
      throw httpError(HttpStatus.FORBIDDEN, 'AUTH_FORBIDDEN', 'Você não tem permissão para esta ação.');
    }
    const vehicle = await this.repo.findVehicle(user.companyId, dto.vehicleId);
    if (!vehicle) {
      throw httpError(HttpStatus.NOT_FOUND, 'VEHICLE_NOT_FOUND', 'Veículo não encontrado.');
    }
    const settings = await this.repo.findCompanySettings(user.companyId);
    const fileCheck = file?.buffer?.length ? validateRouteEvidenceUpload(file) : null;
    if (file && fileCheck && !fileCheck.ok) {
      throw httpError(HttpStatus.UNPROCESSABLE_ENTITY, fileCheck.code, fileCheck.message);
    }
    if (settings?.fuelReceiptRequired && (!fileCheck || !fileCheck.ok)) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'FUEL_RECEIPT_REQUIRED',
        'Esta empresa exige foto do comprovante.',
      );
    }

    const liters = dto.liters;
    const price = dto.pricePerLiter;
    const totalCost = computeFillTotal(liters, price);
    const occurredAt = new Date(dto.occurredAt);
    const employee =
      user.role === UserRole.EMPLOYEE
        ? await this.repo.findEmployeeByUser(user.companyId, user.id)
        : null;

    let evidence:
      | { storageKey: string; mimeType: string; sizeBytes: number; originalName: string | null }
      | undefined;
    const fillIdPlaceholder = randomUUID();
    if (fileCheck?.ok && file) {
      const stored = await this.storage.saveBuffer(
        { companyId: user.companyId, fuelFillId: fillIdPlaceholder },
        fileCheck.ext,
        file.buffer,
      );
      evidence = {
        storageKey: stored.storageKey,
        mimeType: fileCheck.mimeType,
        sizeBytes: file.size,
        originalName: file.originalname?.slice(0, 255) || null,
      };
      void ocrProvider.extractFromImage(file.buffer);
    }

    const created = await this.repo.createFill({
      companyId: user.companyId,
      vehicleId: vehicle.id,
      employeeId: employee?.id ?? null,
      occurredAt,
      odometerKm: dec(dto.odometerKm),
      liters: dec(liters),
      pricePerLiter: dec(price),
      totalCost: dec(totalCost),
      fuelType: dto.fuelType?.trim() || vehicle.fuelType,
      station: dto.station?.trim() || null,
      paymentMethod: dto.paymentMethod ?? FuelPaymentMethod.OTHER,
      receiptRef: dto.receiptRef?.trim() || null,
      notes: dto.notes?.trim() || null,
      createdByUserId: user.id,
      evidence,
    });

    await writeOdometerReading(this.repo.client, {
      companyId: user.companyId,
      vehicleId: vehicle.id,
      source: OdometerReadingSource.FUEL_FILL,
      km: dto.odometerKm,
      occurredAt,
      fuelFillId: created.id,
      actorUserId: user.id,
    });

    if (vehicle.odometerKm == null || dto.odometerKm >= vehicle.odometerKm) {
      await this.repo.client.vehicle.update({
        where: { id: vehicle.id },
        data: { odometerKm: dto.odometerKm },
      });
    }

    await this.repo.client.auditLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: 'FUEL_FILL_CREATED',
        entity: 'FuelFill',
        entityId: created.id,
        metadata: {
          vehicleId: vehicle.id,
          liters,
          pricePerLiter: price,
          totalCost,
          odometerKm: dto.odometerKm,
        },
      },
    });

    const fresh = await this.repo.findById(user.companyId, created.id);
    return { fill: serializeFill(fresh!) };
  }

  async update(user: AuthUser, id: string, dto: UpdateFuelFillDto) {
    this.assertOfficeWrite(user);
    const existing = await this.repo.findById(user.companyId, id);
    if (!existing || existing.status === FuelFillStatus.CANCELLED) {
      throw httpError(HttpStatus.NOT_FOUND, 'FUEL_FILL_NOT_FOUND', 'Abastecimento não encontrado.');
    }
    const liters = dto.liters ?? num(existing.liters)!;
    const price = dto.pricePerLiter ?? num(existing.pricePerLiter)!;
    const totalCost = computeFillTotal(liters, price);
    const odometerKm = dto.odometerKm ?? num(existing.odometerKm)!;
    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : existing.occurredAt;

    await this.repo.client.$transaction(async (tx) => {
      await tx.fuelFill.updateMany({
        where: { id, companyId: user.companyId },
        data: {
          ...(dto.occurredAt ? { occurredAt } : {}),
          ...(dto.odometerKm != null ? { odometerKm: dec(odometerKm) } : {}),
          liters: dec(liters),
          pricePerLiter: dec(price),
          totalCost: dec(totalCost),
          ...(dto.fuelType !== undefined ? { fuelType: dto.fuelType } : {}),
          ...(dto.station !== undefined ? { station: dto.station } : {}),
          ...(dto.paymentMethod !== undefined ? { paymentMethod: dto.paymentMethod } : {}),
          ...(dto.receiptRef !== undefined ? { receiptRef: dto.receiptRef } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        },
      });
      await tx.vehicleCost.updateMany({
        where: { fuelFillId: id, companyId: user.companyId },
        data: { amount: dec(totalCost), occurredAt },
      });
    });

    if (dto.odometerKm != null && dto.odometerKm !== num(existing.odometerKm)) {
      await writeOdometerReading(this.repo.client, {
        companyId: user.companyId,
        vehicleId: existing.vehicleId,
        source: OdometerReadingSource.ADMIN_ADJUST,
        km: dto.odometerKm,
        occurredAt,
        fuelFillId: id,
        actorUserId: user.id,
        note: 'Correção de km do abastecimento',
      });
    }

    await this.repo.client.auditLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: 'FUEL_FILL_UPDATED',
        entity: 'FuelFill',
        entityId: id,
        metadata: {
          before: {
            liters: num(existing.liters),
            pricePerLiter: num(existing.pricePerLiter),
            totalCost: num(existing.totalCost),
            odometerKm: num(existing.odometerKm),
          },
          after: { liters, pricePerLiter: price, totalCost, odometerKm },
        },
      },
    });

    return this.getOne(user, id);
  }

  async cancel(user: AuthUser, id: string) {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.PLATFORM_ADMIN) {
      throw httpError(HttpStatus.FORBIDDEN, 'AUTH_FORBIDDEN', 'Somente admin pode cancelar abastecimento.');
    }
    const existing = await this.repo.findById(user.companyId, id);
    if (!existing) {
      throw httpError(HttpStatus.NOT_FOUND, 'FUEL_FILL_NOT_FOUND', 'Abastecimento não encontrado.');
    }
    if (existing.status === FuelFillStatus.CANCELLED) {
      return { fill: serializeFill(existing) };
    }
    await this.repo.client.$transaction(async (tx) => {
      await tx.fuelFill.updateMany({
        where: { id, companyId: user.companyId },
        data: {
          status: FuelFillStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelledByUserId: user.id,
        },
      });
      await tx.vehicleCost.updateMany({
        where: { fuelFillId: id, companyId: user.companyId },
        data: { status: FuelFillStatus.CANCELLED },
      });
    });
    await this.repo.client.auditLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: 'FUEL_FILL_CANCELLED',
        entity: 'FuelFill',
        entityId: id,
        metadata: { totalCost: num(existing.totalCost) },
      },
    });
    return this.getOne(user, id);
  }

  async getEvidenceFile(user: AuthUser, fillId: string, evidenceId: string) {
    await this.getOne(user, fillId);
    const ev = await this.repo.findEvidence(user.companyId, fillId, evidenceId);
    if (!ev) {
      throw httpError(HttpStatus.NOT_FOUND, 'FUEL_EVIDENCE_NOT_FOUND', 'Comprovante não encontrado.');
    }
    return ev;
  }
}
