import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CompaniesService } from './companies.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { ListCompaniesQueryDto } from './dto/list-companies.dto';
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

  @Get()
  @Roles(UserRole.PLATFORM_ADMIN)
  list(@CurrentUser() user: AuthUser, @Query() query: ListCompaniesQueryDto) {
    return this.companiesService.list(user, query);
  }

  @Post()
  @Roles(UserRole.PLATFORM_ADMIN)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCompanyDto) {
    return this.companiesService.create(user, dto);
  }

  @Get(':id')
  @Roles(UserRole.PLATFORM_ADMIN)
  getOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.companiesService.getOne(user, id);
  }

  @Patch(':id')
  @Roles(UserRole.PLATFORM_ADMIN)
  updateById(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companiesService.updateById(user, id, dto);
  }
}
