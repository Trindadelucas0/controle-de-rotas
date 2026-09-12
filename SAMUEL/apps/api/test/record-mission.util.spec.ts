import { normalizeRecordCustomerName, MAX_RECORD_POINTS } from '../src/modules/routes/record-mission.util';

describe('record-mission.util', () => {
  it('rejeita nome curto', () => {
    expect(normalizeRecordCustomerName('A')).toBeNull();
    expect(normalizeRecordCustomerName('  ')).toBeNull();
  });

  it('aceita nome de fazenda', () => {
    expect(normalizeRecordCustomerName('  São João  ')).toBe('São João');
  });

  it('teto de pontos é 25', () => {
    expect(MAX_RECORD_POINTS).toBe(25);
  });
});
