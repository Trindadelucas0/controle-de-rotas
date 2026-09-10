import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCompanyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  tradeName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  document?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const t = value.trim().toLowerCase();
    return t.length ? t : null;
  })
  @IsEmail({}, { message: 'Informe um e-mail válido da empresa.' })
  @MaxLength(255)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  adminName!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Informe um e-mail válido do administrador.' })
  @MaxLength(255)
  adminEmail!: string;

  @IsString()
  @MinLength(8, { message: 'A senha deve ter pelo menos 8 caracteres.' })
  adminPassword!: string;
}
