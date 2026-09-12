import { RouteStatus, VehicleStatus } from '@prisma/client';
import {
  closeTestApp,
  createRouteInProgress,
  getTestApp,
  loginAs,
  TINY_JPEG,
} from './helpers';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('POST complete rota', () => {
  afterAll(async () => {
    await closeTestApp();
  });

  it('EMPLOYEE sem foto recebe ROUTE_EVIDENCE_REQUIRED', async () => {
    const fixture = await createRouteInProgress();
    const agent = await loginAs('EMPLOYEE');
    const res = await agent
      .post(`/api/v1/field/routes/${fixture.routeId}/complete`)
      .send({ mode: 'INCOMPLETE' });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('ROUTE_EVIDENCE_REQUIRED');
  });

  it('EMPLOYEE atribuído conclui via /field/routes/:id/complete com foto e km', async () => {
    const fixture = await createRouteInProgress();
    const agent = await loginAs('EMPLOYEE');
    const res = await agent
      .post(`/api/v1/field/routes/${fixture.routeId}/complete`)
      .field('mode', 'INCOMPLETE')
      .field('endOdometerKm', '130')
      .field('endFuelLevel', 'QUARTER')
      .attach('file', TINY_JPEG, { filename: 'odo.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(200);
    expect(res.body.route.status).toBe(RouteStatus.INCOMPLETE);
    expect(res.body.route.endOdometerKm).toBe(130);
  });

  it('ADMIN da empresa conclui rota travada sem foto (escritório)', async () => {
    const fixture = await createRouteInProgress();
    const admin = await loginAs('ADMIN');
    const res = await admin
      .post(`/api/v1/field/routes/${fixture.routeId}/complete`)
      .send({ mode: 'INCOMPLETE' });
    expect(res.status).toBe(200);
    expect(res.body.route.status).toBe(RouteStatus.INCOMPLETE);
  });

  it('outro EMPLOYEE 403 ROUTE_NOT_ASSIGNED', async () => {
    const fixture = await createRouteInProgress({ employee: 'primary' });
    const other = await loginAs('EMPLOYEE_OTHER');
    const res = await other
      .post(`/api/v1/field/routes/${fixture.routeId}/complete`)
      .send({ mode: 'INCOMPLETE' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ROUTE_NOT_ASSIGNED');
  });

  it('outro tenant 404', async () => {
    const fixture = await createRouteInProgress({ tenant: 'demo' });
    const outra = await loginAs('OUTRA_EMPLOYEE');
    const res = await outra
      .post(`/api/v1/field/routes/${fixture.routeId}/complete`)
      .send({ mode: 'INCOMPLETE' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('ROUTE_NOT_FOUND');
  });

  it('POST /routes/:id/complete com evidência para o atribuído', async () => {
    const fixture = await createRouteInProgress();
    const agent = await loginAs('EMPLOYEE');
    const res = await agent
      .post(`/api/v1/routes/${fixture.routeId}/complete`)
      .field('mode', 'INCOMPLETE')
      .field('endOdometerKm', '120')
      .field('endFuelLevel', 'HALF')
      .attach('file', TINY_JPEG, { filename: 'odo.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(200);
    expect(res.body.route.status).toBe(RouteStatus.INCOMPLETE);
  });

  it('401 sem cookie', async () => {
    const fixture = await createRouteInProgress();
    const nest = await getTestApp();
    const request = (await import('supertest')).default;
    const res = await request(nest.getHttpServer())
      .post(`/api/v1/field/routes/${fixture.routeId}/complete`)
      .send({ mode: 'INCOMPLETE' });
    expect(res.status).toBe(401);
  });

  it('km 30 vs 10 planejado conclui e cria observação só no admin', async () => {
    const fixture = await createRouteInProgress();
    const agent = await loginAs('EMPLOYEE');
    const complete = await agent
      .post(`/api/v1/field/routes/${fixture.routeId}/complete`)
      .field('mode', 'INCOMPLETE')
      .field('endOdometerKm', '130')
      .field('endFuelLevel', 'QUARTER')
      .attach('file', TINY_JPEG, { filename: 'odo.jpg', contentType: 'image/jpeg' });
    expect(complete.status).toBe(200);

    const empObs = await agent.get(
      `/api/v1/ops/employees/${fixture.employeeId}/observations`,
    );
    expect(empObs.status).toBe(403);

    const admin = await loginAs('ADMIN');
    const list = await admin.get(
      `/api/v1/ops/employees/${fixture.employeeId}/observations`,
    );
    expect(list.status).toBe(200);
    const codes = (list.body.observations as { code: string }[]).map((o) => o.code);
    expect(codes).toContain('KM_DISCREPANCY');
  });

  it('veículo volta AVAILABLE ao concluir', async () => {
    const fixture = await createRouteInProgress();
    const nest = await getTestApp();
    const prisma = nest.get(PrismaService);
    const before = await prisma.route.findFirst({
      where: { id: fixture.routeId },
      select: { vehicleId: true },
    });
    const agent = await loginAs('EMPLOYEE');
    await agent
      .post(`/api/v1/field/routes/${fixture.routeId}/complete`)
      .field('mode', 'INCOMPLETE')
      .field('endOdometerKm', '105')
      .field('endFuelLevel', 'HALF')
      .attach('file', TINY_JPEG, { filename: 'odo.jpg', contentType: 'image/jpeg' });
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: before?.vehicleId ?? '' },
    });
    expect(vehicle?.status).toBe(VehicleStatus.AVAILABLE);
    expect(vehicle?.odometerKm).toBe(105);
  });
});
