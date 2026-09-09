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
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { VisitsService } from './visits.service';
import { CheckInVisitDto, CheckOutVisitDto, ListVisitsQueryDto, UpdateVisitDto } from './dto/visits.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser, Roles, AuthUser } from '../auth/decorators/auth.decorators';

function requestMeta(req: Request) {
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.ip ||
    req.socket.remoteAddress ||
    undefined;
  return { ip, userAgent: req.headers['user-agent'] };
}

@Controller('visits')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.EMPLOYEE)
  list(@CurrentUser() user: AuthUser, @Query() query: ListVisitsQueryDto) {
    return this.visitsService.list(user, query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.EMPLOYEE)
  getOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.visitsService.getOne(user, id);
  }

  @Post(':id/check-in')
  @Roles(UserRole.EMPLOYEE)
  @HttpCode(201)
  checkIn(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CheckInVisitDto,
    @Req() req: Request,
  ) {
    return this.visitsService.checkIn(user, id, dto, requestMeta(req));
  }

  @Post(':id/check-out')
  @Roles(UserRole.EMPLOYEE)
  @HttpCode(201)
  checkOut(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CheckOutVisitDto,
    @Req() req: Request,
  ) {
    return this.visitsService.checkOut(user, id, dto, requestMeta(req));
  }

  @Post(':id/evidence')
  @Roles(UserRole.EMPLOYEE)
  @HttpCode(201)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  addEvidence(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { caption?: string; latitude?: number; longitude?: number; accuracy?: number },
    @Req() req: Request,
  ) {
    return this.visitsService.addEvidence(user, id, file, body, requestMeta(req));
  }

  @Get(':id/evidence')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.EMPLOYEE)
  listEvidence(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.visitsService.listEvidence(user, id);
  }

  @Get(':id/evidence/:evidenceId/file')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.EMPLOYEE)
  async getEvidenceFile(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
    @Res() res: Response,
  ) {
    const file = await this.visitsService.getEvidenceFile(user, id, evidenceId);
    res.setHeader('Content-Type', file.mimeType);
    if (file.originalName) {
      res.setHeader('Content-Disposition', `inline; filename="${file.originalName.replace(/"/g, '')}"`);
    }
    file.stream.pipe(res);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVisitDto,
  ) {
    return this.visitsService.update(user, id, dto);
  }
}
