import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  MAX_CUSTOMER_REGION_SLIDER_METERS,
  MIN_CUSTOMER_REGION_RADIUS_METERS,
} from '../customer-region.util';

export class CreateCustomerRegionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsInt()
  @Min(MIN_CUSTOMER_REGION_RADIUS_METERS)
  @Max(MAX_CUSTOMER_REGION_SLIDER_METERS)
  radiusMeters!: number;
}

export class UpdateCustomerRegionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsInt()
  @Min(MIN_CUSTOMER_REGION_RADIUS_METERS)
  @Max(MAX_CUSTOMER_REGION_SLIDER_METERS)
  radiusMeters?: number;
}

export class NewCustomerRegionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(MIN_CUSTOMER_REGION_RADIUS_METERS)
  @Max(MAX_CUSTOMER_REGION_SLIDER_METERS)
  radiusMeters!: number;
}
