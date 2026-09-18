import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CostsService } from './costs.service';
import { CostSettingsDto, CostsQueryDto } from './dto/costs.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser, Roles, AuthUser } from '../auth/decorators/auth.decorators';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class CostsController {
  constructor(private readonly costsService: CostsService) {}

  @Get('costs/dashboard')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR)
  dashboard(@CurrentUser() user: AuthUser, @Query() query: CostsQueryDto) {
    return this.costsService.dashboard(user, query);
  }

  @Get('costs/vehicles/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR)
  vehicle(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CostsQueryDto,
  ) {
    return this.costsService.vehicle(user, id, query);
  }

  @Get('costs/routes/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR)
  route(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.costsService.route(user, id);
  }

  @Get('vehicles/:id/odometer-readings')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR)
  readings(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.costsService.odometerReadings(user, id);
  }

  @Get('companies/me/cost-settings')
  getSettings(@CurrentUser() user: AuthUser) {
    return this.costsService.getCostSettings(user);
  }

  @Patch('companies/me/cost-settings')
  @Roles(UserRole.ADMIN)
  patchSettings(@CurrentUser() user: AuthUser, @Body() dto: CostSettingsDto) {
    return this.costsService.patchCostSettings(user, dto);
  }
}
