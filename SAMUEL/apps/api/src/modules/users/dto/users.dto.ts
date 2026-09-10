import { UserRole, UserStatus } from '@prisma/client';
import { IsEmail, IsEnum, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

/** Papéis atribuíveis no tenant — PLATFORM_ADMIN só via seed/ops. */
const TENANT_ROLES = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.SUPERVISOR,
  UserRole.EMPLOYEE,
] as const;

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email!: string;

  @IsIn(TENANT_ROLES)
  role!: (typeof TENANT_ROLES)[number];

  @IsString()
  @MinLength(8, { message: 'A senha deve ter pelo menos 8 caracteres.' })
  password!: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsIn(TENANT_ROLES)
  role?: (typeof TENANT_ROLES)[number];

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

export class ResetUserPasswordDto {
  @IsString()
  @MinLength(8, { message: 'A senha deve ter pelo menos 8 caracteres.' })
  password!: string;
}

export class ListUsersQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
