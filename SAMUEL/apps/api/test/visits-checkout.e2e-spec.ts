import { PrismaService } from '../src/common/prisma/prisma.service';
import { RouteStopStatus, VisitStatus } from '@prisma/client';
import {
  closeTestApp,
  createRouteInProgress,
  getTestApp,
  loginAs,
} from './helpers';
import { DEMO_COMPANY_ID } from './fixtures';

const GPS = { latitude: -23.5505, longitude: -46.6333, accuracy: 8 };

/** 1x1 PNG */
const PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function checkInVisit(agent: Awaited<ReturnType<typeof loginAs>>, visitId: string) {
  return agent.post(`/api/v1/visits/${visitId}/check-in`).send(GPS);
}

async function uploadEvidence(agent: Awaited<ReturnType<typeof loginAs>>, visitId: string) {
  return agent
    .post(`/api/v1/visits/${visitId}/evidence`)
    .attach('file', PNG_BUFFER, { filename: 'proof.png', contentType: 'image/png' });
}

describe('POST /api/v1/visits/:id/check-out', () => {
  afterAll(async () => {
    await closeTestApp();
  });

  it('201 finaliza visita DONE, atualiza parada e exige foto', async () => {
    const fixture = await createRouteInProgress();
    const agent = await loginAs('EMPLOYEE');
    await checkInVisit(agent, fixture.visitId);
    const noPhoto = await agent.post(`/api/v1/visits/${fixture.visitId}/check-out`).send({
      ...GPS,
      outcome: 'DONE',
      executionNotes: 'Visita ok',
    });
    expect(noPhoto.status).toBe(422);
    expect(noPhoto.body.code).toBe('VISIT_EVIDENCE_REQUIRED');

    await uploadEvidence(agent, fixture.visitId);
    const res = await agent.post(`/api/v1/visits/${fixture.visitId}/check-out`).send({
      ...GPS,
      outcome: 'DONE',
      executionNotes: 'Visita ok',
    });
    expect(res.status).toBe(201);
    expect(res.body.visit.status).toBe('COMPLETED');
    expect(res.body.visit.outcome).toBe('DONE');
    expect(res.body.visit.checkedOutAt).toBeTruthy();

    const prisma = (await getTestApp()).get(PrismaService);
    const stop = await prisma.routeStop.findUnique({ where: { id: fixture.stopId } });
    expect(stop?.status).toBe(RouteStopStatus.COMPLETED);
  });

  it('201 FOLLOW_UP cria próxima visita ASSIGNED', async () => {
    const fixture = await createRouteInProgress();
    const agent = await loginAs('EMPLOYEE');
    await checkInVisit(agent, fixture.visitId);

    const nextStart = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const res = await agent.post(`/api/v1/visits/${fixture.visitId}/check-out`).send({
      ...GPS,
      outcome: 'FOLLOW_UP',
      executionNotes: 'Cliente pediu retorno',
      nextVisit: { scheduledStart: nextStart },
    });
    expect(res.status).toBe(201);
    expect(res.body.nextVisit).toBeTruthy();
    expect(res.body.nextVisit.status).toBe('ASSIGNED');

    const prisma = (await getTestApp()).get(PrismaService);
    const count = await prisma.visit.count({
      where: { serviceOrderId: res.body.visit.serviceOrderId, companyId: DEMO_COMPANY_ID },
    });
    expect(count).toBe(2);
  });

  it('403 outro EMPLOYEE', async () => {
    const fixture = await createRouteInProgress();
    const owner = await loginAs('EMPLOYEE');
    await checkInVisit(owner, fixture.visitId);
    await uploadEvidence(owner, fixture.visitId);
    const other = await loginAs('EMPLOYEE_OTHER');
    const res = await other.post(`/api/v1/visits/${fixture.visitId}/check-out`).send({
      ...GPS,
      outcome: 'DONE',
    });
    expect(res.status).toBe(403);
  });

  it('409 segundo check-out', async () => {
    const fixture = await createRouteInProgress();
    const agent = await loginAs('EMPLOYEE');
    await checkInVisit(agent, fixture.visitId);
    await uploadEvidence(agent, fixture.visitId);
    const first = await agent.post(`/api/v1/visits/${fixture.visitId}/check-out`).send({
      ...GPS,
      outcome: 'DONE',
    });
    expect(first.status).toBe(201);
    const second = await agent.post(`/api/v1/visits/${fixture.visitId}/check-out`).send({
      ...GPS,
      outcome: 'DONE',
    });
    expect(second.status).toBe(409);
  });

  it('422 check-out sem check-in', async () => {
    const fixture = await createRouteInProgress({ visitStatus: VisitStatus.ASSIGNED });
    const agent = await loginAs('EMPLOYEE');
    const res = await agent.post(`/api/v1/visits/${fixture.visitId}/check-out`).send({
      ...GPS,
      outcome: 'NO_CONTACT',
      executionNotes: 'Ninguém atendeu',
    });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VISIT_CHECKIN_REQUIRED');
  });
});

describe('POST /api/v1/visits/:id/evidence', () => {
  afterAll(async () => {
    await closeTestApp();
  });

  it('201 upload JPEG/PNG válido', async () => {
    const fixture = await createRouteInProgress();
    const agent = await loginAs('EMPLOYEE');
    await checkInVisit(agent, fixture.visitId);
    const res = await uploadEvidence(agent, fixture.visitId);
    expect(res.status).toBe(201);
    expect(res.body.evidence.mimeType).toBe('image/png');
  });

  it('422 MIME inválido', async () => {
    const fixture = await createRouteInProgress();
    const agent = await loginAs('EMPLOYEE');
    await checkInVisit(agent, fixture.visitId);
    const res = await agent
      .post(`/api/v1/visits/${fixture.visitId}/evidence`)
      .attach('file', Buffer.from('<html></html>'), {
        filename: 'bad.html',
        contentType: 'text/html',
      });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VISIT_EVIDENCE_INVALID_TYPE');
  });

  it('404 IDOR arquivo de outro tenant', async () => {
    const fixture = await createRouteInProgress({ tenant: 'demo' });
    const agent = await loginAs('EMPLOYEE');
    await checkInVisit(agent, fixture.visitId);
    const up = await uploadEvidence(agent, fixture.visitId);
    const evidenceId = up.body.evidence.id;

    const outra = await loginAs('OUTRA_EMPLOYEE');
    const res = await outra.get(
      `/api/v1/visits/${fixture.visitId}/evidence/${evidenceId}/file`,
    );
    expect(res.status).toBe(404);
  });
});
