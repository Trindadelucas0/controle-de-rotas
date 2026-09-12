import { RouteStatus, VisitStatus } from '@prisma/client';
import {
  closeTestApp,
  createRouteInProgress,
  getTestApp,
  loginAs,
} from './helpers';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('DELETE /api/v1/routes/:id', () => {
  afterAll(async () => {
    await closeTestApp();
  });

  async function markPublished(routeId: string) {
    const nest = await getTestApp();
    const prisma = nest.get(PrismaService);
    await prisma.route.update({
      where: { id: routeId },
      data: { status: RouteStatus.PUBLISHED, startedAt: null },
    });
  }

  it('ADMIN exclui rota publicada e libera visitas ASSIGNED', async () => {
    const fixture = await createRouteInProgress();
    await markPublished(fixture.routeId);
    const admin = await loginAs('ADMIN');
    const res = await admin.delete(`/api/v1/routes/${fixture.routeId}`);
    expect(res.status).toBe(204);

    const nest = await getTestApp();
    const prisma = nest.get(PrismaService);
    const route = await prisma.route.findFirst({ where: { id: fixture.routeId } });
    expect(route).toBeNull();
    const visit = await prisma.visit.findFirst({ where: { id: fixture.visitId } });
    expect(visit?.status).toBe(VisitStatus.SCHEDULED);
    expect(visit?.employeeId).toBeNull();
  });

  it('ADMIN não exclui rota IN_PROGRESS', async () => {
    const fixture = await createRouteInProgress();
    const admin = await loginAs('ADMIN');
    const res = await admin.delete(`/api/v1/routes/${fixture.routeId}`);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('ROUTE_IN_PROGRESS');
  });

  it('EMPLOYEE 403', async () => {
    const fixture = await createRouteInProgress();
    await markPublished(fixture.routeId);
    const employee = await loginAs('EMPLOYEE');
    const res = await employee.delete(`/api/v1/routes/${fixture.routeId}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTH_FORBIDDEN');
  });

  it('outro tenant 404', async () => {
    const fixture = await createRouteInProgress({ tenant: 'demo' });
    await markPublished(fixture.routeId);
    const outra = await loginAs('OUTRA_ADMIN');
    const res = await outra.delete(`/api/v1/routes/${fixture.routeId}`);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('ROUTE_NOT_FOUND');
  });

  it('401 sem cookie', async () => {
    const fixture = await createRouteInProgress();
    await markPublished(fixture.routeId);
    const nest = await getTestApp();
    const request = (await import('supertest')).default;
    const res = await request(nest.getHttpServer()).delete(
      `/api/v1/routes/${fixture.routeId}`,
    );
    expect(res.status).toBe(401);
  });
});
