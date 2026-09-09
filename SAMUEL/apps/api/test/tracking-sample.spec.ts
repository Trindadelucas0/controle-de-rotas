import {
  HISTORY_MAX_INTERVAL_MS,
  HISTORY_MIN_MOVE_M,
  HISTORY_RECORD_TRIP_MAX_INTERVAL_MS,
  HISTORY_RECORD_TRIP_MIN_MOVE_M,
  shouldPersistTrackingSample,
  trackingSampleThresholds,
} from '../src/modules/tracking/tracking-sample.util';

describe('trackingSampleThresholds', () => {
  it('rota normal usa 25 m / 15 s', () => {
    expect(trackingSampleThresholds(false)).toEqual({
      minMoveM: HISTORY_MIN_MOVE_M,
      maxIntervalMs: HISTORY_MAX_INTERVAL_MS,
    });
  });

  it('recordTrip usa 5 m / 2 s', () => {
    expect(trackingSampleThresholds(true)).toEqual({
      minMoveM: HISTORY_RECORD_TRIP_MIN_MOVE_M,
      maxIntervalMs: HISTORY_RECORD_TRIP_MAX_INTERVAL_MS,
    });
  });
});

describe('shouldPersistTrackingSample', () => {
  const last = { latitude: -15.8, longitude: -48.0, at: 1_000_000 };

  it('persiste o primeiro ponto', () => {
    expect(
      shouldPersistTrackingSample({
        last: null,
        latitude: -15.8,
        longitude: -48.0,
        recordedAtMs: 1_000_000,
        recordTrip: false,
        distanceMeters: 0,
      }),
    ).toBe(true);
  });

  it('rota normal não persiste 10 m em 5 s', () => {
    expect(
      shouldPersistTrackingSample({
        last,
        latitude: -15.8,
        longitude: -48.0,
        recordedAtMs: last.at + 5_000,
        recordTrip: false,
        distanceMeters: 10,
      }),
    ).toBe(false);
  });

  it('recordTrip persiste 5 m ou 2 s', () => {
    expect(
      shouldPersistTrackingSample({
        last,
        latitude: -15.8,
        longitude: -48.0,
        recordedAtMs: last.at + 2_000,
        recordTrip: true,
        distanceMeters: 1,
      }),
    ).toBe(true);
    expect(
      shouldPersistTrackingSample({
        last,
        latitude: -15.8,
        longitude: -48.0,
        recordedAtMs: last.at + 500,
        recordTrip: true,
        distanceMeters: 5,
      }),
    ).toBe(true);
  });
});
