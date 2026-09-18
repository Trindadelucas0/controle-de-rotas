import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { OdometerReadingSource } from '@prisma/client';
import { VehiclesRepository } from './vehicles.repository';
import {
  CreateVehicleDto,
  ListVehiclesQueryDto,
  UpdateVehicleDto,
} from './dto/vehicles.dto';
import { AuthUser } from '../auth/decorators/auth.decorators';
import { httpError } from '../../common/errors/http-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { writeOdometerReading } from '../costs/odometer-write';

function isUniquePlateError(err: unknown): boolean {
  return (err as { code?: string })?.code === 'P2002';
}

@Injectable()
export class VehiclesService {
  constructor(
    private readonly vehiclesRepository: VehiclesRepository,
    private readonly prisma: PrismaService,
  ) {}

  async list(user: AuthUser, query: ListVehiclesQueryDto) {
    const vehicles = await this.vehiclesRepository.list({
      companyId: user.companyId,
      q: query.q,
      status: query.status,
    });
    return { vehicles };
  }

  async create(user: AuthUser, dto: CreateVehicleDto) {
    try {
      const vehicle = await this.vehiclesRepository.create({
        company: { connect: { id: user.companyId } },
        plate: dto.plate,
        brand: dto.brand ?? null,
        model: dto.model ?? null,
        year: dto.year ?? null,
        fuelType: dto.fuelType ?? null,
        avgConsumption: dto.avgConsumption ?? null,
        capacity: dto.capacity ?? null,
        odometerKm: dto.odometerKm ?? null,
        status: dto.status,
      });
      return { vehicle };
    } catch (err: unknown) {
      if (isUniquePlateError(err)) {
        throw httpError(
          HttpStatus.CONFLICT,
          'VEHICLE_PLATE_EXISTS',
          'Já existe um veículo com esta placa na empresa.',
        );
      }
      throw err;
    }
  }

  async getOne(user: AuthUser, id: string) {
    const vehicle = await this.vehiclesRepository.findByIdInCompany(id, user.companyId);
    if (!vehicle) {
      throw httpError(HttpStatus.NOT_FOUND, 'VEHICLE_NOT_FOUND', 'Veículo não encontrado.');
    }
    return { vehicle };
  }

  async update(user: AuthUser, id: string, dto: UpdateVehicleDto) {
    try {
      const existing = await this.vehiclesRepository.findByIdInCompany(id, user.companyId);
      if (!existing) {
        throw httpError(HttpStatus.NOT_FOUND, 'VEHICLE_NOT_FOUND', 'Veículo não encontrado.');
      }
      const vehicle = await this.vehiclesRepository.update(id, user.companyId, {
        ...(dto.plate !== undefined ? { plate: dto.plate } : {}),
        ...(dto.brand !== undefined ? { brand: dto.brand } : {}),
        ...(dto.model !== undefined ? { model: dto.model } : {}),
        ...(dto.year !== undefined ? { year: dto.year } : {}),
        ...(dto.fuelType !== undefined ? { fuelType: dto.fuelType } : {}),
        ...(dto.avgConsumption !== undefined ? { avgConsumption: dto.avgConsumption } : {}),
        ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
        ...(dto.odometerKm !== undefined ? { odometerKm: dto.odometerKm } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      });
      if (!vehicle) {
        throw httpError(HttpStatus.NOT_FOUND, 'VEHICLE_NOT_FOUND', 'Veículo não encontrado.');
      }
      if (dto.odometerKm !== undefined && dto.odometerKm != null && dto.odometerKm !== existing.odometerKm) {
        await writeOdometerReading(this.prisma, {
          companyId: user.companyId,
          vehicleId: id,
          source: OdometerReadingSource.ADMIN_ADJUST,
          km: dto.odometerKm,
          occurredAt: new Date(),
          actorUserId: user.id,
          note: 'Ajuste administrativo do cadastro',
        });
        await this.prisma.auditLog.create({
          data: {
            companyId: user.companyId,
            userId: user.id,
            action: 'VEHICLE_ODOMETER_ADJUSTED',
            entity: 'Vehicle',
            entityId: id,
            metadata: { before: existing.odometerKm, after: dto.odometerKm },
          },
        });
      }
      return { vehicle };
    } catch (err: unknown) {
      if (err instanceof HttpException) throw err;
      if (isUniquePlateError(err)) {
        throw httpError(
          HttpStatus.CONFLICT,
          'VEHICLE_PLATE_EXISTS',
          'Já existe um veículo com esta placa na empresa.',
        );
      }
      throw err;
    }
  }
}
