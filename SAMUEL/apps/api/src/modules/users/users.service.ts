import { Injectable, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UsersRepository } from './users.repository';
import {
  CreateUserDto,
  ListUsersQueryDto,
  ResetUserPasswordDto,
  UpdateUserDto,
} from './dto/users.dto';
import { AuthUser } from '../auth/decorators/auth.decorators';
import { httpError } from '../../common/errors/http-error';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly config: ConfigService,
  ) {}

  async list(user: AuthUser, query: ListUsersQueryDto) {
    const users = await this.usersRepository.list({
      companyId: user.companyId,
      q: query.q,
      role: query.role,
      status: query.status,
    });
    return { users };
  }

  async create(user: AuthUser, dto: CreateUserDto, tx?: Prisma.TransactionClient) {
    const existing = await this.usersRepository.findByEmail(dto.email, tx);
    if (existing) {
      throw httpError(HttpStatus.CONFLICT, 'USER_EMAIL_EXISTS', 'Este e-mail já está em uso.');
    }

    const rounds = Number(this.config.get('BCRYPT_ROUNDS') || 10);
    const passwordHash = await bcrypt.hash(dto.password, rounds);
    try {
      const created = await this.usersRepository.create(
        {
          companyId: user.companyId,
          name: dto.name,
          email: dto.email,
          role: dto.role,
          passwordHash,
        },
        tx,
      );
      return { user: created };
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'P2002') {
        throw httpError(HttpStatus.CONFLICT, 'USER_EMAIL_EXISTS', 'Este e-mail já está em uso.');
      }
      throw err;
    }
  }

  async getOne(user: AuthUser, id: string) {
    const found = await this.usersRepository.findByIdInCompany(id, user.companyId);
    if (!found) {
      throw httpError(HttpStatus.NOT_FOUND, 'USER_NOT_FOUND', 'Usuário não encontrado.');
    }
    return { user: found };
  }

  async update(user: AuthUser, id: string, dto: UpdateUserDto) {
    const updated = await this.usersRepository.update(id, user.companyId, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.role !== undefined ? { role: dto.role } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
    });
    if (!updated) {
      throw httpError(HttpStatus.NOT_FOUND, 'USER_NOT_FOUND', 'Usuário não encontrado.');
    }
    return { user: updated };
  }

  async resetPassword(user: AuthUser, id: string, dto: ResetUserPasswordDto) {
    const rounds = Number(this.config.get('BCRYPT_ROUNDS') || 10);
    const passwordHash = await bcrypt.hash(dto.password, rounds);
    const ok = await this.usersRepository.updatePasswordHash(id, user.companyId, passwordHash);
    if (!ok) {
      throw httpError(HttpStatus.NOT_FOUND, 'USER_NOT_FOUND', 'Usuário não encontrado.');
    }
    await this.usersRepository.revokeAllRefreshTokens(id);
    return { ok: true };
  }
}
