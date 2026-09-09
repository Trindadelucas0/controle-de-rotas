import { evaluateVisitCheckIn } from '../src/modules/visits/visit-state';

const base = {
  visitFoundInTenant: true,
  visitStatus: 'ASSIGNED',
  checkedInAt: null as Date | null,
  visitEmployeeId: 'emp-1',
  actorRole: 'EMPLOYEE',
  actorEmployeeId: 'emp-1',
  routeStatus: 'IN_PROGRESS',
  routeEmployeeId: 'emp-1',
};

describe('evaluateVisitCheckIn', () => {
  it('permite ASSIGNED + rota IN_PROGRESS do próprio EMPLOYEE', () => {
    expect(evaluateVisitCheckIn(base)).toEqual({ ok: true });
  });

  it('permite IN_ROUTE + rota IN_PROGRESS', () => {
    expect(evaluateVisitCheckIn({ ...base, visitStatus: 'IN_ROUTE' })).toEqual({ ok: true });
  });

  it('recusa COMPLETED', () => {
    const r = evaluateVisitCheckIn({ ...base, visitStatus: 'COMPLETED' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.statusCode).toBe(422);
      expect(r.code).toBe('VISIT_CHECKIN_NOT_ALLOWED');
    }
  });

  it('recusa CANCELLED', () => {
    const r = evaluateVisitCheckIn({ ...base, visitStatus: 'CANCELLED' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('VISIT_CHECKIN_NOT_ALLOWED');
  });

  it('recusa segundo check-in (409)', () => {
    const r = evaluateVisitCheckIn({ ...base, checkedInAt: new Date() });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.statusCode).toBe(409);
      expect(r.code).toBe('VISIT_ALREADY_CHECKED_IN');
    }
  });

  it('recusa visita de outro EMPLOYEE (403)', () => {
    const r = evaluateVisitCheckIn({ ...base, visitEmployeeId: 'emp-2' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.statusCode).toBe(403);
      expect(r.code).toBe('VISIT_FORBIDDEN');
    }
  });

  it('recusa rota que não está IN_PROGRESS', () => {
    const r = evaluateVisitCheckIn({ ...base, routeStatus: 'PUBLISHED' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.statusCode).toBe(422);
      expect(r.code).toBe('ROUTE_NOT_IN_PROGRESS');
    }
  });

  it('recusa visita de outro tenant (não encontrada no companyId)', () => {
    const r = evaluateVisitCheckIn({ ...base, visitFoundInTenant: false });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.statusCode).toBe(404);
      expect(r.code).toBe('VISIT_NOT_FOUND');
    }
  });

  it('ADMIN não faz check-in', () => {
    const r = evaluateVisitCheckIn({ ...base, actorRole: 'ADMIN' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.statusCode).toBe(403);
      expect(r.code).toBe('AUTH_FORBIDDEN');
    }
  });

  it('MANAGER não faz check-in', () => {
    const r = evaluateVisitCheckIn({ ...base, actorRole: 'MANAGER' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('AUTH_FORBIDDEN');
  });
});
