import { evaluateVisitCheckOut } from '../src/modules/visits/visit-state';

const base = {
  visitFoundInTenant: true,
  visitStatus: 'IN_PROGRESS',
  checkedInAt: new Date(),
  checkedOutAt: null as Date | null,
  visitEmployeeId: 'emp-1',
  actorRole: 'EMPLOYEE',
  actorEmployeeId: 'emp-1',
  routeStatus: 'IN_PROGRESS',
  routeEmployeeId: 'emp-1',
  outcome: 'DONE' as const,
  evidenceCount: 1,
  executionNotes: 'Tudo ok',
  nextVisitScheduledStart: undefined as string | undefined,
};

describe('evaluateVisitCheckOut', () => {
  it('permite DONE com foto', () => {
    expect(evaluateVisitCheckOut(base)).toEqual({ ok: true });
  });

  it('recusa DONE sem foto', () => {
    const r = evaluateVisitCheckOut({ ...base, evidenceCount: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('VISIT_EVIDENCE_REQUIRED');
  });

  it('exige observações quando não é DONE', () => {
    const r = evaluateVisitCheckOut({
      ...base,
      outcome: 'NO_CONTACT',
      evidenceCount: 0,
      executionNotes: '',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('VISIT_EXECUTION_NOTES_REQUIRED');
  });

  it('exige próxima visita para FOLLOW_UP', () => {
    const r = evaluateVisitCheckOut({
      ...base,
      outcome: 'FOLLOW_UP',
      evidenceCount: 0,
      executionNotes: 'Cliente pediu retorno',
      nextVisitScheduledStart: undefined,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('VISIT_NEXT_SCHEDULE_REQUIRED');
  });

  it('recusa check-out sem check-in', () => {
    const r = evaluateVisitCheckOut({ ...base, checkedInAt: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('VISIT_CHECKIN_REQUIRED');
  });

  it('recusa segundo check-out', () => {
    const r = evaluateVisitCheckOut({ ...base, checkedOutAt: new Date() });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('VISIT_ALREADY_CHECKED_OUT');
  });
});
