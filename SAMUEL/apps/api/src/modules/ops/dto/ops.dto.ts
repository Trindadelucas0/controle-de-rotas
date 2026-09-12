import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

export class OpsSnapshotQueryDto {
  /** Dia operacional YYYY-MM-DD (APP_TIMEZONE). Default: hoje. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;
}

export class OpsListEnrichedQueryDto extends OpsSnapshotQueryDto {
  @IsOptional()
  @IsString()
  q?: string;
}

export class PatchEmployeeObservationDto {
  @IsIn(['SEEN'])
  status!: 'SEEN';
}
