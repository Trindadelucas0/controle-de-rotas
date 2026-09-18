import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FuelPaymentMethod } from '@prisma/client';

export class CreateFuelFillDto {
  @IsUUID('4')
  vehicleId!: string;

  @IsDateString()
  occurredAt!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  odometerKm!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  liters!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pricePerLiter!: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  fuelType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  station?: string;

  @IsOptional()
  @IsEnum(FuelPaymentMethod)
  paymentMethod?: FuelPaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  receiptRef?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateFuelFillDto {
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  odometerKm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  liters?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pricePerLiter?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  fuelType?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  station?: string | null;

  @IsOptional()
  @IsEnum(FuelPaymentMethod)
  paymentMethod?: FuelPaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  receiptRef?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class ListFuelFillsQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID('4')
  vehicleId?: string;

  @IsOptional()
  @IsString()
  fuelType?: string;

  @IsOptional()
  @IsString()
  station?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}
