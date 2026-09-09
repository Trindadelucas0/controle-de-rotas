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
import { ServiceOrdersService } from './service-orders.service';
import {
  CreateServiceOrderDto,
  ListServiceOrdersQueryDto,
  UpdateServiceOrderDto,
} from './dto/service-orders.dto';
import { CreateVisitDto } from '../visits/dto/visits.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser, Roles, AuthUser } from '../auth/decorators/auth.decorators';

@Controller('service-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServiceOrdersController {
  constructor(private readonly serviceOrdersService: ServiceOrdersService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR)
  list(@CurrentUser() user: AuthUser, @Query() query: ListServiceOrdersQueryDto) {
    return this.serviceOrdersService.list(user, query);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateServiceOrderDto) {
    return this.serviceOrdersService.create(user, dto);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR)
  getOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.serviceOrdersService.getOne(user, id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceOrderDto,
  ) {
    return this.serviceOrdersService.update(user, id, dto);
  }

  @Post(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.serviceOrdersService.cancel(user, id);
  }

  @Post(':id/visits')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  addVisit(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateVisitDto,
  ) {
    return this.serviceOrdersService.addVisit(user, id, dto);
  }
}
