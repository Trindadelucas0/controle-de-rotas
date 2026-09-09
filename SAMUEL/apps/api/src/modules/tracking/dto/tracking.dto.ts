import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TrackingPointDto {
  @IsUUID('4')
  routeId!: string;

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

  /** Opcional; null/undefined/NaN são ignorados (não rejeitam o ponto). */
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  accuracy?: number | null;

  /** m/s do Geolocation — só no Redis (live); histórico PostGIS não exige. */
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @Type(() => Number)
  @IsNumber()
  speed?: number | null;

  /** graus 0–360 */
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(360)
  heading?: number | null;

  /** ISO datetime; default = now */
  @IsOptional()
  @IsString()
  recordedAt?: string;
}

export class PostTrackingPointsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TrackingPointDto)
  points!: TrackingPointDto[];
}
