import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CompaniesService } from './companies.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser, Roles, AuthUser } from '../auth/decorators/auth.decorators';

@Controller('companies')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthUser) {
    return this.companiesService.getMe(user);
  }

  @Patch('me')
  @Roles(UserRole.ADMIN)
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.updateMe(user, dto);
  }
}
