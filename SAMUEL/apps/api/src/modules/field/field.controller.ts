import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { FieldService } from './field.service';
import { MyRouteQueryDto, FieldVehiclesQueryDto } from './dto/field.dto';
import { CompleteRouteDto } from '../routes/dto/routes.dto';
import { RoutesService } from '../routes/routes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser, Roles, AuthUser } from '../auth/decorators/auth.decorators';

@Controller('field')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FieldController {
  constructor(
    private readonly fieldService: FieldService,
    private readonly routesService: RoutesService,
  ) {}

  @Get('my-route')
  @Roles(UserRole.EMPLOYEE)
  myRoute(@CurrentUser() user: AuthUser, @Query() query: MyRouteQueryDto) {
    return this.fieldService.myRoute(user, query.date);
  }

  @Get('vehicles')
  @Roles(UserRole.EMPLOYEE)
  vehicles(@CurrentUser() user: AuthUser, @Query() query: FieldVehiclesQueryDto) {
    return this.fieldService.listVehicles(user, query.routeId);
  }

  @Get('tracking-status')
  @Roles(UserRole.EMPLOYEE)
  trackingStatus(@CurrentUser() user: AuthUser) {
    return this.fieldService.trackingStatus(user);
  }

  @Post('routes/:id/complete')
  @HttpCode(200)
  @Roles(UserRole.EMPLOYEE, UserRole.ADMIN, UserRole.MANAGER)
  complete(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteRouteDto,
  ) {
    return this.routesService.complete(user, id, dto);
  }
}
