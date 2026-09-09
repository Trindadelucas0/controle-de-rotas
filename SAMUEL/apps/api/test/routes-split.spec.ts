import {
  pickEmployeeDispatchPosition,
  type LastKnownEmployeePosition,
} from '../src/modules/routes/routes-split';

const company = { latitude: -23.55, longitude: -46.63 };
const lastKnown: LastKnownEmployeePosition = {
  latitude: -22.9,
  longitude: -47.05,
  recordedAt: '2026-09-09T12:00:00.000Z',
  source: 'live',
};

describe('pickEmployeeDispatchPosition', () => {
  it('COMPANY ignora GPS e usa o pin da empresa', () => {
    const picked = pickEmployeeDispatchPosition('COMPANY', lastKnown, company);
    expect(picked.source).toBe('company');
    expect(picked.position).toEqual(company);
    expect(picked.recordedAt).toBeNull();
  });

  it('EMPLOYEE_LAST usa Redis/histórico quando existe', () => {
    const picked = pickEmployeeDispatchPosition('EMPLOYEE_LAST', lastKnown, company);
    expect(picked.source).toBe('live');
    expect(picked.position).toEqual({
      latitude: lastKnown.latitude,
      longitude: lastKnown.longitude,
    });
    expect(picked.recordedAt).toBe(lastKnown.recordedAt);
  });

  it('EMPLOYEE_LAST sem GPS cai no pin da empresa', () => {
    const picked = pickEmployeeDispatchPosition('EMPLOYEE_LAST', null, company);
    expect(picked.source).toBe('company_fallback');
    expect(picked.position).toEqual(company);
    expect(picked.recordedAt).toBeNull();
  });

  it('EMPLOYEE_LAST com histórico (não live) usa tracking_history', () => {
    const hist: LastKnownEmployeePosition = {
      ...lastKnown,
      source: 'tracking_history',
    };
    const picked = pickEmployeeDispatchPosition('EMPLOYEE_LAST', hist, company);
    expect(picked.source).toBe('tracking_history');
    expect(picked.position.latitude).toBe(hist.latitude);
  });
});
