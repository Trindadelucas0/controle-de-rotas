import { RouteStopStatus } from '@prisma/client';
import {
  canCompleteAsFinished,
  remainingPlannedMeters,
  ROUTE_COMPLETE_REMAINING_TOLERANCE_METERS,
} from '../src/modules/routes/route-complete.util';

describe('route-complete.util', () => {
  it('remaining 0 when no pending', () => {
    expect(
      remainingPlannedMeters([
        {
          status: RouteStopStatus.COMPLETED,
          sequence: 1,
          latitude: -23,
          longitude: -46,
          plannedDistanceMeters: 1000,
        },
      ]),
    ).toBe(0);
  });

  it('sums planned distance of pending stops', () => {
    expect(
      remainingPlannedMeters([
        {
          status: RouteStopStatus.COMPLETED,
          sequence: 1,
          latitude: -23,
          longitude: -46,
          plannedDistanceMeters: 100,
        },
        {
          status: RouteStopStatus.PENDING,
          sequence: 2,
          latitude: -23.01,
          longitude: -46.01,
          plannedDistanceMeters: 200,
        },
        {
          status: RouteStopStatus.PENDING,
          sequence: 3,
          latitude: -23.02,
          longitude: -46.02,
          plannedDistanceMeters: 250,
        },
      ]),
    ).toBe(450);
  });

  it('within 500m allows finished', () => {
    expect(canCompleteAsFinished(450, 2)).toBe(true);
    expect(canCompleteAsFinished(ROUTE_COMPLETE_REMAINING_TOLERANCE_METERS, 1)).toBe(true);
    expect(canCompleteAsFinished(501, 1)).toBe(false);
    expect(canCompleteAsFinished(null, 1)).toBe(false);
    expect(canCompleteAsFinished(null, 0)).toBe(true);
  });
});
