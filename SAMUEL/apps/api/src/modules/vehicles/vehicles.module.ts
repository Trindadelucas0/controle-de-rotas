import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { VehiclesRepository } from './vehicles.repository';

@Module({
  imports: [AuthModule],
  controllers: [VehiclesController],
  providers: [VehiclesService, VehiclesRepository],
  exports: [VehiclesService],
})
export class VehiclesModule {}
