import { PrismaService } from '../src/common/prisma/prisma.service';
import { VisitStatus } from '@prisma/client';
import {
  closeTestApp,
  createRouteInProgress,
  getTestApp,
  loginAs,
  postGps,
} from './helpers';
import { DEMO_COMPANY_ID } from './fixtures';

const GPS = { latitude: -23.5505, longitude: -46.6333, accuracy: 8 };

describe('POST /api/v1/visits/:id/check-in', () => {
  afterAll(async () => {
    await closeTestApp();
  });

  it('201 grava coords, timestamp, evento e visita IN_PROGRESS; stop permanece PENDING', async () => {
    const fixture = await createRouteInProgress();
    const agent = await loginAs('EMPLOYEE');

    const res = await agent.post(`/api/v1/visits/${fixture.visitId}/check-in`).send(GPS);

    expect(res.status).toBe(201);
    expect(res.body.visit.status).toBe('IN_PROGRESS');
    expect(res.body.visit.checkedInAt).toBeTruthy();
    expect(res.body.visit.checkedInLat).toBeCloseTo(GPS.latitude, 5);
    expect(res.body.visit.checkedInLng).toBeCloseTo(GPS.longitude, 5);
    expect(res.body.visit.checkedInAccuracy).toBe(GPS.accuracy);
    expect(res.body.visit.routeStop.status).toBe('PENDING');

    const prisma = (await getTestApp()).get(PrismaService);
    const event = await prisma.visitEvent.findFirst({
      where: { visitId: fixture.visitId, companyId: DEMO_COMPANY_ID, type: 'CHECK_IN' },
    });
    expect(event).toBeTruthy();
    const audit = await prisma.auditLog.findFirst({
      where: { entityId: fixture.visitId, action: 'VISIT_CHECKED_IN', companyId: DEMO_COMPANY_ID },
    });
    expect(audit).toBeTruthy();
  });

  it('401 sem cookie', async () => {
    const fixture = await createRouteInProgress();
    const nest = await getTestApp();
    const request = (await import('supertest')).default;
    const res = await request(nest.getHttpServer())
      .post(`/api/v1/visits/${fixture.visitId}/check-in`)
      .send(GPS);
    expect(res.status).toBe(401);
  });

  it('403 outro EMPLOYEE da mesma empresa', async () => {
    const fixture = await createRouteInProgress({ employee: 'primary' });
    const other = await loginAs('EMPLOYEE_OTHER');
    const res = await other.post(`/api/v1/visits/${fixture.visitId}/check-in`).send(GPS);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('VISIT_FORBIDDEN');
  });

  it('403 ADMIN não faz check-in', async () => {
    const fixture = await createRouteInProgress();
    const admin = await loginAs('ADMIN');
    const res = await admin.post(`/api/v1/visits/${fixture.visitId}/check-in`).send(GPS);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTH_FORBIDDEN');
  });

  it('404 outro tenant', async () => {
    const fixture = await createRouteInProgress({ tenant: 'demo' });
    const outra = await loginAs('OUTRA_EMPLOYEE');
    const res = await outra.post(`/api/v1/visits/${fixture.visitId}/check-in`).send(GPS);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('VISIT_NOT_FOUND');
  });

  it('409 segundo check-in', async () => {
    const fixture = await createRouteInProgress();
    const agent = await loginAs('EMPLOYEE');
    const first = await agent.post(`/api/v1/visits/${fixture.visitId}/check-in`).send(GPS);
    expect(first.status).toBe(201);
    const second = await agent.post(`/api/v1/visits/${fixture.visitId}/check-in`).send(GPS);
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('VISIT_ALREADY_CHECKED_IN');
  });

  it('422 rota não IN_PROGRESS', async () => {
    const fixture = await createRouteInProgress();
    const prisma = (await getTestApp()).get(PrismaService);
    await prisma.route.update({
      where: { id: fixture.routeId },
      data: { status: 'PUBLISHED' },
    });
    const agent = await loginAs('EMPLOYEE');
    const res = await agent.post(`/api/v1/visits/${fixture.visitId}/check-in`).send(GPS);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('ROUTE_NOT_IN_PROGRESS');
  });

  it('422 visita COMPLETED', async () => {
    const fixture = await createRouteInProgress({ visitStatus: VisitStatus.COMPLETED });
    const agent = await loginAs('EMPLOYEE');
    const res = await agent.post(`/api/v1/visits/${fixture.visitId}/check-in`).send(GPS);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VISIT_CHECKIN_NOT_ALLOWED');
  });

  it('snapshot team.inService e operational IN_SERVICE após check-in', async () => {
    const fixture = await createRouteInProgress();
    const employee = await loginAs('EMPLOYEE');
    await postGps(employee, fixture);
    const check = await employee.post(`/api/v1/visits/${fixture.visitId}/check-in`).send(GPS);
    expect(check.status).toBe(201);

    const admin = await loginAs('ADMIN');
    const snap = await admin.get('/api/v1/ops/snapshot');
    expect(snap.status).toBe(200);
    expect(snap.body.meta.inServiceAvailable).toBe(true);
    expect(snap.body.team.inService).toBeGreaterThanOrEqual(1);
    const row = snap.body.live.find((r: { employeeId: string }) => r.employeeId === fixture.employeeId);
    expect(row).toBeTruthy();
    expect(row.operational).toBe('IN_SERVICE');
  });
});
