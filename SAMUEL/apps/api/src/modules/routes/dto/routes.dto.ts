import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PreviewRouteDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(25)
  @IsUUID('4', { each: true })
  visitIds!: string[];

  @IsOptional()
  @IsBoolean()
  roundtrip?: boolean;
}

export class CreateRouteStopDto {
  @IsUUID('4')
  visitId!: string;

  @IsInt()
  @Min(1)
  sequence!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  distanceMeters?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;
}

export class CreateRouteDto {
  @IsDateString()
  date!: string;

  @IsUUID('4')
  employeeId!: string;

  @IsUUID('4')
  vehicleId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(25)
  @ValidateNested({ each: true })
  @Type(() => CreateRouteStopDto)
  stops!: CreateRouteStopDto[];

  @IsOptional()
  @IsBoolean()
  roundtrip?: boolean;

  @IsOptional()
  @IsBoolean()
  recordTrip?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  plannedDistanceMeters?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  plannedDurationSeconds?: number;

  @IsOptional()
  @IsObject()
  geometry?: { type: 'LineString'; coordinates: [number, number][] };

  @IsOptional()
  @IsString()
  quality?: string;
}

export class ListRoutesQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsUUID('4')
  employeeId?: string;
}

export class PreviewCustomersRouteDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(25)
  @IsUUID('4', { each: true })
  customerIds!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @IsUUID('4', { each: true })
  employeeIds!: string[];

  @IsOptional()
  @IsBoolean()
  roundtrip?: boolean;

  @IsOptional()
  @IsDateString()
  date?: string;

  /** Grava trilha real até o cliente; exige exatamente 1 cliente. */
  @IsOptional()
  @IsBoolean()
  recordTrip?: boolean;
}

export class DispatchCustomersRouteDto extends PreviewCustomersRouteDto {}

export const ROUTE_START_FUEL_LEVELS = [
  'EMPTY',
  'QUARTER',
  'HALF',
  'THREE_QUARTERS',
  'FULL',
] as const;

export type RouteStartFuelLevel = (typeof ROUTE_START_FUEL_LEVELS)[number];

export class StartRouteDto {
  @IsUUID('4')
  vehicleId!: string;

  @IsNumber()
  @Min(0.1)
  startOdometerKm!: number;

  @IsString()
  @IsIn([...ROUTE_START_FUEL_LEVELS])
  startFuelLevel!: RouteStartFuelLevel;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  startNotes?: string;

  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;
}

/** Recalcula geometria/manobras a partir da posição GPS atual (navegação). */
export class RerouteRouteDto {
  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;

  /** Se true, reordena paradas pendentes mais perto → mais longe. */
  @IsBoolean()
  reorderRemaining!: boolean;
}
