import { Injectable } from '@nestjs/common';
import {
  Company,
  PasswordResetToken,
  Prisma,
  RefreshToken,
  User,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export type UserWithCompany = User & { company: Company };

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUserByEmail(email: string): Promise<UserWithCompany | null> {
    return this.prisma.user.findUnique({
      where: { email },
      include: { company: true },
    });
  }

  findUserById(id: string): Promise<UserWithCompany | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: { company: true },
    });
  }

  updateLastLogin(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  createRefreshToken(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent?: string;
    ip?: string;
  }): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({ data });
  }

  findRefreshByHash(tokenHash: string): Promise<(RefreshToken & { user: UserWithCompany }) | null> {
    return this.prisma.refreshToken.findFirst({
      where: { tokenHash },
      include: { user: { include: { company: true } } },
    });
  }

  revokeRefreshToken(id: string): Promise<RefreshToken> {
    return this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  revokeAllRefreshTokens(userId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  createPasswordResetToken(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<PasswordResetToken> {
    return this.prisma.passwordResetToken.create({ data });
  }

  findPasswordResetByHash(
    tokenHash: string,
  ): Promise<(PasswordResetToken & { user: User }) | null> {
    return this.prisma.passwordResetToken.findFirst({
      where: { tokenHash },
      include: { user: true },
    });
  }

  markPasswordResetUsed(id: string): Promise<PasswordResetToken> {
    return this.prisma.passwordResetToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  updatePasswordHash(userId: string, passwordHash: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  createAuditLog(data: {
    companyId?: string | null;
    userId?: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    metadata?: Prisma.InputJsonValue;
    ip?: string;
    userAgent?: string;
  }) {
    return this.prisma.auditLog.create({
      data: {
        companyId: data.companyId ?? null,
        userId: data.userId ?? null,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId ?? null,
        metadata: data.metadata,
        ip: data.ip,
        userAgent: data.userAgent,
      },
    });
  }

  isUserActive(status: UserStatus): boolean {
    return status === UserStatus.ACTIVE;
  }
}
