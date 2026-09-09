import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { EmployeesRepository } from './employees.repository';
import {
  CreateEmployeeDto,
  ListEmployeesQueryDto,
  UpdateEmployeeDto,
} from './dto/employees.dto';
import { AuthUser } from '../auth/decorators/auth.decorators';
import { httpError } from '../../common/errors/http-error';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly employeesRepository: EmployeesRepository,
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  async list(user: AuthUser, query: ListEmployeesQueryDto) {
    const employees = await this.employeesRepository.list({
      companyId: user.companyId,
      q: query.q,
      status: query.status,
    });
    return { employees };
  }

  async create(user: AuthUser, dto: CreateEmployeeDto) {
    try {
      const employee = await this.prisma.$transaction(async (tx) => {
        const { user: createdUser } = await this.usersService.create(
          user,
          {
            name: dto.name,
            email: dto.email,
            role: UserRole.EMPLOYEE,
            password: dto.password,
          },
          tx,
        );

        return this.employeesRepository.create(
          {
            company: { connect: { id: user.companyId } },
            name: dto.name,
            phone: dto.phone ?? null,
            email: dto.email,
            jobTitle: dto.jobTitle ?? null,
            registration: dto.registration ?? null,
            specialties: dto.specialties ?? [],
            region: dto.region ?? null,
            status: dto.status,
            user: { connect: { id: createdUser.id } },
          },
          tx,
        );
      });
      return { employee };
    } catch (err: unknown) {
      this.rethrowWriteError(err);
    }
  }

  async getOne(user: AuthUser, id: string) {
    const employee = await this.employeesRepository.findByIdInCompany(id, user.companyId);
    if (!employee) {
      throw httpError(HttpStatus.NOT_FOUND, 'EMPLOYEE_NOT_FOUND', 'Funcionário não encontrado.');
    }
    return { employee };
  }

  async update(user: AuthUser, id: string, dto: UpdateEmployeeDto) {
    const existing = await this.employeesRepository.findByIdInCompany(id, user.companyId);
    if (!existing) {
      throw httpError(HttpStatus.NOT_FOUND, 'EMPLOYEE_NOT_FOUND', 'Funcionário não encontrado.');
    }

    const profileData = {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      ...(dto.email !== undefined ? { email: dto.email } : {}),
      ...(dto.jobTitle !== undefined ? { jobTitle: dto.jobTitle } : {}),
      ...(dto.registration !== undefined ? { registration: dto.registration } : {}),
      ...(dto.specialties !== undefined ? { specialties: dto.specialties } : {}),
      ...(dto.region !== undefined ? { region: dto.region } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
    };

    if (existing.userId) {
      if (dto.password) {
        throw httpError(
          HttpStatus.BAD_REQUEST,
          'EMPLOYEE_ALREADY_HAS_LOGIN',
          'Este funcionário já tem acesso. Redefina a senha em Usuários.',
        );
      }
      try {
        const employee = await this.employeesRepository.update(id, user.companyId, profileData);
        if (!employee) {
          throw httpError(HttpStatus.NOT_FOUND, 'EMPLOYEE_NOT_FOUND', 'Funcionário não encontrado.');
        }
        return { employee };
      } catch (err: unknown) {
        this.rethrowWriteError(err);
      }
    }

    const loginEmail = (dto.email ?? existing.email)?.trim().toLowerCase();
    if (!dto.password) {
      throw httpError(
        HttpStatus.BAD_REQUEST,
        'EMPLOYEE_LOGIN_REQUIRED',
        'Informe e-mail e senha. Não há funcionário sem usuário de acesso.',
      );
    }
    if (!loginEmail) {
      throw httpError(
        HttpStatus.BAD_REQUEST,
        'EMPLOYEE_LOGIN_EMAIL_REQUIRED',
        'Informe um e-mail para criar o acesso.',
      );
    }

    try {
      const employee = await this.prisma.$transaction(async (tx) => {
        const { user: createdUser } = await this.usersService.create(
          user,
          {
            name: dto.name ?? existing.name,
            email: loginEmail,
            role: UserRole.EMPLOYEE,
            password: dto.password!,
          },
          tx,
        );

        return this.employeesRepository.update(
          id,
          user.companyId,
          {
            ...profileData,
            email: loginEmail,
            userId: createdUser.id,
          },
          tx,
        );
      });
      if (!employee) {
        throw httpError(HttpStatus.NOT_FOUND, 'EMPLOYEE_NOT_FOUND', 'Funcionário não encontrado.');
      }
      return { employee };
    } catch (err: unknown) {
      this.rethrowWriteError(err);
    }
  }

  private rethrowWriteError(err: unknown): never {
    if (err instanceof HttpException) throw err;
    const code = (err as { code?: string })?.code;
    if (code === 'P2002') {
      const target = ((err as { meta?: { target?: string[] } }).meta?.target ?? []).join(',');
      if (target.includes('email')) {
        throw httpError(HttpStatus.CONFLICT, 'USER_EMAIL_EXISTS', 'Este e-mail já está em uso.');
      }
      throw httpError(
        HttpStatus.CONFLICT,
        'EMPLOYEE_USER_LINKED',
        'Este usuário já está vinculado a outro funcionário.',
      );
    }
    throw err;
  }
}
