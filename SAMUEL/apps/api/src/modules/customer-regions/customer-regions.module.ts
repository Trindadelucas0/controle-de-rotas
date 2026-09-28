import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CustomerRegionsController } from './customer-regions.controller';
import { CustomerRegionsService } from './customer-regions.service';

@Module({
  imports: [AuthModule],
  controllers: [CustomerRegionsController],
  providers: [CustomerRegionsService],
  exports: [CustomerRegionsService],
})
export class CustomerRegionsModule {}
