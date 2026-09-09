import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  effectiveNavSpeedMs,
  LIVE_SPEED_MIN_M_S,
  NAV_FALLBACK_SPEED_M_S,
  remainingFromCurrentPosition,
  type LngLat,
} from './nav-geometry';

/** ~2 km no equador (1° lng ≈ 111,32 km). */
const TWO_KM_LNG = 2000 / 111_320;
const line2km: LngLat[] = [
  [0, 0],
  [TWO_KM_LNG, 0],
];
const startGps = { latitude: 0, longitude: 0 };
const dest = { latitude: 0, longitude: TWO_KM_LNG };

describe('effectiveNavSpeedMs', () => {
  it('usa a velocidade ao vivo quando está andando', () => {
    assert.equal(effectiveNavSpeedMs({ speedMs: 20, lastGoodSpeedMs: 10 }), 20);
  });

  it('usa a última boa quando parado', () => {
    assert.equal(effectiveNavSpeedMs({ speedMs: 0, lastGoodSpeedMs: 20 }), 20);
  });

  it('cai no fallback ~30 km/h sem velocidade', () => {
    assert.equal(
      effectiveNavSpeedMs({ speedMs: null, lastGoodSpeedMs: null }),
      NAV_FALLBACK_SPEED_M_S,
    );
    assert.equal(LIVE_SPEED_MIN_M_S, 2);
  });
});

describe('remainingFromCurrentPosition', () => {
  it('2 km restantes a 72 km/h → ~100 s (não usa duração congelada)', () => {
    const rem = remainingFromCurrentPosition({
      gps: startGps,
      lineCoords: line2km,
      flatSteps: [
        {
          distanceMeters: 2000,
          durationSeconds: 99_999,
          name: 'Siga a rota',
          maneuver: { type: 'arrive', modifier: null, location: [TWO_KM_LNG, 0] },
          legIndex: 0,
          stepIndex: 0,
          startAlongMeters: 0,
          endAlongMeters: 2000,
        },
      ],
      nextStop: dest,
      remainingStops: [dest],
      plannedDistanceMeters: 2000,
      plannedDurationSeconds: 99_999,
      speedMs: 20,
    });
    assert.ok(rem.remainingDistance > 1_900);
    assert.ok(rem.remainingDistance < 2_100);
    assert.ok(rem.remainingDuration > 90);
    assert.ok(rem.remainingDuration < 110);
  });

  it('velocidade 0 / null não herda a duração da gravação', () => {
    const rem = remainingFromCurrentPosition({
      gps: startGps,
      lineCoords: line2km,
      flatSteps: [],
      nextStop: dest,
      remainingStops: [dest],
      plannedDurationSeconds: 99_999,
      plannedDistanceMeters: 2000,
      speedMs: 0,
      lastGoodSpeedMs: null,
    });
    const expected = rem.remainingDistance / NAV_FALLBACK_SPEED_M_S;
    assert.ok(Math.abs(rem.remainingDuration - expected) < 1e-6);
    assert.ok(rem.remainingDuration < 1_000);
  });
});
