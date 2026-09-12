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
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { UserRole } from '@prisma/client';
import { RoutesService } from './routes.service';
import {
  CompleteRouteDto,
  CreateRouteDto,
  DispatchCustomersRouteDto,
  DispatchRecordMissionDto,
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

  @Post('dispatch-record-mission')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  dispatchRecordMission(
    @CurrentUser() user: AuthUser,
    @Body() dto: DispatchRecordMissionDto,
  ) {
    return this.routesService.dispatchRecordMission(user, dto);
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
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  start(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StartRouteDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.routesService.start(user, id, dto, file);
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

  /** Campo + gestor (rota travada). Declaração antes de GET :id. */
  @Post(':id/complete')
  @HttpCode(200)
  @Roles(UserRole.EMPLOYEE, UserRole.ADMIN, UserRole.MANAGER)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  complete(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteRouteDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.routesService.complete(user, id, dto, file);
  }

  @Get(':id/evidence/:evidenceId/file')
  @Roles(
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.SUPERVISOR,
    UserRole.EMPLOYEE,
    UserRole.PLATFORM_ADMIN,
  )
  async getEvidenceFile(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
    @Res() res: Response,
  ) {
    const file = await this.routesService.getEvidenceFile(user, id, evidenceId);
    res.setHeader('Content-Type', file.mimeType);
    if (file.originalName) {
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${file.originalName.replace(/"/g, '')}"`,
      );
    }
    file.stream.pipe(res);
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

  @Delete(':id')
  @HttpCode(204)
  @Roles(UserRole.ADMIN)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.routesService.remove(user, id);
  }
}
