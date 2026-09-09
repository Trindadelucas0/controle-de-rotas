import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { IsString, MinLength } from 'class-validator';
import { LookupsService } from './lookups.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/auth.decorators';

class AddressQueryDto {
  @IsString()
  @MinLength(3)
  q!: string;
}

@Controller('lookups')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.EMPLOYEE)
export class LookupsController {
  constructor(private readonly lookupsService: LookupsService) {}

  @Get('cnpj/:cnpj')
  lookupCnpj(@Param('cnpj') cnpj: string) {
    return this.lookupsService.lookupCnpj(cnpj);
  }

  @Get('cep/:cep')
  lookupCep(@Param('cep') cep: string) {
    return this.lookupsService.lookupCep(cep);
  }

  @Get('address')
  searchAddress(@Query() query: AddressQueryDto) {
    return this.lookupsService.searchAddress(query.q);
  }
}
