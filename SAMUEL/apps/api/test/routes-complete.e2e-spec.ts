import { RouteStatus } from '@prisma/client';
import {
  closeTestApp,
  createRouteInProgress,
  getTestApp,
  loginAs,
} from './helpers';

describe('POST complete rota', () => {
  afterAll(async () => {
    await closeTestApp();
  });

  it('EMPLOYEE atribuído conclui via /field/routes/:id/complete', async () => {
    const fixture = await createRouteInProgress();
    const agent = await loginAs('EMPLOYEE');
    const res = await agent
      .post(`/api/v1/field/routes/${fixture.routeId}/complete`)
      .send({ mode: 'INCOMPLETE' });
    expect(res.status).toBe(200);
    expect(res.body.route.status).toBe(RouteStatus.INCOMPLETE);
  });

  it('ADMIN da empresa conclui rota travada (não precisa ser EMPLOYEE)', async () => {
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

  it('POST /routes/:id/complete continua válido para o atribuído', async () => {
    const fixture = await createRouteInProgress();
    const agent = await loginAs('EMPLOYEE');
    const res = await agent
      .post(`/api/v1/routes/${fixture.routeId}/complete`)
      .send({ mode: 'INCOMPLETE' });
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
});
