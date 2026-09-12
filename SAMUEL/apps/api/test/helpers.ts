import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { businessDayUtc } from '../src/common/date/business-day';
import {
  DEMO_COMPANY_ID,
  OUTRA_COMPANY_ID,
  TEST_PASSWORD,
  TEST_USERS,
  type TestLoginRole,
} from './fixtures';
import {
  CustomerStatus,
  EmployeeStatus,
  LocationStatus,
  RouteStatus,
  RouteStopStatus,
  ServiceOrderStatus,
  VehicleStatus,
  VisitStatus,
} from '@prisma/client';

let app: INestApplication | null = null;
const agents = new Map<TestLoginRole, ReturnType<typeof request.agent>>();

export async function getTestApp(): Promise<INestApplication> {
  if (app) return app;
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  return app;
}

export async function closeTestApp(): Promise<void> {
  agents.clear();
  if (app) {
    await app.close();
    app = null;
  }
}

export async function loginAs(role: TestLoginRole) {
  const cached = agents.get(role);
  if (cached) return cached;
  const nest = await getTestApp();
  const agent = request.agent(nest.getHttpServer());
  const res = await agent.post('/api/v1/auth/login').send({
    email: TEST_USERS[role],
    password: TEST_PASSWORD,
  });
  if (res.status !== 200) {
    throw new Error(`loginAs(${role}) falhou: ${res.status} ${JSON.stringify(res.body)}`);
  }
  agents.set(role, agent);
  return agent;
}

export type CreatedRouteFixture = {
  companyId: string;
  employeeId: string;
  visitId: string;
  routeId: string;
  stopId: string;
  customerId: string;
  latitude: number;
  longitude: number;
};

export async function createRouteInProgress(opts?: {
  tenant?: 'demo' | 'outra';
  employee?: 'primary' | 'other';
  visitStatus?: VisitStatus;
}): Promise<CreatedRouteFixture> {
  const nest = await getTestApp();
  const prisma = nest.get(PrismaService);
  const companyId = opts?.tenant === 'outra' ? OUTRA_COMPANY_ID : DEMO_COMPANY_ID;

  const employeeEmail =
    opts?.tenant === 'outra'
      ? TEST_USERS.OUTRA_EMPLOYEE
      : opts?.employee === 'other'
        ? TEST_USERS.EMPLOYEE_OTHER
        : TEST_USERS.EMPLOYEE;

  const user = await prisma.user.findUnique({ where: { email: employeeEmail } });
  if (!user) throw new Error(`Usuário de teste ausente: ${employeeEmail}`);
  const employee = await prisma.employee.findFirst({
    where: { companyId, userId: user.id, status: EmployeeStatus.ACTIVE },
  });
  if (!employee) throw new Error(`Employee de teste ausente: ${employeeEmail}`);

  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const latitude = -23.5505;
  const longitude = -46.6333;

  const customer = await prisma.customer.create({
    data: {
      companyId,
      name: `Cliente Teste ${suffix}`,
      street: 'Rua Teste',
      number: '100',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01000-000',
      latitude,
      longitude,
      locationStatus: LocationStatus.OK,
      status: CustomerStatus.ACTIVE,
    },
  });

  const lastSo = await prisma.serviceOrder.findFirst({
    where: { companyId },
    orderBy: { number: 'desc' },
    select: { number: true },
  });

  const serviceOrder = await prisma.serviceOrder.create({
    data: {
      companyId,
      customerId: customer.id,
      number: (lastSo?.number ?? 2000) + 1,
      title: `OS teste ${suffix}`,
      status: ServiceOrderStatus.IN_PROGRESS,
    },
  });

  const visit = await prisma.visit.create({
    data: {
      companyId,
      serviceOrderId: serviceOrder.id,
      customerId: customer.id,
      employeeId: employee.id,
      scheduledStart: new Date(),
      status: opts?.visitStatus ?? VisitStatus.ASSIGNED,
      street: 'Rua Teste',
      number: '100',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01000-000',
      latitude,
      longitude,
    },
  });

  const vehicle = await prisma.vehicle.create({
    data: {
      companyId,
      plate: `T${suffix.slice(-7).toUpperCase()}`,
      brand: 'Test',
      model: 'Van',
      status: VehicleStatus.IN_USE,
      odometerKm: 100,
      lastFuelLevel: 'HALF',
    },
  });

  const route = await prisma.route.create({
    data: {
      companyId,
      employeeId: employee.id,
      vehicleId: vehicle.id,
      date: businessDayUtc(),
      status: RouteStatus.IN_PROGRESS,
      originLatitude: latitude,
      originLongitude: longitude,
      originName: 'Base teste',
      startedAt: new Date(),
      startOdometerKm: 100,
      startFuelLevel: 'HALF',
      plannedDistanceMeters: 10_000,
    },
  });

  const stop = await prisma.routeStop.create({
    data: {
      companyId,
      routeId: route.id,
      visitId: visit.id,
      sequence: 1,
      status: RouteStopStatus.PENDING,
      latitude,
      longitude,
    },
  });

  return {
    companyId,
    employeeId: employee.id,
    visitId: visit.id,
    routeId: route.id,
    stopId: stop.id,
    customerId: customer.id,
    latitude,
    longitude,
  };
}

/** JPEG mínimo (SOI+EOI) para upload de evidência em testes. */
export const TINY_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

export async function postGps(
  agent: ReturnType<typeof request.agent>,
  fixture: CreatedRouteFixture,
  coords?: { latitude: number; longitude: number; accuracy?: number },
) {
  const res = await agent.post('/api/v1/tracking/points').send({
    points: [
      {
        routeId: fixture.routeId,
        latitude: coords?.latitude ?? fixture.latitude,
        longitude: coords?.longitude ?? fixture.longitude,
        accuracy: coords?.accuracy ?? 12,
      },
    ],
  });
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`postGps falhou: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res;
}
