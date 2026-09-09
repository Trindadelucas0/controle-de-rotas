import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VisitOutcome, VisitStatus } from '@prisma/client';

export class CreateVisitDto {
  @IsDateString()
  scheduledStart!: string;

  @IsOptional()
  @IsDateString()
  scheduledEnd?: string;

  @IsOptional()
  @IsUUID('4')
  employeeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateVisitDto {
  @IsOptional()
  @IsDateString()
  scheduledStart?: string;

  @IsOptional()
  @IsDateString()
  scheduledEnd?: string | null;

  @IsOptional()
  @IsUUID('4')
  employeeId?: string | null;

  @IsOptional()
  @IsEnum(VisitStatus)
  status?: VisitStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class ListVisitsQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID('4')
  employeeId?: string;

  @IsOptional()
  @IsUUID('4')
  customerId?: string;

  @IsOptional()
  @IsUUID('4')
  serviceOrderId?: string;

  @IsOptional()
  @IsEnum(VisitStatus)
  status?: VisitStatus;
}

export class TrailPointDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  /** ISO datetime; se omitido o servidor usa agora. */
  @IsOptional()
  @IsString()
  recordedAt?: string;
}

export class CheckInVisitDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  accuracy!: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => TrailPointDto)
  trailPoints?: TrailPointDto[];
}

export class NextVisitDto {
  @IsDateString()
  scheduledStart!: string;

  @IsOptional()
  @IsDateString()
  scheduledEnd?: string;
}

export class CheckOutVisitDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  accuracy!: number;

  @IsEnum(VisitOutcome)
  outcome!: VisitOutcome;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  executionNotes?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => NextVisitDto)
  nextVisit?: NextVisitDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => TrailPointDto)
  trailPoints?: TrailPointDto[];
}
