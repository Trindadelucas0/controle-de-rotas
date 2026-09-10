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
import { RoutesService } from './routes.service';
import {
  CompleteRouteDto,
  CreateRouteDto,
  DispatchCustomersRouteDto,
  ListRoutesQueryDto,
  PreviewCustomersRouteDto,
  PreviewRouteDto,
  RerouteRouteDto,
  StartRouteDto,
  UpdateRouteDto,
} from './dto/routes.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser, Roles, AuthUser } from '../auth/decorators/auth.decorators';

@Controller('routes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Post('preview')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR)
  preview(@CurrentUser() user: AuthUser, @Body() dto: PreviewRouteDto) {
    return this.routesService.preview(user, dto);
  }

  @Post('preview-customers')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR)
  previewCustomers(@CurrentUser() user: AuthUser, @Body() dto: PreviewCustomersRouteDto) {
    return this.routesService.previewCustomers(user, dto);
  }

  @Post('dispatch-customers')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  dispatchCustomers(@CurrentUser() user: AuthUser, @Body() dto: DispatchCustomersRouteDto) {
    return this.routesService.dispatchCustomers(user, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR)
  list(@CurrentUser() user: AuthUser, @Query() query: ListRoutesQueryDto) {
    return this.routesService.list(user, query);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRouteDto) {
    return this.routesService.create(user, dto);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR)
  getOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.routesService.getOne(user, id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRouteDto,
  ) {
    return this.routesService.update(user, id, dto);
  }

  @Post(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.routesService.cancel(user, id);
  }

  @Post(':id/publish')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  publish(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.routesService.publish(user, id);
  }

  @Post(':id/start')
  @Roles(UserRole.EMPLOYEE)
  start(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StartRouteDto,
  ) {
    return this.routesService.start(user, id, dto);
  }

  @Post(':id/reroute')
  @Roles(UserRole.EMPLOYEE)
  reroute(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RerouteRouteDto,
  ) {
    return this.routesService.reroute(user, id, dto);
  }

  @Post(':id/complete')
  @Roles(UserRole.EMPLOYEE)
  complete(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteRouteDto,
  ) {
    return this.routesService.complete(user, id, dto);
  }
}
