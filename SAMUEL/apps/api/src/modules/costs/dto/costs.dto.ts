import { Type, Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsNumber, IsOptional, IsUUID, Min, ValidateIf } from 'class-validator';

export class CostsQueryDto {
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
  @IsUUID('4')
  employeeId?: string;

  @IsOptional()
  fuelType?: string;
}

export class CostSettingsDto {
  @IsOptional()
  @Transform(({ value }) => (value === null || value === '' ? null : value))
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  referenceFuelPricePerLiter?: number | null;

  @IsOptional()
  @IsBoolean()
  fuelReceiptRequired?: boolean;
}
