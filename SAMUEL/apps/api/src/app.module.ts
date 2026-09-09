import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { StorageModule } from './common/storage/storage.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { UsersModule } from './modules/users/users.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { CustomersModule } from './modules/customers/customers.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { MapModule } from './modules/map/map.module';
import { LookupsModule } from './modules/lookups/lookups.module';
import { RoutesModule } from './modules/routes/routes.module';
import { ServiceOrdersModule } from './modules/service-orders/service-orders.module';
import { VisitsModule } from './modules/visits/visits.module';
import { FieldModule } from './modules/field/field.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { OpsModule } from './modules/ops/ops.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    RedisModule,
    StorageModule,
    HealthModule,
    AuthModule,
    CompaniesModule,
    UsersModule,
    EmployeesModule,
    CustomersModule,
    VehiclesModule,
    MapModule,
    LookupsModule,
    RoutesModule,
    ServiceOrdersModule,
    VisitsModule,
    FieldModule,
    TrackingModule,
    OpsModule,
  ],
})
export class AppModule {}
