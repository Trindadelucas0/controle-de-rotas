import { Injectable, HttpStatus } from '@nestjs/common';
import { Prisma, LocationStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthUser } from '../auth/decorators/auth.decorators';
import { httpError } from '../../common/errors/http-error';
import { MapCustomersQueryDto, NearbyCustomersQueryDto } from './dto/map.dto';

type MapPinRow = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  location_status: string;
  status: string;
  profile_incomplete: boolean;
  city: string | null;
  street: string | null;
  number: string | null;
};

@Injectable()
export class MapService {
  constructor(private readonly prisma: PrismaService) {}

  async listCustomerPins(user: AuthUser, query: MapCustomersQueryDto) {
    const where: Prisma.CustomerWhereInput = {
      companyId: user.companyId,
      recordSessionShell: false,
      latitude: { not: null },
      longitude: { not: null },
    };
    if (query.status) where.status = query.status;
    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { document: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
      ];
    }

    const customers = await this.prisma.customer.findMany({
      where,
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        locationStatus: true,
        status: true,
        profileIncomplete: true,
        city: true,
        street: true,
        number: true,
      },
      orderBy: { name: 'asc' },
      take: 2000,
    });

    return {
      customers: customers.map((c) => ({
        id: c.id,
        name: c.name,
        latitude: c.latitude!,
        longitude: c.longitude!,
        locationStatus: c.locationStatus,
        status: c.status,
        profileIncomplete: c.profileIncomplete,
        city: c.city,
        street: c.street,
        number: c.number,
      })),
    };
  }

  async nearby(user: AuthUser, query: NearbyCustomersQueryDto) {
    const radius = query.radiusMeters ?? 3000;
    const rows = await this.prisma.$queryRaw<MapPinRow[]>`
      SELECT
        id::text,
        name,
        latitude,
        longitude,
        location_status::text,
        status::text,
        profile_incomplete,
        city,
        street,
        number
      FROM customers
      WHERE company_id = ${user.companyId}::uuid
        AND record_session_shell = false
        AND location IS NOT NULL
        AND ST_DWithin(
          location::geography,
          ST_SetSRID(ST_MakePoint(${query.lng}, ${query.lat}), 4326)::geography,
          ${radius}
        )
      ORDER BY ST_Distance(
        location::geography,
        ST_SetSRID(ST_MakePoint(${query.lng}, ${query.lat}), 4326)::geography
      )
      LIMIT 100
    `;

    return {
      customers: rows.map((c) => ({
        id: c.id,
        name: c.name,
        latitude: c.latitude,
        longitude: c.longitude,
        locationStatus: c.location_status,
        status: c.status,
        profileIncomplete: c.profile_incomplete,
        city: c.city,
        street: c.street,
        number: c.number,
      })),
      radiusMeters: radius,
    };
  }

  async geocodeCustomer(user: AuthUser, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, companyId: user.companyId },
    });
    if (!customer || customer.recordSessionShell) {
      throw httpError(HttpStatus.NOT_FOUND, 'CUSTOMER_NOT_FOUND', 'Cliente não encontrado.');
    }

    const parts = [
      customer.street,
      customer.number,
      customer.district,
      customer.city,
      customer.state,
      customer.zipCode,
      'Brasil',
    ].filter(Boolean);
    const address = parts.join(', ');
    if (parts.length < 2) {
      throw httpError(
        HttpStatus.BAD_REQUEST,
        'GEOCODE_NO_ADDRESS',
        'Cliente sem endereço suficiente para geocodificar.',
      );
    }

    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', address);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');

    let results: { lat: string; lon: string }[] = [];
    try {
      const res = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'Rotas/1.0 (operacoes-externas; contato-dev@local)',
          Accept: 'application/json',
        },
      });
      if (!res.ok) {
        throw new Error(`Nominatim HTTP ${res.status}`);
      }
      results = (await res.json()) as { lat: string; lon: string }[];
    } catch {
      await this.prisma.customer.update({
        where: { id: customer.id },
        data: { locationStatus: LocationStatus.FAILED },
      });
      throw httpError(
        HttpStatus.BAD_GATEWAY,
        'GEOCODE_FAILED',
        'Falha ao consultar o serviço de geocoding.',
      );
    }

    if (!results.length) {
      await this.prisma.customer.update({
        where: { id: customer.id },
        data: { locationStatus: LocationStatus.FAILED },
      });
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'GEOCODE_NOT_FOUND',
        'Endereço não encontrado no Nominatim.',
      );
    }

    const latitude = Number(results[0].lat);
    const longitude = Number(results[0].lon);
    const updated = await this.prisma.customer.update({
      where: { id: customer.id },
      data: {
        latitude,
        longitude,
        locationStatus: LocationStatus.OK,
      },
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        locationStatus: true,
        status: true,
        profileIncomplete: true,
        city: true,
        street: true,
        number: true,
      },
    });

    return { customer: updated };
  }
}
