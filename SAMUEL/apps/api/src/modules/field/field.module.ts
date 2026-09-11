import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RoutesModule } from '../routes/routes.module';
import { FieldController } from './field.controller';
import { FieldService } from './field.service';

@Module({
  imports: [AuthModule, RoutesModule],
  controllers: [FieldController],
  providers: [FieldService],
})
export class FieldModule {}
