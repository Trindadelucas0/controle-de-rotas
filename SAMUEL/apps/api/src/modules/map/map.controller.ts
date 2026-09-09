import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { MapService } from './map.service';
import { MapCustomersQueryDto, NearbyCustomersQueryDto } from './dto/map.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser, Roles, AuthUser } from '../auth/decorators/auth.decorators';

@Controller('map')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR)
export class MapController {
  constructor(private readonly mapService: MapService) {}

  @Get('customers')
  listCustomers(@CurrentUser() user: AuthUser, @Query() query: MapCustomersQueryDto) {
    return this.mapService.listCustomerPins(user, query);
  }

  @Get('customers/nearby')
  nearby(@CurrentUser() user: AuthUser, @Query() query: NearbyCustomersQueryDto) {
    return this.mapService.nearby(user, query);
  }
}
