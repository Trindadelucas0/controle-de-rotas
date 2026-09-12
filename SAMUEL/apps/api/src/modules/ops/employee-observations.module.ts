import { Module } from '@nestjs/common';
import { EmployeeObservationsService } from './employee-observations.service';

@Module({
  providers: [EmployeeObservationsService],
  exports: [EmployeeObservationsService],
})
export class EmployeeObservationsModule {}
