import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class MyRouteQueryDto {
  /** YYYY-MM-DD — default: dia operacional (APP_TIMEZONE, ex. America/Sao_Paulo) */
  @IsOptional()
  @IsDateString()
  date?: string;
}

export class FieldVehiclesQueryDto {
  @IsOptional()
  @IsUUID('4')
  routeId?: string;
}
