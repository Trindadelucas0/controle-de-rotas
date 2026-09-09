import { Injectable, HttpStatus } from '@nestjs/common';
import { LocationStatus } from '@prisma/client';
import { CompaniesRepository } from './companies.repository';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { AuthUser } from '../auth/decorators/auth.decorators';
import { httpError } from '../../common/errors/http-error';

function resolveLocationStatus(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): LocationStatus {
  if (latitude != null && longitude != null) {
    return LocationStatus.OK;
  }
  return LocationStatus.PENDING;
}

@Injectable()
export class CompaniesService {
  constructor(private readonly companiesRepository: CompaniesRepository) {}

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

    const latitude =
      dto.latitude !== undefined ? dto.latitude : existing.latitude;
    const longitude =
      dto.longitude !== undefined ? dto.longitude : existing.longitude;
    const locationTouched =
      dto.latitude !== undefined || dto.longitude !== undefined;

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
}
