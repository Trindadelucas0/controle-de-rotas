import { Injectable, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CompanyStatus, LocationStatus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CompaniesRepository } from './companies.repository';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { ListCompaniesQueryDto } from './dto/list-companies.dto';
import { AuthUser } from '../auth/decorators/auth.decorators';
import { httpError } from '../../common/errors/http-error';
import { PrismaService } from '../../common/prisma/prisma.service';

function resolveLocationStatus(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): LocationStatus {
  if (latitude != null && longitude != null) {
    return LocationStatus.OK;
  }
  return LocationStatus.PENDING;
}

function assertPlatformAdmin(user: AuthUser) {
  if (user.role !== UserRole.PLATFORM_ADMIN) {
    throw httpError(
      HttpStatus.FORBIDDEN,
      'AUTH_FORBIDDEN',
      'Apenas o administrador da plataforma pode gerenciar empresas.',
    );
  }
}

@Injectable()
export class CompaniesService {
  constructor(
    private readonly companiesRepository: CompaniesRepository,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getMe(user: AuthUser) {
    const company = await this.companiesRepository.findById(user.companyId);
    if (!company) {
      throw httpError(HttpStatus.NOT_FOUND, 'COMPANY_NOT_FOUND', 'Empresa não encontrada.');
    }
    return { company };
  }

  async updateMe(user: AuthUser, dto: UpdateCompanyDto) {
    const existing = await this.companiesRepository.findById(user.companyId);
    if (!existing) {
      throw httpError(HttpStatus.NOT_FOUND, 'COMPANY_NOT_FOUND', 'Empresa não encontrada.');
    }

    const latitude = dto.latitude !== undefined ? dto.latitude : existing.latitude;
    const longitude = dto.longitude !== undefined ? dto.longitude : existing.longitude;
    const locationTouched = dto.latitude !== undefined || dto.longitude !== undefined;

    const company = await this.companiesRepository.update(user.companyId, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.tradeName !== undefined ? { tradeName: dto.tradeName } : {}),
      ...(dto.document !== undefined ? { document: dto.document } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      ...(dto.email !== undefined ? { email: dto.email } : {}),
      ...(dto.address !== undefined ? { address: dto.address } : {}),
      ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
      ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
      ...(locationTouched
        ? { locationStatus: resolveLocationStatus(latitude, longitude) }
        : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
    });

    return { company };
  }

  async list(user: AuthUser, query: ListCompaniesQueryDto) {
    assertPlatformAdmin(user);
    const companies = await this.companiesRepository.list({
      q: query.q,
      status: query.status,
    });
    return { companies };
  }

  async getOne(user: AuthUser, id: string) {
    assertPlatformAdmin(user);
    const company = await this.companiesRepository.findById(id);
    if (!company) {
      throw httpError(HttpStatus.NOT_FOUND, 'COMPANY_NOT_FOUND', 'Empresa não encontrada.');
    }
    return { company };
  }

  async create(user: AuthUser, dto: CreateCompanyDto) {
    assertPlatformAdmin(user);

    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.adminEmail },
    });
    if (existingEmail) {
      throw httpError(
        HttpStatus.CONFLICT,
        'USER_EMAIL_EXISTS',
        'Este e-mail do administrador já está em uso.',
      );
    }

    const rounds = Number(this.config.get('BCRYPT_ROUNDS') || 10);
    const passwordHash = await bcrypt.hash(dto.adminPassword, rounds);

    try {
      const created = await this.companiesRepository.createWithAdmin(
        {
          name: dto.name.trim(),
          tradeName: dto.tradeName?.trim() || null,
          document: dto.document?.trim() || null,
          phone: dto.phone?.trim() || null,
          email: dto.email?.trim() || null,
          address: dto.address?.trim() || null,
          status: CompanyStatus.ACTIVE,
          locationStatus: LocationStatus.PENDING,
        },
        {
          name: dto.adminName.trim(),
          email: dto.adminEmail,
          passwordHash,
        },
      );
      return created;
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'P2002') {
        throw httpError(
          HttpStatus.CONFLICT,
          'USER_EMAIL_EXISTS',
          'Este e-mail do administrador já está em uso.',
        );
      }
      throw err;
    }
  }

  async updateById(user: AuthUser, id: string, dto: UpdateCompanyDto) {
    assertPlatformAdmin(user);
    const existing = await this.companiesRepository.findById(id);
    if (!existing) {
      throw httpError(HttpStatus.NOT_FOUND, 'COMPANY_NOT_FOUND', 'Empresa não encontrada.');
    }

    const latitude = dto.latitude !== undefined ? dto.latitude : existing.latitude;
    const longitude = dto.longitude !== undefined ? dto.longitude : existing.longitude;
    const locationTouched = dto.latitude !== undefined || dto.longitude !== undefined;

    const company = await this.companiesRepository.update(id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.tradeName !== undefined ? { tradeName: dto.tradeName } : {}),
      ...(dto.document !== undefined ? { document: dto.document } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      ...(dto.email !== undefined ? { email: dto.email } : {}),
      ...(dto.address !== undefined ? { address: dto.address } : {}),
      ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
      ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
      ...(locationTouched
        ? { locationStatus: resolveLocationStatus(latitude, longitude) }
        : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
    });

    return { company };
  }
}
