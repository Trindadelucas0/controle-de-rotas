import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MapModule } from '../map/map.module';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { CustomersRepository } from './customers.repository';

@Module({
  imports: [AuthModule, MapModule],
  controllers: [CustomersController],
  providers: [CustomersService, CustomersRepository],
  exports: [CustomersService],
})
export class CustomersModule {}
