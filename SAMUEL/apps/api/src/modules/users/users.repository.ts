import { Injectable } from '@nestjs/common';
import { Prisma, User, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export const USER_PUBLIC_SELECT = {
  id: true,
  companyId: true,
  name: true,
  email: true,
  role: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type PublicUserRecord = Prisma.UserGetPayload<{ select: typeof USER_PUBLIC_SELECT }>;

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(params: {
    companyId: string;
    q?: string;
    role?: UserRole;
    status?: UserStatus;
  }): Promise<PublicUserRecord[]> {
    const where: Prisma.UserWhereInput = {
      companyId: params.companyId,
      ...(params.role ? { role: params.role } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.q
        ? {
            OR: [
              { name: { contains: params.q, mode: 'insensitive' } },
              { email: { contains: params.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return this.prisma.user.findMany({
      where,
      select: USER_PUBLIC_SELECT,
      orderBy: { name: 'asc' },
    });
  }

  findByIdInCompany(id: string, companyId: string): Promise<PublicUserRecord | null> {
    return this.prisma.user.findFirst({
      where: { id, companyId },
      select: USER_PUBLIC_SELECT,
    });
  }

  findByEmail(email: string, db?: Prisma.TransactionClient): Promise<User | null> {
    return (db ?? this.prisma).user.findUnique({ where: { email } });
  }

  create(
    data: {
      companyId: string;
      name: string;
      email: string;
      role: UserRole;
      passwordHash: string;
    },
    db?: Prisma.TransactionClient,
  ): Promise<PublicUserRecord> {
    return (db ?? this.prisma).user.create({
      data,
      select: USER_PUBLIC_SELECT,
    });
  }

  async update(
    id: string,
    companyId: string,
    data: Prisma.UserUpdateManyMutationInput,
  ): Promise<PublicUserRecord | null> {
    const result = await this.prisma.user.updateMany({ where: { id, companyId }, data });
    if (result.count === 0) return null;
    return this.findByIdInCompany(id, companyId);
  }

  updatePasswordHash(id: string, companyId: string, passwordHash: string): Promise<boolean> {
    return this.prisma.user
      .updateMany({ where: { id, companyId }, data: { passwordHash } })
      .then((result) => result.count > 0);
  }

  revokeAllRefreshTokens(userId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
