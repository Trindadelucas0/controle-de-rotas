import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { OpsService } from './ops.service';
import { OpsListEnrichedQueryDto, OpsSnapshotQueryDto } from './dto/ops.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser, Roles, AuthUser } from '../auth/decorators/auth.decorators';

@Controller('ops')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OpsController {
  constructor(private readonly opsService: OpsService) {}

  @Get('snapshot')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR)
  snapshot(@CurrentUser() user: AuthUser, @Query() query: OpsSnapshotQueryDto) {
    return this.opsService.snapshot(user, query);
  }

  @Get('vehicles/summary')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  vehiclesSummary(@CurrentUser() user: AuthUser, @Query() query: OpsSnapshotQueryDto) {
    return this.opsService.vehiclesSummary(user, query);
  }

  @Get('employees/summary')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  employeesSummary(@CurrentUser() user: AuthUser, @Query() query: OpsSnapshotQueryDto) {
    return this.opsService.employeesSummary(user, query);
  }

  @Get('customers/summary')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.EMPLOYEE)
  customersSummary(@CurrentUser() user: AuthUser, @Query() query: OpsSnapshotQueryDto) {
    return this.opsService.customersSummary(user, query);
  }

  @Get('service-orders/summary')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR)
  serviceOrdersSummary(@CurrentUser() user: AuthUser) {
    return this.opsService.serviceOrdersSummary(user);
  }

  @Get('routes/summary')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR)
  routesSummary(@CurrentUser() user: AuthUser, @Query() query: OpsSnapshotQueryDto) {
    return this.opsService.routesSummary(user, query);
  }

  @Get('agenda/summary')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.EMPLOYEE)
  agendaSummary(@CurrentUser() user: AuthUser, @Query() query: OpsSnapshotQueryDto) {
    return this.opsService.agendaSummary(user, query);
  }

  @Get('customers/list-enriched')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.EMPLOYEE)
  customersListEnriched(@CurrentUser() user: AuthUser, @Query() query: OpsListEnrichedQueryDto) {
    return this.opsService.customersListEnriched(user, query.q);
  }

  @Get('employees/list-enriched')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  employeesListEnriched(@CurrentUser() user: AuthUser, @Query() query: OpsListEnrichedQueryDto) {
    return this.opsService.employeesListEnriched(user, query.q, query.date);
  }

  @Get('vehicles/list-enriched')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  vehiclesListEnriched(@CurrentUser() user: AuthUser, @Query() query: OpsListEnrichedQueryDto) {
    return this.opsService.vehiclesListEnriched(user, query.q, query.date);
  }

  @Get('customers/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.EMPLOYEE)
  customerContext(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.opsService.customerContext(user, id);
  }

  @Get('vehicles/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  vehicleContext(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.opsService.vehicleContext(user, id);
  }

  @Get('employees/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  employeeContext(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.opsService.employeeContext(user, id);
  }

  @Get('service-orders/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR)
  serviceOrderContext(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.opsService.serviceOrderContext(user, id);
  }
}
