import { VehicleStatus } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateVehicleDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(16)
  plate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  model?: string | null;

  @IsOptional()
  @IsInt()
  year?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  fuelType?: string | null;

  @IsOptional()
  @IsNumber()
  avgConsumption?: number | null;

  @IsOptional()
  @IsNumber()
  capacity?: number | null;

  @IsOptional()
  @IsNumber()
  odometerKm?: number | null;

  @IsOptional()
  @IsEnum(VehicleStatus)
  status?: VehicleStatus;
}

export class UpdateVehicleDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(16)
  plate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  model?: string | null;

  @IsOptional()
  @IsInt()
  year?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  fuelType?: string | null;

  @IsOptional()
  @IsNumber()
  avgConsumption?: number | null;

  @IsOptional()
  @IsNumber()
  capacity?: number | null;

  @IsOptional()
  @IsNumber()
  odometerKm?: number | null;

  @IsOptional()
  @IsEnum(VehicleStatus)
  status?: VehicleStatus;
}

export class ListVehiclesQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(VehicleStatus)
  status?: VehicleStatus;
}
