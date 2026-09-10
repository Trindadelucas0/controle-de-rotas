import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { TrackingService } from './tracking.service';
import { PostTrackingPointsDto, TrackingHistoryQueryDto } from './dto/tracking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser, Roles, AuthUser } from '../auth/decorators/auth.decorators';

@Controller('tracking')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Post('points')
  @Roles(UserRole.EMPLOYEE)
  ingest(@CurrentUser() user: AuthUser, @Body() dto: PostTrackingPointsDto) {
    return this.trackingService.ingestPoints(user, dto);
  }

  @Get('live')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR)
  live(@CurrentUser() user: AuthUser) {
    return this.trackingService.listLive(user);
  }

  @Get('history')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR)
  history(@CurrentUser() user: AuthUser, @Query() query: TrackingHistoryQueryDto) {
    return this.trackingService.routeHistory(user, query.routeId);
  }
}
