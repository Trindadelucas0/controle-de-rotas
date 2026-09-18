import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FuelController } from './fuel.controller';
import { FuelService } from './fuel.service';
import { FuelRepository } from './fuel.repository';

@Module({
  imports: [AuthModule],
  controllers: [FuelController],
  providers: [FuelService, FuelRepository],
  exports: [FuelService],
})
export class FuelModule {}
