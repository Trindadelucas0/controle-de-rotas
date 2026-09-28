import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { httpError } from '../../common/errors/http-error';
import { AuthUser } from '../auth/decorators/auth.decorators';
import {
  CreateCustomerRegionDto,
  NewCustomerRegionDto,
  UpdateCustomerRegionDto,
} from './dto/customer-regions.dto';
import {
  grownRadiusMeters,
  isRegionLatLng,
  isSliderRadiusMeters,
  normalizeRegionName,
} from './customer-region.util';

const regionPublicSelect = {
  id: true,
  name: true,
  latitude: true,
  longitude: true,
  radiusMeters: true,
} as const;

export type CustomerRegionPublic = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

export type CustomerRegionLinkResult = {
  /** `undefined` = não mexer no vínculo. */
  customerRegionId: string | null | undefined;
  regionNotice: 'NO_PIN' | null;
};

@Injectable()
export class CustomerRegionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser): Promise<{ regions: CustomerRegionPublic[] }> {
    const regions = await this.prisma.customerRegion.findMany({
      where: { companyId: user.companyId },
      select: regionPublicSelect,
      orderBy: { name: 'asc' },
    });
    return { regions };
  }

  async create(user: AuthUser, dto: CreateCustomerRegionDto) {
    const region = await this.prisma.$transaction((tx) =>
      this.insertRegion(tx, user.companyId, dto),
    );
    return { region };
  }

  async update(user: AuthUser, id: string, dto: UpdateCustomerRegionDto) {
    const region = await this.prisma.$transaction(async (tx) => {
      const current = await tx.customerRegion.findFirst({
        where: { id, companyId: user.companyId },
      });
      if (!current) {
        throw httpError(HttpStatus.NOT_FOUND, 'REGION_NOT_FOUND', 'Região não encontrada.');
      }

      const name = dto.name !== undefined ? normalizeRegionName(dto.name) : current.name;
      if (!name) {
        throw httpError(HttpStatus.UNPROCESSABLE_ENTITY, 'REGION_NAME_REQUIRED', 'Informe o nome da região.');
      }
      if (dto.name !== undefined) {
        await this.assertNameFree(tx, user.companyId, name, id);
      }

      const latitude = dto.latitude !== undefined ? dto.latitude : current.latitude;
      const longitude = dto.longitude !== undefined ? dto.longitude : current.longitude;
      if (!isRegionLatLng(latitude, longitude)) {
        throw httpError(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'REGION_CENTER_REQUIRED',
          'Clique no mapa para definir o centro da região.',
        );
      }

      const requested =
        dto.radiusMeters !== undefined ? Math.round(dto.radiusMeters) : current.radiusMeters;
      if (dto.radiusMeters !== undefined && !isSliderRadiusMeters(requested)) {
        throw httpError(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'REGION_RADIUS_INVALID',
          'O raio deve ficar entre 500 m e 50 km.',
        );
      }

      const radiusMeters = await this.coverLinkedCustomers(tx, user.companyId, id, {
        latitude,
        longitude,
        radiusMeters: requested,
      });

      try {
        return await tx.customerRegion.update({
          where: { id },
          data: { name, latitude, longitude, radiusMeters },
          select: regionPublicSelect,
        });
      } catch (err) {
        this.rethrowDuplicate(err);
      }
    });
    return { region };
  }

  async remove(user: AuthUser, id: string) {
    const result = await this.prisma.customerRegion.deleteMany({
      where: { id, companyId: user.companyId },
    });
    if (result.count === 0) {
      throw httpError(HttpStatus.NOT_FOUND, 'REGION_NOT_FOUND', 'Região não encontrada.');
    }
    return { ok: true as const };
  }

  /**
   * Resolve o vínculo pedido no cadastro do cliente, na mesma transação.
   * Não encolhe o raio ao desvincular.
   */
  async applyCustomerLink(
    tx: Prisma.TransactionClient,
    companyId: string,
    input: {
      customerRegionId?: string | null;
      newRegion?: NewCustomerRegionDto | null;
      latitude: number | null;
      longitude: number | null;
    },
  ): Promise<CustomerRegionLinkResult> {
    const hasNew = input.newRegion != null;
    const hasId = input.customerRegionId !== undefined && input.customerRegionId !== null;
    if (hasNew && hasId) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'REGION_CHOICE_CONFLICT',
        'Escolha uma região já salva ou crie uma nova, não as duas.',
      );
    }

    if (!hasNew && input.customerRegionId === undefined) {
      return { customerRegionId: undefined, regionNotice: null };
    }

    if (!hasNew && input.customerRegionId === null) {
      return { customerRegionId: null, regionNotice: null };
    }

    const point =
      input.latitude != null && input.longitude != null && isRegionLatLng(input.latitude, input.longitude)
        ? { latitude: input.latitude, longitude: input.longitude }
        : null;

    if (hasNew && input.newRegion) {
      if (!point) {
        throw httpError(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'REGION_PIN_REQUIRED',
          'Marque o pin do cliente para criar a região.',
        );
      }
      const created = await this.insertRegion(tx, companyId, {
        name: input.newRegion.name,
        latitude: point.latitude,
        longitude: point.longitude,
        radiusMeters: input.newRegion.radiusMeters,
      });
      return { customerRegionId: created.id, regionNotice: null };
    }

    const regionId = input.customerRegionId;
    if (!regionId) {
      return { customerRegionId: null, regionNotice: null };
    }

    const region = await tx.customerRegion.findFirst({
      where: { id: regionId, companyId },
      select: regionPublicSelect,
    });
    if (!region) {
      throw httpError(HttpStatus.NOT_FOUND, 'REGION_NOT_FOUND', 'Região não encontrada.');
    }

    if (!point) {
      return { customerRegionId: region.id, regionNotice: 'NO_PIN' };
    }

    await this.expandStoredRadius(tx, companyId, region.id, point);
    return { customerRegionId: region.id, regionNotice: null };
  }

  async expandStoredRadius(
    tx: Prisma.TransactionClient,
    companyId: string,
    regionId: string,
    point: { latitude: number; longitude: number },
  ): Promise<void> {
    const region = await tx.customerRegion.findFirst({
      where: { id: regionId, companyId },
      select: regionPublicSelect,
    });
    if (!region) return;
    const radiusMeters = grownRadiusMeters(
      { latitude: region.latitude, longitude: region.longitude },
      region.radiusMeters,
      point,
    );
    if (radiusMeters === region.radiusMeters) return;
    await tx.customerRegion.update({
      where: { id: region.id },
      data: { radiusMeters },
    });
  }

  private async insertRegion(
    tx: Prisma.TransactionClient,
    companyId: string,
    dto: { name: string; latitude: number; longitude: number; radiusMeters: number },
  ): Promise<CustomerRegionPublic> {
    const name = normalizeRegionName(dto.name);
    if (!name) {
      throw httpError(HttpStatus.UNPROCESSABLE_ENTITY, 'REGION_NAME_REQUIRED', 'Informe o nome da região.');
    }
    if (!isRegionLatLng(dto.latitude, dto.longitude)) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'REGION_CENTER_REQUIRED',
        'Clique no mapa para definir o centro da região.',
      );
    }
    const radiusMeters = Math.round(dto.radiusMeters);
    if (!isSliderRadiusMeters(radiusMeters)) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'REGION_RADIUS_INVALID',
        'O raio deve ficar entre 500 m e 50 km.',
      );
    }
    await this.assertNameFree(tx, companyId, name);
    try {
      return await tx.customerRegion.create({
        data: {
          companyId,
          name,
          latitude: dto.latitude,
          longitude: dto.longitude,
          radiusMeters,
        },
        select: regionPublicSelect,
      });
    } catch (err) {
      this.rethrowDuplicate(err);
    }
  }

  private async assertNameFree(
    tx: Prisma.TransactionClient,
    companyId: string,
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const taken = await tx.customerRegion.findFirst({
      where: {
        companyId,
        name: { equals: name, mode: 'insensitive' },
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (taken) {
      throw httpError(
        HttpStatus.CONFLICT,
        'REGIAO_JA_EXISTE',
        'Essa região já está cadastrada. Selecione ela na lista.',
      );
    }
  }

  private async coverLinkedCustomers(
    tx: Prisma.TransactionClient,
    companyId: string,
    regionId: string,
    center: { latitude: number; longitude: number; radiusMeters: number },
  ): Promise<number> {
    const customers = await tx.customer.findMany({
      where: {
        companyId,
        customerRegionId: regionId,
        recordSessionShell: false,
        latitude: { not: null },
        longitude: { not: null },
      },
      select: { latitude: true, longitude: true },
    });
    let radius = center.radiusMeters;
    for (const customer of customers) {
      if (customer.latitude == null || customer.longitude == null) continue;
      radius = grownRadiusMeters(
        { latitude: center.latitude, longitude: center.longitude },
        radius,
        { latitude: customer.latitude, longitude: customer.longitude },
      );
    }
    return radius;
  }

  private rethrowDuplicate(err: unknown): never {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw httpError(
        HttpStatus.CONFLICT,
        'REGIAO_JA_EXISTE',
        'Essa região já está cadastrada. Selecione ela na lista.',
      );
    }
    throw err;
  }
}
