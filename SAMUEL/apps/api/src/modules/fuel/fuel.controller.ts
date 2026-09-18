import {
  Body,
  Controller,
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
import { FuelService } from './fuel.service';
import { CreateFuelFillDto, ListFuelFillsQueryDto, UpdateFuelFillDto } from './dto/fuel.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser, Roles, AuthUser } from '../auth/decorators/auth.decorators';
import { LocalStorageService } from '../../common/storage/local-storage.service';
import { httpError } from '../../common/errors/http-error';
import { HttpStatus } from '@nestjs/common';

@Controller('fuel-fills')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FuelController {
  constructor(
    private readonly fuelService: FuelService,
    private readonly storage: LocalStorageService,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.EMPLOYEE)
  list(@CurrentUser() user: AuthUser, @Query() query: ListFuelFillsQueryDto) {
    return this.fuelService.list(user, query);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateFuelFillDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.fuelService.create(user, dto, file);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.EMPLOYEE)
  getOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.fuelService.getOne(user, id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFuelFillDto,
  ) {
    return this.fuelService.update(user, id, dto);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @Roles(UserRole.ADMIN)
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.fuelService.cancel(user, id);
  }

  @Get(':id/evidence/:evidenceId/file')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.EMPLOYEE)
  async file(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
    @Res() res: Response,
  ) {
    const ev = await this.fuelService.getEvidenceFile(user, id, evidenceId);
    const stream = this.storage.openReadStream(ev.storageKey);
    if (!stream) {
      throw httpError(HttpStatus.NOT_FOUND, 'FUEL_EVIDENCE_NOT_FOUND', 'Arquivo não encontrado.');
    }
    res.setHeader('Content-Type', ev.mimeType);
    stream.pipe(res);
  }
}
