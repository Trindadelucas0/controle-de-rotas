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
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TrailPointDto } from '../../visits/dto/visits.dto';

export const ROUTE_ORIGIN_MODES = ['EMPLOYEE_LAST', 'COMPANY'] as const;
export type RouteOriginMode = (typeof ROUTE_ORIGIN_MODES)[number];

export class PreviewRouteDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(25)
  @IsUUID('4', { each: true })
  visitIds!: string[];

  @IsOptional()
  @IsBoolean()
  roundtrip?: boolean;

  /** Aceito e ignorado no preview por visitas (origem fixa = empresa). */
  @IsOptional()
  @IsIn([...ROUTE_ORIGIN_MODES])
  originMode?: RouteOriginMode;
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

  /** Aceito e ignorado no create/update (origem calculada no servidor). */
  @IsOptional()
  @IsIn([...ROUTE_ORIGIN_MODES])
  originMode?: RouteOriginMode;

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

/** ADMIN/MANAGER: altera rota ainda não iniciada (PLANNED | PUBLISHED). */
export class UpdateRouteDto extends CreateRouteDto {}

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

  /** Grava trilha real até cada cliente no Cheguei; aplica a todas as rotas do lote. */
  @IsOptional()
  @IsBoolean()
  recordTrip?: boolean;

  /** Início do km/tempo: última localização do funcionário (padrão) ou pin da empresa. */
  @IsOptional()
  @IsIn([...ROUTE_ORIGIN_MODES])
  originMode?: RouteOriginMode;
}

export class DispatchCustomersRouteDto extends PreviewCustomersRouteDto {
  /** Redeclarado: Nest whitelist + extends vazio às vezes ignora o campo do pai. */
  @IsOptional()
  @IsIn([...ROUTE_ORIGIN_MODES])
  declare originMode?: RouteOriginMode;
}
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

export const ROUTE_COMPLETE_MODES = ['COMPLETED', 'INCOMPLETE'] as const;
export type RouteCompleteMode = (typeof ROUTE_COMPLETE_MODES)[number];

export class CompleteRouteDto {
  @IsIn([...ROUTE_COMPLETE_MODES])
  mode!: RouteCompleteMode;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  endOdometerKm?: number;

  @IsOptional()
  @IsString()
  @IsIn([...ROUTE_START_FUEL_LEVELS])
  endFuelLevel?: RouteStartFuelLevel;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  endLatitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  endLongitude?: number;
}

export class DispatchRecordMissionDto {
  @IsDateString()
  date!: string;

  @IsUUID('4')
  employeeId!: string;

  @IsUUID('4')
  vehicleId!: string;
}

export class RecordPointCustomerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  document?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  whatsapp?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  state?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  street?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class RecordPointDto {
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

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  accuracy?: number;

  @IsOptional()
  @IsBoolean()
  completeProfile?: boolean;

  @ValidateNested()
  @Type(() => RecordPointCustomerDto)
  customer!: RecordPointCustomerDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => TrailPointDto)
  trailPoints?: TrailPointDto[];
}
