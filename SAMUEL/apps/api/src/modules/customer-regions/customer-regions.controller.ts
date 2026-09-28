import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser, Roles, AuthUser } from '../auth/decorators/auth.decorators';
import { CustomerRegionsService } from './customer-regions.service';
import { CreateCustomerRegionDto, UpdateCustomerRegionDto } from './dto/customer-regions.dto';

@Controller('customer-regions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomerRegionsController {
  constructor(private readonly customerRegions: CustomerRegionsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.EMPLOYEE)
  list(@CurrentUser() user: AuthUser) {
    return this.customerRegions.list(user);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCustomerRegionDto) {
    return this.customerRegions.create(user, dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerRegionDto,
  ) {
    return this.customerRegions.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.customerRegions.remove(user, id);
  }
}
