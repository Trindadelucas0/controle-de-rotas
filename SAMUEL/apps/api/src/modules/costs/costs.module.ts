import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CostsController } from './costs.controller';
import { CostsService } from './costs.service';

@Module({
  imports: [AuthModule],
  controllers: [CostsController],
  providers: [CostsService],
  exports: [CostsService],
})
export class CostsModule {}
