import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ServiceOrderPriority, ServiceOrderStatus } from '@prisma/client';

export class CreateVisitInlineDto {
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

export class CreateServiceOrderDto {
  @IsUUID('4')
  customerId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsEnum(ServiceOrderPriority)
  priority?: ServiceOrderPriority;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateVisitInlineDto)
  firstVisit?: CreateVisitInlineDto;
}

export class UpdateServiceOrderDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @IsOptional()
  @IsEnum(ServiceOrderPriority)
  priority?: ServiceOrderPriority;

  @IsOptional()
  @IsEnum(ServiceOrderStatus)
  status?: ServiceOrderStatus;

  @IsOptional()
  @IsDateString()
  dueAt?: string | null;
}

export class ListServiceOrdersQueryDto {
  @IsOptional()
  @IsUUID('4')
  customerId?: string;

  @IsOptional()
  @IsEnum(ServiceOrderStatus)
  status?: ServiceOrderStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
