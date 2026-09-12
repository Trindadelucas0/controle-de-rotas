import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmployeeObservationsModule } from '../ops/employee-observations.module';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';

@Module({
  imports: [AuthModule, EmployeeObservationsModule],
  controllers: [TrackingController],
  providers: [TrackingService],
  exports: [TrackingService],
})
export class TrackingModule {}
